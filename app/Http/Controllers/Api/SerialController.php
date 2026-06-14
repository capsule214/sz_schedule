<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DmKisyu;
use App\Models\KdSerial;
use Illuminate\Http\Request;

class SerialController extends Controller
{
  private function formatSerial(KdSerial $s): array
  {
    return [
      'serialId' => $s->serial_id,
      'kisyuId' => $s->kisyu_id,
      'kisyuName' => $s->dm_kisyu ? $s->dm_kisyu->kisyu_name : '',
      'serialNo' => $s->serial_no,
      'equipTypeId' => $s->equip_type_id,
      'szgroupId' => $s->szgroup_id,
      'shippingDate' => $s->shipping_date,
      'responsible' => $s->responsible,
      'backColor' => $s->back_color,
      'fontColor' => $s->font_color,
      'sortNo' => $s->dm_kisyu ? $s->dm_kisyu->sort_no : 0,
      'seizoStatus' => $s->dm_kisyu ? $s->dm_kisyu->waku_display : null,
    ];
  }

  public function index()
  {
    $serials = KdSerial::with('dm_kisyu')
      ->orderBy('serial_id')
      ->get();

    return response()->json($serials->map(fn ($s) => $this->formatSerial($s)));
  }

  public function deviceGroups(Request $request)
  {
    $data = $request->validate([
      'offset' => 'nullable|integer|min:0',
      'limit' => 'nullable|integer|min:1|max:1000',
      'q' => 'nullable|string|max:120',
      'kisyu_ids' => 'nullable|array',
      'kisyu_ids.*' => 'integer|min:1',
      'equip_type_id' => 'nullable|integer',
      'szgroup_ids' => 'nullable|array',
      'szgroup_ids.*' => 'integer|min:1',
      'seizo_statuses' => 'nullable|array',
      'seizo_statuses.*' => 'integer|min:0|max:2',
    ]);

    $offset = (int) ($data['offset'] ?? 0);
    $limit = (int) ($data['limit'] ?? 200);

    $query = KdSerial::with('dm_kisyu')
      ->join('dm_kisyu', 'kd_serial.kisyu_id', '=', 'dm_kisyu.kisyu_id')
      ->select('kd_serial.*');

    if (! empty($data['kisyu_ids'])) {
      $query->whereIn('kd_serial.kisyu_id', $data['kisyu_ids']);
    }
    if (array_key_exists('equip_type_id', $data) && $data['equip_type_id'] !== null && (int) $data['equip_type_id'] !== -1) {
      $query->where('kd_serial.equip_type_id', $data['equip_type_id']);
    }
    if (! empty($data['szgroup_ids'])) {
      $query->whereIn('kd_serial.szgroup_id', $data['szgroup_ids']);
    }
    if (! empty($data['seizo_statuses'])) {
      $query->whereIn('dm_kisyu.waku_display', $data['seizo_statuses']);
    }
    $ordered = $query
      ->orderBy('dm_kisyu.sort_no')
      ->orderBy('kd_serial.serial_no');

    if (($data['q'] ?? '') !== '') {
      $ids = (clone $ordered)->pluck('kd_serial.serial_id')->all();
      $target = (clone $ordered)->where('kd_serial.serial_no', $data['q'])->first();
      $index = $target ? array_search($target->serial_id, $ids, true) : false;

      return response()->json([
        'total' => count($ids),
        'offset' => $index === false ? 0 : (int) $index,
        'limit' => 1,
        'groups' => $target ? [$this->formatSerial($target)] : [],
      ]);
    }

    $total = (clone $ordered)->count();
    $groups = $ordered
      ->offset($offset)
      ->limit($limit)
      ->get()
      ->map(fn ($s) => $this->formatSerial($s));

    return response()->json([
      'total' => $total,
      'offset' => $offset,
      'limit' => $limit,
      'groups' => $groups,
    ]);
  }

  public function kisyu()
  {
    $kisyus = DmKisyu::orderBy('sort_no')->orderBy('kisyu_id')->get();

    return response()->json($kisyus->map(fn ($k) => [
      'kisyuId' => $k->kisyu_id,
      'kisyuName' => $k->kisyu_name,
      'sortNo' => $k->sort_no,
    ]));
  }

  public function byKisyu(int $kisyuId)
  {
    $serials = KdSerial::with('dm_kisyu')
      ->where('kisyu_id', $kisyuId)
      ->orderBy('serial_no')
      ->get();

    return response()->json($serials->map(fn ($s) => $this->formatSerial($s)));
  }
}
