<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('kk_task_type', function (Blueprint $table) {
      $table->tinyInteger('task_type_id')->primary();
      $table->string('task_type_name', 40);
    });

    DB::table('kk_task_type')->insert([
      ['task_type_id' => 1, 'task_type_name' => '作業予定'],
      ['task_type_id' => 2, 'task_type_name' => '製番予定'],
      ['task_type_id' => 3, 'task_type_name' => '個人予定'],
    ]);
  }

  public function down(): void
  {
    Schema::dropIfExists('kk_task_type');
  }
};
