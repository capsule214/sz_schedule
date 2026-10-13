<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('km_resource', function (Blueprint $table): void {
            $table->smallInteger('resource_type_id')->default(0);
            $table->integer('x1')->default(0);
            $table->integer('y1')->default(0);
            $table->integer('x2')->default(0);
            $table->integer('y2')->default(0);
        });

        // ローカルSQLiteの既存サンプルを、初回表示でも確認できる格子座標へ配置する。
        if (DB::connection()->getDriverName() === 'sqlite') {
            $floorIndexes = [];
            DB::table('km_resource')
                ->orderBy('location_type_id')
                ->orderBy('sort_no')
                ->orderBy('resource_id')
                ->get(['resource_id', 'location_type_id'])
                ->each(function ($resource) use (&$floorIndexes): void {
                    $floorId = (int) $resource->location_type_id;
                    $index = $floorIndexes[$floorId] ?? 0;
                    $floorIndexes[$floorId] = $index + 1;
                    $column = $index % 10;
                    $row = intdiv($index, 10);

                    DB::table('km_resource')->where('resource_id', $resource->resource_id)->update([
                        'resource_type_id' => 1,
                        'x1' => 120 + $column * 480,
                        'y1' => 150 + $row * 150,
                        'x2' => 520 + $column * 480,
                        'y2' => 260 + $row * 150,
                    ]);
                });
        }
    }

    public function down(): void
    {
        Schema::table('km_resource', function (Blueprint $table): void {
            $table->dropColumn(['resource_type_id', 'x1', 'y1', 'x2', 'y2']);
        });
    }
};
