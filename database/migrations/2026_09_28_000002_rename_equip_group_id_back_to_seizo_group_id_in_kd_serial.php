<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    if (Schema::hasColumn('kd_serial', 'equip_group_id') && ! Schema::hasColumn('kd_serial', 'seizo_group_id')) {
      Schema::table('kd_serial', function (Blueprint $table) {
        $table->dropIndex('kd_serial_kisyu_equip_group_deleted_index');
        $table->renameColumn('equip_group_id', 'seizo_group_id');
      });

      Schema::table('kd_serial', function (Blueprint $table) {
        $table->index(['kisyu_id', 'seizo_group_id', 'deleted'], 'kd_serial_kisyu_seizo_group_deleted_index');
      });
    }
  }

  public function down(): void
  {
    if (Schema::hasColumn('kd_serial', 'seizo_group_id') && ! Schema::hasColumn('kd_serial', 'equip_group_id')) {
      Schema::table('kd_serial', function (Blueprint $table) {
        $table->dropIndex('kd_serial_kisyu_seizo_group_deleted_index');
        $table->renameColumn('seizo_group_id', 'equip_group_id');
      });

      Schema::table('kd_serial', function (Blueprint $table) {
        $table->index(['kisyu_id', 'equip_group_id', 'deleted'], 'kd_serial_kisyu_equip_group_deleted_index');
      });
    }
  }
};
