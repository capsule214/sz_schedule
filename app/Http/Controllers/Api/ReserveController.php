<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdReserve;
use App\Models\KdSerial;
use Illuminate\Http\Request;

class ReserveController extends Controller
{
  private function reserveRules(): array
  {
    return [
      'resourceId' => 'required|integer|min:1',
      'serialId'   => 'required|integer|min:1',
      'startDate'  => 'required|date',
      'endDate'    => 'required|date|after_or_equal:startDate',
    ];
  }

  private function payload(array $data): array
  {
    return [
      'resource_id' => $data['resourceId'],
      'serial_id'   => $data['serialId'],
      'start_date'  => $data['startDate'],
      'end_date'    => $data['endDate'],
    ];
  }

  private function formatReserve(KdReserve $reserve): array
  {
    $resource = $reserve->km_resource;
    $serial   = $reserve->kd_serial;

    return [
      'reserveId'    => $reserve->reserve_id,
      'planId'       => $reserve->reserve_id,
      'resourceId'   => $reserve->resource_id,
      'resourceName' => $resource ? $resource->resource_name : '',
      'serialId'     => $reserve->serial_id,
      'serialNo'     => $serial ? $serial->serial_no : '',
      'kisyuId'      => $serial ? $serial->kisyu_id : null,
      'kisyuName'    => $serial && $serial->dm_kisyu ? $serial->dm_kisyu->kisyu_name : '',
      'backColor'    => $serial ? $serial->back_color : 1,
      'fontColor'    => $serial ? $serial->font_color : 6,
      'startDate'    => $reserve->start_date,
      'endDate'      => $reserve->end_date,
    ];
  }

  public function index()
  {
    $query = KdReserve::with(['km_resource', 'kd_serial.dm_kisyu'])
      ->where('deleted', 0);

    return response()->json($query->get()->map(fn($p) => $this->formatReserve($p)));
  }

  public function search(Request $request)
  {
    $data = $request->validate([
      'from'           => 'required|date',
      'to'             => 'required|date|after_or_equal:from',
      'resource_ids'   => 'nullable|array',
      'resource_ids.*' => 'integer|min:1',
      'serial_ids'     => 'nullable|array',
      'serial_ids.*'   => 'integer|min:1',
      'kisyu_ids'      => 'nullable|array',
      'kisyu_ids.*'    => 'integer|min:1',
      'show_finished'  => 'nullable|boolean',
    ]);

    $query = KdReserve::with(['km_resource', 'kd_serial.dm_kisyu'])
      ->where('deleted', 0)
      ->where('start_date', '<=', $data['to'])
      ->where('end_date', '>=', $data['from']);

    if (!empty($data['resource_ids'])) {
      $query->whereIn('resource_id', $data['resource_ids']);
    }
    if (!empty($data['serial_ids'])) {
      $query->whereIn('serial_id', $data['serial_ids']);
    }
    if (!empty($data['kisyu_ids'])) {
      $query->whereIn('serial_id', KdSerial::whereIn('kisyu_id', $data['kisyu_ids'])->select('serial_id'));
    }
    if (empty($data['show_finished'])) {
      // 「完了製品も表示」OFF のときは flg_finish=0 の製番の予約のみ
      $query->whereIn('serial_id', KdSerial::where('flg_finish', 0)->select('serial_id'));
    }

    return response()->json($query->get()->map(fn($p) => $this->formatReserve($p)));
  }

  public function store(Request $request)
  {
    $data = $request->validate($this->reserveRules());

    $reserve = KdReserve::create([
      ...$this->payload($data),
      'deleted' => 0,
    ]);

    $reserve->load(['km_resource', 'kd_serial.dm_kisyu']);

    return response()->json($this->formatReserve($reserve), 201);
  }

  public function update(Request $request, int $id)
  {
    $reserve = KdReserve::findOrFail($id);
    $data = $request->validate($this->reserveRules());

    $reserve->update($this->payload($data));
    $reserve->load(['km_resource', 'kd_serial.dm_kisyu']);

    return response()->json($this->formatReserve($reserve));
  }

  public function destroy(Request $request)
  {
    $data = $request->validate([
      'ids'   => 'required|array|min:1',
      'ids.*' => 'integer|min:1',
    ]);

    $deleted = KdReserve::whereIn('reserve_id', $data['ids'])->update(['deleted' => 1]);
    return response()->json(['deleted' => $deleted]);
  }
}
