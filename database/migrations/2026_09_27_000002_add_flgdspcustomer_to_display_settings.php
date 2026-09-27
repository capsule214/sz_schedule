<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('display_settings', function (Blueprint $table) {
      $table->boolean('flgdspcustomer')->default(false)->after('sbdspincharge');
    });
  }

  public function down(): void
  {
    Schema::table('display_settings', function (Blueprint $table) {
      $table->dropColumn('flgdspcustomer');
    });
  }
};
