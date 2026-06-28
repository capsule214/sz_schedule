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
      // 製造グループ（1:1部 2:2部 3:3部）。null=全グループ共通の工程
      $table->tinyInteger('seizo_group_id')->nullable()->after('task_type_id');
    });

    // 既存データに 1/2/3 を均等付与（kd_serial.seizo_group_id と噛み合うよう仮設定）
    $ids = DB::table('km_task')->pluck('task_id');
    foreach ($ids as $id) {
      DB::table('km_task')
        ->where('task_id', $id)
        ->update(['seizo_group_id' => (($id + 1) % 3) + 1]);
    }
  }

  public function down(): void
  {
    Schema::table('km_task', function (Blueprint $table) {
      $table->dropColumn('seizo_group_id');
    });
  }
};
