<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('km_task')
            ->where('task_name', '作業予定')
            ->where('task_type_id', 1)
            ->exists();

        if ($exists) {
            return;
        }

        $processId = DB::table('km_process')
            ->orderBy('sort_no')
            ->orderBy('process_id')
            ->value('process_id');
        $sortNo = ((int) DB::table('km_task')->max('sort_no')) + 1;

        DB::table('km_task')->insert([
            'process_id' => $processId,
            'task_type_id' => 1,
            'task_name' => '作業予定',
            'back_color' => 1,
            'font_color' => 6,
            'sort_no' => $sortNo,
        ]);
    }

    public function down(): void
    {
        DB::table('km_task')
            ->where('task_name', '作業予定')
            ->where('task_type_id', 1)
            ->delete();
    }
};
