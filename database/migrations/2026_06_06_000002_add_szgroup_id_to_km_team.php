<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('km_team', function (Blueprint $table) {
      $table->tinyInteger('szgroup_id')->nullable()->after('sort_no'); // 製造部署: 1=1部, 2=2部, 3=3部
    });

    // 既存チームに適当な値を割り当て
    DB::table('km_team')->orderBy('team_id')->each(function ($team) {
      DB::table('km_team')
        ->where('team_id', $team->team_id)
        ->update(['szgroup_id' => ($team->team_id % 3) + 1]);
    });
  }

  public function down(): void
  {
    Schema::table('km_team', function (Blueprint $table) {
      $table->dropColumn('szgroup_id');
    });
  }
};
