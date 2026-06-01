<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('km_process', function (Blueprint $table) {
      $table->id('process_id');
      $table->string('process_name');
      $table->integer('sort_no')->default(0);
    });

    Schema::table('km_task', function (Blueprint $table) {
      $table->unsignedBigInteger('process_id')->nullable()->after('task_id');
      $table->foreign('process_id')
          ->references('process_id')->on('km_process')
          ->nullOnDelete();
    });
  }

  public function down(): void
  {
    Schema::table('km_task', function (Blueprint $table) {
      $table->dropForeign(['process_id']);
      $table->dropColumn('process_id');
    });
    Schema::dropIfExists('km_process');
  }
};
