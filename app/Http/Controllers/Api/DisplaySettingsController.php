<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DisplaySettingsController extends Controller
{
  private const KEY = 'main';
  private const WORKER_ID = 0;

  private function defaults(): array
  {
    return [
      'sbmodellist'                => [],
      'syteamlist'                 => [],
      'sytasklist'                 => [],
      'tktasklist'                 => [],
      'showReserveInDevice'        => false,
      'showResourceInDevice'       => false,
      'showLocationInDevice'       => false,
      'showUnassignedWorker'       => false,
      'showShippingDateInDevice'   => false,
      'showResponsibleInDevice'    => false,
      'selectedKisyuIds'           => [],
      'selectedTeamIds'            => [],
      'selectedTaskIds'            => [],
      'selectedTaskTabIds'         => [],
    ];
  }

  private function normalize(array $settings): array
  {
    $settings = array_merge($this->defaults(), $settings);

    $settings['sbmodellist'] = $settings['sbmodellist'] ?: $settings['selectedKisyuIds'];
    $settings['syteamlist']  = $settings['syteamlist'] ?: $settings['selectedTeamIds'];
    $settings['sytasklist']  = $settings['sytasklist'] ?: $settings['selectedTaskIds'];
    $settings['tktasklist']  = $settings['tktasklist'] ?: $settings['selectedTaskTabIds'];

    $settings['selectedKisyuIds']    = $settings['selectedKisyuIds'] ?: $settings['sbmodellist'];
    $settings['selectedTeamIds']     = $settings['selectedTeamIds'] ?: $settings['syteamlist'];
    $settings['selectedTaskIds']     = $settings['selectedTaskIds'] ?: $settings['sytasklist'];
    $settings['selectedTaskTabIds']  = $settings['selectedTaskTabIds'] ?: $settings['tktasklist'];

    $showResource = $settings['showReserveInDevice']
      || $settings['showResourceInDevice']
      || $settings['showLocationInDevice'];
    $settings['showReserveInDevice']  = $showResource;
    $settings['showResourceInDevice'] = $showResource;
    $settings['showLocationInDevice'] = $showResource;

    return $settings;
  }

  public function index()
  {
    $value = DB::table('display_settings')
      ->where('key', self::KEY)
      ->value('value');

    if ($value === null) {
      return response()->json($this->defaults());
    }

    return response()->json($this->normalize(json_decode($value, true) ?: []));
  }

  public function update(Request $request)
  {
    $payload = $this->normalize($request->only([
      'sbmodellist',
      'syteamlist',
      'sytasklist',
      'tktasklist',
      'showReserveInDevice',
      'showResourceInDevice',
      'showLocationInDevice',
      'showUnassignedWorker',
      'showShippingDateInDevice',
      'showResponsibleInDevice',
      'selectedKisyuIds',
      'selectedTeamIds',
      'selectedTaskIds',
      'selectedTaskTabIds',
    ]));
    $json    = json_encode($payload);

    DB::table('display_settings')->upsert(
      [['worker_id' => self::WORKER_ID, 'key' => self::KEY, 'value' => $json]],
      ['key'],
      ['value']
    );

    return response()->json($payload);
  }
}
