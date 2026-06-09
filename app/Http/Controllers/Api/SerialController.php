<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DmKisyu;
use App\Models\KdSerial;

class SerialController extends Controller
{
  private function formatSerial(KdSerial $s): array
  {
    return [
      'serialId'      => $s->serial_id,
      'kisyuId'       => $s->kisyu_id,
      'kisyuName'     => $s->dm_kisyu ? $s->dm_kisyu->kisyu_name : '',
      'serialNo'      => $s->serial_no,
      'equipTypeId'   => $s->equip_type_id,
      'szgroupId'     => $s->szgroup_id,
      'shippingDate'  => $s->shipping_date,
      'responsible'   => $s->responsible,
      'backColor'     => $s->back_color,
      'fontColor'     => $s->font_color,
      'sortNo'        => $s->dm_kisyu ? $s->dm_kisyu->sort_no : 0,
      'seizoStatus'   => $s->dm_kisyu ? $s->dm_kisyu->waku_display : null,
    ];
  }

  public function index()
  {
    $serials = KdSerial::with('dm_kisyu')
      ->orderBy('serial_id')
      ->get();

    return response()->json($serials->map(fn($s) => $this->formatSerial($s)));
  }

  public function kisyu()
  {
    $kisyus = DmKisyu::orderBy('sort_no')->orderBy('kisyu_id')->get();

    return response()->json($kisyus->map(fn($k) => [
      'kisyuId'   => $k->kisyu_id,
      'kisyuName' => $k->kisyu_name,
      'sortNo'    => $k->sort_no,
    ]));
  }

  public function byKisyu(int $kisyuId)
  {
    $serials = KdSerial::with('dm_kisyu')
      ->where('kisyu_id', $kisyuId)
      ->orderBy('serial_no')
      ->get();

    return response()->json($serials->map(fn($s) => $this->formatSerial($s)));
  }
}
