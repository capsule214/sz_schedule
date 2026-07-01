<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DmKisyu;
use App\Models\KdPlan;
use App\Models\KdSerial;
use App\Models\KmQualification;
use App\Models\KmSkillmap;
use App\Models\KmTeam;
use App\Models\KmWorker;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PlanController extends Controller
{
  private function planRelations(): array
  {
    return ['kd_serial.dm_kisyu.dm_equip', 'kd_serial.km_koujun_details', 'kd_morder', 'km_task', 'km_worker'];
  }

  private function planRules(): array
  {
    return [
      'serialId' => 'required|integer',
      'morderId' => 'nullable|integer',
      'taskId' => 'required|integer|min:1',
      'workerId' => 'nullable|integer|min:1',
      'teacherId' => 'nullable|integer|min:1',
      'startDate' => 'required|date',
      'endDate' => 'required|date|after_or_equal:startDate',
      'plannedMinutes' => 'nullable|integer|min:0',
      'price' => 'nullable|integer|min:0',
      'remark' => 'nullable|string',
    ];
  }

  private function planPayload(array $data): array
  {
    return [
      'serial_id' => $data['serialId'],
      'morder_id' => $data['morderId'] ?? -1,
      'task_id' => $data['taskId'],
      'worker_id' => $data['workerId'] ?? null,
      'educator_worker_id' => $data['teacherId'] ?? null,
      'start_date' => $data['startDate'],
      'end_date' => $data['endDate'],
      'planned_minutes' => $data['plannedMinutes'] ?? 0,
      'price' => $data['price'] ?? 0,
      'remark' => $data['remark'] ?? '',
    ];
  }

  private function validatePlanQualification(array $data): void
  {
    $workerId = $data['workerId'] ?? null;
    if (! $workerId) {
      return;
    }

    $serialId = (int) ($data['serialId'] ?? 0);
    if ($serialId <= 0) {
      return;
    }

    $serial = KdSerial::find($serialId);
    if (! $serial || ! $serial->kisyu_id) {
      return;
    }

    $qualificationCount = KmQualification::where('kisyu_id', $serial->kisyu_id)
      ->where('task_id', $data['taskId'])
      ->count();
    if ($qualificationCount === 0) {
      return;
    }

    $skillLevel = (int) (KmSkillmap::where('kisyu_id', $serial->kisyu_id)
      ->where('task_id', $data['taskId'])
      ->where('worker_id', $workerId)
      ->max('skill_level') ?? 0);

    if ($skillLevel <= 0) {
      throw ValidationException::withMessages([
        'workerId' => ['有資格者を選択してください'],
      ]);
    }

    if ($skillLevel < 2 && empty($data['teacherId'])) {
      throw ValidationException::withMessages([
        'teacherId' => ['教育者を選択してください'],
      ]);
    }
  }

  private function formatPlan(KdPlan $plan): array
  {
    $serial = $plan->kd_serial;
    $kisyu = $serial ? $serial->dm_kisyu : null;
    $task = $plan->km_task;
    $worker = $plan->km_worker;
    $morder = $plan->kd_morder;
    $isSyoyoTask = false;
    if ($serial && (int) $serial->flg_syoyo !== 0) {
      $isSyoyoTask = $serial->km_koujun_details
        ->contains(fn ($detail) => (int) $detail->task_id === (int) $plan->task_id);
    }
    $morderOrderTypeNames = [
      11 => '直送DPR',
      21 => '加工オーダー',
    ];

    return [
      'planId' => $plan->plan_id,
      'serialId' => $plan->serial_id,
      'morderId' => $plan->morder_id,
      'morderNo' => $morder ? $morder->morder_no : '',
      'morderOrderTypeId' => $morder ? $morder->order_type_id : null,
      'morderOrderTypeName' => $morder ? ($morderOrderTypeNames[$morder->order_type_id] ?? (string) $morder->order_type_id) : '',
      'partsNo' => $morder ? $morder->parts_no : '',
      'publicRemark' => $morder ? $morder->public_remark : '',
      'morderShippingDate' => $morder ? $morder->shipping_date : null,
      'morderKouteiPicNo' => $morder ? $morder->koutei_pic_no : '',
      'taskId' => $plan->task_id,
      'taskName' => $task ? $task->task_name : '',
      'kisyuId' => $kisyu ? $kisyu->kisyu_id : null,
      'kisyuName' => $kisyu ? $kisyu->kisyu_name : '',
      'serialNo' => $serial ? $serial->serial_no : '',
      'taskBackColor' => $task ? $task->back_color : 1,
      'taskFontColor' => $task ? $task->font_color : 6,
      'startDate' => $plan->start_date,
      'endDate' => $plan->end_date,
      'workerId' => $plan->worker_id,
      'workerName' => $worker ? $worker->worker_name : '',
      'teacherId' => $plan->educator_worker_id,
      'plannedMinutes' => $plan->planned_minutes ?? 0,
      'price' => $plan->price ?? 0,
      'remark' => $plan->remark ?? '',
      'isSyoyoTask' => $isSyoyoTask,
      'updatedAt' => $plan->updated_at ? substr($plan->updated_at, 0, 10) : null,
    ];
  }

  private function applyUnassignedWorkerCondition($query, array $data): void
  {
    $query
      ->where(function ($q) {
        $q->whereNull('worker_id')
          ->orWhere('worker_id', '<=', 0);
      })
      ->whereHas('kd_serial', function ($q) use ($data) {
        $q->where('deleted', 0)
          ->where('flg_public', 1);

        if (! empty($data['team_szgroup_id'])) {
          $q->where('seizo_group_id', $data['team_szgroup_id']);
        }
      })
      ->whereHas('km_task', function ($q) {
        $q->whereIn('task_type_id', [1, 3]);
      });
  }

  private function applyWorkerModeFilter($query, array $data): void
  {
    $workerIds = [];
    if (! empty($data['worker_ids'])) {
      $workerIds = array_merge($workerIds, $data['worker_ids']);
    }
    if (! empty($data['team_szgroup_id'])) {
      $teamIds = KmTeam::where('equip_group_id', $data['team_szgroup_id'])->pluck('team_id');
      $workerIds = array_merge($workerIds, KmWorker::whereIn('team_id', $teamIds)->pluck('worker_id')->all());
    }
    if (! empty($data['team_ids'])) {
      $workerIds = array_merge($workerIds, KmWorker::whereIn('team_id', $data['team_ids'])->pluck('worker_id')->all());
    }
    $workerIds = array_values(array_unique(array_map('intval', $workerIds)));

    if (! empty($data['show_unassigned_worker'])) {
      $query->where(function ($q) use ($workerIds, $data) {
        if (! empty($workerIds)) {
          $q->whereIn('worker_id', $workerIds)
            ->orWhere(function ($uq) use ($data) {
              $this->applyUnassignedWorkerCondition($uq, $data);
            });

          return;
        }

        $this->applyUnassignedWorkerCondition($q, $data);
      });

      return;
    }

    if (! empty($workerIds)) {
      $query->whereIn('worker_id', $workerIds);
    } elseif (! empty($data['worker_ids']) || ! empty($data['team_szgroup_id']) || ! empty($data['team_ids'])) {
      $query->whereRaw('1 = 0');
    }
  }

  private function applySerialFilters($query, array $data): void
  {
    if (! empty($data['serial_ids'])) {
      $query->whereIn('serial_id', $data['serial_ids']);
    }
    if (! empty($data['kisyu_ids'])) {
      $query->whereIn('serial_id', KdSerial::whereIn('kisyu_id', $data['kisyu_ids'])->select('serial_id'));
    }
    if (! empty($data['equip_type_id'])) {
      $kisyuIds = DmKisyu::whereHas('dm_equip', function ($q) use ($data) {
        $q->where('equip_type_id', $data['equip_type_id']);
      })->select('kisyu_id');
      $query->whereIn('serial_id', KdSerial::whereIn('kisyu_id', $kisyuIds)->select('serial_id'));
    }
    if (! empty($data['szgroup_ids'])) {
      $query->whereIn('serial_id', KdSerial::whereIn('seizo_group_id', $data['szgroup_ids'])->select('serial_id'));
    }
    if (! empty($data['seizo_statuses'])) {
      $kisyuIds = DmKisyu::whereIn('waku_display', $data['seizo_statuses'])->select('kisyu_id');
      $query->whereIn('serial_id', KdSerial::whereIn('kisyu_id', $kisyuIds)->select('serial_id'));
    }
  }

  private function applyMorderFilters($query, array $data): void
  {
    $query->where('morder_id', '>', 0);
    if (! empty($data['morder_ids'])) {
      $query->whereIn('morder_id', $data['morder_ids']);
    }
    if (empty($data['show_finished'])) {
      $query->whereHas('kd_morder', function ($q) {
        $q->where('flg_finish', 0);
      });
    }
    if (! empty($data['morder_order_type_id'])) {
      // M番=21(加工オーダー) / 直送DPR=11 で対象 M番を絞る
      $query->whereHas('kd_morder', function ($q) use ($data) {
        $q->where('order_type_id', $data['morder_order_type_id']);
      });
    }
    if (! empty($data['szgroup_ids'])) {
      $query->whereHas('kd_morder', function ($q) use ($data) {
        $q->whereIn('equip_group_id', $data['szgroup_ids']);
      });
    }
  }

  public function index(Request $request)
  {
    $query = KdPlan::with($this->planRelations())
      ->where('deleted', 0);

    return response()->json($query->get()->map(fn ($p) => $this->formatPlan($p)));
  }

  public function search(Request $request)
  {
    return $this->searchForMode($request);
  }

  public function searchDevice(Request $request)
  {
    return $this->searchForMode($request, 'device');
  }

  public function searchWorker(Request $request)
  {
    return $this->searchForMode($request, 'worker');
  }

  public function searchTask(Request $request)
  {
    return $this->searchForMode($request, 'task');
  }

  private function searchForMode(Request $request, ?string $mode = null)
  {
    $data = $request->validate([
      'from' => 'required|date',
      'to' => 'required|date|after_or_equal:from',
      'serial_ids' => 'nullable|array',
      'serial_ids.*' => 'integer|min:1',
      'worker_ids' => 'nullable|array',
      'worker_ids.*' => 'integer|min:1',
      'kisyu_ids' => 'nullable|array',
      'kisyu_ids.*' => 'integer|min:1',
      'equip_type_id' => 'nullable|integer',
      'szgroup_ids' => 'nullable|array',
      'szgroup_ids.*' => 'integer|min:1',
      'seizo_statuses' => 'nullable|array',
      'seizo_statuses.*' => 'integer|min:0|max:2',
      'team_szgroup_id' => 'nullable|integer|min:1|max:3',
      'team_ids' => 'nullable|array',
      'team_ids.*' => 'integer|min:1',
      'task_ids' => 'nullable|array',
      'task_ids.*' => 'integer|min:1',
      'show_unassigned_worker' => 'nullable|boolean',
      'product_display' => 'nullable|string|in:serial,morder',
      'morder_order_type_id' => 'nullable|integer',
      'morder_ids' => 'nullable|array',
      'morder_ids.*' => 'integer|min:1',
      'show_finished' => 'nullable|boolean',
    ]);
    $isMorderDisplay = ($data['product_display'] ?? 'serial') === 'morder';

    $query = KdPlan::with($this->planRelations())
      ->where('deleted', 0)
      ->where('start_date', '<=', $data['to'])
      ->where('end_date', '>=', $data['from']);

    if ($mode === 'device' && ! $isMorderDisplay
     && empty($data['serial_ids']) && empty($data['kisyu_ids'])
     && empty($data['szgroup_ids']) && empty($data['seizo_statuses']) && empty($data['equip_type_id'])) {
      return response()->json([]);
    }
    if ($mode === 'worker' && empty($data['worker_ids']) && empty($data['team_ids']) && empty($data['team_szgroup_id']) && empty($data['show_unassigned_worker'])) {
      return response()->json([]);
    }
    if ($mode === 'task' && empty($data['task_ids'])) {
      return response()->json([]);
    }

    // 「完了製品も表示」OFF のときは flg_finish=0 の製番の予定のみ表示する。
    // morder 予定やセンチネル（serial_id <= 0）は製番を持たないため対象外とする。
    if (empty($data['show_finished'])) {
      $query->where(function ($q) {
        $q->where('serial_id', '<=', 0)
          ->orWhereIn('serial_id', KdSerial::where('flg_finish', 0)->select('serial_id'));
      });
    }

    if ($mode === 'device' && $isMorderDisplay) {
      $this->applyMorderFilters($query, $data);

      return response()->json($query->get()->map(fn ($p) => $this->formatPlan($p)));
    }

    if ($mode === 'task' && $isMorderDisplay) {
      $this->applyMorderFilters($query, $data);
    } else {
      $this->applySerialFilters($query, $data);
    }

    if ($mode === 'worker') {
      $this->applyWorkerModeFilter($query, $data);
    }
    if (! empty($data['task_ids'])) {
      $query->whereIn('task_id', $data['task_ids']);
    }

    return response()->json($query->get()->map(fn ($p) => $this->formatPlan($p)));
  }

  public function store(Request $request)
  {
    $data = $request->validate($this->planRules());
    $this->validatePlanQualification($data);

    $plan = KdPlan::create([
      ...$this->planPayload($data),
      'deleted' => 0,
    ]);

    $plan->load($this->planRelations());

    return response()->json($this->formatPlan($plan), 201);
  }

  public function update(Request $request, int $id)
  {
    $plan = KdPlan::findOrFail($id);

    $data = $request->validate($this->planRules());
    $this->validatePlanQualification($data);

    $plan->update($this->planPayload($data));

    $plan->load($this->planRelations());

    return response()->json($this->formatPlan($plan));
  }

  public function destroy(Request $request)
  {
    $data = $request->validate([
      'ids' => 'required|array|min:1',
      'ids.*' => 'integer|min:1',
    ]);

    $ids = $data['ids'];
    $deleted = KdPlan::whereIn('plan_id', $ids)->update(['deleted' => 1, 'updated_at' => now()]);

    return response()->json(['deleted' => $deleted]);
  }

  public function destroyOne(int $id)
  {
    KdPlan::findOrFail($id)->update(['deleted' => 1]);

    return response()->json(['deleted' => 1]);
  }

  /** 製番IDで予定を全件取得（日付フィルタなし） */
  public function bySerial(int $serialId)
  {
    $plans = KdPlan::with($this->planRelations())
      ->where('serial_id', $serialId)
      ->where('deleted', 0)
      ->orderBy('start_date')
      ->get();

    return response()->json($plans->map(fn ($p) => $this->formatPlan($p)));
  }
}
