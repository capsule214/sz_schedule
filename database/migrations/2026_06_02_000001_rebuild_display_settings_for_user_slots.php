<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    $legacyRows = collect();
    if (Schema::hasTable('display_settings')) {
      $legacyRows = DB::table('display_settings')->get();
      Schema::rename('display_settings', 'display_settings_legacy');
    }

    Schema::create('display_settings', function (Blueprint $table) {
      $table->unsignedBigInteger('user_no');
      $table->unsignedTinyInteger('setting_no');
      $table->string('setting_name', 80);
      $table->text('value');
      $table->boolean('is_active')->default(false);
      $table->timestamps();

      $table->primary(['user_no', 'setting_no']);
      $table->index(['user_no', 'is_active']);
    });

    $legacy = $legacyRows->firstWhere('key', 'main') ?: $legacyRows->first();
    if ($legacy) {
      DB::table('display_settings')->insert([
        'user_no'      => 1,
        'setting_no'   => 1,
        'setting_name' => '表示設定1',
        'value'        => $legacy->value,
        'is_active'    => true,
        'created_at'   => now(),
        'updated_at'   => now(),
      ]);
    }

    Schema::dropIfExists('display_settings_legacy');
  }

  public function down(): void
  {
    Schema::dropIfExists('display_settings');

    Schema::create('display_settings', function (Blueprint $table) {
      $table->integer('worker_id')->primary();
      $table->string('key')->unique();
      $table->text('value');
    });
  }
};
