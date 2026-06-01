<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KmLocation;

class ResourceController extends Controller
{
  public function index()
  {
    $resources = KmLocation::orderBy('sort_no')->orderBy('location_id')->get();

    return response()->json($resources->map(fn($resource) => [
      'resourceId'   => $resource->location_id,
      'resourceName' => $resource->location_name,
      'locationId'   => $resource->location_id,
      'locationName' => $resource->location_name,
    ]));
  }
}
