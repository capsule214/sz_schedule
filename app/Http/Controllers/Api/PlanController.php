<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdPlan;
use App\Models\KdSerial;
use App\Models\KmWorker;
use Illuminate\Http\Request;

class PlanController extends Controller
{
  private function planRules(): array
  {
    return [
      'serialId'  => 'required|integer|min:1',
      'taskId'    => 'required|integer|min:1',
      'workerId'  => 'nullable|integer|min:1',
      'startDate' => 'required|date',
      'endDate'   => 'required|date|after_or_equal:startDate',
    ];
  }

  private function planPayload(array $data): array
  {
    return [
      'serial_id'   => $data['serialId'],
      'task_id'     => $data['taskId'],
      'assignee_id' => $data['workerId'] ?? null,
      'start_date'  => $data['startDate'],
      'end_date'    => $data['endDate'],
    ];
  }

  private function formatPlan(KdPlan $plan): array
  {
    $serial = $plan->kd_serial;
    $kisyu  = $serial ? $serial->dm_kisyu : null;
    $task   = $plan->km_task;
    $worker = $plan->km_worker;

    return [
      'planId'         => $plan->plan_id,
      'serialId'       => $plan->serial_id,
      'taskId'         => $plan->task_id,
      'taskName'       => $task ? $task->task_name : '',
      'kisyuId'        => $kisyu ? $kisyu->kisyu_id : null,
      'kisyuName'      => $kisyu ? $kisyu->kisyu_name : '',
      'serialNo'       => $serial ? $serial->serial_no : '',
      'taskBackColor'  => $task ? $task->back_color : 1,
      'taskFontColor'  => $task ? $task->font_color : 6,
      'startDate'      => $plan->start_date,
      'endDate'        => $plan->end_date,
      'workerId'       => $plan->assignee_id,
      'workerName'     => $worker ? $worker->worker_name : '',
    ];
  }

  public function index(Request $request)
  {
    $query = KdPlan::with(['kd_serial.dm_kisyu', 'km_task', 'km_worker'])
      ->where('deleted', 0);

    return response()->json($query->get()->map(fn($p) => $this->formatPlan($p)));
  }

  public function search(Request $request)
  {
    $data = $request->validate([
      'from'                   => 'required|date',
      'to'                     => 'required|date|after_or_equal:from',
      'kisyu_ids'              => 'nullable|array',
      'kisyu_ids.*'            => 'integer|min:1',
      'team_ids'               => 'nullable|array',
      'team_ids.*'             => 'integer|min:1',
      'task_ids'               => 'nullable|array',
      'task_ids.*'             => 'integer|min:1',
      'show_unassigned_worker' => 'nullable|boolean',
    ]);

    $query = KdPlan::with(['kd_serial.dm_kisyu', 'km_task', 'km_worker'])
      ->where('deleted', 0)
      ->where('start_date', '<=', $data['to'])
      ->where('end_date', '>=', $data['from']);

    if (!empty($data['kisyu_ids'])) {
      $serialIds = KdSerial::whereIn('kisyu_id', $data['kisyu_ids'])->pluck('serial_id');
      $query->whereIn('serial_id', $serialIds);
    }
    if (!empty($data['team_ids'])) {
      $workerIds = KmWorker::whereIn('team_id', $data['team_ids'])->pluck('worker_id');
      if (!empty($data['show_unassigned_worker'])) {
        $query->where(function ($q) use ($workerIds) {
          $q->whereIn('assignee_id', $workerIds)->orWhereNull('assignee_id');
        });
      } else {
        $query->whereIn('assignee_id', $workerIds);
      }
    } elseif (!empty($data['show_unassigned_worker'])) {
      // チームフィルタなしで担当者未定のみ追加取得（全担当者＋未定は既にフィルタなしで取得済み）
      // チームフィルタがない場合は全プランを返すため追加フィルタ不要
    }
    if (!empty($data['task_ids'])) {
      $query->whereIn('task_id', $data['task_ids']);
    }

    return response()->json($query->get()->map(fn($p) => $this->formatPlan($p)));
  }

  public function store(Request $request)
  {
    $data = $request->validate($this->planRules());

    $plan = KdPlan::create([
      ...$this->planPayload($data),
      'deleted'     => 0,
    ]);

    $plan->load(['kd_serial.dm_kisyu', 'km_task', 'km_worker']);

    return response()->json($this->formatPlan($plan), 201);
  }

  public function update(Request $request, int $id)
  {
    $plan = KdPlan::findOrFail($id);

    $data = $request->validate($this->planRules());

    $plan->update($this->planPayload($data));

    $plan->load(['kd_serial.dm_kisyu', 'km_task', 'km_worker']);

    return response()->json($this->formatPlan($plan));
  }

  public function destroy(Request $request)
  {
    $data = $request->validate([
      'ids'   => 'required|array|min:1',
      'ids.*' => 'integer|min:1',
    ]);

    $ids     = $data['ids'];
    $deleted = KdPlan::whereIn('plan_id', $ids)->update(['deleted' => 1]);
    return response()->json(['deleted' => $deleted]);
  }

  public function destroyOne(int $id)
  {
    KdPlan::findOrFail($id)->update(['deleted' => 1]);
    return response()->json(['deleted' => 1]);
  }
}
