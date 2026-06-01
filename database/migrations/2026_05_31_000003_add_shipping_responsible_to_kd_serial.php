<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('kd_serial', function (Blueprint $table) {
      $table->date('shipping_date')->nullable()->after('serial_no');
      $table->string('responsible', 100)->nullable()->after('shipping_date');
    });
  }

  public function down(): void
  {
    Schema::table('kd_serial', function (Blueprint $table) {
      $table->dropColumn(['shipping_date', 'responsible']);
    });
  }
};
