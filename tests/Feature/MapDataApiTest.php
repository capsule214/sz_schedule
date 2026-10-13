<?php

namespace Tests\Feature;

use App\Models\DmKisyu;
use App\Models\KdReserve;
use App\Models\KdSerial;
use App\Models\KkLocationType;
use App\Models\KmResource;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MapDataApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_map_data_returns_floor_resources_and_reserves_for_the_selected_date_and_serial(): void
    {
        $user = User::create([
            'name' => 'Map user',
            'email' => 'map@example.com',
            'password' => Hash::make('password'),
        ]);
        $floor3 = KkLocationType::create(['location_type_name' => '3F']);
        $floor4 = KkLocationType::create(['location_type_name' => '4F']);
        $resource = KmResource::create([
            'resource_name' => '設置場所A',
            'sort_no' => 1,
            'location_type_id' => $floor3->location_type_id,
            'resource_type_id' => 1,
            'x1' => 100,
            'y1' => 200,
            'x2' => 500,
            'y2' => 350,
        ]);
        KmResource::create([
            'resource_name' => '4F設置場所',
            'sort_no' => 2,
            'location_type_id' => $floor4->location_type_id,
            'resource_type_id' => 1,
            'x1' => 600,
            'y1' => 200,
            'x2' => 900,
            'y2' => 350,
        ]);
        KmResource::create([
            'resource_name' => '背景座標',
            'sort_no' => 0,
            'location_type_id' => $floor3->location_type_id,
            'resource_type_id' => 99,
            'x1' => 0,
            'y1' => 0,
            'x2' => 5318,
            'y2' => 1860,
        ]);

        $kisyu = DmKisyu::create(['kisyu_name' => '機種A']);
        $serial = KdSerial::create([
            'serial_no' => 'PX1001',
            'kisyu_id' => $kisyu->kisyu_id,
            'deleted' => 0,
        ]);
        KdReserve::create([
            'resource_id' => $resource->resource_id,
            'serial_id' => $serial->serial_id,
            'start_date' => '2026-10-01 08:30:00',
            'end_date' => '2026-10-31 17:15:00',
            'deleted' => 0,
        ]);

        $this->actingAs($user)->postJson('/api/map/data', [
            'display_date' => '2026-10-13',
            'floor' => 'A棟3F',
            'serial_no' => 'PX1001',
        ])->assertOk()
            ->assertJsonPath('floor', 'A棟3F')
            ->assertJsonPath('displayDate', '2026-10-13')
            ->assertJsonCount(1, 'resources')
            ->assertJsonPath('resources.0.resourceName', '設置場所A')
            ->assertJsonPath('resources.0.resourceTypeId', 1)
            ->assertJsonPath('resources.0.x1', 100)
            ->assertJsonPath('resources.0.reserves.0.serialNo', 'PX1001')
            ->assertJsonCount(1, 'background')
            ->assertJsonPath('background.0.resourceTypeId', 99);

        $this->actingAs($user)->postJson('/api/map/data', [
            'display_date' => '2026-11-01',
            'floor' => 'A棟3F',
            'serial_no' => 'PX1001',
        ])->assertOk()
            ->assertJsonCount(0, 'resources.0.reserves');
    }

    public function test_map_data_rejects_an_unknown_floor(): void
    {
        $user = User::create([
            'name' => 'Map validation user',
            'email' => 'map-validation@example.com',
            'password' => Hash::make('password'),
        ]);

        $this->actingAs($user)->postJson('/api/map/data', [
            'display_date' => '2026-10-13',
            'floor' => 'B棟1F',
        ])->assertUnprocessable()->assertJsonValidationErrors('floor');
    }
}
