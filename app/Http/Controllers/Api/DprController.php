<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DprController extends Controller
{
  private function dprSalesExpression(): string
  {
    return DB::connection()->getDriverName() === 'sqlite'
      ? 'substr(dprno, 1, 2)'
      : 'LEFT(dprno, 2)';
  }

  private function dprPublishExpression(): string
  {
    return match (DB::connection()->getDriverName()) {
      'pgsql' => 'SUBSTRING(dprno FROM 3 FOR 2)',
      'sqlite' => 'substr(dprno, 3, 2)',
      default => 'SUBSTRING(dprno, 3, 2)',
    };
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

  private function dprGroup(string $dprNo): ?array
  {
    $rows = DB::table('m_dpr')
      ->where('dprno', $dprNo)
      ->orderBy('machine')
      ->get();
    if ($rows->isEmpty()) {
      return null;
    }

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

  private function plansForDpr(string $dprNo, string $from, string $to)
  {
    return DB::table('kd_plan')
      ->leftJoin('km_task', 'km_task.task_id', '=', 'kd_plan.task_id')
      ->where('kd_plan.deleted', 0)
      ->where('kd_plan.dpr_no', $dprNo)
      ->where('kd_plan.start_date', '<=', $to)
      ->where('kd_plan.end_date', '>=', $from)
      ->orderBy('kd_plan.start_date')
      ->get([
        'kd_plan.plan_id', 'kd_plan.dpr_no', 'kd_plan.task_id', 'kd_plan.user_no',
        'kd_plan.start_date', 'kd_plan.end_date', 'kd_plan.remark', 'kd_plan.updated_at',
        'km_task.task_name', 'km_task.back_color', 'km_task.font_color',
      ])
      ->map(fn ($plan) => [
        'planId' => $plan->plan_id,
        'dprNo' => $plan->dpr_no,
        'taskId' => $plan->task_id,
        'taskName' => $plan->task_name ?? '',
        'taskBackColor' => $plan->back_color ?? 1,
        'taskFontColor' => $plan->font_color ?? 6,
        'userNo' => $plan->user_no,
        'startDate' => $plan->start_date,
        'endDate' => $plan->end_date,
        'remark' => $plan->remark ?? '',
        'updatedAt' => $plan->updated_at,
        'updatedAtVersion' => $plan->updated_at ? Carbon::parse($plan->updated_at)->format('Y-m-d H:i:s.u') : null,
      ]);
  }

  /** DPR Noを完全一致検索し、表示設定の対象内かどうかと単独表示用データを返す。 */
  public function search(Request $request)
  {
    $data = $request->validate([
      'dprNo' => 'required|string|max:255',
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
    ]);
    $dprNo = trim($data['dprNo']);
    $group = $this->dprGroup($dprNo);
    if ($group === null) {
      return response()->json(['found' => false]);
    }

    $filtered = DB::table('m_dpr')
      ->where('dprno', $dprNo)
      ->whereIn('machine', $data['machines'] ?? []);
    $this->applyCategoryFilters($filtered, $data);
    if (! empty($data['leader_user_nos'])) {
      $filtered->whereIn('dprleader_sytx', $data['leader_user_nos']);
    }
    if (! empty($data['sales_locations'])) {
      $filtered->whereIn(DB::raw($this->dprSalesExpression()), $data['sales_locations']);
    }
    if (! empty($data['publication_years'])) {
      $filtered->whereIn(DB::raw($this->dprPublishExpression()), $data['publication_years']);
    }

    return response()->json([
      'found' => true,
      'dprNo' => $dprNo,
      'inDisplaySettings' => $filtered->exists(),
      'group' => $group,
      'plans' => $this->plansForDpr($dprNo, $data['from'], $data['to']),
    ]);
  }

  /** DPR Noの機種名から機種マスタを介して、関連する製番を返す。 */
  public function relatedSerials(Request $request)
  {
    $data = $request->validate([
      'dprNo' => 'required|string|max:255',
    ]);

    $serials = DB::table('m_dpr')
      ->join('dm_kisyu', 'dm_kisyu.kisyu_name', '=', 'm_dpr.machine')
      ->join('kd_serial', 'kd_serial.kisyu_id', '=', 'dm_kisyu.kisyu_id')
      ->where('m_dpr.dprno', $data['dprNo'])
      ->where('dm_kisyu.deleted', 0)
      ->where('kd_serial.deleted', 0)
      ->where('kd_serial.serial_no', '<>', '')
      ->select('kd_serial.serial_no', 'kd_serial.order_no')
      ->distinct()
      ->orderBy('kd_serial.serial_no')
      ->orderBy('kd_serial.order_no')
      ->get()
      ->map(fn ($serial) => [
        'serialNo' => $serial->serial_no,
        'receiptNo' => $serial->order_no,
      ]);

    return response()->json($serials);
  }

  /** 選択機種に属するDPR Noグループと、表示期間内の予定をカーソルページングで返す。 */
  public function groups(Request $request)
  {
    $data = $request->validate([
      'machines' => 'required|array|min:1|max:500',
      'machines.*' => 'required|string|max:255',
      'from' => 'required|date',
      'to' => 'required|date|after_or_equal:from',
      'after_dpr_no' => 'nullable|string|max:255',
      'at_or_after_dpr_no' => 'nullable|string|max:255',
      'limit' => 'nullable|integer|min:1|max:500',
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
    ]);
    $limit = (int) ($data['limit'] ?? 200);

    // OFFSETは100万件規模で遅くなるため、(machine, dprno)索引を使うカーソル方式にする。
    $dprNoQuery = DB::table('m_dpr')
      ->whereIn('machine', $data['machines'])
      ->whereNotNull('dprno')
      ->where('dprno', '<>', '');
    $this->applyCategoryFilters($dprNoQuery, $data);
    if (! empty($data['leader_user_nos'])) {
      $dprNoQuery->whereIn('dprleader_sytx', $data['leader_user_nos']);
    }
    if (! empty($data['sales_locations'])) {
      $dprNoQuery->whereIn(DB::raw($this->dprSalesExpression()), $data['sales_locations']);
    }
    if (! empty($data['publication_years'])) {
      $dprNoQuery->whereIn(DB::raw($this->dprPublishExpression()), $data['publication_years']);
    }
    if (! empty($data['after_dpr_no'])) {
      $dprNoQuery->where('dprno', '>', $data['after_dpr_no']);
    } elseif (! empty($data['at_or_after_dpr_no'])) {
      $dprNoQuery->where('dprno', '>=', $data['at_or_after_dpr_no']);
    }
    $dprNos = $dprNoQuery
      ->select('dprno')
      ->distinct()
      ->orderBy('dprno')
      ->limit($limit + 1)
      ->pluck('dprno');

    $hasMore = $dprNos->count() > $limit;
    $pageDprNos = $dprNos->take($limit)->values();
    if ($pageDprNos->isEmpty()) {
      return response()->json(['groups' => [], 'plans' => [], 'hasMore' => false, 'nextCursor' => null]);
    }

    // 同一DPR Noに複数機種・複数行が存在するため、該当するマスタ行をDPR No単位に集約する。
    $masterRows = DB::table('m_dpr')
      ->whereIn('dprno', $pageDprNos)
      ->orderBy('dprno')
      ->orderBy('machine')
      ->get();

    $joinValues = static function ($rows, string $column): string {
      return $rows->pluck($column)
        ->filter(fn ($value) => $value !== null && $value !== '')
        ->map(fn ($value) => (string) $value)
        ->unique()
        ->implode(' / ');
    };
    $rowsByDprNo = $masterRows->groupBy('dprno');
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

    $plans = DB::table('kd_plan')
      ->leftJoin('km_task', 'km_task.task_id', '=', 'kd_plan.task_id')
      ->where('kd_plan.deleted', 0)
      ->whereIn('kd_plan.dpr_no', $pageDprNos)
      ->where('kd_plan.start_date', '<=', $data['to'])
      ->where('kd_plan.end_date', '>=', $data['from'])
      ->orderBy('kd_plan.start_date')
      ->get([
        'kd_plan.plan_id', 'kd_plan.dpr_no', 'kd_plan.task_id', 'kd_plan.user_no',
        'kd_plan.start_date', 'kd_plan.end_date', 'kd_plan.remark', 'kd_plan.updated_at',
        'km_task.task_name', 'km_task.back_color', 'km_task.font_color',
      ])
      ->map(fn ($plan) => [
        'planId' => $plan->plan_id,
        'dprNo' => $plan->dpr_no,
        'taskId' => $plan->task_id,
        'taskName' => $plan->task_name ?? '',
        'taskBackColor' => $plan->back_color ?? 1,
        'taskFontColor' => $plan->font_color ?? 6,
        'userNo' => $plan->user_no,
        'startDate' => $plan->start_date,
        'endDate' => $plan->end_date,
        'remark' => $plan->remark ?? '',
        'updatedAt' => $plan->updated_at,
        'updatedAtVersion' => $plan->updated_at ? Carbon::parse($plan->updated_at)->format('Y-m-d H:i:s.u') : null,
      ]);

    return response()->json([
      'groups' => $groups,
      'plans' => $plans,
      'hasMore' => $hasMore,
      'nextCursor' => $hasMore ? $pageDprNos->last() : null,
    ]);
  }

  /** m_dpr.machine の重複排除済み昇順リストを返す */
  public function machines()
  {
    $machines = DB::table('m_dpr')
      ->select('machine')
      ->whereNotNull('machine')
      ->where('machine', '<>', '')
      ->groupBy('machine')
      ->orderBy('machine')
      ->pluck('machine')
      ->values()
      ->all();

    return response()->json($machines);
  }

  /** m_dpr.dprno 先頭のアルファベット部分（営業拠点コード）を重複排除して返す */
  public function salesLocations()
  {
    $expression = $this->dprSalesExpression();
    $locations = DB::table('m_dpr')
      ->whereNotNull('dprno')
      ->where('dprno', '<>', '')
      ->selectRaw("{$expression} as dprsales")
      ->groupByRaw($expression)
      ->orderBy('dprsales')
      ->pluck('dprsales')
      ->filter()
      ->values()
      ->all();

    return response()->json($locations);
  }

  /** m_dpr.dprno のアルファベット直後の2桁（発行年）を重複排除して返す */
  public function publicationYears()
  {
    $expression = $this->dprPublishExpression();
    $years = DB::table('m_dpr')
      ->whereNotNull('dprno')
      ->where('dprno', '<>', '')
      ->selectRaw("{$expression} as dprpublish")
      ->groupByRaw($expression)
      ->orderByDesc('dprpublish')
      ->pluck('dprpublish')
      ->filter()
      ->values()
      ->all();

    return response()->json($years);
  }

  /**
   * 受注形態・出荷形態・種別・ステータスで絞り込んだ
   * 機種 / 営業拠点 / 発行年 のリストを一括返却する。
   * 各パラメータが空の場合はその条件をかけない（全件対象）。
   */
  public function filterOptions(Request $request)
  {
    $data = $request->validate([
      'formtype' => 'nullable|array',
      'formtype.*' => 'integer|in:1,2,3',
      'deliverytype' => 'nullable|array',
      'deliverytype.*' => 'integer|in:1,2',
      'classification' => 'nullable|array',
      'classification.*' => 'string|max:50',
      'status' => 'nullable|array',
      'status.*' => 'string|max:100',
    ]);
    $baseQuery = DB::table('m_dpr')->whereNotNull('dprno')->where('dprno', '<>', '');
    $this->applyCategoryFilters($baseQuery, $data);

    $salesExpression = $this->dprSalesExpression();
    $publishExpression = $this->dprPublishExpression();

    // 100万件をPHPへ転送せず、指定列・計算列をDB上でグループ化する。
    $machines = (clone $baseQuery)
      ->whereNotNull('machine')->where('machine', '<>', '')
      ->select('machine')->groupBy('machine')->orderBy('machine')
      ->pluck('machine')->values()->all();
    $locations = (clone $baseQuery)
      ->selectRaw("{$salesExpression} as dprsales")
      ->groupByRaw($salesExpression)->orderBy('dprsales')
      ->pluck('dprsales')->filter()->values()->all();
    $years = (clone $baseQuery)
      ->selectRaw("{$publishExpression} as dprpublish")
      ->groupByRaw($publishExpression)->orderByDesc('dprpublish')
      ->pluck('dprpublish')->filter()->values()->all();

    return response()->json(compact('machines', 'locations', 'years'));
  }
}
