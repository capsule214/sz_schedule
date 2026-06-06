<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('kd_serial', function (Blueprint $table) {
      // 1:AAA 2:BBB 3:CCC  null は未分類
      $table->tinyInteger('equip_type_id')->nullable()->after('serial_no');
    });

    // 既存データに 1/2/3 をランダム（擬似乱数）で付与
    $ids = DB::table('kd_serial')->pluck('serial_id');
    foreach ($ids as $id) {
      DB::table('kd_serial')
        ->where('serial_id', $id)
        ->update(['equip_type_id' => ($id % 3) + 1]);  // 1/2/3 を均等に分散
    }
  }

  public function down(): void
  {
    Schema::table('kd_serial', function (Blueprint $table) {
      $table->dropColumn('equip_type_id');
    });
  }
};
