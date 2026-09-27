<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('kk_shikakari_type', function (Blueprint $table) {
      $table->smallInteger('shikakari_type_id')->primary()->default(0);
      $table->integer('sort_no')->default(0);
      $table->text('shikakari_type_name')->default('');
    });

    DB::table('kk_shikakari_type')->insert([
      ['shikakari_type_id' => 1, 'sort_no' => 1, 'shikakari_type_name' => '標準'],
      ['shikakari_type_id' => 2, 'sort_no' => 2, 'shikakari_type_name' => '客先'],
      ['shikakari_type_id' => 3, 'sort_no' => 3, 'shikakari_type_name' => '検査'],
      ['shikakari_type_id' => 4, 'sort_no' => 4, 'shikakari_type_name' => '出荷'],
    ]);

    Schema::table('km_task', function (Blueprint $table) {
      $table->smallInteger('shikakari_type_id')->default(0)->after('task_type_id');
      $table->index('shikakari_type_id', 'km_task_shikakari_type_id_index');
    });

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

    Schema::table('km_task', function (Blueprint $table) {
      $table->dropIndex('km_task_shikakari_type_id_index');
      $table->dropColumn('shikakari_type_id');
    });

    Schema::dropIfExists('kk_shikakari_type');
  }
};
