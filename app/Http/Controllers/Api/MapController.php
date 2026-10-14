<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KdReserve;
use App\Models\KkLocationType;
use App\Models\KmResource;
use Carbon\Carbon;
use Illuminate\Http\Request;

class MapController extends Controller
{
  public function locationTypes()
  {
    return response()->json(
      KkLocationType::query()
        ->orderBy('location_type_id')
        ->get(['location_type_id', 'location_type_name'])
        ->map(fn (KkLocationType $type) => [
          'locationTypeId' => (int) $type->location_type_id,
          'locationTypeName' => (string) $type->location_type_name,
        ])
    );
  }

  public function data(Request $request)
  {
    $data = $request->validate([
      'display_date' => 'required|date',
      'location_type_id' => 'required|integer|exists:kk_location_type,location_type_id',
      'serial_no' => 'nullable|string|max:120',
    ]);

    $locationType = KkLocationType::findOrFail($data['location_type_id']);
    $resources = KmResource::with('locationType')
      ->where('deleted', 0)
      ->where('location_type_id', $locationType->location_type_id)
      ->orderBy('sort_no')
      ->orderBy('resource_id')
      ->get();

    $resourceIds = $resources->pluck('resource_id');
    $date = Carbon::parse($data['display_date']);
    $reserves = KdReserve::with('kd_serial.dm_kisyu')
      ->where('deleted', 0)
      ->whereIn('resource_id', $resourceIds)
      ->where('start_date', '<=', $date->copy()->endOfDay()->format('Y-m-d H:i:s'))
      ->where('end_date', '>=', $date->copy()->startOfDay()->format('Y-m-d H:i:s'));

    $serialSearch = trim((string) ($data['serial_no'] ?? ''));
    if ($serialSearch !== '') {
      $reserves->whereHas('kd_serial', function ($query) use ($serialSearch): void {
        $query->where('deleted', 0)
          ->where(function ($serials) use ($serialSearch): void {
            $serials->where('serial_no', $serialSearch)
              ->orWhere('serial_no', 'like', '%'.$serialSearch.'%');
          });
      });
    }

    $reservesByResource = $reserves->get()->groupBy('resource_id');
    $formatted = $resources->map(function (KmResource $resource) use ($reservesByResource): array {
      $resourceReserves = $reservesByResource->get($resource->resource_id, collect());

      return [
        'resourceId' => (int) $resource->resource_id,
        'resourceName' => (string) $resource->resource_name,
        'resourceTypeId' => (int) $resource->resource_type_id,
        'x1' => (int) $resource->x1,
        'y1' => (int) $resource->y1,
        'x2' => (int) $resource->x2,
        'y2' => (int) $resource->y2,
        'backColor' => (int) $resource->back_color,
        'fontColor' => (int) $resource->font_color,
        'reserves' => $resourceReserves->map(function (KdReserve $reserve): array {
          $serial = $reserve->kd_serial;

          return [
            'reserveId' => (int) $reserve->reserve_id,
            'serialId' => (int) $reserve->serial_id,
            'serialNo' => (string) ($serial?->serial_no ?? ''),
            'kisyuName' => (string) ($serial?->dm_kisyu?->kisyu_name ?? ''),
            'startDate' => (string) $reserve->start_date,
            'endDate' => (string) $reserve->end_date,
            'remark' => (string) ($reserve->remark ?? ''),
          ];
        })->values()->all(),
      ];
    })->values();

    return response()->json([
      'locationTypeId' => (int) $locationType->location_type_id,
      'locationTypeName' => (string) $locationType->location_type_name,
      'displayDate' => $date->format('Y-m-d'),
      'background' => $formatted->where('resourceTypeId', 99)->values()->all(),
      'resources' => $formatted->where('resourceTypeId', '<>', 99)->values()->all(),
    ]);
  }
}
