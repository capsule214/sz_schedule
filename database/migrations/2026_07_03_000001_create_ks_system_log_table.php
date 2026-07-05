<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::create('ks_system_log', function (Blueprint $table) {
      $table->id();
      $table->bigInteger('plan_id')->index();
      $table->text('diff'); // 登録内容 / 更新差分 / 削除フラグ を JSON で保持する
      $table->timestamp('created_at')->nullable();
    });
  }

  public function down(): void
  {
    Schema::dropIfExists('ks_system_log');
  }
};
