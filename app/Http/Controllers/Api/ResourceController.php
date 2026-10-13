<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KmResource;

class ResourceController extends Controller
{
  public function index()
  {
    $resources = KmResource::with('locationType')->orderBy('sort_no')->orderBy('resource_id')->get();

    return response()->json($resources->map(fn($r) => [
      'resourceId'       => $r->resource_id,
      'resourceName'     => $r->resource_name,
      'sortNo'           => $r->sort_no,
      'locationTypeId'   => $r->location_type_id,
      'locationTypeName' => $r->locationType ? $r->locationType->location_type_name : null,
      'resourceTypeId'   => $r->resource_type_id,
      'x1'               => $r->x1,
      'y1'               => $r->y1,
      'x2'               => $r->x2,
      'y2'               => $r->y2,
      'backColor'        => $r->back_color,
      'fontColor'        => $r->font_color,
    ]));
  }
}
