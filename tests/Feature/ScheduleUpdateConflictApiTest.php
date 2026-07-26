<?php

namespace Tests\Feature;

use App\Models\DmKisyu;
use App\Models\KdPlan;
use App\Models\KdReserve;
use App\Models\KdSerial;
use App\Models\KmResource;
use App\Models\KmTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ScheduleUpdateConflictApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_plan_update_check_detects_a_newer_database_version(): void
    {
        $user = $this->createUser();
        [$serial, $task] = $this->createSerialAndTask();
        $plan = KdPlan::create([
            'serial_id' => $serial->serial_id,
            'morder_id' => -1,
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-02',
        ]);
        $loadedVersion = $plan->updated_at?->format('Y-m-d H:i:s.u');

        $this->actingAs($user)
            ->postJson('/api/plan/check-updates', [
                'updates' => [['id' => $plan->plan_id, 'updatedAt' => $loadedVersion]],
            ])
            ->assertOk()
            ->assertExactJson(['conflictIds' => []]);

        DB::table('kd_plan')->where('plan_id', $plan->plan_id)->update([
            'updated_at' => '2026-07-26 12:34:56',
        ]);

        $this->actingAs($user)
            ->postJson('/api/plan/check-updates', [
                'updates' => [['id' => $plan->plan_id, 'updatedAt' => $loadedVersion]],
            ])
            ->assertOk()
            ->assertExactJson(['conflictIds' => [$plan->plan_id]]);
    }

    public function test_reserve_update_check_detects_a_newer_database_version(): void
    {
        $user = $this->createUser();
        [$serial] = $this->createSerialAndTask();
        $resource = KmResource::create(['resource_name' => '場所A']);
        $reserve = KdReserve::create([
            'resource_id' => $resource->resource_id,
            'serial_id' => $serial->serial_id,
            'deleted' => 0,
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-02',
        ]);
        $loadedVersion = $reserve->updated_at?->format('Y-m-d H:i:s.u');

        DB::table('kd_reserve')->where('reserve_id', $reserve->reserve_id)->update([
            'updated_at' => '2026-07-26 12:34:56',
        ]);

        $this->actingAs($user)
            ->postJson('/api/reserve/check-updates', [
                'updates' => [['id' => $reserve->reserve_id, 'updatedAt' => $loadedVersion]],
            ])
            ->assertOk()
            ->assertExactJson(['conflictIds' => [$reserve->reserve_id]]);
    }

    private function createUser(): User
    {
        return User::create([
            'name' => 'conflict-user',
            'email' => 'conflict-user',
            'password' => Hash::make('12345'),
        ]);
    }

    private function createSerialAndTask(): array
    {
        $kisyu = DmKisyu::create(['kisyu_name' => 'MODEL-A']);
        $serial = KdSerial::create([
            'kisyu_id' => $kisyu->kisyu_id,
            'serial_no' => 'CONFLICT-001',
            'flg_public' => 1,
        ]);
        $task = KmTask::create(['task_name' => '組立']);

        return [$serial, $task];
    }
}
