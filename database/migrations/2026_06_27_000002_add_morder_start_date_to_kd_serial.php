<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kd_serial', function (Blueprint $table) {
            if (! Schema::hasColumn('kd_serial', 'morder_start_date')) {
                $table->date('morder_start_date')->nullable()->after('koujun_id');
            }
        });

        DB::table('kd_serial')
            ->whereNull('morder_start_date')
            ->whereNotNull('shipping_date')
            ->orderBy('serial_id')
            ->select('serial_id', 'shipping_date')
            ->chunk(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('kd_serial')
                        ->where('serial_id', $row->serial_id)
                        ->update([
                            'morder_start_date' => date('Y-m-d', strtotime($row->shipping_date) - 30 * 86400),
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('kd_serial', function (Blueprint $table) {
            if (Schema::hasColumn('kd_serial', 'morder_start_date')) {
                $table->dropColumn('morder_start_date');
            }
        });
    }
};
