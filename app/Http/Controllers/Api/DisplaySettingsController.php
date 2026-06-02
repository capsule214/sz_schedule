<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DisplaySettingsController extends Controller
{
  private const SLOT_COUNT = 5;

  private function userNo(Request $request): int
  {
    return (int) $request->user()->getKey();
  }

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

  private function settingName(int $settingNo): string
  {
    return "表示設定{$settingNo}";
  }

  private function ensureSlots(int $userNo): void
  {
    $now = now();
    $existing = DB::table('display_settings')
      ->where('user_no', $userNo)
      ->pluck('setting_no')
      ->map(fn($v) => (int) $v)
      ->all();

    for ($i = 1; $i <= self::SLOT_COUNT; $i++) {
      if (in_array($i, $existing, true)) continue;
      DB::table('display_settings')->insert([
        'user_no'      => $userNo,
        'setting_no'   => $i,
        'setting_name' => $this->settingName($i),
        'value'        => json_encode($this->defaults()),
        'is_active'    => $i === 1,
        'created_at'   => $now,
        'updated_at'   => $now,
      ]);
    }

    $hasActive = DB::table('display_settings')->where('user_no', $userNo)->where('is_active', true)->exists();
    if (!$hasActive) {
      DB::table('display_settings')
        ->where('user_no', $userNo)
        ->where('setting_no', 1)
        ->update(['is_active' => true, 'updated_at' => $now]);
    }
  }

  private function rowsForUser(int $userNo)
  {
    $this->ensureSlots($userNo);

    return DB::table('display_settings')
      ->where('user_no', $userNo)
      ->orderBy('setting_no')
      ->get();
  }

  private function formatResponse(int $userNo, ?int $activeNo = null): array
  {
    $rows = $this->rowsForUser($userNo);
    $active = $activeNo
      ? $rows->firstWhere('setting_no', $activeNo)
      : ($rows->firstWhere('is_active', 1) ?: $rows->first());

    $settingsList = $rows->map(fn($row) => [
      'settingNo'   => (int) $row->setting_no,
      'settingName' => $row->setting_name ?: $this->settingName((int) $row->setting_no),
      'settings'    => $this->normalize(json_decode($row->value, true) ?: []),
      'isActive'    => (bool) $row->is_active,
    ])->values()->all();

    $payload = $this->normalize(json_decode($active->value, true) ?: []);
    $payload['userNo'] = $userNo;
    $payload['settingNo'] = (int) $active->setting_no;
    $payload['settingName'] = $active->setting_name ?: $this->settingName((int) $active->setting_no);
    $payload['settingsList'] = $settingsList;

    return $payload;
  }

  public function index(Request $request)
  {
    return response()->json($this->formatResponse($this->userNo($request)));
  }

  public function activate(Request $request)
  {
    $data = $request->validate([
      'settingNo' => 'required|integer|min:1|max:' . self::SLOT_COUNT,
    ]);

    $userNo = $this->userNo($request);
    $this->ensureSlots($userNo);
    DB::transaction(function () use ($userNo, $data) {
      DB::table('display_settings')->where('user_no', $userNo)->update(['is_active' => false, 'updated_at' => now()]);
      DB::table('display_settings')
        ->where('user_no', $userNo)
        ->where('setting_no', $data['settingNo'])
        ->update(['is_active' => true, 'updated_at' => now()]);
    });

    return response()->json($this->formatResponse($userNo, $data['settingNo']));
  }

  public function update(Request $request)
  {
    $data = $request->validate([
      'settingNo'   => 'nullable|integer|min:1|max:' . self::SLOT_COUNT,
      'settingName' => 'nullable|string|max:80',
    ]);

    $settingNo = (int) ($data['settingNo'] ?? 1);
    $settingName = trim((string) ($data['settingName'] ?? $this->settingName($settingNo)));
    if ($settingName === '') $settingName = $this->settingName($settingNo);

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

    $userNo = $this->userNo($request);
    $this->ensureSlots($userNo);

    DB::transaction(function () use ($userNo, $settingNo, $settingName, $payload) {
      DB::table('display_settings')->where('user_no', $userNo)->update(['is_active' => false, 'updated_at' => now()]);
      DB::table('display_settings')->updateOrInsert(
        ['user_no' => $userNo, 'setting_no' => $settingNo],
        [
          'setting_name' => $settingName,
          'value'        => json_encode($payload),
          'is_active'    => true,
          'updated_at'   => now(),
          'created_at'   => now(),
        ],
      );
    });

    return response()->json($this->formatResponse($userNo, $settingNo));
  }
}
