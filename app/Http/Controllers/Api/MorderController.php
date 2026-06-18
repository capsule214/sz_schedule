<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdMorder;

class MorderController extends Controller
{
  /**
   * 公開フラグ=1 の M番を全件返す（予定の有無は問わない）。
   * 装置タブの M番表示で行の元データとして使用する。
   */
  public function index()
  {
    $morders = KdMorder::where('deleted', 0)
      ->where('flg_public', 1)
      ->orderBy('shipping_date')
      ->orderBy('morder_no')
      ->get();

    return response()->json($morders->map(fn ($m) => [
      'morderId'     => $m->morder_id,
      'morderNo'     => $m->morder_no,
      'partsNo'      => $m->parts_no,
      'publicRemark' => $m->public_remark,
      'shippingDate' => $m->shipping_date,
      'kouteiPicNo'  => $m->koutei_pic_no,
      'orderTypeId'  => $m->order_type_id,
      'szgroupId'    => $m->equip_group_id,
      'flgFinish'    => $m->flg_finish,
    ]));
  }
}
