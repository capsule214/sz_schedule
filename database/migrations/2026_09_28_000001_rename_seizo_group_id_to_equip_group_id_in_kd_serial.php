<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    if (Schema::hasColumn('kd_serial', 'seizo_group_id') && ! Schema::hasColumn('kd_serial', 'equip_group_id')) {
      Schema::table('kd_serial', function (Blueprint $table) {
        $table->renameColumn('seizo_group_id', 'equip_group_id');
      });
    } elseif (! Schema::hasColumn('kd_serial', 'equip_group_id')) {
      Schema::table('kd_serial', function (Blueprint $table) {
        $table->integer('equip_group_id')->default(0)->after('customer_name');
      });
    }

    Schema::table('kd_serial', function (Blueprint $table) {
      $table->index(['kisyu_id', 'equip_group_id', 'deleted'], 'kd_serial_kisyu_equip_group_deleted_index');
    });
  }

  public function down(): void
  {
    Schema::table('kd_serial', function (Blueprint $table) {
      $table->dropIndex('kd_serial_kisyu_equip_group_deleted_index');
    });

    if (Schema::hasColumn('kd_serial', 'equip_group_id') && ! Schema::hasColumn('kd_serial', 'seizo_group_id')) {
      Schema::table('kd_serial', function (Blueprint $table) {
        $table->renameColumn('equip_group_id', 'seizo_group_id');
      });
    }
  }
};
