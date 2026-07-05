<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * 予定データ（kd_plan）の変更履歴ログ。
 * diff には登録時は登録内容、更新時は更新差分、削除時は {"deleted":1} を JSON で保持する。
 */
class KsSystemLog extends Model
{
  protected $table = 'ks_system_log';

  const UPDATED_AT = null;    // created_at のみ管理する

  protected $fillable = ['plan_id', 'diff'];

  /** 1件の予定に対する変更内容を記録する */
  public static function record(int $planId, array $diff): void
  {
    static::create([
      'plan_id' => $planId,
      'diff' => json_encode($diff, JSON_UNESCAPED_UNICODE),
    ]);
  }

  /** 複数の予定に同一の変更内容（一括削除など）を記録する */
  public static function recordMany(array $planIds, array $diff): void
  {
    if (empty($planIds)) {
      return;
    }

    $json = json_encode($diff, JSON_UNESCAPED_UNICODE);
    $now = now();
    static::insert(array_map(fn ($id) => [
      'plan_id' => $id,
      'diff' => $json,
      'created_at' => $now,
    ], $planIds));
  }
}
