<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            [20001, 'DPRメカ設計', 1],
            [20002, 'DPRエレキ設計', 2],
            [20003, 'DPRソフト設計', 3],
            [20004, 'DPR他', 4],
        ] as [$taskId, $taskName, $backColor]) {
            DB::table('km_task')->updateOrInsert(
                ['task_id' => $taskId],
                [
                    'task_name' => $taskName,
                    'task_type_id' => 2,
                    'back_color' => $backColor,
                    'font_color' => 6,
                    'sort_no' => $taskId,
                ]
            );
        }
    }

    public function down(): void
    {
        DB::table('km_task')
            ->whereIn('task_id', [20001, 20002, 20003, 20004])
            ->delete();
    }
};
