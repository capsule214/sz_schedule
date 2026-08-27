<?php

namespace Tests\Feature;

use App\Models\KdPlan;
use App\Models\KmTask;
use App\Models\Mdpr;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DprPlanRelationTest extends TestCase
{
    use RefreshDatabase;

    public function test_kd_plan_has_dpr_columns_and_resolves_its_m_dpr(): void
    {
        $this->assertTrue(Schema::hasColumns('kd_plan', ['dpr_no', 'user_no']));

        DB::table('m_dpr')->insert([
            'dprno' => 'CH26000001',
            'classification' => 'A',
            'machine' => '機種001',
        ]);
        $task = KmTask::create(['task_name' => 'DPR設計']);
        $plan = KdPlan::create([
            'serial_id' => -1,
            'morder_id' => -1,
            'dpr_no' => 'CH26000001',
            'user_no' => '00123',
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-08-26 08:30:00',
            'end_date' => '2026-08-26 10:30:00',
        ]);

        $this->assertSame('00123', $plan->fresh()->user_no);
        $this->assertSame('機種001', $plan->fresh()->m_dpr?->machine);

        $dpr = Mdpr::query()->where('dprno', 'CH26000001')->firstOrFail();
        $this->assertSame([$plan->plan_id], $dpr->kd_plans()->pluck('plan_id')->all());
    }
}
