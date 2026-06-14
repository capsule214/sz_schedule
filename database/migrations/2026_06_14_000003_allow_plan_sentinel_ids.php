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
            $table->dropForeign(['serial_id']);
            $table->bigInteger('serial_id')->change();
        });

        try {
            Schema::table('kd_plan', function (Blueprint $table) {
                $table->dropForeign(['morder_id']);
            });
        } catch (Throwable) {
            // Fresh migrations create morder_id without a foreign key.
        }

        Schema::table('kd_plan', function (Blueprint $table) {
            $table->bigInteger('morder_id')->default(-1)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_id')->change();
            $table->foreign('serial_id')->references('serial_id')->on('kd_serial');
        });
    }
};
