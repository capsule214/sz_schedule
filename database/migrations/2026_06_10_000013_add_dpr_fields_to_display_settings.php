<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('display_settings', function (Blueprint $table) {
            $table->smallInteger('dprduration')->default(4);    // 表示期間
            $table->smallInteger('dprorder')->default(0);       // 表示順
            $table->smallInteger('dprcolor')->default(0);       // タスク表示カラー
            $table->boolean('dprflgseiban')->default(false);    // 製番予定も表示
        });

        // 配列カラム: PostgreSQL は native 配列型、それ以外は text(JSON)
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprmodellist          text[]       NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprsaleslocationlist  text[]       NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprpublicationyearlist text[]      NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprdeliverytypelist   smallint[]   NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprformtypelist       smallint[]   NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprclassificationlist text[]       NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprstatuslist         text[]       NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprinchargelist       text[]       NOT NULL DEFAULT '{}'");
            DB::statement("ALTER TABLE display_settings ADD COLUMN dprszgrouplist        text[]       NOT NULL DEFAULT '{}'");
        } else {
            Schema::table('display_settings', function (Blueprint $table) {
                $table->text('dprmodellist')->nullable();
                $table->text('dprsaleslocationlist')->nullable();
                $table->text('dprpublicationyearlist')->nullable();
                $table->text('dprdeliverytypelist')->nullable();
                $table->text('dprformtypelist')->nullable();
                $table->text('dprclassificationlist')->nullable();
                $table->text('dprstatuslist')->nullable();
                $table->text('dprinchargelist')->nullable();
                $table->text('dprszgrouplist')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('display_settings', function (Blueprint $table) {
            $table->dropColumn([
                'dprduration', 'dprorder', 'dprcolor', 'dprflgseiban',
                'dprmodellist', 'dprsaleslocationlist', 'dprpublicationyearlist',
                'dprdeliverytypelist', 'dprformtypelist',
                'dprclassificationlist', 'dprstatuslist', 'dprinchargelist', 'dprszgrouplist',
            ]);
        });
    }
};
