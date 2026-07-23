<?php

namespace Tests\Feature;

use App\Models\DmEquip;
use App\Models\DmKisyu;
use App\Models\KdSerial;
use App\Models\KdPlan;
use App\Models\KmTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SerialDeviceGroupsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_device_groups_are_paged_and_filterable(): void
    {
        $user = User::create([
            'name' => 'serial-device-user',
            'email' => 'serial-device-user',
            'password' => Hash::make('12345'),
        ]);
        $equip = DmEquip::create(['equip_name' => '装置A', 'equip_type_id' => 1]);
        $kisyu = DmKisyu::create(['kisyu_name' => 'MODEL-A', 'equip_id' => $equip->equip_id, 'sort_no' => 1, 'waku_display' => 1]);
        for ($i = 1; $i <= 5; $i++) {
            KdSerial::create([
                'kisyu_id' => $kisyu->kisyu_id,
                'serial_no' => 'SN-'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'seizo_group_id' => 2,
                'flg_public' => 1,
            ]);
        }

        $this->actingAs($user)
            ->postJson('/api/serial/device-groups', [
                'offset' => 1,
                'limit' => 2,
                'equip_type_id' => 1,
                'szgroup_ids' => [2],
                'seizo_statuses' => [1],
            ])
            ->assertOk()
            ->assertJsonPath('total', 5)
            ->assertJsonPath('offset', 1)
            ->assertJsonCount(2, 'groups')
            ->assertJsonPath('groups.0.serialNo', 'SN-002');
    }

    public function test_device_groups_can_find_exact_serial_no_with_index(): void
    {
        $user = User::create([
            'name' => 'serial-search-user',
            'email' => 'serial-search-user',
            'password' => Hash::make('12345'),
        ]);
        $equip = DmEquip::create(['equip_name' => '装置A', 'equip_type_id' => 1]);
        $kisyu = DmKisyu::create(['kisyu_name' => 'MODEL-A', 'equip_id' => $equip->equip_id, 'sort_no' => 1, 'waku_display' => 1]);
        foreach (['SN-001', 'SN-002', 'SN-003'] as $serialNo) {
            KdSerial::create([
                'kisyu_id' => $kisyu->kisyu_id,
                'serial_no' => $serialNo,
                'seizo_group_id' => 1,
                'flg_public' => 1,
            ]);
        }

        $this->actingAs($user)
            ->postJson('/api/serial/device-groups', [
                'q' => 'SN-003',
                'limit' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('offset', 2)
            ->assertJsonCount(1, 'groups')
            ->assertJsonPath('groups.0.serialNo', 'SN-003');
    }

    public function test_device_groups_can_return_more_than_one_thousand_serials_for_multiple_models(): void
    {
        $user = User::create([
            'name' => 'serial-all-user',
            'email' => 'serial-all-user',
            'password' => Hash::make('12345'),
        ]);
        $equip = DmEquip::create(['equip_name' => '装置A', 'equip_type_id' => 1]);
        $modelA = DmKisyu::create(['kisyu_name' => 'MODEL-A', 'equip_id' => $equip->equip_id, 'sort_no' => 1]);
        $modelB = DmKisyu::create(['kisyu_name' => 'MODEL-B', 'equip_id' => $equip->equip_id, 'sort_no' => 2]);
        $rows = [];
        for ($i = 1; $i <= 1005; $i++) {
            $rows[] = [
                'kisyu_id' => $i % 2 === 0 ? $modelA->kisyu_id : $modelB->kisyu_id,
                'serial_no' => 'SN-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'flg_public' => 1,
            ];
        }
        foreach (array_chunk($rows, 250) as $chunk) {
            KdSerial::insert($chunk);
        }

        $response = $this->actingAs($user)->postJson('/api/serial/device-groups', [
            'all' => true,
            'kisyu_ids' => [$modelA->kisyu_id, $modelB->kisyu_id],
        ]);

        $response->assertOk()
            ->assertJsonPath('total', 1005)
            ->assertJsonPath('offset', 0)
            ->assertJsonPath('limit', 1005)
            ->assertJsonCount(1005, 'groups');

        $serialIds = collect($response->json('groups'))->take(200)->pluck('serialId')->all();
        $this->actingAs($user)
            ->postJson('/api/plan/search/device', [
                'from' => '2026-07-01',
                'to' => '2026-07-31',
                'serial_ids' => $serialIds,
                'count_only' => true,
            ])
            ->assertOk()
            ->assertExactJson(['count' => 0]);
    }

    public function test_finished_serials_are_limited_to_those_with_plans_in_display_period(): void
    {
        $user = User::create([
            'name' => 'finished-serial-user',
            'email' => 'finished-serial-user',
            'password' => Hash::make('12345'),
        ]);
        $kisyu = DmKisyu::create(['kisyu_name' => 'MODEL-A', 'sort_no' => 1]);
        $task = KmTask::create(['task_name' => '組立']);
        $unfinished = KdSerial::create(['kisyu_id' => $kisyu->kisyu_id, 'serial_no' => 'ACTIVE', 'flg_public' => 1, 'flg_finish' => 0]);
        $finishedInRange = KdSerial::create(['kisyu_id' => $kisyu->kisyu_id, 'serial_no' => 'FIN-IN', 'flg_public' => 1, 'flg_finish' => 1]);
        $finishedOutOfRange = KdSerial::create(['kisyu_id' => $kisyu->kisyu_id, 'serial_no' => 'FIN-OUT', 'flg_public' => 1, 'flg_finish' => 1]);

        foreach ([
            [$finishedInRange, '2026-07-10', '2026-07-12'],
            [$finishedOutOfRange, '2026-05-10', '2026-05-12'],
        ] as [$serial, $from, $to]) {
            KdPlan::create([
                'serial_id' => $serial->serial_id,
                'morder_id' => -1,
                'task_id' => $task->task_id,
                'deleted' => 0,
                'start_date' => $from,
                'end_date' => $to,
            ]);
        }

        $response = $this->actingAs($user)->postJson('/api/serial/device-groups', [
            'show_finished' => 1,
            'display_from' => '2026-07-01',
            'display_to' => '2026-07-31',
            'offset' => 0,
            'limit' => 50,
        ]);

        $response->assertOk()->assertJsonPath('total', 2);
        $serialNos = collect($response->json('groups'))->pluck('serialNo')->all();
        $this->assertSame([$unfinished->serial_no, $finishedInRange->serial_no], $serialNos);
        $this->assertNotContains($finishedOutOfRange->serial_no, $serialNos);

        $this->actingAs($user)
            ->postJson('/api/serial/device-groups', [
                'show_finished' => 1,
                'display_from' => '2026-07-01',
                'display_to' => '2026-07-31',
                'offset' => 1,
                'limit' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('offset', 1)
            ->assertJsonPath('groups.0.serialNo', $finishedInRange->serial_no);

        $this->actingAs($user)
            ->postJson('/api/serial/device-groups', [
                'show_finished' => 1,
                'display_from' => '2026-07-01',
                'display_to' => '2026-07-31',
                'q' => $finishedInRange->serial_no,
            ])
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('offset', 1)
            ->assertJsonPath('limit', 1)
            ->assertJsonPath('groups.0.serialNo', $finishedInRange->serial_no);
    }
}
