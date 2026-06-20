<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            if (! Schema::hasColumn('kd_plan', 'educator_worker_id')) {
                $table->integer('educator_worker_id')->nullable()->after('worker_id');
            }
            if (! Schema::hasColumn('kd_plan', 'planned_minutes')) {
                $table->integer('planned_minutes')->default(0)->after('end_date');
            }
            if (! Schema::hasColumn('kd_plan', 'price')) {
                $table->integer('price')->default(0)->after('planned_minutes');
            }
            if (! Schema::hasColumn('kd_plan', 'remark')) {
                $table->text('remark')->default('')->after('price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            foreach (['educator_worker_id', 'planned_minutes', 'price', 'remark'] as $column) {
                if (Schema::hasColumn('kd_plan', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
