<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // PK カラム名のリネーム
        if (Schema::hasColumn('kd_location_plan', 'location_plan_id')) {
            Schema::table('kd_location_plan', function (Blueprint $table) {
                $table->renameColumn('location_plan_id', 'reserve_id');
            });
        }

        // テーブル名のリネーム
        if (Schema::hasTable('kd_location_plan')) {
            Schema::rename('kd_location_plan', 'kd_reserve');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('kd_reserve')) {
            Schema::rename('kd_reserve', 'kd_location_plan');
        }

        if (Schema::hasColumn('kd_location_plan', 'reserve_id')) {
            Schema::table('kd_location_plan', function (Blueprint $table) {
                $table->renameColumn('reserve_id', 'location_plan_id');
            });
        }
    }
};
