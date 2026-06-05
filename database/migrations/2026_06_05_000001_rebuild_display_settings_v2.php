<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
  public function up(): void
  {
    Schema::dropIfExists('display_settings');

    Schema::create('display_settings', function (Blueprint $table) {
      $table->text('user_no');
      $table->smallInteger('setting_no');                         // スロット番号 0〜4
      $table->text('setting_name')->nullable();                   // 設定名

      // 共通フラグ
      $table->smallInteger('duration')->default(1);               // 表示期間（日数）
      $table->boolean('flgdiff')->default(false);                 // 当日予定変更強調
      $table->boolean('flgkeppin')->default(false);               // 部品欠品表示
      $table->boolean('flgsyoyo')->default(false);                // 所要日連動表示
      $table->boolean('flgukeoi')->default(false);                // 請負発注表示

      // 場所タブ
      $table->smallInteger('pllocation')->default(3);             // 表示階層
      $table->smallInteger('plslace')->default(1);                // 1:日単位 6:時間単位

      // 装置タブ
      $table->smallInteger('sbcolor')->default(0);                // 0:タスクカラー 1:機種カラー
      $table->boolean('sbdspdate')->default(false);               // 出荷日列表示
      $table->boolean('sbdspincharge')->default(false);           // 責任者列表示
      $table->boolean('sbdspplplan')->default(false);             // 場所予定も表示
      $table->boolean('flggoso')->default(false);                 // 後送有無を表示
      $table->smallInteger('sboption')->default(0);               // 0:未完了のみ 1:完了も表示
      $table->smallInteger('sborder')->default(0);                // 0:製番順 1:着工日順 2:出荷日順
      $table->smallInteger('sbsbmb')->default(0);                 // 0:製番 1:M番
      $table->smallInteger('sbslace')->default(1);                // 1:日単位 6:時間単位
      $table->smallInteger('sbequiptype')->default(-1);           // 装置区分 -1:全て 1:AAA 2:BBB 3:CCC

      // 担当者タブ
      $table->smallInteger('sycolor')->default(0);                // 0:タスクカラー 1:機種カラー
      $table->smallInteger('sygroup')->default(0);                // 製造部署
      $table->smallInteger('syslace')->default(1);                // 1:日単位 6:時間単位

      // タスクタブ
      $table->smallInteger('tksbmb')->default(0);                 // 0:製番 1:M番
      $table->smallInteger('tkslace')->default(1);                // 1:日単位 6:時間単位

      $table->timestamps();

      $table->primary(['user_no', 'setting_no']);
    });

    // PostgreSQL: 配列型カラムを追加
    if (DB::connection()->getDriverName() === 'pgsql') {
      DB::statement("ALTER TABLE display_settings ADD COLUMN sbinchargelist  text[]       NOT NULL DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ADD COLUMN sbmodellist     smallint[]   NOT NULL DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ADD COLUMN sbstatuslist    smallint[]   NOT NULL DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ADD COLUMN sbszgrouplist   smallint[]   NOT NULL DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ADD COLUMN syteamlist      smallint[]   NOT NULL DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ADD COLUMN sytasklist      smallint[]   NOT NULL DEFAULT '{}'");
      DB::statement("ALTER TABLE display_settings ADD COLUMN tktasklist      smallint[]   NOT NULL DEFAULT '{}'");
    } else {
      // SQLite / MySQL: JSON文字列として保存
      Schema::table('display_settings', function (Blueprint $table) {
        $table->text('sbinchargelist')->nullable();
        $table->text('sbmodellist')->nullable();
        $table->text('sbstatuslist')->nullable();
        $table->text('sbszgrouplist')->nullable();
        $table->text('syteamlist')->nullable();
        $table->text('sytasklist')->nullable();
        $table->text('tktasklist')->nullable();
      });
    }
  }

  public function down(): void
  {
    Schema::dropIfExists('display_settings');
  }
};
