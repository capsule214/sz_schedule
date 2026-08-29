<?php

namespace Tests\Feature;

use App\Models\DmKisyu;
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
            $this->dprRow('OS26000004', '機種A', '設計中'),
            $this->dprRow('CH25000005', '機種A', '設計中'),
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
            'sales_locations' => ['CH'],
            'publication_years' => ['26'],
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

        $this->actingAs($user)->postJson('/api/dpr/groups', [
            'machines' => ['機種A'],
            'sales_locations' => ['CH'],
            'publication_years' => ['26'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
            'after_dpr_no' => 'CH26000001',
            'limit' => 10,
        ])->assertOk()
            ->assertJsonCount(1, 'groups')
            ->assertJsonPath('groups.0.dprNo', 'CH26000002')
            ->assertJsonPath('hasMore', false);
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

    public function test_it_returns_all_non_deleted_serials_related_by_dpr_machine_ids(): void
    {
        $user = User::create([
            'name' => 'DPR serial user',
            'email' => 'dpr-serials@example.com',
            'password' => Hash::make('password'),
        ]);
        $machineA = DmKisyu::create(['kisyu_name' => '機種A']);
        $machineB = DmKisyu::create(['kisyu_name' => '機種B']);
        $otherMachine = DmKisyu::create(['kisyu_name' => '機種C']);
        DB::table('m_dpr')->insert([
            $this->dprRow('CH26000001', '機種A', '設計中'),
            $this->dprRow('CH26000001', '機種B', '設計中'),
            $this->dprRow('OS26000002', '機種C', '設計中'),
        ]);
        DB::table('kd_serial')->insert([
            ['serial_no' => 'SN-00002', 'order_no' => 'YG00002', 'kisyu_id' => $machineB->kisyu_id, 'deleted' => 0],
            ['serial_no' => 'SN-00001', 'order_no' => 'YG00001', 'kisyu_id' => $machineA->kisyu_id, 'deleted' => 0],
            ['serial_no' => 'SN-DELETED', 'order_no' => 'YG00001', 'kisyu_id' => $machineA->kisyu_id, 'deleted' => 1],
            ['serial_no' => 'SN-OTHER', 'order_no' => 'YG00003', 'kisyu_id' => $otherMachine->kisyu_id, 'deleted' => 0],
        ]);

        $this->actingAs($user)->postJson('/api/dpr/related-serials', [
            'dprNo' => 'CH26000001',
        ])->assertOk()->assertExactJson([
            ['serialNo' => 'SN-00001', 'receiptNo' => 'YG00001'],
            ['serialNo' => 'SN-00002', 'receiptNo' => 'YG00002'],
        ]);
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
