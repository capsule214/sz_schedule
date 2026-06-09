<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdLocationPlan;
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

  private function formatReserve(KdLocationPlan $reserve): array
  {
    $resource = $reserve->km_resource;
    $serial   = $reserve->kd_serial;

    return [
      'reserveId'    => $reserve->location_plan_id,
      'planId'       => $reserve->location_plan_id,
      'resourceId'   => $reserve->resource_id,
      'resourceName' => $resource ? $resource->resource_name : '',
      'serialId'     => $reserve->serial_id,
      'serialNo'     => $serial ? $serial->serial_no : '',
      'kisyuId'      => $serial ? $serial->kisyu_id : null,
      'kisyuName'    => $serial && $serial->dm_kisyu ? $serial->dm_kisyu->kisyu_name : '',
      'startDate'    => $reserve->start_date,
      'endDate'      => $reserve->end_date,
    ];
  }

  public function index()
  {
    $query = KdLocationPlan::with(['km_resource', 'kd_serial.dm_kisyu'])
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
    ]);

    $query = KdLocationPlan::with(['km_resource', 'kd_serial.dm_kisyu'])
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
      $serialIds = KdSerial::whereIn('kisyu_id', $data['kisyu_ids'])->pluck('serial_id');
      $query->whereIn('serial_id', $serialIds);
    }

    return response()->json($query->get()->map(fn($p) => $this->formatReserve($p)));
  }

  public function store(Request $request)
  {
    $data = $request->validate($this->reserveRules());

    $reserve = KdLocationPlan::create([
      ...$this->payload($data),
      'deleted' => 0,
    ]);

    $reserve->load(['km_resource', 'kd_serial.dm_kisyu']);

    return response()->json($this->formatReserve($reserve), 201);
  }

  public function update(Request $request, int $id)
  {
    $reserve = KdLocationPlan::findOrFail($id);
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

    $deleted = KdLocationPlan::whereIn('location_plan_id', $data['ids'])->update(['deleted' => 1]);
    return response()->json(['deleted' => $deleted]);
  }
}
