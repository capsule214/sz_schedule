<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DmKisyu;
use App\Models\KdSerial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SerialController extends Controller
{
  /** 装置タブの行描画に必要な最小項目のみを返す（予定描画に不要な製番情報は含めない） */
  private function formatDeviceGroup(KdSerial $s): array
  {
    $kisyu = $s->dm_kisyu;

    return [
      'serialId' => $s->serial_id,
      'kisyuId' => $s->kisyu_id,
      'kisyuName' => $kisyu ? $kisyu->kisyu_name : '',
      'kisyuBackColor' => $kisyu ? $kisyu->back_color : null,
      'kisyuFontColor' => $kisyu ? $kisyu->font_color : null,
      'serialNo' => $s->serial_no,
      'receiptNo' => $s->order_no,
      'shippingDate' => $s->shipping_date,
      'morderStartDate' => $s->morder_start_date,
      'responsible' => $s->koutei_pic_no,
      'flgSyoyo' => $s->flg_syoyo,
      'flgGoso' => $s->flg_goso,
    ];
  }

  private function formatSerial(KdSerial $s): array
  {
    $kisyu = $s->dm_kisyu;
    $equip = $kisyu?->dm_equip;

    return [
      'serialId' => $s->serial_id,
      'kisyuId' => $s->kisyu_id,
      'kisyuName' => $kisyu ? $kisyu->kisyu_name : '',
      'kisyuBackColor' => $kisyu ? $kisyu->back_color : null,
      'kisyuFontColor' => $kisyu ? $kisyu->font_color : null,
      'serialNo' => $s->serial_no,
      'equipId' => $kisyu ? $kisyu->equip_id : null,
      'equipName' => $equip ? $equip->equip_name : '',
      'equipTypeId' => $equip ? $equip->equip_type_id : null,
      'szgroupId' => $s->seizo_group_id,
      'seizoGroupId' => $s->seizo_group_id,
      'shippingDate' => $s->shipping_date,
      'morderStartDate' => $s->morder_start_date,
      'responsible' => $s->koutei_pic_no,
      'orderNo' => $s->order_no,
      'originalNo' => $s->original_no,
      'rNo' => $s->r_no,
      'flgPublic' => $s->flg_public,
      'flgGoso' => $s->flg_goso,
      'flgFinish' => $s->flg_finish,
      'flgSyoyo' => $s->flg_syoyo,
      'koujunId' => $s->koujun_id,
      'kouteiPicNo' => $s->koutei_pic_no,
      'mechanicPicNo' => $s->mechanic_pic_no,
      'electricPicNo' => $s->electric_pic_no,
      'publicRemark' => $s->public_remark,
      'customerName' => $s->customer_name,
      'backColor' => $s->back_color,
      'fontColor' => $s->font_color,
      'sortNo' => $kisyu ? $kisyu->sort_no : 0,
      'seizoStatus' => $kisyu ? $kisyu->waku_display : null,
    ];
  }

  public function index()
  {
    $serials = KdSerial::with('dm_kisyu.dm_equip')
      ->where('deleted', 0)
      ->orderBy('serial_id')
      ->get();

    return response()->json($serials->map(fn ($s) => $this->formatSerial($s)));
  }

  /** 表示設定を適用せず、製番検索で指定された1製番だけを返す。 */
  public function search(Request $request)
  {
    $data = $request->validate([
      'q' => 'required|string|max:120',
    ]);
    $search = trim((string) $data['q']);

    $query = KdSerial::with('dm_kisyu')
      ->where('deleted', 0);
    $serial = (clone $query)->where('serial_no', $search)->first()
      ?? (clone $query)->where('serial_no', 'like', '%'.$search.'%')->orderBy('serial_no')->first();

    return response()->json($serial ? $this->formatDeviceGroup($serial) : null);
  }

  public function deviceGroups(Request $request)
  {
    $data = $request->validate([
      'offset' => 'nullable|integer|min:0',
      'limit' => 'nullable|integer|min:1|max:1000',
      'all' => 'nullable|boolean',
      'q' => 'nullable|string|max:120',
      'kisyu_ids' => 'nullable|array',
      'kisyu_ids.*' => 'integer|min:1',
      'equip_type_id' => 'nullable|integer',
      'szgroup_ids' => 'nullable|array',
      'szgroup_ids.*' => 'integer|min:1',
      'seizo_statuses' => 'nullable|array',
      'seizo_statuses.*' => 'integer|min:0|max:2',
      'show_finished' => 'nullable|boolean',
      'display_from' => 'nullable|required_if:show_finished,1|date',
      'display_to' => 'nullable|required_if:show_finished,1|date|after_or_equal:display_from',
      'display_order' => 'nullable|integer|min:0|max:2',
      'koutei_pic_nos' => 'nullable|array',
      'koutei_pic_nos.*' => 'string|max:32',
    ]);

    $offset = (int) ($data['offset'] ?? 0);
    $limit = (int) ($data['limit'] ?? 200);

    $query = KdSerial::with('dm_kisyu')
      ->join('dm_kisyu', 'kd_serial.kisyu_id', '=', 'dm_kisyu.kisyu_id')
      ->leftJoin('dm_equip', 'dm_kisyu.equip_id', '=', 'dm_equip.equip_id')
      ->where('kd_serial.deleted', 0)
      ->where('dm_kisyu.deleted', 0)
      ->where('kd_serial.flg_public', 1) // 公開フラグ=1 の製番を表示対象（予定の有無は問わない）
      ->select('kd_serial.*');

    if (! empty($data['kisyu_ids'])) {
      $query->whereIn('kd_serial.kisyu_id', $data['kisyu_ids']);
    }
    if (array_key_exists('equip_type_id', $data) && $data['equip_type_id'] !== null && (int) $data['equip_type_id'] !== -1) {
      $query->where('dm_equip.equip_type_id', $data['equip_type_id']);
    }
    if (! empty($data['szgroup_ids'])) {
      $query->whereIn('kd_serial.seizo_group_id', $data['szgroup_ids']);
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
        $query->whereIn('kd_serial.koutei_pic_no', $picNos);
      }
    }
    if (! empty($data['seizo_statuses'])) {
      $query->whereIn('dm_kisyu.waku_display', $data['seizo_statuses']);
    }
    if (empty($data['show_finished'])) {
      // 「完了製品も表示」OFF のときは flg_finish=0 の製番のみ
      $query->where('kd_serial.flg_finish', 0);
    } else {
      // OR + 相関 EXISTS が全製番へ評価されるのを避けるため、完了・未完了を別々に取得する。
      // 完了製番側だけを表示期間と重なる予定で絞り込み、最後に従来と同じ表示順へ並べ直す。
      $finished = (clone $query)
        ->where('kd_serial.flg_finish', 1)
        ->whereIn('kd_serial.serial_id', function ($plans) use ($data) {
          $plans->select('kd_plan.serial_id')
            ->from('kd_plan')
            ->where('kd_plan.deleted', 0)
            ->where('kd_plan.start_date', '<=', $data['display_to'])
            ->where('kd_plan.end_date', '>=', $data['display_from']);
        })
        ->get();

      $unfinished = (clone $query)
        ->where('kd_serial.flg_finish', 0)
        ->get();

      $displayOrder = (int) ($data['display_order'] ?? 0);
      $serials = $finished
        ->concat($unfinished)
        ->sort(function (KdSerial $a, KdSerial $b) use ($displayOrder): int {
          if ($displayOrder === 1 || $displayOrder === 2) {
            $field = $displayOrder === 1 ? 'morder_start_date' : 'shipping_date';
            $aNull = empty($a->{$field}) ? 1 : 0;
            $bNull = empty($b->{$field}) ? 1 : 0;
            $nullOrder = $aNull <=> $bNull;
            if ($nullOrder !== 0) return $nullOrder;

            $dateOrder = strcmp((string) $a->{$field}, (string) $b->{$field});
            if ($dateOrder !== 0) return $dateOrder;
          } else {
            $sortOrder = ((int) ($a->dm_kisyu?->sort_no ?? 0)) <=> ((int) ($b->dm_kisyu?->sort_no ?? 0));
            if ($sortOrder !== 0) return $sortOrder;
          }

          return strcmp((string) $a->serial_no, (string) $b->serial_no);
        })
        ->values();

      if (($data['q'] ?? '') !== '') {
        $search = (string) $data['q'];
        $target = $serials->first(fn (KdSerial $serial) => (string) $serial->serial_no === $search)
          ?? $serials->first(fn (KdSerial $serial) => str_contains((string) $serial->serial_no, $search));
        $index = $target
          ? $serials->search(fn (KdSerial $serial) => (int) $serial->serial_id === (int) $target->serial_id)
          : false;

        return response()->json([
          'total' => $serials->count(),
          'offset' => $index === false ? 0 : (int) $index,
          'limit' => 1,
          'groups' => $target ? [$this->formatDeviceGroup($target)] : [],
        ]);
      }

      $total = $serials->count();
      $groups = (empty($data['all']) ? $serials->slice($offset, $limit) : $serials)
        ->map(fn (KdSerial $serial) => $this->formatDeviceGroup($serial))
        ->values();

      return response()->json([
        'total' => $total,
        'offset' => empty($data['all']) ? $offset : 0,
        'limit' => empty($data['all']) ? $limit : $total,
        'groups' => $groups,
      ]);
    }
    $displayOrder = (int) ($data['display_order'] ?? 0);
    $ordered = match ($displayOrder) {
      1 => $query
        ->orderByRaw('kd_serial.morder_start_date IS NULL')
        ->orderBy('kd_serial.morder_start_date')
        ->orderBy('kd_serial.serial_no'),
      2 => $query
        ->orderByRaw('kd_serial.shipping_date IS NULL')
        ->orderBy('kd_serial.shipping_date')
        ->orderBy('kd_serial.serial_no'),
      default => $query
        ->orderBy('dm_kisyu.sort_no')
        ->orderBy('kd_serial.serial_no'),
    };

    if (($data['q'] ?? '') !== '') {
      $ids = (clone $ordered)->pluck('kd_serial.serial_id')->all();
      $target = (clone $ordered)->where('kd_serial.serial_no', $data['q'])->first()
        ?? (clone $ordered)->where('kd_serial.serial_no', 'like', '%'.$data['q'].'%')->first();
      $index = $target ? array_search($target->serial_id, $ids, true) : false;

      return response()->json([
        'total' => count($ids),
        'offset' => $index === false ? 0 : (int) $index,
        'limit' => 1,
        'groups' => $target ? [$this->formatDeviceGroup($target)] : [],
      ]);
    }

    $total = (clone $ordered)->count();
    $groupsQuery = empty($data['all']) ? $ordered->offset($offset)->limit($limit) : $ordered;
    $groups = $groupsQuery->get()
      ->map(fn ($s) => $this->formatDeviceGroup($s));

    return response()->json([
      'total' => $total,
      'offset' => empty($data['all']) ? $offset : 0,
      'limit' => empty($data['all']) ? $limit : $total,
      'groups' => $groups,
    ]);
  }

  public function kisyu()
  {
    $kisyus = DmKisyu::with('dm_equip')->orderBy('sort_no')->orderBy('kisyu_id')->get();

    return response()->json($kisyus->map(fn ($k) => [
      'kisyuId' => $k->kisyu_id,
      'kisyuName' => $k->kisyu_name,
      'backColor' => $k->back_color,
      'fontColor' => $k->font_color,
      'sortNo' => $k->sort_no,
      'equipTypeId' => $k->dm_equip ? $k->dm_equip->equip_type_id : null,
      'seizoStatus' => $k->waku_display,
    ]));
  }

  public function byKisyu(int $kisyuId)
  {
    $serials = KdSerial::with('dm_kisyu.dm_equip')
      ->where('kisyu_id', $kisyuId)
      ->where('deleted', 0)
      ->orderBy('serial_no')
      ->get();

    return response()->json($serials->map(fn ($s) => $this->formatSerial($s)));
  }
}
