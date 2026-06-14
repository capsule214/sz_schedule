<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DmKisyu;
use App\Models\KdPlan;
use App\Models\KdSerial;
use App\Models\KmTeam;
use App\Models\KmWorker;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    private function planRules(): array
    {
        return [
            'serialId' => 'required|integer',
            'morderId' => 'nullable|integer',
            'taskId' => 'required|integer|min:1',
            'workerId' => 'nullable|integer|min:1',
            'startDate' => 'required|date',
            'endDate' => 'required|date|after_or_equal:startDate',
        ];
    }

    private function planPayload(array $data): array
    {
        return [
            'serial_id' => $data['serialId'],
            'morder_id' => $data['morderId'] ?? -1,
            'task_id' => $data['taskId'],
            'worker_id' => $data['workerId'] ?? null,
            'start_date' => $data['startDate'],
            'end_date' => $data['endDate'],
        ];
    }

    private function formatPlan(KdPlan $plan): array
    {
        $serial = $plan->kd_serial;
        $kisyu = $serial ? $serial->dm_kisyu : null;
        $task = $plan->km_task;
        $worker = $plan->km_worker;
        $morder = $plan->kd_morder;

        return [
            'planId' => $plan->plan_id,
            'serialId' => $plan->serial_id,
            'morderId' => $plan->morder_id,
            'morderNo' => $morder ? $morder->morder_no : '',
            'partsNo' => $morder ? $morder->parts_no : '',
            'publicRemark' => $morder ? $morder->public_remark : '',
            'morderShippingDate' => $morder ? $morder->shipping_date : null,
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
            'updatedAt' => $plan->updated_at ? substr($plan->updated_at, 0, 10) : null,
        ];
    }

    public function index(Request $request)
    {
        $query = KdPlan::with(['kd_serial.dm_kisyu', 'kd_morder', 'km_task', 'km_worker'])
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
            'morder_ids' => 'nullable|array',
            'morder_ids.*' => 'integer|min:1',
        ]);
        $isMorderDisplay = ($data['product_display'] ?? 'serial') === 'morder';

        $query = KdPlan::with(['kd_serial.dm_kisyu', 'kd_morder', 'km_task', 'km_worker'])
            ->where('deleted', 0)
            ->where('start_date', '<=', $data['to'])
            ->where('end_date', '>=', $data['from']);

        if ($mode === 'device' && ! $isMorderDisplay && empty($data['serial_ids']) && empty($data['kisyu_ids'])) {
            return response()->json([]);
        }
        if ($mode === 'worker' && empty($data['worker_ids']) && empty($data['team_ids']) && empty($data['team_szgroup_id']) && empty($data['show_unassigned_worker'])) {
            return response()->json([]);
        }
        if ($mode === 'task' && empty($data['task_ids'])) {
            return response()->json([]);
        }

        if ($mode === 'device' && $isMorderDisplay) {
            $query->where('morder_id', '>', 0);
            if (! empty($data['morder_ids'])) {
                $query->whereIn('morder_id', $data['morder_ids']);
            }
            if (! empty($data['szgroup_ids'])) {
                $query->whereHas('kd_morder', function ($q) use ($data) {
                    $q->whereIn('equip_group_id', $data['szgroup_ids']);
                });
            }

            return response()->json($query->get()->map(fn ($p) => $this->formatPlan($p)));
        }

        if (! empty($data['serial_ids'])) {
            $query->whereIn('serial_id', $data['serial_ids']);
        }
        if (! empty($data['kisyu_ids'])) {
            $serialIds = KdSerial::whereIn('kisyu_id', $data['kisyu_ids'])->pluck('serial_id');
            $query->whereIn('serial_id', $serialIds);
        }
        if (! empty($data['equip_type_id'])) {
            $serialIds = KdSerial::where('equip_type_id', $data['equip_type_id'])->pluck('serial_id');
            $query->whereIn('serial_id', $serialIds);
        }
        if (! empty($data['szgroup_ids'])) {
            $serialIds = KdSerial::whereIn('szgroup_id', $data['szgroup_ids'])->pluck('serial_id');
            $query->whereIn('serial_id', $serialIds);
        }
        if (! empty($data['seizo_statuses'])) {
            $kisyuIds = DmKisyu::whereIn('waku_display', $data['seizo_statuses'])->pluck('kisyu_id');
            $serialIds = KdSerial::whereIn('kisyu_id', $kisyuIds)->pluck('serial_id');
            $query->whereIn('serial_id', $serialIds);
        }
        if (! empty($data['worker_ids'])) {
            if (! empty($data['show_unassigned_worker'])) {
                $query->where(function ($q) use ($data) {
                    $q->whereIn('worker_id', $data['worker_ids'])->orWhereNull('worker_id');
                });
            } else {
                $query->whereIn('worker_id', $data['worker_ids']);
            }
        }
        if (! empty($data['team_szgroup_id'])) {
            // 製造部署フィルタ: equip_group_id が一致するチームの worker_ids に絞る
            $sgroupTeamIds = KmTeam::where('equip_group_id', $data['team_szgroup_id'])->pluck('team_id');
            $sgroupWorkerIds = KmWorker::whereIn('team_id', $sgroupTeamIds)->pluck('worker_id');
            if (! empty($data['show_unassigned_worker'])) {
                $query->where(function ($q) use ($sgroupWorkerIds) {
                    $q->whereIn('worker_id', $sgroupWorkerIds)->orWhereNull('worker_id');
                });
            } else {
                $query->whereIn('worker_id', $sgroupWorkerIds);
            }
        }
        if (! empty($data['team_ids'])) {
            $workerIds = KmWorker::whereIn('team_id', $data['team_ids'])->pluck('worker_id');
            if (! empty($data['show_unassigned_worker'])) {
                $query->where(function ($q) use ($workerIds) {
                    $q->whereIn('worker_id', $workerIds)->orWhereNull('worker_id');
                });
            } else {
                $query->whereIn('worker_id', $workerIds);
            }
        } elseif (! empty($data['show_unassigned_worker'])) {
            // チームフィルタなしで担当者未定のみ追加取得（全担当者＋未定は既にフィルタなしで取得済み）
            // チームフィルタがない場合は全プランを返すため追加フィルタ不要
        }
        if (! empty($data['task_ids'])) {
            $query->whereIn('task_id', $data['task_ids']);
        }

        return response()->json($query->get()->map(fn ($p) => $this->formatPlan($p)));
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->planRules());

        $plan = KdPlan::create([
            ...$this->planPayload($data),
            'deleted' => 0,
        ]);

        $plan->load(['kd_serial.dm_kisyu', 'kd_morder', 'km_task', 'km_worker']);

        return response()->json($this->formatPlan($plan), 201);
    }

    public function update(Request $request, int $id)
    {
        $plan = KdPlan::findOrFail($id);

        $data = $request->validate($this->planRules());

        $plan->update($this->planPayload($data));

        $plan->load(['kd_serial.dm_kisyu', 'kd_morder', 'km_task', 'km_worker']);

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
        $plans = KdPlan::with(['kd_serial.dm_kisyu', 'kd_morder', 'km_task', 'km_worker'])
            ->where('serial_id', $serialId)
            ->where('deleted', 0)
            ->orderBy('start_date')
            ->get();

        return response()->json($plans->map(fn ($p) => $this->formatPlan($p)));
    }
}
