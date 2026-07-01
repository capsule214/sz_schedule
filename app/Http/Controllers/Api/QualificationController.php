<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KmQualification;
use App\Models\KmSkillmap;
use Illuminate\Http\Request;

class QualificationController extends Controller
{
  public function status(Request $request)
  {
    $data = $request->validate([
      'kisyu_id' => ['nullable', 'integer'],
      'task_id' => ['nullable', 'integer'],
      'worker_id' => ['nullable', 'integer'],
    ]);

    $kisyuId = $data['kisyu_id'] ?? null;
    $taskId = $data['task_id'] ?? null;
    $workerId = $data['worker_id'] ?? null;

    if (! $kisyuId || ! $taskId) {
      return response()->json([
        'qualifications' => [],
        'skillLevel' => 0,
        'skillLevelName' => 'なし',
      ]);
    }

    $qualifications = KmQualification::where('kisyu_id', $kisyuId)
      ->where('task_id', $taskId)
      ->orderBy('qualification_id')
      ->get();

    $skillLevel = 0;
    if ($workerId) {
      $skillLevel = (int) (KmSkillmap::where('kisyu_id', $kisyuId)
        ->where('task_id', $taskId)
        ->where('worker_id', $workerId)
        ->max('skill_level') ?? 0);
    }

    return response()->json([
      'qualifications' => $qualifications->map(fn ($q) => [
        'qualificationId' => $q->qualification_id,
        'qualificationName' => $q->qualification_name,
        'hasSkill' => $skillLevel > 0,
      ])->values(),
      'skillLevel' => $skillLevel,
      'skillLevelName' => $this->skillLevelName($skillLevel),
    ]);
  }

  private function skillLevelName(int $skillLevel): string
  {
    return match ($skillLevel) {
      1 => '初心者',
      2 => 'プロ',
      default => 'なし',
    };
  }
}
