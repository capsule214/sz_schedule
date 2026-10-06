<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdPlan;
use App\Models\KsSystemLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PlanDprController extends Controller
{
  private const TASK_IDS = [20001, 20002, 20003, 20004];

  private function dprSalesExpression(): string
  {
    return DB::connection()->getDriverName() === 'sqlite'
      ? 'substr(m_dpr.dprno, 1, 2)'
      : 'LEFT(m_dpr.dprno, 2)';
  }

  private function dprPublishExpression(): string
  {
    return match (DB::connection()->getDriverName()) {
      'pgsql' => 'SUBSTRING(m_dpr.dprno FROM 3 FOR 2)',
      'sqlite' => 'substr(m_dpr.dprno, 3, 2)',
      default => 'SUBSTRING(m_dpr.dprno, 3, 2)',
    };
  }

  private function minShipDatesQuery()
  {
    return DB::table('r_dprno_serialno2 as related_ship_serial')
      ->leftJoin('vd_all_order as related_order', 'related_order.order_no', '=', 'related_ship_serial.receno')
      ->where('related_order.deleted', 0)
      ->groupBy('related_ship_serial.dprno', 'related_order.deleted')
      ->selectRaw('related_ship_serial.dprno, MIN(related_order.shipping_date) as min_date');
  }

  private function minShipDateForDpr(string $dprNo): mixed
  {
    return DB::table('r_dprno_serialno2 as related_ship_serial')
      ->leftJoin('vd_all_order as related_order', 'related_order.order_no', '=', 'related_ship_serial.receno')
      ->where('related_order.deleted', 0)
      ->where('related_ship_serial.dprno', $dprNo)
      ->min('related_order.shipping_date');
  }

  private function applyCategoryFilters($query, array $data): void
  {
    if (! empty($data['formtype'])) {
      $query->whereIn('formtype', array_map('intval', $data['formtype']));
    }
    if (! empty($data['deliverytype'])) {
      $query->whereIn('deliverytype', array_map('intval', $data['deliverytype']));
    }
    if (! empty($data['classification'])) {
      $query->whereIn('classification', $data['classification']);
    }
    if (! empty($data['status'])) {
      $query->whereIn('status', $data['status']);
    }
  }

  /** DPR No に関連する製番の製造グループで絞り込む。 */
  private function applySeizoGroupFilters($query, array $data): void
  {
    if (empty($data['seizo_group_ids'])) return;

    $seizoGroupIds = array_map('intval', $data['seizo_group_ids']);
    $query->whereExists(function ($relatedSerials) use ($seizoGroupIds) {
      $relatedSerials
        ->selectRaw('1')
        ->from('r_dprno_serialno2 as related_dpr_serial')
        ->leftJoin('kd_serial as related_serial', 'related_serial.order_no', '=', 'related_dpr_serial.receno')
        ->leftJoin('dk_equip_group as related_equip_group', 'related_equip_group.equip_group_id', '=', 'related_serial.seizo_group_id')
        ->whereColumn('related_dpr_serial.dprno', 'm_dpr.dprno')
        ->whereNotNull('related_serial.serial_id')
        ->whereIn('related_equip_group.equip_group_id', $seizoGroupIds);
    });
  }

  private function displayRules(): array
  {
    return [
      'machines' => 'nullable|array|max:500',
      'machines.*' => 'required|string|max:255',
      'from' => 'required|date',
      'to' => 'required|date|after_or_equal:from',
      'formtype' => 'nullable|array',
      'formtype.*' => 'integer|in:1,2,3',
      'deliverytype' => 'nullable|array',
      'deliverytype.*' => 'integer|in:1,2',
      'classification' => 'nullable|array',
      'classification.*' => 'string|max:50',
      'status' => 'nullable|array',
      'status.*' => 'string|max:100',
      'leader_user_nos' => 'nullable|array|max:500',
      'leader_user_nos.*' => 'required|string|max:32',
      'sales_locations' => 'nullable|array',
      'sales_locations.*' => ['string', 'regex:/^[A-Za-z]{2}$/'],
      'publication_years' => 'nullable|array',
      'publication_years.*' => ['string', 'regex:/^\d{2}$/'],
      'seizo_group_ids' => 'nullable|array|max:3',
      'seizo_group_ids.*' => 'integer|in:1,2,3',
      'display_order' => 'nullable|integer|in:0,1',
      'include_serial_plans' => 'nullable|boolean',
    ];
  }

  private function planRules(): array
  {
    return [
      'dprNo' => 'required|string|max:255',
      'userNo' => ['nullable', 'string', 'regex:/^\d{1,5}$/'],
      'taskId' => ['required', 'integer', Rule::in(self::TASK_IDS)],
      'startDate' => 'required|date',
      'endDate' => 'required|date|after_or_equal:startDate',
      'remark' => 'nullable|string',
    ];
  }

  private function planPayload(array $data): array
  {
    return [
      'serial_id' => -1,
      'morder_id' => -1,
      'dpr_no' => $data['dprNo'],
      'user_no' => ! empty($data['userNo']) ? str_pad($data['userNo'], 5, '0', STR_PAD_LEFT) : null,
      'task_id' => (int) $data['taskId'],
      'worker_id' => null,
      'educator_worker_id' => null,
      'start_date' => Carbon::parse($data['startDate'])->toDateString().' 08:30:00',
      'end_date' => Carbon::parse($data['endDate'])->toDateString().' 21:25:00',
      'planned_minutes' => 0,
      'price' => 0,
      'remark' => $data['remark'] ?? '',
    ];
  }

  private function formatPlan(KdPlan $plan): array
  {
    $task = $plan->km_task;

    return [
      'planId' => $plan->plan_id,
      'serialId' => $plan->serial_id,
      'morderId' => $plan->morder_id,
      'dprNo' => $plan->dpr_no,
      'userNo' => $plan->user_no,
      'taskId' => $plan->task_id,
      'taskName' => $task?->task_name ?? '',
      'taskBackColor' => $task?->back_color ?? 1,
      'taskFontColor' => $task?->font_color ?? 6,
      'startDate' => $plan->start_date,
      'endDate' => $plan->end_date,
      'workerId' => null,
      'teacherId' => null,
      'plannedMinutes' => $plan->planned_minutes ?? 0,
      'price' => $plan->price ?? 0,
      'remark' => $plan->remark ?? '',
      'updatedAt' => $plan->updated_at,
      'updatedAtVersion' => $plan->updated_at?->format('Y-m-d H:i:s.u'),
    ];
  }

  private function plansForDprNos($dprNos, string $from, string $to)
  {
    return KdPlan::with('km_task')
      ->whereIn('dpr_no', $dprNos)
      ->where('start_date', '<=', $to)
      ->where('end_date', '>=', $from)
      ->orderBy('start_date')
      ->get()
      ->map(fn (KdPlan $plan) => $this->formatPlan($plan));
  }

  /** DPRの機種に関連する製番予定を、製番・仕掛区分単位の期間へ集約する。 */
  private function serialPlansForDprNos($dprNos, array $seizoGroupIds = [])
  {
    if ($dprNos->isEmpty()) return collect();

    $relatedSerials = DB::table('m_dpr')
      ->join('dm_kisyu', 'dm_kisyu.kisyu_name', '=', 'm_dpr.machine')
      ->join('kd_serial', 'kd_serial.kisyu_id', '=', 'dm_kisyu.kisyu_id')
      ->whereIn('m_dpr.dprno', $dprNos)
      ->where('dm_kisyu.deleted', 0)
      ->where('kd_serial.deleted', 0)
      ->where('kd_serial.serial_no', '<>', '')
      ->select('m_dpr.dprno as dpr_no', 'kd_serial.serial_id', 'kd_serial.serial_no')
      ->distinct();
    if (! empty($seizoGroupIds)) {
      $relatedSerials->whereIn('kd_serial.seizo_group_id', array_map('intval', $seizoGroupIds));
    }

    return DB::query()
      ->fromSub($relatedSerials, 'related_serials')
      ->join('kd_plan', 'kd_plan.serial_id', '=', 'related_serials.serial_id')
      ->leftJoin('km_task', 'km_task.task_id', '=', 'kd_plan.task_id')
      ->leftJoin('kk_shikakari_type', 'kk_shikakari_type.shikakari_type_id', '=', 'km_task.shikakari_type_id')
      ->where('kd_plan.deleted', 0)
      ->whereNotNull('kk_shikakari_type.shikakari_type_name')
      ->selectRaw('related_serials.dpr_no, related_serials.serial_no, kk_shikakari_type.shikakari_type_name, kk_shikakari_type.sort_no, MIN(kd_plan.start_date) as start_date, MAX(kd_plan.end_date) as end_date')
      ->groupBy('related_serials.dpr_no', 'related_serials.serial_no', 'kk_shikakari_type.shikakari_type_name', 'kk_shikakari_type.sort_no')
      ->orderBy('related_serials.dpr_no')
      ->orderBy('related_serials.serial_no')
      ->orderBy('kk_shikakari_type.sort_no')
      ->get()
      ->map(fn ($plan) => [
        'dprNo' => $plan->dpr_no,
        'serialNo' => $plan->serial_no,
        'shikakariTypeName' => $plan->shikakari_type_name,
        'sortNo' => (int) $plan->sort_no,
        'startDate' => $plan->start_date,
        'endDate' => $plan->end_date,
      ]);
  }

  private function dprGroup(string $dprNo): ?array
  {
    $rows = DB::table('m_dpr')->where('dprno', $dprNo)->orderBy('machine')->get();
    if ($rows->isEmpty()) return null;

    $joinValues = static fn (string $column): string => $rows->pluck($column)
      ->filter(fn ($value) => $value !== null && $value !== '')
      ->map(fn ($value) => (string) $value)
      ->unique()
      ->implode(' / ');
    $first = $rows->first();

    return [
      'id' => $dprNo,
      'dprNo' => $dprNo,
      'machine' => $joinValues('machine'),
      'deliveryType' => $joinValues('deliverytype'),
      'qty' => $joinValues('qty'),
      'leaderUserNo' => $joinValues('dprleader_sytx'),
      'classification' => $joinValues('classification'),
      'status' => (string) ($first->status ?? ''),
      'mechanismUserNo' => $joinValues('mechanism_sytx'),
      'customerName' => $joinValues('customer_name'),
      'electricityUserNo' => $joinValues('electricity_sytx'),
      'subject' => $joinValues('subject'),
      'softUserNo' => $joinValues('soft_sytx'),
    ];
  }

  public function groups(Request $request)
  {
    $data = $request->validate([
      ...$this->displayRules(),
      'machines' => 'required|array|min:1|max:500',
      'after_dpr_no' => 'nullable|string|max:255',
      'after_ship_date' => 'nullable|date',
      'after_ship_date_null' => 'nullable|boolean',
      'at_or_after_dpr_no' => 'nullable|string|max:255',
      'limit' => 'nullable|integer|min:1|max:500',
    ]);
    $limit = (int) ($data['limit'] ?? 200);
    $displayOrder = (int) ($data['display_order'] ?? 0);

    $query = DB::table('m_dpr')
      ->whereIn('m_dpr.machine', $data['machines'])
      ->whereNotNull('m_dpr.dprno')
      ->where('m_dpr.dprno', '<>', '');
    if ($displayOrder === 1) {
      $query->leftJoinSub($this->minShipDatesQuery(), 'min_ship_date', function ($join) {
        $join->on('min_ship_date.dprno', '=', 'm_dpr.dprno');
      });
    }
    $this->applyCategoryFilters($query, $data);
    $this->applySeizoGroupFilters($query, $data);
    if (! empty($data['leader_user_nos'])) $query->whereIn('dprleader_sytx', $data['leader_user_nos']);
    if (! empty($data['sales_locations'])) $query->whereIn(DB::raw($this->dprSalesExpression()), $data['sales_locations']);
    if (! empty($data['publication_years'])) $query->whereIn(DB::raw($this->dprPublishExpression()), $data['publication_years']);
    if ($displayOrder === 1 && ! empty($data['after_dpr_no'])) {
      $afterDprNo = $data['after_dpr_no'];
      if (! empty($data['after_ship_date_null'])) {
        $query->whereNull('min_ship_date.min_date')->where('m_dpr.dprno', '>', $afterDprNo);
      } else {
        $afterShipDate = $data['after_ship_date'];
        $query->where(function ($cursor) use ($afterShipDate, $afterDprNo) {
          $cursor->where('min_ship_date.min_date', '>', $afterShipDate)
            ->orWhere(function ($sameDate) use ($afterShipDate, $afterDprNo) {
              $sameDate->where('min_ship_date.min_date', $afterShipDate)
                ->where('m_dpr.dprno', '>', $afterDprNo);
            })
            ->orWhereNull('min_ship_date.min_date');
        });
      }
    } elseif ($displayOrder === 1 && ! empty($data['at_or_after_dpr_no'])) {
      $targetDprNo = $data['at_or_after_dpr_no'];
      $targetShipDate = $this->minShipDateForDpr($targetDprNo);
      if ($targetShipDate === null) {
        $query->whereNull('min_ship_date.min_date')->where('m_dpr.dprno', '>=', $targetDprNo);
      } else {
        $query->where(function ($cursor) use ($targetShipDate, $targetDprNo) {
          $cursor->where('min_ship_date.min_date', '>', $targetShipDate)
            ->orWhere(function ($sameDate) use ($targetShipDate, $targetDprNo) {
              $sameDate->where('min_ship_date.min_date', $targetShipDate)
                ->where('m_dpr.dprno', '>=', $targetDprNo);
            })
            ->orWhereNull('min_ship_date.min_date');
        });
      }
    } elseif (! empty($data['after_dpr_no'])) {
      $query->where('m_dpr.dprno', '>', $data['after_dpr_no']);
    } elseif (! empty($data['at_or_after_dpr_no'])) {
      $query->where('m_dpr.dprno', '>=', $data['at_or_after_dpr_no']);
    }

    if ($displayOrder === 1) {
      $dprRows = $query
        ->selectRaw('m_dpr.dprno, min_ship_date.min_date, CASE WHEN min_ship_date.min_date IS NULL THEN 1 ELSE 0 END as ship_date_missing')
        ->distinct()
        ->orderBy('ship_date_missing')
        ->orderBy('min_ship_date.min_date')
        ->orderBy('m_dpr.dprno')
        ->limit($limit + 1)
        ->get();
    } else {
      $dprRows = $query->select('m_dpr.dprno')->distinct()->orderBy('m_dpr.dprno')->limit($limit + 1)->get();
    }
    $hasMore = $dprRows->count() > $limit;
    $pageRows = $dprRows->take($limit)->values();
    $pageDprNos = $pageRows->pluck('dprno');
    if ($pageDprNos->isEmpty()) {
      return response()->json(['groups' => [], 'plans' => [], 'serialPlans' => [], 'hasMore' => false, 'nextCursor' => null]);
    }

    $masterRows = DB::table('m_dpr')->whereIn('dprno', $pageDprNos)->orderBy('dprno')->orderBy('machine')->get();
    $rowsByDprNo = $masterRows->groupBy('dprno');
    $joinValues = static fn ($rows, string $column): string => $rows->pluck($column)
      ->filter(fn ($value) => $value !== null && $value !== '')
      ->map(fn ($value) => (string) $value)
      ->unique()
      ->implode(' / ');
    $groups = $pageDprNos->map(function ($dprNo) use ($rowsByDprNo, $joinValues) {
      $rows = $rowsByDprNo->get($dprNo, collect());
      $first = $rows->first();
      return [
        'id' => $dprNo,
        'dprNo' => $dprNo,
        'machine' => $joinValues($rows, 'machine'),
        'deliveryType' => $joinValues($rows, 'deliverytype'),
        'qty' => $joinValues($rows, 'qty'),
        'leaderUserNo' => $joinValues($rows, 'dprleader_sytx'),
        'classification' => $joinValues($rows, 'classification'),
        'status' => (string) ($first->status ?? ''),
        'mechanismUserNo' => $joinValues($rows, 'mechanism_sytx'),
        'customerName' => $joinValues($rows, 'customer_name'),
        'electricityUserNo' => $joinValues($rows, 'electricity_sytx'),
        'subject' => $joinValues($rows, 'subject'),
        'softUserNo' => $joinValues($rows, 'soft_sytx'),
      ];
    });

    return response()->json([
      'groups' => $groups,
      'plans' => $this->plansForDprNos($pageDprNos, $data['from'], $data['to']),
      'serialPlans' => ! empty($data['include_serial_plans'])
        ? $this->serialPlansForDprNos($pageDprNos, $data['seizo_group_ids'] ?? [])
        : [],
      'hasMore' => $hasMore,
      'nextCursor' => $hasMore ? [
        'dprNo' => $pageRows->last()->dprno,
        'minShipDate' => $displayOrder === 1 ? $pageRows->last()->min_date : null,
      ] : null,
    ]);
  }

  public function search(Request $request)
  {
    $data = $request->validate([
      ...$this->displayRules(),
      'dprNo' => 'required|string|max:255',
    ]);
    $dprNo = trim($data['dprNo']);
    $group = $this->dprGroup($dprNo);
    if ($group === null) return response()->json(['found' => false]);

    $filtered = DB::table('m_dpr')->where('dprno', $dprNo)->whereIn('machine', $data['machines'] ?? []);
    $this->applyCategoryFilters($filtered, $data);
    $this->applySeizoGroupFilters($filtered, $data);
    if (! empty($data['leader_user_nos'])) $filtered->whereIn('dprleader_sytx', $data['leader_user_nos']);
    if (! empty($data['sales_locations'])) $filtered->whereIn(DB::raw($this->dprSalesExpression()), $data['sales_locations']);
    if (! empty($data['publication_years'])) $filtered->whereIn(DB::raw($this->dprPublishExpression()), $data['publication_years']);

    return response()->json([
      'found' => true,
      'dprNo' => $dprNo,
      'inDisplaySettings' => $filtered->exists(),
      'group' => $group,
      'plans' => $this->plansForDprNos([$dprNo], $data['from'], $data['to']),
      'serialPlans' => ! empty($data['include_serial_plans'])
        ? $this->serialPlansForDprNos(collect([$dprNo]), $data['seizo_group_ids'] ?? [])
        : [],
    ]);
  }

  public function checkUpdates(Request $request)
  {
    $data = $request->validate([
      'updates' => 'required|array',
      'updates.*.id' => 'required|integer|min:1',
      'updates.*.updatedAt' => 'nullable|string|max:64',
    ]);
    $versions = KdPlan::whereNotNull('dpr_no')
      ->where('dpr_no', '<>', '')
      ->whereIn('plan_id', collect($data['updates'])->pluck('id'))
      ->get(['plan_id', 'updated_at'])
      ->mapWithKeys(fn (KdPlan $plan) => [(int) $plan->plan_id => $this->normalizeVersion($plan->updated_at)]);
    $conflictIds = collect($data['updates'])
      ->filter(fn (array $update) => ! $versions->has((int) $update['id'])
        || $versions->get((int) $update['id']) !== $this->normalizeVersion($update['updatedAt'] ?? null))
      ->pluck('id')->map(fn ($id) => (int) $id)->values();

    return response()->json(['conflictIds' => $conflictIds]);
  }

  private function normalizeVersion(mixed $value): ?string
  {
    if ($value === null || $value === '') return null;

    try {
      return Carbon::parse($value)->utc()->format('Y-m-d H:i:s.u');
    } catch (\Throwable) {
      return null;
    }
  }

  public function store(Request $request)
  {
    $payload = [...$this->planPayload($request->validate($this->planRules())), 'deleted' => 0];
    $plan = DB::transaction(function () use ($payload) {
      $plan = KdPlan::create($payload);
      KsSystemLog::record($plan->plan_id, $payload);
      return $plan;
    });
    $plan->load('km_task');

    return response()->json($this->formatPlan($plan), 201);
  }

  public function update(Request $request, int $id)
  {
    $plan = KdPlan::whereNotNull('dpr_no')->where('dpr_no', '<>', '')->findOrFail($id);
    $plan->fill($this->planPayload($request->validate($this->planRules())));
    $diff = $plan->getDirty();
    DB::transaction(function () use ($plan, $diff) {
      $plan->save();
      if (! empty($diff)) KsSystemLog::record($plan->plan_id, $diff);
    });
    $plan->load('km_task');

    return response()->json($this->formatPlan($plan));
  }

  public function destroy(Request $request)
  {
    $data = $request->validate(['ids' => 'required|array|min:1', 'ids.*' => 'integer|min:1']);
    $targetIds = KdPlan::whereNotNull('dpr_no')->where('dpr_no', '<>', '')->whereIn('plan_id', $data['ids'])->pluck('plan_id')->all();
    $deleted = DB::transaction(function () use ($targetIds) {
      $deleted = KdPlan::whereIn('plan_id', $targetIds)->update(['deleted' => 1, 'updated_at' => now()]);
      KsSystemLog::recordMany($targetIds, ['deleted' => 1]);
      return $deleted;
    });

    return response()->json(['deleted' => $deleted]);
  }

  public function destroyOne(int $id)
  {
    $plan = KdPlan::whereNotNull('dpr_no')->where('dpr_no', '<>', '')->findOrFail($id);
    DB::transaction(function () use ($plan) {
      $plan->update(['deleted' => 1]);
      KsSystemLog::record($plan->plan_id, ['deleted' => 1]);
    });

    return response()->json(['deleted' => 1]);
  }
}
