<?php

namespace Tests\Feature;

use App\Models\KdPlan;
use App\Models\KmTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DprGroupsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_groups_duplicate_dpr_numbers_and_returns_only_overlapping_plans(): void
    {
        $user = User::create([
            'name' => 'DPR user',
            'email' => 'dpr-groups@example.com',
            'password' => Hash::make('password'),
        ]);
        DB::table('m_dpr')->insert([
            $this->dprRow('CH26000001', '機種A', '設計中'),
            $this->dprRow('CH26000001', '機種B', '設計中'),
            $this->dprRow('CH26000002', '機種A', '設計完了'),
            $this->dprRow('CH26000003', '対象外機種', '中止'),
        ]);
        $task = KmTask::create(['task_name' => 'DPR設計', 'back_color' => 2, 'font_color' => 6]);
        $visiblePlan = KdPlan::create([
            'serial_id' => -1, 'morder_id' => -1, 'dpr_no' => 'CH26000001', 'user_no' => '00123',
            'task_id' => $task->task_id, 'deleted' => 0,
            'start_date' => '2026-08-27 08:30:00', 'end_date' => '2026-08-27 10:30:00',
        ]);
        KdPlan::create([
            'serial_id' => -1, 'morder_id' => -1, 'dpr_no' => 'CH26000001', 'user_no' => '00123',
            'task_id' => $task->task_id, 'deleted' => 0,
            'start_date' => '2026-07-01 08:30:00', 'end_date' => '2026-07-01 10:30:00',
        ]);

        $response = $this->actingAs($user)->postJson('/api/dpr/groups', [
            // 候補抽出は機種Aだけだが、同じDPR Noに属する機種Bも左ヘッダ情報へ集約される。
            'machines' => ['機種A'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
            'limit' => 1,
        ]);

        $response->assertOk()
            ->assertJsonCount(1, 'groups')
            ->assertJsonPath('groups.0.dprNo', 'CH26000001')
            ->assertJsonPath('groups.0.machine', '機種A / 機種B')
            ->assertJsonPath('plans.0.planId', $visiblePlan->plan_id)
            ->assertJsonPath('plans.0.userNo', '00123')
            ->assertJsonPath('hasMore', true)
            ->assertJsonPath('nextCursor', 'CH26000001');
        $response->assertJsonCount(1, 'plans');
    }

    public function test_machine_selection_is_required(): void
    {
        $user = User::create([
            'name' => 'DPR user',
            'email' => 'dpr-validation@example.com',
            'password' => Hash::make('password'),
        ]);

        $this->actingAs($user)->postJson('/api/dpr/groups', [
            'machines' => [], 'from' => '2026-08-01', 'to' => '2026-08-31',
        ])->assertUnprocessable()->assertJsonValidationErrors('machines');
    }

    private function dprRow(string $dprNo, string $machine, string $status): array
    {
        return [
            'dprno' => $dprNo,
            'classification' => 'A',
            'deliverytype' => 2,
            'machine' => $machine,
            'qty' => 1,
            'status' => $status,
            'customer_name' => '顧客A',
            'subject' => '件名A',
            'dprleader_sytx' => '00001',
            'mechanism_sytx' => '00002',
            'electricity_sytx' => '00003',
            'soft_sytx' => '00004',
        ];
    }
}
