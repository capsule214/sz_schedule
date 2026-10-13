<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 本番では外部DBに存在するテーブル／ビュー。ローカルSQLiteにも同じ参照先を用意する。
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return;
        }

        if (! Schema::hasTable('r_dprno_serialno2')) {
            Schema::create('r_dprno_serialno2', function (Blueprint $table): void {
                $table->text('dprno');
                $table->text('receno');
                $table->unique(['dprno', 'receno']);
                $table->index('receno');
            });
        }

        if (! Schema::hasTable('dk_equip_group')) {
            Schema::create('dk_equip_group', function (Blueprint $table): void {
                $table->integer('equip_group_id')->primary();
            });
        }

        if (! Schema::hasTable('vd_all_order')) {
            Schema::create('vd_all_order', function (Blueprint $table): void {
                $table->text('order_no')->primary();
                $table->date('shipping_date')->nullable();
                $table->boolean('deleted')->default(false);
            });
        }

        DB::table('dk_equip_group')->insertOrIgnore([
            ['equip_group_id' => 1],
            ['equip_group_id' => 2],
            ['equip_group_id' => 3],
        ]);

        if (! Schema::hasTable('m_dpr') || ! Schema::hasTable('kd_serial') || ! Schema::hasTable('dm_kisyu')) {
            return;
        }

        // SQLiteのサンプルデータには受付No対応表がないため、同じ機種の製番をDPRへ関連付ける。
        DB::table('m_dpr')
            ->join('dm_kisyu', 'dm_kisyu.kisyu_name', '=', 'm_dpr.machine')
            ->join('kd_serial', 'kd_serial.kisyu_id', '=', 'dm_kisyu.kisyu_id')
            ->where('kd_serial.deleted', 0)
            ->whereNotNull('m_dpr.dprno')
            ->where('m_dpr.dprno', '<>', '')
            ->whereNotNull('kd_serial.order_no')
            ->where('kd_serial.order_no', '<>', '')
            ->select('m_dpr.dprno', 'kd_serial.order_no as receno')
            ->distinct()
            ->orderBy('m_dpr.dprno')
            ->chunk(500, function ($rows): void {
                DB::table('r_dprno_serialno2')->insertOrIgnore(
                    $rows->map(fn ($row) => (array) $row)->all()
                );
            });

        DB::table('kd_serial')
            ->where('deleted', 0)
            ->whereNotNull('order_no')
            ->where('order_no', '<>', '')
            ->selectRaw('order_no, MIN(shipping_date) as shipping_date')
            ->groupBy('order_no')
            ->orderBy('order_no')
            ->chunk(500, function ($rows): void {
                DB::table('vd_all_order')->upsert(
                    $rows->map(fn ($row) => [
                        'order_no' => $row->order_no,
                        'shipping_date' => $row->shipping_date,
                        'deleted' => 0,
                    ])->all(),
                    ['order_no'],
                    ['shipping_date', 'deleted'],
                );
            });
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            return;
        }

        Schema::dropIfExists('vd_all_order');
        Schema::dropIfExists('dk_equip_group');
        Schema::dropIfExists('r_dprno_serialno2');
    }
};
