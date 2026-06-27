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
            if (! Schema::hasColumn('kd_serial', 'koutei_pic_no')) {
                $table->text('koutei_pic_no')->default('')->after('koujun_id');
            }
        });

        DB::table('kd_serial')
            ->orderBy('serial_id')
            ->select('serial_id')
            ->chunk(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('kd_serial')
                        ->where('serial_id', $row->serial_id)
                        ->update([
                            'koutei_pic_no' => str_pad((string) $row->serial_id, 5, '0', STR_PAD_LEFT),
                        ]);
                }
            });
    }

    public function down(): void
    {
        // 既存カラムの正規化のみなので戻さない。
    }
};
