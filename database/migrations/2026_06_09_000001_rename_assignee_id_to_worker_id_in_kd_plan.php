<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            $table->renameColumn('assignee_id', 'worker_id');
        });
    }

    public function down(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            $table->renameColumn('worker_id', 'assignee_id');
        });
    }
};
