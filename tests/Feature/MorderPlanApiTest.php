<?php

namespace Tests\Feature;

use App\Models\DmKisyu;
use App\Models\KdMorder;
use App\Models\KdPlan;
use App\Models\KdSerial;
use App\Models\KmTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MorderPlanApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_device_search_can_return_morder_linked_plans(): void
    {
        $user = User::create([
            'name' => 'morder-user',
            'email' => 'morder-user',
            'password' => Hash::make('12345'),
        ]);
        $kisyu = DmKisyu::create(['kisyu_name' => 'MODEL-A']);
        $serial = KdSerial::create(['kisyu_id' => $kisyu->kisyu_id, 'serial_no' => 'S001']);
        $task = KmTask::create(['task_name' => '組立']);
        $morder = KdMorder::create([
            'equip_group_id' => 2,
            'order_type_id' => 11,
            'morder_no' => 'M1234567',
            'parts_no' => 'PART-001',
            'public_remark' => '備考A',
            'shipping_date' => '2026-06-30',
        ]);

        KdPlan::create([
            'serial_id' => $serial->serial_id,
            'morder_id' => $morder->morder_id,
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-06-10',
            'end_date' => '2026-06-11',
        ]);

        $this->actingAs($user)
            ->postJson('/api/plan/search/device', [
                'from' => '2026-06-01',
                'to' => '2026-06-30',
                'product_display' => 'morder',
                'szgroup_ids' => [2],
            ])
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.morderId', $morder->morder_id)
            ->assertJsonPath('0.morderNo', 'M1234567')
            ->assertJsonPath('0.morderOrderTypeName', '直送DPR')
            ->assertJsonPath('0.partsNo', 'PART-001')
            ->assertJsonPath('0.publicRemark', '備考A')
            ->assertJsonPath('0.morderShippingDate', '2026-06-30');
    }

    public function test_task_search_can_return_morder_linked_plans(): void
    {
        $user = User::create([
            'name' => 'morder-task-user',
            'email' => 'morder-task-user',
            'password' => Hash::make('12345'),
        ]);
        $task = KmTask::create(['task_name' => '加工']);
        $morder = KdMorder::create([
            'order_type_id' => 21,
            'equip_group_id' => 1,
            'morder_no' => 'M7654321',
            'parts_no' => 'PART-999',
            'shipping_date' => '2026-07-15',
        ]);

        KdPlan::create([
            'serial_id' => -1,
            'morder_id' => $morder->morder_id,
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-06-12',
            'end_date' => '2026-06-13',
        ]);

        KdPlan::create([
            'serial_id' => -1,
            'morder_id' => -1,
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-06-12',
            'end_date' => '2026-06-13',
        ]);

        $this->actingAs($user)
            ->postJson('/api/plan/search/task', [
                'from' => '2026-06-01',
                'to' => '2026-06-30',
                'product_display' => 'morder',
                'task_ids' => [$task->task_id],
            ])
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.morderId', $morder->morder_id)
            ->assertJsonPath('0.morderNo', 'M7654321')
            ->assertJsonPath('0.morderOrderTypeName', '加工オーダー');
    }

    public function test_seed_master_creates_morders_and_seed_plans_can_create_morder_plans(): void
    {
        $user = User::create([
            'name' => 'morder-seed-user',
            'email' => 'morder-seed-user',
            'password' => Hash::make('12345'),
        ]);

        $this->actingAs($user)
            ->postJson('/api/seed/master', [
                'baseDate' => '2026-06-01',
                'seedNum' => 7,
            ])
            ->assertOk()
            ->assertJsonPath('morders', 100);

        $this->assertDatabaseCount('kd_morder', 100);

        $this->actingAs($user)
            ->postJson('/api/seed/plans', [
                'count' => 20,
                'reserveCount' => 0,
                'baseDate' => '2026-06-01',
                'seedNum' => 8,
                'product_display' => 'morder',
            ])
            ->assertOk()
            ->assertJsonPath('plans', 20)
            ->assertJsonPath('morders', 100);

        $this->assertDatabaseCount('kd_plan', 20);
        $this->assertDatabaseMissing('kd_plan', ['serial_id' => -1, 'morder_id' => -1]);
        $this->assertSame(20, KdPlan::where('serial_id', -1)->where('morder_id', '>', 0)->count());
    }

    public function test_seed_plans_creates_serial_plans_with_morder_sentinel(): void
    {
        $user = User::create([
            'name' => 'serial-seed-user',
            'email' => 'serial-seed-user',
            'password' => Hash::make('12345'),
        ]);

        $this->actingAs($user)
            ->postJson('/api/seed/master', [
                'baseDate' => '2026-06-01',
                'seedNum' => 9,
            ])
            ->assertOk();

        $this->actingAs($user)
            ->postJson('/api/seed/plans', [
                'count' => 15,
                'reserveCount' => 0,
                'baseDate' => '2026-06-01',
                'seedNum' => 10,
                'product_display' => 'serial',
            ])
            ->assertOk()
            ->assertJsonPath('plans', 15);

        $this->assertDatabaseCount('kd_plan', 15);
        $this->assertSame(15, KdPlan::where('morder_id', -1)->where('serial_id', '>', 0)->count());
    }
}
