<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DprPlanApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_dpr_plan_create_and_update_use_dpr_fields_fixed_times_and_task_colors(): void
    {
        $user = User::create([
            'name' => 'DPR plan user',
            'email' => 'dpr-plan@example.com',
            'password' => Hash::make('password'),
        ]);

        $created = $this->actingAs($user)->postJson('/api/plan', [
            'serialId' => 999,
            'morderId' => 999,
            'dprNo' => 'CH26000001-00',
            'userNo' => '123',
            'taskId' => 20001,
            'startDate' => '2026-08-30T12:34:56',
            'endDate' => '2026-09-02T12:34:56',
            'remark' => 'メカ備考',
        ])->assertCreated()
            ->assertJsonPath('serialId', -1)
            ->assertJsonPath('morderId', -1)
            ->assertJsonPath('dprNo', 'CH26000001-00')
            ->assertJsonPath('userNo', '00123')
            ->assertJsonPath('taskId', 20001)
            ->assertJsonPath('taskName', 'DPRメカ設計')
            ->assertJsonPath('taskBackColor', 1);

        $planId = $created->json('planId');
        $this->assertDatabaseHas('kd_plan', [
            'plan_id' => $planId,
            'serial_id' => -1,
            'morder_id' => -1,
            'dpr_no' => 'CH26000001-00',
            'user_no' => '00123',
            'start_date' => '2026-08-30 08:30:00',
            'end_date' => '2026-09-02 21:25:00',
        ]);

        $this->actingAs($user)->putJson('/api/plan/'.$planId, [
            'serialId' => 123,
            'morderId' => 456,
            'dprNo' => 'CH26000001-00',
            'userNo' => '00456',
            'taskId' => 20004,
            'startDate' => '2026-09-05',
            'endDate' => '2026-09-06',
            'remark' => 'その他備考',
        ])->assertOk()
            ->assertJsonPath('taskName', 'DPR他')
            ->assertJsonPath('taskBackColor', 4)
            ->assertJsonPath('userNo', '00456');

        $this->assertDatabaseHas('kd_plan', [
            'plan_id' => $planId,
            'serial_id' => -1,
            'morder_id' => -1,
            'task_id' => 20004,
            'user_no' => '00456',
            'start_date' => '2026-09-05 08:30:00',
            'end_date' => '2026-09-06 21:25:00',
            'remark' => 'その他備考',
        ]);
    }

    public function test_dpr_plan_rejects_non_dpr_task(): void
    {
        $user = User::create([
            'name' => 'DPR invalid task user',
            'email' => 'dpr-invalid-task@example.com',
            'password' => Hash::make('password'),
        ]);

        $this->actingAs($user)->postJson('/api/plan', [
            'serialId' => -1,
            'dprNo' => 'CH26000001-00',
            'taskId' => 1,
            'startDate' => '2026-08-30',
            'endDate' => '2026-08-30',
        ])->assertUnprocessable()->assertJsonValidationErrors('taskId');
    }
}
