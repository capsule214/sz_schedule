<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdPlan;
use App\Models\KdSerial;
use App\Models\KmTeam;
use App\Models\KmSkillmap;
use App\Models\KmWorker;
use Illuminate\Http\Request;

class WorkerController extends Controller
{
  private function formatWorker(KmWorker $w): array
  {
    return [
      'workerId'    => $w->worker_id,
      'workerName'  => $w->worker_name,
      'userNo'      => $w->user_no,
      'teamId'      => $w->team_id,
      'teamName'    => $w->km_team ? $w->km_team->team_name : '',
      'szgroupId'   => $w->km_team ? $w->km_team->equip_group_id : null,
    ];
  }

  public function index()
  {
    $workers = KmWorker::with('km_team')
      ->orderBy('team_id')
      ->orderBy('worker_id')
      ->get();

    return response()->json($workers->values()->map(fn($w) => $this->formatWorker($w)));
  }

  public function teams()
  {
    $teams = KmTeam::orderBy('sort_no')->orderBy('team_id')->get();

    return response()->json($teams->map(fn($t) => [
      'teamId'    => $t->team_id,
      'teamName'  => $t->team_name,
      'sortNo'    => $t->sort_no,
      'szgroupId' => $t->equip_group_id,
    ]));
  }

  public function byTeam(Request $request, int $teamId)
  {
    $data = $request->validate([
      'available' => ['nullable', 'boolean'],
      'qualified' => ['nullable', 'boolean'],
      'start_date' => ['nullable', 'date'],
      'end_date' => ['nullable', 'date'],
      'exclude_plan_id' => ['nullable', 'integer', 'min:1'],
      'kisyu_id' => ['nullable', 'integer', 'min:1'],
      'serial_id' => ['nullable', 'integer', 'min:1'],
      'task_id' => ['nullable', 'integer', 'min:1'],
    ]);

    $query = KmWorker::with('km_team')
      ->where('team_id', $teamId)
      ->orderBy('worker_id');

    if (! empty($data['available']) && ! empty($data['start_date']) && ! empty($data['end_date'])) {
      $startDate = $data['start_date'];
      $endDate = $data['end_date'];
      $excludePlanId = $data['exclude_plan_id'] ?? null;

      $busyWorkerIds = KdPlan::query()
        ->where('deleted', 0)
        ->whereNotNull('worker_id')
        ->where('start_date', '<', $endDate)
        ->where('end_date', '>', $startDate)
        ->when($excludePlanId, fn ($q) => $q->where('plan_id', '<>', $excludePlanId))
        ->pluck('worker_id')
        ->filter()
        ->values()
        ->all();

      if (! empty($busyWorkerIds)) {
        $query->whereNotIn('worker_id', $busyWorkerIds);
      }
    }

    if (! empty($data['qualified']) && ! empty($data['task_id'])) {
      $kisyuId = $data['kisyu_id'] ?? null;
      if (! $kisyuId && ! empty($data['serial_id'])) {
        $kisyuId = KdSerial::where('serial_id', $data['serial_id'])->value('kisyu_id');
      }

      if ($kisyuId) {
        $qualifiedWorkerIds = KmSkillmap::query()
          ->where('kisyu_id', $kisyuId)
          ->where('task_id', $data['task_id'])
          ->where('skill_level', '>', 0)
          ->pluck('worker_id')
          ->values()
          ->all();

        $query->whereIn('worker_id', $qualifiedWorkerIds);
      }
    }

    $workers = $query->get();

    return response()->json($workers->map(fn($w) => $this->formatWorker($w)));
  }

  public function show(int $id)
  {
    $worker = KmWorker::with('km_team')->findOrFail($id);

    return response()->json($this->formatWorker($worker));
  }
}
