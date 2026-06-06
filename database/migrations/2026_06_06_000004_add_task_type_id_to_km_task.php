<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('km_task', function (Blueprint $table) {
      $table->tinyInteger('task_type_id')->nullable()->after('process_id'); // kk_task_type FK
    });

    // 既存タスクに適当な値を割り当て（task_id % 3 + 1 → 1,2,3）
    DB::table('km_task')->orderBy('task_id')->each(function ($task) {
      DB::table('km_task')
        ->where('task_id', $task->task_id)
        ->update(['task_type_id' => ($task->task_id % 3) + 1]);
    });
  }

  public function down(): void
  {
    Schema::table('km_task', function (Blueprint $table) {
      $table->dropColumn('task_type_id');
    });
  }
};
