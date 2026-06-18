<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdMorder;
use Illuminate\Http\Request;

class MorderController extends Controller
{
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
    ];
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
      'q' => 'nullable|string|max:120',
      'szgroup_ids' => 'nullable|array',
      'szgroup_ids.*' => 'integer|min:1',
      'morder_order_type_id' => 'nullable|integer',
      'show_finished' => 'nullable|boolean',
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
    if (empty($data['show_finished'])) {
      $query->where('flg_finish', 0);
    }
    $ordered = $query->orderBy('shipping_date')->orderBy('morder_no');

    if (($data['q'] ?? '') !== '') {
      $ids = (clone $ordered)->pluck('morder_id')->all();
      $target = (clone $ordered)->where(function ($qq) use ($data) {
        $qq->where('morder_no', $data['q'])->orWhere('parts_no', $data['q']);
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
    $groups = $ordered
      ->offset($offset)
      ->limit($limit)
      ->get()
      ->map(fn ($m) => $this->formatMorderGroup($m));

    return response()->json([
      'total' => $total,
      'offset' => $offset,
      'limit' => $limit,
      'groups' => $groups,
    ]);
  }
}
