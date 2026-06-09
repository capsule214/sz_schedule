<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 旧 date_type=6 (会社休業日) → 新 date_type=4 (会社休日)
        DB::table('dr_calendar')->where('date_type', 6)->update(['date_type' => 4]);
    }

    public function down(): void
    {
        DB::table('dr_calendar')->where('date_type', 4)->update(['date_type' => 6]);
    }
};
