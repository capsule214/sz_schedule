<?php

namespace Tests\Feature;

use App\Models\DmKisyu;
use App\Models\KdPlan;
use App\Models\KmTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DprGroupsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_shikakari_types_and_corresponding_serial_plan_tasks_are_seeded(): void
    {
        foreach ([
            1 => ['標準', '標準タスク'],
            2 => ['客先', '客先タスク'],
            3 => ['検査', '検査'],
            4 => ['出荷', '出荷'],
        ] as $id => [$typeName, $taskName]) {
            $this->assertDatabaseHas('kk_shikakari_type', [
                'shikakari_type_id' => $id,
                'sort_no' => $id,
                'shikakari_type_name' => $typeName,
            ]);
            $this->assertDatabaseHas('km_task', [
                'task_type_id' => 2,
                'shikakari_type_id' => $id,
                'task_name' => $taskName,
                'sort_no' => $id,
            ]);
        }
    }

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

        $response = $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
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
            ->assertJsonPath('nextCursor.dprNo', 'CH26000001')
            ->assertJsonPath('nextCursor.minShipDate', null);
        $response->assertJsonCount(1, 'plans');

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
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

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            'machines' => ['機種A'],
            'sales_locations' => ['CH'],
            'publication_years' => ['26'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
            'at_or_after_dpr_no' => 'CH26000002',
            'limit' => 10,
        ])->assertOk()->assertJsonPath('groups.0.dprNo', 'CH26000002');

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            'machines' => ['機種A'],
            'leader_user_nos' => ['00001'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
        ])->assertOk()->assertJsonCount(4, 'groups');

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            'machines' => ['機種A'],
            'leader_user_nos' => ['99999'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
        ])->assertOk()->assertJsonCount(0, 'groups');
    }

    public function test_machine_selection_is_required(): void
    {
        $user = User::create([
            'name' => 'DPR user',
            'email' => 'dpr-validation@example.com',
            'password' => Hash::make('password'),
        ]);

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            'machines' => [], 'from' => '2026-08-01', 'to' => '2026-08-31',
        ])->assertUnprocessable()->assertJsonValidationErrors('machines');
    }

    public function test_it_filters_dpr_groups_by_related_serial_seizo_group(): void
    {
        Schema::create('r_dprno_serialno2', function (Blueprint $table): void {
            $table->string('dprno');
            $table->string('receno');
        });
        Schema::create('dk_equip_group', function (Blueprint $table): void {
            $table->integer('equip_group_id')->primary();
        });

        $user = User::create([
            'name' => 'DPR equip group user',
            'email' => 'dpr-equip-group@example.com',
            'password' => Hash::make('password'),
        ]);
        $machineA = DmKisyu::create(['kisyu_name' => '機種A']);
        $machineB = DmKisyu::create(['kisyu_name' => '機種B']);
        DB::table('m_dpr')->insert([
            $this->dprRow('CH26000001', '機種A', '設計中'),
            $this->dprRow('CH26000002', '機種B', '設計中'),
        ]);
        DB::table('kd_serial')->insert([
            ['serial_no' => 'GROUP-1', 'order_no' => 'RECEIPT-1', 'kisyu_id' => $machineB->kisyu_id, 'seizo_group_id' => 1, 'deleted' => 0],
            ['serial_no' => 'GROUP-2', 'order_no' => 'RECEIPT-2', 'kisyu_id' => $machineA->kisyu_id, 'seizo_group_id' => 2, 'deleted' => 0],
        ]);
        DB::table('dk_equip_group')->insert([
            ['equip_group_id' => 1],
            ['equip_group_id' => 2],
        ]);
        DB::table('r_dprno_serialno2')->insert([
            ['dprno' => 'CH26000001', 'receno' => 'RECEIPT-1'],
            ['dprno' => 'CH26000002', 'receno' => 'RECEIPT-2'],
        ]);

        $payload = [
            'machines' => ['機種A', '機種B'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
        ];

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            ...$payload,
            'seizo_group_ids' => [1],
        ])->assertOk()
            ->assertJsonCount(1, 'groups')
            ->assertJsonPath('groups.0.dprNo', 'CH26000001');

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            ...$payload,
            'seizo_group_ids' => [2],
        ])->assertOk()
            ->assertJsonCount(1, 'groups')
            ->assertJsonPath('groups.0.dprNo', 'CH26000002');

        $this->actingAs($user)->postJson('/api/dpr/plans/search', [
            ...$payload,
            'dprNo' => 'CH26000001',
            'seizo_group_ids' => [2],
        ])->assertOk()->assertJsonPath('inDisplaySettings', false);
    }

    public function test_it_orders_dpr_groups_by_the_first_machine_shipping_date(): void
    {
        Schema::create('r_dprno_serialno2', function (Blueprint $table): void {
            $table->string('dprno');
            $table->string('receno');
        });
        Schema::create('vd_all_order', function (Blueprint $table): void {
            $table->string('order_no');
            $table->date('shipping_date')->nullable();
            $table->boolean('deleted')->default(false);
        });

        $user = User::create([
            'name' => 'DPR shipping order user',
            'email' => 'dpr-shipping-order@example.com',
            'password' => Hash::make('password'),
        ]);
        DB::table('m_dpr')->insert([
            $this->dprRow('CH26000001', '機種A', '設計中'),
            $this->dprRow('CH26000002', '機種A', '設計中'),
            $this->dprRow('CH26000003', '機種A', '設計中'),
        ]);
        DB::table('r_dprno_serialno2')->insert([
            ['dprno' => 'CH26000001', 'receno' => 'ORDER-1A'],
            ['dprno' => 'CH26000001', 'receno' => 'ORDER-1B'],
            ['dprno' => 'CH26000002', 'receno' => 'ORDER-2'],
            ['dprno' => 'CH26000003', 'receno' => 'ORDER-3'],
        ]);
        DB::table('vd_all_order')->insert([
            ['order_no' => 'ORDER-1A', 'shipping_date' => '2026-10-20', 'deleted' => 0],
            ['order_no' => 'ORDER-1B', 'shipping_date' => '2026-10-10', 'deleted' => 0],
            ['order_no' => 'ORDER-2', 'shipping_date' => '2026-10-05', 'deleted' => 0],
            ['order_no' => 'ORDER-3', 'shipping_date' => '2026-10-01', 'deleted' => 1],
        ]);

        $payload = [
            'machines' => ['機種A'],
            'from' => '2026-10-01',
            'to' => '2026-10-31',
            'display_order' => 1,
        ];
        $response = $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            ...$payload,
            'limit' => 1,
        ])->assertOk()
            ->assertJsonPath('groups.0.dprNo', 'CH26000002')
            ->assertJsonPath('nextCursor.dprNo', 'CH26000002')
            ->assertJsonPath('nextCursor.minShipDate', '2026-10-05');

        $cursor = $response->json('nextCursor');
        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            ...$payload,
            'limit' => 10,
            'after_dpr_no' => $cursor['dprNo'],
            'after_ship_date' => $cursor['minShipDate'],
            'after_ship_date_null' => false,
        ])->assertOk()
            ->assertJsonPath('groups.0.dprNo', 'CH26000001')
            ->assertJsonPath('groups.1.dprNo', 'CH26000003');
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

    public function test_it_returns_related_serial_plans_grouped_by_serial_and_shikakari_type(): void
    {
        $user = User::create([
            'name' => 'DPR serial plan user',
            'email' => 'dpr-serial-plans@example.com',
            'password' => Hash::make('password'),
        ]);
        $machine = DmKisyu::create(['kisyu_name' => '機種A']);
        DB::table('m_dpr')->insert($this->dprRow('CH26000001', '機種A', '設計中'));
        $serialId = DB::table('kd_serial')->insertGetId([
            'serial_no' => 'PX1441', 'order_no' => 'YG00001',
            'kisyu_id' => $machine->kisyu_id, 'deleted' => 0,
        ]);
        $standardTask = KmTask::create(['task_name' => '標準作業', 'shikakari_type_id' => 1]);
        $shippingTask = KmTask::create(['task_name' => '出荷作業', 'shikakari_type_id' => 4]);
        foreach ([
            [$standardTask->task_id, '2026-08-03 08:30:00', '2026-08-05 17:00:00'],
            [$standardTask->task_id, '2026-08-10 08:30:00', '2026-08-12 17:00:00'],
            [$shippingTask->task_id, '2026-08-20 08:30:00', '2026-08-21 17:00:00'],
        ] as [$taskId, $startDate, $endDate]) {
            KdPlan::create([
                'serial_id' => $serialId, 'morder_id' => -1, 'task_id' => $taskId, 'deleted' => 0,
                'start_date' => $startDate, 'end_date' => $endDate,
            ]);
        }

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            'machines' => ['機種A'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
            'include_serial_plans' => true,
        ])->assertOk()
            ->assertJsonCount(2, 'serialPlans')
            ->assertJsonPath('serialPlans.0.dprNo', 'CH26000001')
            ->assertJsonPath('serialPlans.0.serialNo', 'PX1441')
            ->assertJsonPath('serialPlans.0.shikakariTypeName', '標準')
            ->assertJsonPath('serialPlans.0.startDate', '2026-08-03 08:30:00')
            ->assertJsonPath('serialPlans.0.endDate', '2026-08-12 17:00:00')
            ->assertJsonPath('serialPlans.1.shikakariTypeName', '出荷');

        $this->actingAs($user)->postJson('/api/dpr/plans/groups', [
            'machines' => ['機種A'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
            'include_serial_plans' => false,
        ])->assertOk()->assertJsonCount(0, 'serialPlans');
    }

    public function test_dpr_search_reports_display_scope_and_returns_one_group_with_overlapping_plans(): void
    {
        $user = User::create([
            'name' => 'DPR search user',
            'email' => 'dpr-search@example.com',
            'password' => Hash::make('password'),
        ]);
        DB::table('m_dpr')->insert($this->dprRow('CH26000999-00', '機種019', '設計中'));
        $task = KmTask::create(['task_name' => '検索対象タスク']);
        $plan = KdPlan::create([
            'serial_id' => -1,
            'morder_id' => -1,
            'dpr_no' => 'CH26000999-00',
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-08-15 08:30:00',
            'end_date' => '2026-08-16 10:30:00',
        ]);

        $payload = [
            'dprNo' => 'CH26000999-00',
            'machines' => ['機種001'],
            'from' => '2026-08-01',
            'to' => '2026-08-31',
        ];
        $this->actingAs($user)->postJson('/api/dpr/plans/search', $payload)
            ->assertOk()
            ->assertJsonPath('inDisplaySettings', false)
            ->assertJsonPath('group.dprNo', 'CH26000999-00')
            ->assertJsonPath('group.machine', '機種019')
            ->assertJsonPath('plans.0.planId', $plan->plan_id);

        $this->actingAs($user)->postJson('/api/dpr/plans/search', [
            ...$payload,
            'machines' => ['機種019'],
            'leader_user_nos' => ['00001'],
        ])->assertOk()->assertJsonPath('inDisplaySettings', true);

        $this->actingAs($user)->postJson('/api/dpr/plans/search', [
            ...$payload,
            'machines' => ['機種019'],
            'leader_user_nos' => ['99999'],
        ])->assertOk()->assertJsonPath('inDisplaySettings', false);

        $this->actingAs($user)->postJson('/api/dpr/plans/search', [
            ...$payload,
            'dprNo' => 'NOT-FOUND',
        ])->assertOk()->assertExactJson(['found' => false]);
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
