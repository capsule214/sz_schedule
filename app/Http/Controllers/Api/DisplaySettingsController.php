<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\DisplaySettingsStore;
use Illuminate\Http\Request;

class DisplaySettingsController extends Controller
{
  public function __construct(private readonly DisplaySettingsStore $settingsStore) {}

  public function index(Request $request)
  {
    return response()->json(
      $this->settingsStore->formatPayload($this->userNo($request), 0),
    );
  }

  public function update(Request $request)
  {
    $meta = $request->validate([
      'settingNo' => 'nullable|integer|min:0|max:'.(DisplaySettingsStore::SLOT_COUNT - 1),
      'settingName' => 'nullable|string|max:80',
    ]);

    $settingNo = (int) ($meta['settingNo'] ?? 0);
    $settingName = trim((string) ($meta['settingName'] ?? ''));
    if ($settingName === '') {
      $settingName = $this->settingsStore->settingName($settingNo);
    }

    $userNo = $this->userNo($request);
    $this->settingsStore->save(
      $userNo,
      $settingNo,
      $settingName,
      $request->only(array_keys($this->settingsStore->defaults())),
    );

    return response()->json($this->settingsStore->formatPayload($userNo, $settingNo));
  }

  private function userNo(Request $request): string
  {
    return (string) $request->user()->getKey();
  }
}
