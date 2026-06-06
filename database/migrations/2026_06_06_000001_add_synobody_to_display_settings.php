<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('display_settings', function (Blueprint $table) {
      $table->boolean('synobody')->default(false)->after('sboption'); // 社員未定も表示
    });
  }

  public function down(): void
  {
    Schema::table('display_settings', function (Blueprint $table) {
      $table->dropColumn('synobody');
    });
  }
};
