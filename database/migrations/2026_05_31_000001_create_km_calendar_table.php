<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('km_calendar', function (Blueprint $table) {
      $table->date('date')->primary();
      $table->tinyInteger('day_type')->comment('1=祝日 2=特別出勤');
      $table->string('memo', 100)->nullable();
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('km_calendar');
  }
};
