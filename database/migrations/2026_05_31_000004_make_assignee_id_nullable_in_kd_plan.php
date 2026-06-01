<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::table('kd_plan', function (Blueprint $table) {
      $table->dropForeign(['assignee_id']);
      $table->unsignedBigInteger('assignee_id')->nullable()->change();
      $table->foreign('assignee_id')->references('worker_id')->on('km_worker')->nullOnDelete();
    });
  }

  public function down(): void
  {
    Schema::table('kd_plan', function (Blueprint $table) {
      $table->dropForeign(['assignee_id']);
      $table->unsignedBigInteger('assignee_id')->nullable(false)->change();
      $table->foreign('assignee_id')->references('worker_id')->on('km_worker');
    });
  }
};
