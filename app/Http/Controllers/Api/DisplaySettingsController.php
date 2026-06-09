<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DisplaySettingsController extends Controller
{
  /** スロット数（0〜SLOT_COUNT-1） */
  private const SLOT_COUNT = 5;

  // ---------------------------------------------------------------
  // デフォルト値
  // ---------------------------------------------------------------
  private function defaults(): array
  {
    return [
      // 共通
      'duration'        => 1,
      'flgdiff'         => false,
      'flgkeppin'       => false,
      'flgsyoyo'        => false,
      'flgukeoi'        => false,

      // 場所タブ
      'pllocation'      => 3,
      'plscale'         => 1,

      // 装置タブ
      'sbcolor'         => 0,
      'sbdspdate'       => false,
      'sbdspincharge'   => false,
      'sbdspplplan'     => false,
      'flggoso'         => false,
      'sboption'        => 0,
      'synobody'        => false,
      'sborder'         => 0,
      'sbsbmb'          => 0,
      'sbscale'         => 1,
      'sbequiptype'     => -1,
      'sbinchargelist'  => [],
      'sbmodellist'     => [],
      'sbstatuslist'    => [],
      'sbszgrouplist'   => [],

      // 担当者タブ
      'sycolor'         => 0,
      'sygroup'         => 0,
      'syslace'         => 1,
      'syteamlist'      => [],
      'sytasklist'      => [],

      // タスクタブ
      'tksbmb'          => 0,
      'tkslace'         => 1,
      'tktasklist'      => [],
    ];
  }

  // ---------------------------------------------------------------
  // ユーザーキー取得
  // ---------------------------------------------------------------
  private function userNo(Request $request): string
  {
    return (string) $request->user()->getKey();
  }

  // ---------------------------------------------------------------
  // 正規化
  // ---------------------------------------------------------------
  private function normalize(array $in): array
  {
    $d = array_merge($this->defaults(), $in);

    // 整数スカラー
    $d['duration']    = max(1, (int) $d['duration']);
    $d['pllocation']  = (int) $d['pllocation'];
    $d['plscale']     = (int) $d['plscale'];
    $d['sbcolor']     = (int) $d['sbcolor'];
    $d['sboption']    = (int) $d['sboption'];
    $d['sborder']     = (int) $d['sborder'];
    $d['sbsbmb']      = (int) $d['sbsbmb'];
    $d['sbscale']     = (int) $d['sbscale'];
    $d['sbequiptype'] = (int) $d['sbequiptype'];
    $d['sycolor']     = (int) $d['sycolor'];
    $d['sygroup']     = (int) $d['sygroup'];
    $d['syslace']     = (int) $d['syslace'];
    $d['tksbmb']      = (int) $d['tksbmb'];
    $d['tkslace']     = (int) $d['tkslace'];

    // 真偽値
    foreach (['flgdiff', 'flgkeppin', 'flgsyoyo', 'flgukeoi',
              'sbdspdate', 'sbdspincharge', 'sbdspplplan', 'flggoso', 'synobody'] as $key) {
      $d[$key] = (bool) $d[$key];
    }

    // 整数配列
    foreach (['sbmodellist', 'sbstatuslist', 'sbszgrouplist',
              'syteamlist', 'sytasklist', 'tktasklist'] as $key) {
      $d[$key] = $this->intList($d[$key]);
    }

    // 文字列配列
    $d['sbinchargelist'] = $this->strList($d['sbinchargelist']);

    return $d;
  }

  // ---------------------------------------------------------------
  // 配列パーサー
  // ---------------------------------------------------------------
  private function intList(mixed $value): array
  {
    $arr = $this->parseList($value);
    return array_values(array_unique(array_map('intval', $arr)));
  }

  private function strList(mixed $value): array
  {
    $arr = $this->parseList($value);
    return array_values(array_unique(array_map('strval', $arr)));
  }

  private function parseList(mixed $value): array
  {
    if (is_array($value)) return $value;
    if (!is_string($value)) return [];
    $trimmed = trim($value);
    if ($trimmed === '') return [];
    // PostgreSQL配列形式 {a,b,c}
    if (str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}')) {
      $body = substr($trimmed, 1, -1);
      return $body === '' ? [] : explode(',', $body);
    }
    // JSON形式 [a,b,c]
    if (str_starts_with($trimmed, '[')) {
      $decoded = json_decode($trimmed, true);
      return is_array($decoded) ? $decoded : [];
    }
    return explode(',', $trimmed);
  }

  // ---------------------------------------------------------------
  // DB保存用: 配列 → 文字列
  // ---------------------------------------------------------------
  private function intArrayValue(array $values): string
  {
    $values = array_values(array_unique(array_map('intval', $values)));
    if (DB::connection()->getDriverName() === 'pgsql') {
      return '{' . implode(',', $values) . '}';
    }
    return json_encode($values);
  }

  private function strArrayValue(array $values): string
  {
    $values = array_values(array_unique(array_map('strval', $values)));
    if (DB::connection()->getDriverName() === 'pgsql') {
      $escaped = array_map(fn($v) => '"' . str_replace('"', '\\"', $v) . '"', $values);
      return '{' . implode(',', $escaped) . '}';
    }
    return json_encode($values);
  }

  // ---------------------------------------------------------------
  // デフォルト設定名
  // ---------------------------------------------------------------
  private function settingName(int $settingNo): string
  {
    return "表示設定" . ($settingNo + 1);
  }

  // ---------------------------------------------------------------
  // DBレコード → 設定配列
  // ---------------------------------------------------------------
  private function settingsFromRow(object $row): array
  {
    return $this->normalize([
      'duration'        => $row->duration ?? 1,
      'flgdiff'         => $row->flgdiff ?? false,
      'flgkeppin'       => $row->flgkeppin ?? false,
      'flgsyoyo'        => $row->flgsyoyo ?? false,
      'flgukeoi'        => $row->flgukeoi ?? false,

      'pllocation'      => $row->pllocation ?? 3,
      'plscale'         => $row->plscale ?? 1,

      'sbcolor'         => $row->sbcolor ?? 0,
      'sbdspdate'       => $row->sbdspdate ?? false,
      'sbdspincharge'   => $row->sbdspincharge ?? false,
      'sbdspplplan'     => $row->sbdspplplan ?? false,
      'flggoso'         => $row->flggoso ?? false,
      'sboption'        => $row->sboption ?? 0,
      'synobody'        => $row->synobody ?? false,
      'sborder'         => $row->sborder ?? 0,
      'sbsbmb'          => $row->sbsbmb ?? 0,
      'sbscale'         => $row->sbscale ?? 1,
      'sbequiptype'     => $row->sbequiptype ?? -1,
      'sbinchargelist'  => $this->strList($row->sbinchargelist ?? []),
      'sbmodellist'     => $this->intList($row->sbmodellist ?? []),
      'sbstatuslist'    => $this->intList($row->sbstatuslist ?? []),
      'sbszgrouplist'   => $this->intList($row->sbszgrouplist ?? []),

      'sycolor'         => $row->sycolor ?? 0,
      'sygroup'         => $row->sygroup ?? 0,
      'syslace'         => $row->syslace ?? 1,
      'syteamlist'      => $this->intList($row->syteamlist ?? []),
      'sytasklist'      => $this->intList($row->sytasklist ?? []),

      'tksbmb'          => $row->tksbmb ?? 0,
      'tkslace'         => $row->tkslace ?? 1,
      'tktasklist'      => $this->intList($row->tktasklist ?? []),
    ]);
  }

  // ---------------------------------------------------------------
  // 設定配列 → DB保存用配列
  // ---------------------------------------------------------------
  private function rowValues(string $userNo, int $settingNo, string $settingName, array $settings): array
  {
    $s = $this->normalize($settings);

    return [
      'user_no'         => $userNo,
      'setting_no'      => $settingNo,
      'setting_name'    => $settingName,

      'duration'        => $s['duration'],
      'flgdiff'         => $s['flgdiff'],
      'flgkeppin'       => $s['flgkeppin'],
      'flgsyoyo'        => $s['flgsyoyo'],
      'flgukeoi'        => $s['flgukeoi'],

      'pllocation'      => $s['pllocation'],
      'plscale'         => $s['plscale'],

      'sbcolor'         => $s['sbcolor'],
      'sbdspdate'       => $s['sbdspdate'],
      'sbdspincharge'   => $s['sbdspincharge'],
      'sbdspplplan'     => $s['sbdspplplan'],
      'flggoso'         => $s['flggoso'],
      'sboption'        => $s['sboption'],
      'synobody'        => $s['synobody'],
      'sborder'         => $s['sborder'],
      'sbsbmb'          => $s['sbsbmb'],
      'sbscale'         => $s['sbscale'],
      'sbequiptype'     => $s['sbequiptype'],
      'sbinchargelist'  => $this->strArrayValue($s['sbinchargelist']),
      'sbmodellist'     => $this->intArrayValue($s['sbmodellist']),
      'sbstatuslist'    => $this->intArrayValue($s['sbstatuslist']),
      'sbszgrouplist'   => $this->intArrayValue($s['sbszgrouplist']),

      'sycolor'         => $s['sycolor'],
      'sygroup'         => $s['sygroup'],
      'syslace'         => $s['syslace'],
      'syteamlist'      => $this->intArrayValue($s['syteamlist']),
      'sytasklist'      => $this->intArrayValue($s['sytasklist']),

      'tksbmb'          => $s['tksbmb'],
      'tkslace'         => $s['tkslace'],
      'tktasklist'      => $this->intArrayValue($s['tktasklist']),
    ];
  }

  // ---------------------------------------------------------------
  // スロット自動生成（存在しないスロットを補完）
  // ---------------------------------------------------------------
  private function ensureSlots(string $userNo): void
  {
    $now = now();
    $existing = DB::table('display_settings')
      ->where('user_no', $userNo)
      ->pluck('setting_no')
      ->map(fn($v) => (int) $v)
      ->all();

    for ($i = 0; $i < self::SLOT_COUNT; $i++) {
      if (in_array($i, $existing, true)) continue;
      DB::table('display_settings')->insert([
        ...$this->rowValues($userNo, $i, $this->settingName($i), $this->defaults()),
        'created_at' => $now,
        'updated_at' => $now,
      ]);
    }
  }

  // ---------------------------------------------------------------
  // ユーザーの全スロット取得
  // ---------------------------------------------------------------
  private function rowsForUser(string $userNo)
  {
    $this->ensureSlots($userNo);

    return DB::table('display_settings')
      ->where('user_no', $userNo)
      ->orderBy('setting_no')
      ->get();
  }

  // ---------------------------------------------------------------
  // レスポンスペイロード生成
  // ---------------------------------------------------------------
  private function formatPayload(string $userNo, int $activeNo): array
  {
    $rows = $this->rowsForUser($userNo);
    $active = $rows->firstWhere('setting_no', $activeNo) ?? $rows->first();
    $activeNo = (int) $active->setting_no;

    $settingsList = $rows->map(fn($row) => [
      'settingNo'   => (int) $row->setting_no,
      'settingName' => $row->setting_name ?: $this->settingName((int) $row->setting_no),
      'settings'    => $this->settingsFromRow($row),
      'isActive'    => (int) $row->setting_no === $activeNo,
    ])->values()->all();

    $payload = $this->settingsFromRow($active);
    $payload['userNo']       = $userNo;
    $payload['settingNo']    = $activeNo;
    $payload['settingName']  = $active->setting_name ?: $this->settingName($activeNo);
    $payload['settingsList'] = $settingsList;

    return $payload;
  }

  // ---------------------------------------------------------------
  // GET /api/display-settings
  // ---------------------------------------------------------------
  public function index(Request $request)
  {
    return response()->json($this->formatPayload($this->userNo($request), 0));
  }

  // ---------------------------------------------------------------
  // PUT /api/display-settings
  // ---------------------------------------------------------------
  public function update(Request $request)
  {
    $meta = $request->validate([
      'settingNo'   => 'nullable|integer|min:0|max:' . (self::SLOT_COUNT - 1),
      'settingName' => 'nullable|string|max:80',
    ]);

    $settingNo = (int) ($meta['settingNo'] ?? 0);
    $settingName = trim((string) ($meta['settingName'] ?? ''));
    if ($settingName === '') $settingName = $this->settingName($settingNo);

    $payload = $request->only(array_keys($this->defaults()));

    $userNo = $this->userNo($request);
    $this->ensureSlots($userNo);

    DB::transaction(function () use ($userNo, $settingNo, $settingName, $payload) {
      DB::table('display_settings')->updateOrInsert(
        ['user_no' => $userNo, 'setting_no' => $settingNo],
        [
          ...$this->rowValues($userNo, $settingNo, $settingName, $payload),
          'created_at' => now(),
          'updated_at' => now(),
        ],
      );
    });

    return response()->json($this->formatPayload($userNo, $settingNo));
  }
}
