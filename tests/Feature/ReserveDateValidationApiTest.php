<?php

namespace Tests\Feature;

use App\Models\DmKisyu;
use App\Models\KdReserve;
use App\Models\KdSerial;
use App\Models\KmResource;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReserveDateValidationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_reserve_response_returns_updated_date_in_japan_timezone(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-25 15:30:00', 'UTC'));

        try {
            [$user, $resource, $serial] = $this->createFixtures();

            $this->actingAs($user)->postJson('/api/reserve', [
                'resourceId' => $resource->resource_id,
                'serialId' => $serial->serial_id,
                'startDate' => '2026-08-26T08:30:00',
                'endDate' => '2026-08-26T10:30:00',
                'remark' => '',
            ])->assertCreated()
                ->assertJsonPath('updatedAt', '2026-08-26');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_reserve_store_accepts_schedule_datetime_format(): void
    {
        [$user, $resource, $serial] = $this->createFixtures();

        $this->actingAs($user)->postJson('/api/reserve', [
            'resourceId' => $resource->resource_id,
            'serialId' => $serial->serial_id,
            'startDate' => '2026-08-04T08:30:00',
            'endDate' => '2026-08-04T10:30:00',
            'remark' => '',
        ])->assertCreated();

        $this->assertDatabaseHas('kd_reserve', [
            'start_date' => '2026-08-04T08:30:00',
            'end_date' => '2026-08-04T10:30:00',
        ]);
    }

    public function test_reserve_store_rejects_unix_epoch_datetime(): void
    {
        [$user, $resource, $serial] = $this->createFixtures();

        $this->actingAs($user)->postJson('/api/reserve', [
            'resourceId' => $resource->resource_id,
            'serialId' => $serial->serial_id,
            'startDate' => '1970-01-01T00:00:00.000Z',
            'endDate' => '1970-01-01T00:00:00.000Z',
            'remark' => '',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['startDate', 'endDate']);

        $this->assertDatabaseCount('kd_reserve', 0);
    }

    public function test_reserve_update_rejects_unix_epoch_datetime_without_changing_database(): void
    {
        [$user, $resource, $serial] = $this->createFixtures();
        $reserve = KdReserve::create([
            'resource_id' => $resource->resource_id,
            'serial_id' => $serial->serial_id,
            'start_date' => '2026-08-04T08:30:00',
            'end_date' => '2026-08-04T10:30:00',
            'remark' => '',
            'deleted' => 0,
        ]);

        $this->actingAs($user)->putJson("/api/reserve/{$reserve->reserve_id}", [
            'resourceId' => $resource->resource_id,
            'serialId' => $serial->serial_id,
            'startDate' => '1970-01-01T00:00:00',
            'endDate' => '1970-01-01T00:00:00',
            'remark' => '',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['startDate']);

        $this->assertDatabaseHas('kd_reserve', [
            'reserve_id' => $reserve->reserve_id,
            'start_date' => '2026-08-04T08:30:00',
            'end_date' => '2026-08-04T10:30:00',
        ]);
    }

    private function createFixtures(): array
    {
        $user = User::create([
            'name' => 'reserve-date-user',
            'email' => 'reserve-date-user',
            'password' => Hash::make('12345'),
        ]);
        $resource = KmResource::create(['resource_name' => '場所A']);
        $kisyu = DmKisyu::create(['kisyu_name' => 'MODEL-A']);
        $serial = KdSerial::create([
            'kisyu_id' => $kisyu->kisyu_id,
            'serial_no' => 'RESERVE-DATE-001',
            'flg_public' => 1,
        ]);

        return [$user, $resource, $serial];
    }
}
