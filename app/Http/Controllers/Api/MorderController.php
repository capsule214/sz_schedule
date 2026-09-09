<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdMorder;
use App\Models\KdPlan;
use Illuminate\Http\Request;

class MorderController extends Controller
{
  private const ORDER_TYPE_NAMES = [
    11 => '直送DPR',
    21 => '加工オーダー',
  ];

  /** 装置タブ(M番/直送DPR)の行描画に必要な最小項目のみを返す */
  private function formatMorderGroup(KdMorder $m): array
  {
    return [
      'morderId'     => $m->morder_id,
      'morderNo'     => $m->morder_no,
      'partsNo'      => $m->parts_no,
      'publicRemark' => $m->public_remark,
      'shippingDate' => $m->shipping_date,
      'kouteiPicNo'  => $m->koutei_pic_no,
      'orderTypeId'  => $m->order_type_id,
      'orderTypeName' => self::ORDER_TYPE_NAMES[$m->order_type_id] ?? (string) $m->order_type_id,
    ];
  }

  /** 担当者・タスクタブの前後予定表示用に、M番に紐づく予定を日付順で返す。 */
  public function plans(int $morderId)
  {
    $plans = KdPlan::with([
      'kd_serial.dm_kisyu.dm_equip',
      'kd_serial.km_koujun_details',
      'km_task',
      'km_worker',
      'kd_morder',
    ])
      ->where('morder_id', $morderId)
      ->where('deleted', 0)
      ->orderBy('start_date')
      ->get();

    return response()->json($plans->map(fn (KdPlan $plan) => $this->formatPlan($plan)));
  }

  private function formatPlan(KdPlan $plan): array
  {
    $serial = $plan->kd_serial;
    $kisyu = $serial?->dm_kisyu;
    $task = $plan->km_task;
    $worker = $plan->km_worker;
    $morder = $plan->kd_morder;
    $isSyoyoTask = $serial && (int) $serial->flg_syoyo !== 0
      ? $serial->km_koujun_details
        ->contains(fn ($detail) => (int) $detail->task_id === (int) $plan->task_id)
      : false;

    return [
      'planId' => $plan->plan_id,
      'serialId' => $plan->serial_id,
      'morderId' => $plan->morder_id,
      'dprNo' => $plan->dpr_no,
      'userNo' => $plan->user_no,
      'morderNo' => $morder?->morder_no ?? '',
      'morderOrderTypeId' => $morder?->order_type_id,
      'morderOrderTypeName' => $morder
        ? (self::ORDER_TYPE_NAMES[$morder->order_type_id] ?? (string) $morder->order_type_id)
        : '',
      'partsNo' => $morder?->parts_no ?? '',
      'publicRemark' => $morder?->public_remark ?? '',
      'morderShippingDate' => $morder?->shipping_date,
      'morderKouteiPicNo' => $morder?->koutei_pic_no ?? '',
      'taskId' => $plan->task_id,
      'taskName' => $task?->task_name ?? '',
      'taskTypeId' => $task?->task_type_id,
      'kisyuId' => $kisyu?->kisyu_id,
      'kisyuName' => $kisyu?->kisyu_name ?? '',
      'kisyuBackColor' => $kisyu?->back_color,
      'kisyuFontColor' => $kisyu?->font_color,
      'serialNo' => $serial?->serial_no ?? '',
      'taskBackColor' => $task?->back_color ?? 1,
      'taskFontColor' => $task?->font_color ?? 6,
      'startDate' => $plan->start_date,
      'endDate' => $plan->end_date,
      'workerId' => $plan->worker_id,
      'workerName' => $worker?->worker_name ?? '',
      'teacherId' => $plan->educator_worker_id,
      'plannedMinutes' => $plan->planned_minutes ?? 0,
      'price' => $plan->price ?? 0,
      'remark' => $plan->remark ?? '',
      'isSyoyoTask' => $isSyoyoTask,
      'updatedAt' => $plan->updated_at?->copy()->setTimezone('Asia/Tokyo')->format('Y-m-d'),
      'updatedAtVersion' => $plan->updated_at?->format('Y-m-d H:i:s.u'),
    ];
  }

  /** 予定登録ダイアログ用に、手配区分に該当する M番候補を全件返す。 */
  public function index(Request $request)
  {
    $data = $request->validate([
      'order_type_id' => 'required|integer|in:11,21',
    ]);

    $morders = KdMorder::where('deleted', 0)
      ->where('flg_public', 1)
      ->where('order_type_id', $data['order_type_id'])
      ->orderBy('shipping_date')
      ->orderBy('morder_no')
      ->get()
      ->map(fn ($m) => $this->formatMorderGroup($m));

    return response()->json($morders);
  }

  /**
   * 公開フラグ=1 の M番をページングで返す（製番の device-groups と同じ方式）。
   * スクロールで表示対象になった分だけ都度取得する。
   */
  public function groups(Request $request)
  {
    $data = $request->validate([
      'offset' => 'nullable|integer|min:0',
      'limit' => 'nullable|integer|min:1|max:1000',
      'all' => 'nullable|boolean',
      'q' => 'nullable|string|max:120',
      'szgroup_ids' => 'nullable|array',
      'szgroup_ids.*' => 'integer|min:1',
      'morder_order_type_id' => 'nullable|integer',
      'show_finished' => 'nullable|boolean',
      'koutei_pic_nos' => 'nullable|array',
      'koutei_pic_nos.*' => 'string|max:32',
    ]);

    $offset = (int) ($data['offset'] ?? 0);
    $limit = (int) ($data['limit'] ?? 200);

    $query = KdMorder::where('deleted', 0)->where('flg_public', 1);
    if (! empty($data['morder_order_type_id'])) {
      // M番=21(加工オーダー) / 直送DPR=11 で対象を絞る
      $query->where('order_type_id', $data['morder_order_type_id']);
    }
    if (! empty($data['szgroup_ids'])) {
      $query->whereIn('equip_group_id', $data['szgroup_ids']);
    }
    if (! empty($data['koutei_pic_nos'])) {
      $picNos = collect($data['koutei_pic_nos'])
        ->flatMap(fn ($value) => explode(',', (string) $value))
        ->map(fn ($value) => trim($value))
        ->filter()
        ->map(fn ($value) => ctype_digit($value) ? str_pad($value, 5, '0', STR_PAD_LEFT) : $value)
        ->unique()
        ->values()
        ->all();
      if (! empty($picNos)) {
        $query->whereIn('koutei_pic_no', $picNos);
      }
    }
    if (empty($data['show_finished'])) {
      $query->where('flg_finish', 0);
    }
    $ordered = $query->orderBy('shipping_date')->orderBy('morder_no');

    if (($data['q'] ?? '') !== '') {
      $ids = (clone $ordered)->pluck('morder_id')->all();
      $target = (clone $ordered)->where(function ($qq) use ($data) {
        $qq->where('morder_no', $data['q'])->orWhere('parts_no', $data['q']);
      })->first() ?? (clone $ordered)->where(function ($qq) use ($data) {
        $qq->where('morder_no', 'like', '%'.$data['q'].'%')
          ->orWhere('parts_no', 'like', '%'.$data['q'].'%');
      })->first();
      $index = $target ? array_search($target->morder_id, $ids, true) : false;

      return response()->json([
        'total' => count($ids),
        'offset' => $index === false ? 0 : (int) $index,
        'limit' => 1,
        'groups' => $target ? [$this->formatMorderGroup($target)] : [],
      ]);
    }

    $total = (clone $ordered)->count();
    $groupsQuery = empty($data['all']) ? $ordered->offset($offset)->limit($limit) : $ordered;
    $groups = $groupsQuery->get()
      ->map(fn ($m) => $this->formatMorderGroup($m));

    return response()->json([
      'total' => $total,
      'offset' => empty($data['all']) ? $offset : 0,
      'limit' => empty($data['all']) ? $limit : $total,
      'groups' => $groups,
    ]);
  }
}
