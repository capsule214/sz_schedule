<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kd_reserve', function (Blueprint $table) {
            if (! Schema::hasColumn('kd_reserve', 'updated_at')) {
                $table->timestamp('updated_at')->nullable()->after('end_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('kd_reserve', function (Blueprint $table) {
            if (Schema::hasColumn('kd_reserve', 'updated_at')) {
                $table->dropColumn('updated_at');
            }
        });
    }
};
