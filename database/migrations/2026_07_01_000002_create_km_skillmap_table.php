<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('km_skillmap', function (Blueprint $table) {
            $table->increments('skillmap_id');
            $table->integer('kisyu_id')->nullable();
            $table->integer('task_id')->nullable();
            $table->integer('worker_id')->default(0);
            $table->integer('skill_level')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('km_skillmap');
    }
};
