<?php

namespace Tests\Feature;

use App\Models\DmEquip;
use App\Models\DmKisyu;
use App\Models\KdSerial;
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
}
