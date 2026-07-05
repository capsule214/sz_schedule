<?php

namespace Tests\Feature;

use App\Models\DmKisyu;
use App\Models\KdPlan;
use App\Models\KdSerial;
use App\Models\KmTask;
use App\Models\KsSystemLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class KsSystemLogTest extends TestCase
{
    use RefreshDatabase;

    private function loginUser(): User
    {
        return User::create([
            'name' => 'log-user',
            'email' => 'log-user',
            'password' => Hash::make('12345'),
        ]);
    }

    private function createSerialAndTask(): array
    {
        $kisyu = DmKisyu::create(['kisyu_name' => 'MODEL-L']);
        $serial = KdSerial::create(['kisyu_id' => $kisyu->kisyu_id, 'serial_no' => 'LOG-001']);
        $task = KmTask::create(['task_name' => '組立']);

        return [$serial, $task];
    }

    public function test_store_logs_created_content(): void
    {
        $user = $this->loginUser();
        [$serial, $task] = $this->createSerialAndTask();

        $planId = $this->actingAs($user)
            ->postJson('/api/plan', [
                'serialId' => $serial->serial_id,
                'taskId' => $task->task_id,
                'startDate' => '2026-07-01T08:30:00',
                'endDate' => '2026-07-02T17:15:00',
                'remark' => '登録テスト',
            ])
            ->assertCreated()
            ->json('planId');

        $log = KsSystemLog::where('plan_id', $planId)->firstOrFail();
        $diff = json_decode($log->diff, true);
        $this->assertSame($serial->serial_id, $diff['serial_id']);
        $this->assertSame($task->task_id, $diff['task_id']);
        $this->assertSame('2026-07-01T08:30:00', $diff['start_date']);
        $this->assertSame('登録テスト', $diff['remark']);
        $this->assertSame(0, $diff['deleted']);
        $this->assertNotNull($log->created_at);
    }

    public function test_update_logs_only_changed_fields(): void
    {
        $user = $this->loginUser();
        [$serial, $task] = $this->createSerialAndTask();
        $plan = KdPlan::create([
            'serial_id' => $serial->serial_id,
            'morder_id' => -1,
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-07-01T08:30:00',
            'end_date' => '2026-07-02T17:15:00',
            'planned_minutes' => 0,
            'price' => 0,
            'remark' => '',
        ]);

        $this->actingAs($user)
            ->putJson("/api/plan/{$plan->plan_id}", [
                'serialId' => $serial->serial_id,
                'taskId' => $task->task_id,
                'startDate' => '2026-07-01T08:30:00',
                'endDate' => '2026-07-03T17:15:00', // 終了日のみ変更
                'remark' => '',
            ])
            ->assertOk();

        $log = KsSystemLog::where('plan_id', $plan->plan_id)->firstOrFail();
        $diff = json_decode($log->diff, true);
        $this->assertSame(['end_date' => '2026-07-03T17:15:00'], $diff);
    }

    public function test_update_without_changes_logs_nothing(): void
    {
        $user = $this->loginUser();
        [$serial, $task] = $this->createSerialAndTask();
        $plan = KdPlan::create([
            'serial_id' => $serial->serial_id,
            'morder_id' => -1,
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-07-01T08:30:00',
            'end_date' => '2026-07-02T17:15:00',
            'planned_minutes' => 0,
            'price' => 0,
            'remark' => '',
        ]);

        $this->actingAs($user)
            ->putJson("/api/plan/{$plan->plan_id}", [
                'serialId' => $serial->serial_id,
                'taskId' => $task->task_id,
                'startDate' => '2026-07-01T08:30:00',
                'endDate' => '2026-07-02T17:15:00',
                'remark' => '',
            ])
            ->assertOk();

        $this->assertDatabaseCount('ks_system_log', 0);
    }

    public function test_destroy_one_logs_deleted_flag(): void
    {
        $user = $this->loginUser();
        [$serial, $task] = $this->createSerialAndTask();
        $plan = KdPlan::create([
            'serial_id' => $serial->serial_id,
            'morder_id' => -1,
            'task_id' => $task->task_id,
            'deleted' => 0,
            'start_date' => '2026-07-01T08:30:00',
            'end_date' => '2026-07-02T17:15:00',
        ]);

        $this->actingAs($user)
            ->deleteJson("/api/plan/{$plan->plan_id}")
            ->assertOk();

        $log = KsSystemLog::where('plan_id', $plan->plan_id)->firstOrFail();
        $this->assertSame(['deleted' => 1], json_decode($log->diff, true));
    }

    public function test_bulk_destroy_logs_each_target_plan(): void
    {
        $user = $this->loginUser();
        [$serial, $task] = $this->createSerialAndTask();
        $base = [
            'serial_id' => $serial->serial_id,
            'morder_id' => -1,
            'task_id' => $task->task_id,
            'start_date' => '2026-07-01T08:30:00',
            'end_date' => '2026-07-02T17:15:00',
        ];
        $plan1 = KdPlan::create([...$base, 'deleted' => 0]);
        $plan2 = KdPlan::create([...$base, 'deleted' => 0]);
        $alreadyDeleted = KdPlan::create([...$base, 'deleted' => 1]);

        $this->actingAs($user)
            ->deleteJson('/api/plan', [
                'ids' => [$plan1->plan_id, $plan2->plan_id, $alreadyDeleted->plan_id],
            ])
            ->assertOk()
            ->assertJsonPath('deleted', 2);

        $this->assertDatabaseCount('ks_system_log', 2);
        $this->assertSame(
            ['deleted' => 1],
            json_decode(KsSystemLog::where('plan_id', $plan1->plan_id)->firstOrFail()->diff, true),
        );
        $this->assertSame(
            ['deleted' => 1],
            json_decode(KsSystemLog::where('plan_id', $plan2->plan_id)->firstOrFail()->diff, true),
        );
        // 削除済みの予定はログ対象外
        $this->assertSame(0, KsSystemLog::where('plan_id', $alreadyDeleted->plan_id)->count());
    }
}
