<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    // 旧テーブルを削除
    Schema::dropIfExists('km_calendar');

    // 新テーブルを作成
    Schema::create('dr_calendar', function (Blueprint $table) {
      $table->date('calendar_date')->primary();
      $table->smallInteger('date_type')->default(0)->comment('0=平日 1=週末(土日) 6=会社休業日');
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('dr_calendar');

    Schema::create('km_calendar', function (Blueprint $table) {
      $table->date('date')->primary();
      $table->tinyInteger('day_type')->comment('1=祝日 2=特別出勤');
      $table->string('memo', 100)->nullable();
    });
  }
};
