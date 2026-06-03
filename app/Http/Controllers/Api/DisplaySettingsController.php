<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DisplaySettingsController extends Controller
{
  private const SLOT_COUNT = 5;

  private function userNo(Request $request): string
  {
    return (string) $request->user()->getKey();
  }

  private function defaults(): array
  {
    return [
      'duration'                   => 1,
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

    $settings['sbmodellist'] = $this->intList($settings['sbmodellist'] ?: $settings['selectedKisyuIds']);
    $settings['syteamlist']  = $this->intList($settings['syteamlist'] ?: $settings['selectedTeamIds']);
    $settings['sytasklist']  = $this->intList($settings['sytasklist'] ?: $settings['selectedTaskIds']);
    $settings['tktasklist']  = $this->intList($settings['tktasklist'] ?: $settings['selectedTaskTabIds']);

    $settings['selectedKisyuIds']    = $settings['selectedKisyuIds'] ?: array_map('strval', $settings['sbmodellist']);
    $settings['selectedTeamIds']     = $settings['selectedTeamIds'] ?: $settings['syteamlist'];
    $settings['selectedTaskIds']     = $settings['selectedTaskIds'] ?: $settings['sytasklist'];
    $settings['selectedTaskTabIds']  = $settings['selectedTaskTabIds'] ?: $settings['tktasklist'];

    $showResource = $settings['showReserveInDevice']
      || $settings['showResourceInDevice']
      || $settings['showLocationInDevice'];
    $settings['showReserveInDevice']  = (bool) $showResource;
    $settings['showResourceInDevice'] = (bool) $showResource;
    $settings['showLocationInDevice'] = (bool) $showResource;
    $settings['showUnassignedWorker'] = (bool) $settings['showUnassignedWorker'];
    $settings['showShippingDateInDevice'] = (bool) $settings['showShippingDateInDevice'];
    $settings['showResponsibleInDevice'] = (bool) $settings['showResponsibleInDevice'];
    $settings['duration'] = max(1, (int) $settings['duration']);

    return $settings;
  }

  private function intList(mixed $value): array
  {
    if (is_string($value)) {
      $trimmed = trim($value);
      if ($trimmed === '') return [];
      if (str_starts_with($trimmed, '[')) {
        $decoded = json_decode($trimmed, true);
        $value = is_array($decoded) ? $decoded : [];
      } elseif (str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}')) {
        $body = trim($trimmed, '{}');
        $value = $body === '' ? [] : explode(',', $body);
      } else {
        $value = explode(',', $trimmed);
      }
    }
    if (!is_array($value)) return [];
    return array_values(array_unique(array_map('intval', $value)));
  }

  private function arrayValue(array $values): string
  {
    $values = $this->intList($values);
    if (DB::connection()->getDriverName() === 'pgsql') {
      return '{' . implode(',', $values) . '}';
    }
    return json_encode($values);
  }

  private function settingName(int $settingNo): string
  {
    return "表示設定{$settingNo}";
  }

  private function settingsFromRow(object $row): array
  {
    return $this->normalize([
      'duration'                 => (int) ($row->duration ?? 1),
      'sbmodellist'              => $this->intList($row->sbmodellist ?? []),
      'syteamlist'               => $this->intList($row->syteamlist ?? []),
      'sytasklist'               => $this->intList($row->sytasklist ?? []),
      'tktasklist'               => $this->intList($row->tktasklist ?? []),
      'showReserveInDevice'      => (bool) ($row->show_reserve_in_device ?? false),
      'showResourceInDevice'     => (bool) ($row->show_resource_in_device ?? false),
      'showLocationInDevice'     => (bool) ($row->show_location_in_device ?? false),
      'showUnassignedWorker'     => (bool) ($row->show_unassigned_worker ?? false),
      'showShippingDateInDevice' => (bool) ($row->show_shipping_date_in_device ?? false),
      'showResponsibleInDevice'  => (bool) ($row->show_responsible_in_device ?? false),
    ]);
  }

  private function rowValues(string $userNo, int $settingNo, string $settingName, array $settings, bool $isActive): array
  {
    $settings = $this->normalize($settings);

    return [
      'user_no'                         => $userNo,
      'setting_no'                      => $settingNo,
      'setting_name'                    => $settingName,
      'duration'                        => $settings['duration'],
      'sbmodellist'                     => $this->arrayValue($settings['sbmodellist']),
      'syteamlist'                      => $this->arrayValue($settings['syteamlist']),
      'sytasklist'                      => $this->arrayValue($settings['sytasklist']),
      'tktasklist'                      => $this->arrayValue($settings['tktasklist']),
      'show_reserve_in_device'          => $settings['showReserveInDevice'],
      'show_resource_in_device'         => $settings['showResourceInDevice'],
      'show_location_in_device'         => $settings['showLocationInDevice'],
      'show_unassigned_worker'          => $settings['showUnassignedWorker'],
      'show_shipping_date_in_device'    => $settings['showShippingDateInDevice'],
      'show_responsible_in_device'      => $settings['showResponsibleInDevice'],
      'is_active'                       => $isActive,
    ];
  }

  private function ensureSlots(string $userNo): void
  {
    $now = now();
    $existing = DB::table('display_settings')
      ->where('user_no', $userNo)
      ->pluck('setting_no')
      ->map(fn($v) => (int) $v)
      ->all();
    $hasActive = DB::table('display_settings')->where('user_no', $userNo)->where('is_active', true)->exists();

    for ($i = 1; $i <= self::SLOT_COUNT; $i++) {
      if (in_array($i, $existing, true)) continue;
      DB::table('display_settings')->insert([
        ...$this->rowValues($userNo, $i, $this->settingName($i), $this->defaults(), !$hasActive && $i === 1),
        'created_at' => $now,
        'updated_at' => $now,
      ]);
      if ($i === 1) $hasActive = true;
    }

    if (!$hasActive) {
      DB::table('display_settings')
        ->where('user_no', $userNo)
        ->where('setting_no', 1)
        ->update(['is_active' => true, 'updated_at' => $now]);
    }
  }

  private function rowsForUser(string $userNo)
  {
    $this->ensureSlots($userNo);

    return DB::table('display_settings')
      ->where('user_no', $userNo)
      ->orderBy('setting_no')
      ->get();
  }

  private function formatResponse(string $userNo, ?int $activeNo = null): array
  {
    $rows = $this->rowsForUser($userNo);
    $active = $activeNo
      ? $rows->firstWhere('setting_no', $activeNo)
      : ($rows->firstWhere('is_active', 1) ?: $rows->first());

    $settingsList = $rows->map(fn($row) => [
      'settingNo'   => (int) $row->setting_no,
      'settingName' => $row->setting_name ?: $this->settingName((int) $row->setting_no),
      'settings'    => $this->settingsFromRow($row),
      'isActive'    => (bool) $row->is_active,
    ])->values()->all();

    $payload = $this->settingsFromRow($active);
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
      'duration'    => 'nullable|integer|min:1|max:60',
    ]);

    $settingNo = (int) ($data['settingNo'] ?? 1);
    $settingName = trim((string) ($data['settingName'] ?? $this->settingName($settingNo)));
    if ($settingName === '') $settingName = $this->settingName($settingNo);

    $payload = $this->normalize($request->only([
      'duration',
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
          ...$this->rowValues($userNo, $settingNo, $settingName, $payload, true),
          'updated_at' => now(),
          'created_at' => now(),
        ],
      );
    });

    return response()->json($this->formatResponse($userNo, $settingNo));
  }
}
