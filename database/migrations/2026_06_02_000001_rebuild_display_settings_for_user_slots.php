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
      $table->text('user_no');
      $table->smallInteger('setting_no');
      $table->text('setting_name')->nullable();
      $table->smallInteger('duration')->default(1);
      $table->text('sbmodellist')->nullable();
      $table->text('syteamlist')->nullable();
      $table->text('sytasklist')->nullable();
      $table->text('tktasklist')->nullable();
      $table->boolean('show_reserve_in_device')->default(false);
      $table->boolean('show_resource_in_device')->default(false);
      $table->boolean('show_location_in_device')->default(false);
      $table->boolean('show_unassigned_worker')->default(false);
      $table->boolean('show_shipping_date_in_device')->default(false);
      $table->boolean('show_responsible_in_device')->default(false);
      $table->timestamps();

      $table->primary(['user_no', 'setting_no']);
    });

    if (DB::connection()->getDriverName() === 'pgsql') {
      DB::statement("ALTER TABLE display_settings ALTER COLUMN sbmodellist TYPE smallint[] USING COALESCE(sbmodellist::smallint[], '{}')");
      DB::statement("ALTER TABLE display_settings ALTER COLUMN sbmodellist SET DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ALTER COLUMN syteamlist TYPE smallint[] USING COALESCE(syteamlist::smallint[], '{}')");
      DB::statement("ALTER TABLE display_settings ALTER COLUMN syteamlist SET DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ALTER COLUMN sytasklist TYPE smallint[] USING COALESCE(sytasklist::smallint[], '{}')");
      DB::statement("ALTER TABLE display_settings ALTER COLUMN sytasklist SET DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ALTER COLUMN tktasklist TYPE smallint[] USING COALESCE(tktasklist::smallint[], '{}')");
      DB::statement("ALTER TABLE display_settings ALTER COLUMN tktasklist SET DEFAULT '{}'");
    }

    $legacy = $legacyRows->firstWhere('key', 'main') ?: $legacyRows->first();
    if ($legacy) {
      $value = json_decode($legacy->value, true) ?: [];
      DB::table('display_settings')->insert([
        ...$this->settingRow('1', 1, '表示設定1', $value, true),
        'created_at' => now(),
        'updated_at' => now(),
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

  private function settingRow(string $userNo, int $settingNo, string $settingName, array $settings, bool $isActive): array
  {
    $showLocation = (bool) ($settings['showLocationInDevice'] ?? $settings['showResourceInDevice'] ?? $settings['showReserveInDevice'] ?? false);

    return [
      'user_no'                          => $userNo,
      'setting_no'                       => $settingNo,
      'setting_name'                     => $settingName,
      'duration'                         => (int) ($settings['duration'] ?? 1),
      'sbmodellist'                      => $this->arrayValue($settings['sbmodellist'] ?? $settings['selectedKisyuIds'] ?? []),
      'syteamlist'                       => $this->arrayValue($settings['syteamlist'] ?? $settings['selectedTeamIds'] ?? []),
      'sytasklist'                       => $this->arrayValue($settings['sytasklist'] ?? $settings['selectedTaskIds'] ?? []),
      'tktasklist'                       => $this->arrayValue($settings['tktasklist'] ?? $settings['selectedTaskTabIds'] ?? []),
      'show_reserve_in_device'           => $showLocation,
      'show_resource_in_device'          => $showLocation,
      'show_location_in_device'          => $showLocation,
      'show_unassigned_worker'           => (bool) ($settings['showUnassignedWorker'] ?? false),
      'show_shipping_date_in_device'     => (bool) ($settings['showShippingDateInDevice'] ?? false),
      'show_responsible_in_device'       => (bool) ($settings['showResponsibleInDevice'] ?? false),
    ];
  }

  private function arrayValue(array $values): string
  {
    $values = array_values(array_unique(array_map('intval', $values)));
    if (DB::connection()->getDriverName() === 'pgsql') {
      return '{' . implode(',', $values) . '}';
    }
    return json_encode($values);
  }
};
