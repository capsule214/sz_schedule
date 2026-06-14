<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

/**
 * deleted 整数フラグによる論理削除を扱うトレイト。
 *
 * グローバルスコープを付与し、リレーション（eager load）やサブクエリを含む
 * 全てのクエリで自動的に deleted = 0 のレコードのみを抽出する。
 * 論理削除済みも含めたい場合は withDeleted() スコープを使用する。
 */
trait SoftDeleteFlag
{
    public static function bootSoftDeleteFlag(): void
    {
        static::addGlobalScope('notDeleted', function (Builder $builder) {
            $model = $builder->getModel();
            // JOIN を含むクエリでも曖昧にならないようテーブル名で修飾する
            $builder->where($model->getTable() . '.deleted', 0);
        });
    }

    /** 論理削除済みレコードも含めて抽出する */
    public function scopeWithDeleted(Builder $query): Builder
    {
        return $query->withoutGlobalScope('notDeleted');
    }
}
