<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        try {
            Schema::table('kd_reserve', function (Blueprint $table) {
                $table->dropForeign(['serial_id']);
            });
        } catch (Throwable) {
            // Fresh or already-updated databases may not have this foreign key.
        }
    }

    public function down(): void
    {
        try {
            Schema::table('kd_reserve', function (Blueprint $table) {
                $table->foreign('serial_id')->references('serial_id')->on('kd_serial');
            });
        } catch (Throwable) {
            // Rows with serial_id=0 cannot be constrained back to kd_serial.
        }
    }
};
