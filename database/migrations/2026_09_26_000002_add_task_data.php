<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {

    DB::table('km_task')->insert([
      ['task_type_id' => 2, 'shikakari_type_id' => 1, 'task_name' => '標準タスク', 'sort_no' => 1],
      ['task_type_id' => 2, 'shikakari_type_id' => 2, 'task_name' => '客先タスク', 'sort_no' => 2],
      ['task_type_id' => 2, 'shikakari_type_id' => 3, 'task_name' => '検査', 'sort_no' => 3],
      ['task_type_id' => 2, 'shikakari_type_id' => 4, 'task_name' => '出荷', 'sort_no' => 4],
    ]);
  }

  public function down(): void
  {
    DB::table('km_task')
      ->where(function ($query) {
        $query->where(fn ($task) => $task->where('shikakari_type_id', 1)->where('task_name', '標準タスク'))
          ->orWhere(fn ($task) => $task->where('shikakari_type_id', 2)->where('task_name', '客先タスク'))
          ->orWhere(fn ($task) => $task->where('shikakari_type_id', 3)->where('task_name', '検査'))
          ->orWhere(fn ($task) => $task->where('shikakari_type_id', 4)->where('task_name', '出荷'));
      })
      ->delete();

  }
};
