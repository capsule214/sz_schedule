<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('km_worker', function (Blueprint $table) {
            if (! Schema::hasColumn('km_worker', 'user_no')) {
                $table->string('user_no', 20)->nullable()->after('worker_name');
            }
        });

        DB::table('km_worker')
            ->orderBy('worker_id')
            ->select('worker_id')
            ->chunk(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('km_worker')
                        ->where('worker_id', $row->worker_id)
                        ->update(['user_no' => str_pad((string) $row->worker_id, 4, '0', STR_PAD_LEFT)]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('km_worker', function (Blueprint $table) {
            if (Schema::hasColumn('km_worker', 'user_no')) {
                $table->dropColumn('user_no');
            }
        });
    }
};
