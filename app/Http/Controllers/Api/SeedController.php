<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DmKisyu;
use App\Models\KdSerial;
use App\Models\KmTeam;
use App\Models\KmWorker;
use App\Models\KmProcess;
use App\Models\KmTask;
use App\Models\KdPlan;
use App\Models\KmResource;
use App\Models\KkLocationType;
use App\Models\KdLocationPlan;
use App\Models\DrCalendar;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SeedController extends Controller
{
  private const TIME_SLOTS = [
    ['start' => '08:30', 'end' => '10:30'],
    ['start' => '10:40', 'end' => '12:25'],
    ['start' => '13:05', 'end' => '15:05'],
    ['start' => '15:15', 'end' => '17:15'],
    ['start' => '17:25', 'end' => '19:25'],
    ['start' => '19:25', 'end' => '21:25'],
  ];

  private int $lcgSeed = 42;

  private function lcgNext(): int
  {
    $this->lcgSeed = ($this->lcgSeed * 1664525 + 1013904223) & 0xffffffff;
    if ($this->lcgSeed < 0) $this->lcgSeed += 0x100000000;
    return $this->lcgSeed;
  }

  private function lcgRange(int $min, int $max): int
  {
    return $min + ($this->lcgNext() % ($max - $min + 1));
  }

  private function buildDateRangeFromSlots(int $baseTimestamp, int $startSlot, int $duration): array
  {
    $startDay = intdiv($startSlot, 6);
    $startSlotOfDay = $startSlot % 6;
    $endSlot = $startSlot + $duration - 1;
    $endDay = intdiv($endSlot, 6);
    $endSlotOfDay = $endSlot % 6;

    $startTs = $baseTimestamp + $startDay * 86400;
    $endTs = $baseTimestamp + $endDay * 86400;

    $startTime = self::TIME_SLOTS[$startSlotOfDay]['start'];
    $endTime = self::TIME_SLOTS[$endSlotOfDay]['end'];

    $startDate = date('Y-m-d', $startTs) . 'T' . $startTime . ':00';
    $endDate = date('Y-m-d', $endTs) . 'T' . $endTime . ':00';

    return [$startDate, $endDate];
  }

  public function seed(Request $request)
  {
    $count    = $request->input('count', 1000);
    $baseDate = $request->input('baseDate', now()->format('Y-m-01'));
    $months   = $request->input('months', 6);
    $seedNum  = $request->input('seedNum', 42);

    $this->lcgSeed = $seedNum;

    DB::statement('PRAGMA foreign_keys = OFF');
    KdLocationPlan::truncate();
    KdPlan::truncate();
    KdSerial::truncate();
    KmWorker::truncate();
    KmTeam::truncate();
    KmTask::truncate();
    KmProcess::truncate();
    DmKisyu::truncate();
    KmResource::truncate();
    KkLocationType::truncate();
    DB::statement('PRAGMA foreign_keys = ON');

    // 場所種別マスタを作成
    $locationTypeNames = ['1F', '2F', '3F', '4F', '5F'];
    $locationTypeIds = [];
    foreach ($locationTypeNames as $i => $typeName) {
      $lt = KkLocationType::create(['location_type_name' => $typeName]);
      $locationTypeIds[] = $lt->location_type_id;
    }

    // 場所マスタ（1F〜5F）を作成
    $locationNames = ['1F', '2F', '3F', '4F', '5F'];
    $locationIds = [];
    foreach ($locationNames as $i => $name) {
      $loc = KmResource::create([
        'resource_name'    => $name,
        'sort_no'          => $i + 1,
        'location_type_id' => $locationTypeIds[$i],
        'back_color'       => $i + 1,
        'font_color'       => 6,
      ]);
      $locationIds[] = $loc->resource_id;
    }

    $kisyuNames = ['機種A', '機種B', '機種C', '機種D', '機種E'];
    $kisyuIds = [];
    foreach ($kisyuNames as $i => $name) {
      $k = DmKisyu::create(['kisyu_name' => $name, 'sort_no' => $i + 1]);
      $kisyuIds[] = $k->kisyu_id;
    }

    $serialIds = [];
    for ($i = 1; $i <= 100; $i++) {
      $kisyuIdx = $this->lcgRange(0, 4);
      $s = KdSerial::create([
        'kisyu_id'   => $kisyuIds[$kisyuIdx],
        'serial_no'  => 'SN-' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'back_color' => $kisyuIdx + 1,
        'font_color' => 6,
      ]);
      $serialIds[] = $s->serial_id;
    }

    $teamA = KmTeam::create(['team_name' => 'チームA', 'sort_no' => 1]);
    $teamB = KmTeam::create(['team_name' => 'チームB', 'sort_no' => 2]);

    $workerDefs = [
      ['山田太郎', $teamA->team_id],
      ['鈴木花子', $teamA->team_id],
      ['田中一郎', $teamB->team_id],
      ['佐藤二郎', $teamB->team_id],
      ['高橋三郎', $teamB->team_id],
    ];
    $workerIds = [];
    foreach ($workerDefs as $wd) {
      $w = KmWorker::create(['worker_name' => $wd[0], 'team_id' => $wd[1]]);
      $workerIds[] = $w->worker_id;
    }

    $procStd = KmProcess::create(['process_name' => '標準プロセス', 'sort_no' => 1]);
    $procSp  = KmProcess::create(['process_name' => '特殊プロセス', 'sort_no' => 2]);

    $taskDefs = [
      ['工程1', $procStd->process_id, 1, 6, 1],
      ['工程2', $procStd->process_id, 2, 6, 2],
      ['工程3', $procStd->process_id, 3, 6, 3],
      ['検査',  $procSp->process_id,  4, 6, 4],
      ['出荷',  $procSp->process_id,  5, 6, 5],
    ];
    $taskIds = [];
    foreach ($taskDefs as $td) {
      $t = KmTask::create([
        'process_id' => $td[1],
        'task_name'  => $td[0],
        'back_color' => $td[2],
        'font_color' => $td[3],
        'sort_no'    => $td[4],
      ]);
      $taskIds[] = $t->task_id;
    }

    $base = strtotime($baseDate);
    $totalSlots = $months * 30 * 6;

    $plans = [];
    for ($i = 0; $i < $count; $i++) {
      $serialIdx  = $this->lcgRange(0, count($serialIds) - 1);
      $taskIdx    = $this->lcgRange(0, count($taskIds) - 1);
      $workerIdx  = $this->lcgRange(0, count($workerIds) - 1);
      $startSlot  = $this->lcgRange(0, $totalSlots - 1);
      $duration   = $this->lcgRange(1, 12);
      [$startDate, $endDate] = $this->buildDateRangeFromSlots($base, $startSlot, $duration);

      $plans[] = [
        'serial_id'   => $serialIds[$serialIdx],
        'task_id'     => $taskIds[$taskIdx],
        'worker_id'   => $workerIds[$workerIdx],
        'deleted'     => 0,
        'start_date'  => $startDate,
        'end_date'    => $endDate,
      ];
    }

    foreach (array_chunk($plans, 200) as $chunk) {
      KdPlan::insert($chunk);
    }

    // 場所予定を生成（装置予定の約1/4の件数）
    $locationPlanCount = max(1, intdiv($count, 4));
    $locationPlans = [];
    for ($i = 0; $i < $locationPlanCount; $i++) {
      $locationIdx = $this->lcgRange(0, count($locationIds) - 1);
      $serialIdx   = $this->lcgRange(0, count($serialIds) - 1);
      $startSlot   = $this->lcgRange(0, $totalSlots - 1);
      $duration    = $this->lcgRange(1, 8);
      [$startDate, $endDate] = $this->buildDateRangeFromSlots($base, $startSlot, $duration);

      $locationPlans[] = [
        'resource_id' => $locationIds[$locationIdx],
        'serial_id'   => $serialIds[$serialIdx],
        'start_date'  => $startDate,
        'end_date'    => $endDate,
        'deleted'     => 0,
      ];
    }

    foreach (array_chunk($locationPlans, 200) as $chunk) {
      KdLocationPlan::insert($chunk);
    }

    return response()->json([
      'ok'            => true,
      'count'         => $count,
      'serials'       => count($serialIds),
      'workers'       => count($workerIds),
      'tasks'         => count($taskIds),
      'locations'     => count($locationIds),
      'locationPlans' => count($locationPlans),
    ]);
  }

  public function seedMaster(Request $request)
  {
    $baseDate = $request->input('baseDate', now()->format('Y-m-d'));
    $seedNum  = $request->input('seedNum', 42);

    $this->lcgSeed = $seedNum;

    DB::statement('PRAGMA foreign_keys = OFF');
    KdLocationPlan::truncate();
    KdPlan::truncate();
    KdSerial::truncate();
    KmWorker::truncate();
    KmTeam::truncate();
    KmTask::truncate();
    KmProcess::truncate();
    DmKisyu::truncate();
    KmResource::truncate();
    KkLocationType::truncate();
    DrCalendar::truncate();
    DB::statement('PRAGMA foreign_keys = ON');

    // 場所種別マスタを作成（3F/4F/5F相当）
    $locationTypeIds = [];
    foreach (['3F', '4F', '5F'] as $typeName) {
      $lt = KkLocationType::create(['location_type_name' => $typeName]);
      $locationTypeIds[] = $lt->location_type_id;
    }

    $locationIds = [];
    for ($i = 1; $i <= 100; $i++) {
      $loc = KmResource::create([
        'resource_name'    => '場所' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'sort_no'          => $i,
        'location_type_id' => $locationTypeIds[(($i - 1) % count($locationTypeIds))],
        'back_color'       => (($i - 1) % 5) + 1,
        'font_color'       => 6,
      ]);
      $locationIds[] = $loc->resource_id;
    }

    $kisyuIds = [];
    for ($i = 1; $i <= 100; $i++) {
      $kisyu = DmKisyu::create([
        'kisyu_name' => '機種' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'sort_no'    => $i,
      ]);
      $kisyuIds[] = $kisyu->kisyu_id;
    }

    $teamIds = [];
    for ($i = 1; $i <= 20; $i++) {
      $team = KmTeam::create([
        'team_name' => 'チーム' . str_pad($i, 2, '0', STR_PAD_LEFT),
        'sort_no'   => $i,
      ]);
      $teamIds[] = $team->team_id;
    }

    $workerIds = [];
    for ($i = 1; $i <= 100; $i++) {
      $worker = KmWorker::create([
        'worker_name' => '担当者' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'team_id'     => $teamIds[($i - 1) % count($teamIds)],
      ]);
      $workerIds[] = $worker->worker_id;
    }

    $processIds = [];
    for ($i = 1; $i <= 20; $i++) {
      $process = KmProcess::create([
        'process_name' => '工程分類' . str_pad($i, 2, '0', STR_PAD_LEFT),
        'sort_no'      => $i,
      ]);
      $processIds[] = $process->process_id;
    }

    $taskIds = [];
    for ($i = 1; $i <= 100; $i++) {
      $task = KmTask::create([
        'process_id' => $processIds[($i - 1) % count($processIds)],
        'task_name'  => 'タスク' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'back_color' => (($i - 1) % 6) + 1,
        'font_color' => 6,
        'sort_no'    => $i,
      ]);
      $taskIds[] = $task->task_id;
    }

    $serialIds = [];
    $base = strtotime($baseDate);
    for ($i = 1; $i <= 100; $i++) {
      $shippingDate = date('Y-m-d', $base + $this->lcgRange(10, 240) * 86400);
      $serial = KdSerial::create([
        'kisyu_id'       => $kisyuIds[($i - 1) % count($kisyuIds)],
        'serial_no'      => 'SN-' . str_pad($i, 5, '0', STR_PAD_LEFT),
        'shipping_date'  => $shippingDate,
        'responsible'    => (string) $workerIds[($i - 1) % count($workerIds)],
        'back_color'     => (($i - 1) % 6) + 1,
        'font_color'     => 6,
      ]);
      $serialIds[] = $serial->serial_id;
    }

    $start = strtotime('-1 year', $base);
    $calendarRows = [];
    for ($i = 0; $i < 730; $i++) {
      $ts = $start + $i * 86400;
      $w = (int) date('w', $ts);
      $dateType = ($w === 0 || $w === 6) ? 1 : 0;
      if ($this->lcgRange(1, 100) <= 3) {
        $dateType = 4; // 会社休日
      }
      $calendarRows[] = [
        'calendar_date' => date('Y-m-d', $ts),
        'date_type'     => $dateType,
      ];
    }

    foreach (array_chunk($calendarRows, 200) as $chunk) {
      DrCalendar::insert($chunk);
    }

    return response()->json([
      'ok'        => true,
      'serials'   => count($serialIds),
      'workers'   => count($workerIds),
      'tasks'     => count($taskIds),
      'resources' => count($locationIds),
      'calendar'  => count($calendarRows),
    ]);
  }

  public function seedPlans(Request $request)
  {
    $count    = $request->input('count', 1000);
    $baseDate = $request->input('baseDate', now()->format('Y-m-01'));
    $months   = $request->input('months', 6);
    $seedNum  = $request->input('seedNum', 42);

    $this->lcgSeed = $seedNum;

    $serialIds   = KdSerial::pluck('serial_id')->all();
    $taskIds     = KmTask::pluck('task_id')->all();
    $workerIds   = KmWorker::pluck('worker_id')->all();
    $locationIds = KmResource::pluck('resource_id')->all();

    if (empty($serialIds) || empty($taskIds) || empty($workerIds) || empty($locationIds)) {
      return response()->json(['message' => '先に初期データ生成を実行してください。'], 422);
    }

    $base = strtotime($baseDate);
    $totalSlots = $months * 30 * 6;

    $plans = [];
    for ($i = 0; $i < $count; $i++) {
      [$startDate, $endDate] = $this->buildDateRangeFromSlots(
        $base,
        $this->lcgRange(0, $totalSlots - 1),
        $this->lcgRange(1, 12)
      );

      $plans[] = [
        'serial_id'   => $serialIds[$this->lcgRange(0, count($serialIds) - 1)],
        'task_id'     => $taskIds[$this->lcgRange(0, count($taskIds) - 1)],
        'worker_id'   => $this->lcgRange(1, 100) <= 8 ? null : $workerIds[$this->lcgRange(0, count($workerIds) - 1)],
        'deleted'     => 0,
        'start_date'  => $startDate,
        'end_date'    => $endDate,
      ];
    }

    foreach (array_chunk($plans, 200) as $chunk) {
      KdPlan::insert($chunk);
    }

    $reserveCount = $request->input('reserveCount', 1000);
    $reserves = [];
    for ($i = 0; $i < $reserveCount; $i++) {
      [$startDate, $endDate] = $this->buildDateRangeFromSlots(
        $base,
        $this->lcgRange(0, $totalSlots - 1),
        $this->lcgRange(1, 8)
      );

      $reserves[] = [
        'resource_id' => $locationIds[$this->lcgRange(0, count($locationIds) - 1)],
        'serial_id'   => $serialIds[$this->lcgRange(0, count($serialIds) - 1)],
        'start_date'  => $startDate,
        'end_date'    => $endDate,
        'deleted'     => 0,
      ];
    }

    foreach (array_chunk($reserves, 200) as $chunk) {
      KdLocationPlan::insert($chunk);
    }

    return response()->json([
      'ok'       => true,
      'plans'    => count($plans),
      'reserves' => count($reserves),
    ]);
  }
}
