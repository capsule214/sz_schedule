<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('km_location', function (Blueprint $table) {
      $table->tinyInteger('floor_level')->default(3)->comment('3=3F 4=4F 5=5F')->after('sort_no');
    });

    // 既存レコードに 3/4/5 を循環で割り当て
    $locations = DB::table('km_location')->orderBy('location_id')->get();
    $floors = [3, 4, 5];
    foreach ($locations as $idx => $loc) {
      DB::table('km_location')
        ->where('location_id', $loc->location_id)
        ->update(['floor_level' => $floors[$idx % 3]]);
    }
  }

  public function down(): void
  {
    Schema::table('km_location', function (Blueprint $table) {
      $table->dropColumn('floor_level');
    });
  }
};
