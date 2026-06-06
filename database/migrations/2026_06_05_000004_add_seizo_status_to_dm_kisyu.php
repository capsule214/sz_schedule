<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  // 0:試作機 1:量産機 2:生産終了機
  public function up(): void
  {
    Schema::table('dm_kisyu', function (Blueprint $table) {
      $table->tinyInteger('seizo_status')->default(1)->after('sort_no');
    });

    // 既存データに均等付与（kisyu_id % 3 で分散）
    DB::table('dm_kisyu')->orderBy('kisyu_id')->each(function ($row) {
      DB::table('dm_kisyu')
        ->where('kisyu_id', $row->kisyu_id)
        ->update(['seizo_status' => $row->kisyu_id % 3]);
    });
  }

  public function down(): void
  {
    Schema::table('dm_kisyu', function (Blueprint $table) {
      $table->dropColumn('seizo_status');
    });
  }
};
