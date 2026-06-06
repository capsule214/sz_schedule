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
      // 1:1部 2:2部 3:3部
      $table->tinyInteger('szgroup_id')->nullable()->after('equip_type_id');
    });

    // 既存データに 1/2/3 を均等付与（equip_type_id とずらして分散）
    $ids = DB::table('kd_serial')->pluck('serial_id');
    foreach ($ids as $id) {
      DB::table('kd_serial')
        ->where('serial_id', $id)
        ->update(['szgroup_id' => (($id + 1) % 3) + 1]);
    }
  }

  public function down(): void
  {
    Schema::table('kd_serial', function (Blueprint $table) {
      $table->dropColumn('szgroup_id');
    });
  }
};
