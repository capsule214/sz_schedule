<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            $table->bigInteger('morder_id')->default(-1)->after('serial_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            $table->dropColumn('morder_id');
        });
    }
};
