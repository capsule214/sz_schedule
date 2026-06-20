<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DmEquip;
use App\Models\DmKisyu;
use App\Models\DrCalendar;
use App\Models\KdMorder;
use App\Models\KdPlan;
use App\Models\KdReserve;
use App\Models\KdSerial;
use App\Models\KkLocationType;
use App\Models\KmKoujunDetail;
use App\Models\KmProcess;
use App\Models\KmResource;
use App\Models\KmTask;
use App\Models\KmTeam;
use App\Models\KmWorker;
use App\Models\MDpr;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SeedController extends Controller
{
    /** 2025・2026年 日本の国民の祝日（振替休日含む） date_type=3 に設定 */
    private const NATIONAL_HOLIDAYS = [
        // 2025年
        '2025-01-01', // 元日
        '2025-01-13', // 成人の日（第2月曜）
        '2025-02-11', // 建国記念の日
        '2025-02-23', // 天皇誕生日（日曜）
        '2025-02-24', // 振替休日
        '2025-03-20', // 春分の日
        '2025-04-29', // 昭和の日
        '2025-05-03', // 憲法記念日
        '2025-05-04', // みどりの日（日曜）
        '2025-05-05', // こどもの日
        '2025-05-06', // 振替休日（みどりの日）
        '2025-07-21', // 海の日（第3月曜）
        '2025-08-11', // 山の日
        '2025-09-15', // 敬老の日（第3月曜）
        '2025-09-23', // 秋分の日
        '2025-10-13', // スポーツの日（第2月曜）
        '2025-11-03', // 文化の日
        '2025-11-23', // 勤労感謝の日（日曜）
        '2025-11-24', // 振替休日
        // 2026年
        '2026-01-01', // 元日
        '2026-01-12', // 成人の日（第2月曜）
        '2026-02-11', // 建国記念の日
        '2026-02-23', // 天皇誕生日
        '2026-03-20', // 春分の日
        '2026-04-29', // 昭和の日
        '2026-05-03', // 憲法記念日（日曜）
        '2026-05-04', // みどりの日
        '2026-05-05', // こどもの日
        '2026-05-06', // 振替休日（憲法記念日）
        '2026-07-20', // 海の日（第3月曜）
        '2026-08-11', // 山の日
        '2026-09-21', // 敬老の日（第3月曜）
        '2026-09-23', // 秋分の日
        '2026-10-12', // スポーツの日（第2月曜）
        '2026-11-03', // 文化の日
        '2026-11-23', // 勤労感謝の日
    ];

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
        $this->lcgSeed = ($this->lcgSeed * 1664525 + 1013904223) & 0xFFFFFFFF;
        if ($this->lcgSeed < 0) {
            $this->lcgSeed += 0x100000000;
        }

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

        $startDate = date('Y-m-d', $startTs).'T'.$startTime.':00';
        $endDate = date('Y-m-d', $endTs).'T'.$endTime.':00';

        return [$startDate, $endDate];
    }

    private function seedMorders(int $baseTimestamp, int $count = 100): array
    {
        $morderIds = [];
        for ($i = 1; $i <= $count; $i++) {
            $morder = KdMorder::create([
                'deleted' => 0,
                'back_color' => (($i - 1) % 6) + 1,
                'font_color' => 6,
                'order_type_id' => $i % 2 === 0 ? 21 : 11,
                'equip_group_id' => (($i - 1) % 3) + 1,
                'morder_no' => 'M'.str_pad((string) (1234500 + $i), 7, '0', STR_PAD_LEFT),
                'parts_no' => 'PART-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'flg_public' => 1,
                'flg_goso' => $i % 10 === 0 ? 1 : 0,
                'flg_finish' => $i % 12 === 0 ? 1 : 0,
                'koutei_pic_no' => str_pad((string) $this->lcgRange(1, 99999), 5, '0', STR_PAD_LEFT),
                'shipping_date' => date('Y-m-d', $baseTimestamp + $this->lcgRange(10, 240) * 86400),
                'public_remark' => 'M番備考'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'customer_name' => '顧客'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
            ]);
            $morderIds[] = $morder->morder_id;
        }

        return $morderIds;
    }

    private function seedKoujunDetails(array $taskIds, int $count = 100): int
    {
        if (empty($taskIds)) {
            return 0;
        }

        $rows = [];
        for ($koujunId = 1; $koujunId <= $count; $koujunId++) {
            $detailCount = min(count($taskIds), $this->lcgRange(2, 5));
            for ($i = 0; $i < $detailCount; $i++) {
                $rows[] = [
                    'koujun_id' => $koujunId,
                    'koujun_num' => str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
                    'task_id' => $taskIds[($koujunId + $i - 1) % count($taskIds)],
                ];
            }
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            KmKoujunDetail::insert($chunk);
        }

        return count($rows);
    }

    public function seed(Request $request)
    {
        $count = $request->input('count', 1000);
        $baseDate = $request->input('baseDate', now()->format('Y-m-01'));
        $months = $request->input('months', 6);
        $seedNum = $request->input('seedNum', 42);

        $this->lcgSeed = $seedNum;
        $base = strtotime($baseDate);

        DB::statement('PRAGMA foreign_keys = OFF');
        KdReserve::truncate();
        KdPlan::truncate();
        KdMorder::truncate();
        KdSerial::truncate();
        KmKoujunDetail::truncate();
        KmWorker::truncate();
        KmTeam::truncate();
        KmTask::truncate();
        KmProcess::truncate();
        DmKisyu::truncate();
        DmEquip::truncate();
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
                'resource_name' => $name,
                'sort_no' => $i + 1,
                'location_type_id' => $locationTypeIds[$i],
                'back_color' => $i + 1,
                'font_color' => 6,
            ]);
            $locationIds[] = $loc->resource_id;
        }

        $kisyuNames = ['機種A', '機種B', '機種C', '機種D', '機種E'];
        $equipIds = [];
        foreach ([1, 2, 3] as $typeId) {
            $equip = DmEquip::create([
                'equip_name' => '装置区分'.$typeId,
                'equip_type_id' => $typeId,
            ]);
            $equipIds[] = $equip->equip_id;
        }
        $kisyuIds = [];
        foreach ($kisyuNames as $i => $name) {
            $k = DmKisyu::create(['kisyu_name' => $name, 'equip_id' => $equipIds[$i % count($equipIds)], 'sort_no' => $i + 1, 'waku_display' => ($i + 1) % 3]);
            $kisyuIds[] = $k->kisyu_id;
        }

        $serialIds = [];
        for ($i = 1; $i <= 100; $i++) {
            $kisyuIdx = $this->lcgRange(0, 4);
            $s = KdSerial::create([
                'kisyu_id' => $kisyuIds[$kisyuIdx],
                'serial_no' => 'SN-'.str_pad($i, 3, '0', STR_PAD_LEFT),
                'seizo_group_id' => (($i + 1) % 3) + 1,
                'order_no' => 'YG'.str_pad((string) $i, 2, '0', STR_PAD_LEFT),
                'flg_public' => 1,
                'flg_syoyo' => $i % 3 === 0 ? 1 : 0,
                'koujun_id' => $i,
                'koutei_pic_no' => str_pad((string) $this->lcgRange(1, 99999), 5, '0', STR_PAD_LEFT),
                'public_remark' => '製番備考'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'customer_name' => '顧客'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'back_color' => $kisyuIdx + 1,
                'font_color' => 6,
                'flg_finish' => $i % 12 === 0 ? 1 : 0,  // 完了製品は flg_finish=1 として登録
            ]);
            $serialIds[] = $s->serial_id;
        }

        $morderIds = $this->seedMorders($base);

        $teamA = KmTeam::create(['team_name' => 'チームA', 'sort_no' => 1, 'equip_group_id' => 1]);
        $teamB = KmTeam::create(['team_name' => 'チームB', 'sort_no' => 2, 'equip_group_id' => 2]);

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
        $procSp = KmProcess::create(['process_name' => '特殊プロセス', 'sort_no' => 2]);

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
                'task_name' => $td[0],
                'back_color' => $td[2],
                'font_color' => $td[3],
                'sort_no' => $td[4],
            ]);
            $taskIds[] = $t->task_id;
        }

        $koujunDetails = $this->seedKoujunDetails($taskIds);
        $totalSlots = $months * 30 * 6;

        $plans = [];
        for ($i = 0; $i < $count; $i++) {
            $serialIdx = $this->lcgRange(0, count($serialIds) - 1);
            $taskIdx = $this->lcgRange(0, count($taskIds) - 1);
            $workerIdx = $this->lcgRange(0, count($workerIds) - 1);
            $startSlot = $this->lcgRange(0, $totalSlots - 1);
            $duration = $this->lcgRange(1, 12);
            [$startDate, $endDate] = $this->buildDateRangeFromSlots($base, $startSlot, $duration);

            $plans[] = [
                'serial_id' => $serialIds[$serialIdx],
                'morder_id' => -1,
                'task_id' => $taskIds[$taskIdx],
                'worker_id' => $workerIds[$workerIdx],
                'deleted' => 0,
                'start_date' => $startDate,
                'end_date' => $endDate,
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
            $serialIdx = $this->lcgRange(0, count($serialIds) - 1);
            $startSlot = $this->lcgRange(0, $totalSlots - 1);
            $duration = $this->lcgRange(1, 8);
            [$startDate, $endDate] = $this->buildDateRangeFromSlots($base, $startSlot, $duration);

            $locationPlans[] = [
                'resource_id' => $locationIds[$locationIdx],
                'serial_id' => $serialIds[$serialIdx],
                'start_date' => $startDate,
                'end_date' => $endDate,
                'deleted' => 0,
            ];
        }

        foreach (array_chunk($locationPlans, 200) as $chunk) {
            KdReserve::insert($chunk);
        }

        return response()->json([
            'ok' => true,
            'count' => $count,
            'serials' => count($serialIds),
            'workers' => count($workerIds),
            'tasks' => count($taskIds),
            'koujunDetails' => $koujunDetails,
            'locations' => count($locationIds),
            'morders' => count($morderIds),
            'locationPlans' => count($locationPlans),
        ]);
    }

    public function seedMaster(Request $request)
    {
        $baseDate = $request->input('baseDate', now()->format('Y-m-d'));
        $seedNum = $request->input('seedNum', 42);

        $this->lcgSeed = $seedNum;

        DB::statement('PRAGMA foreign_keys = OFF');
        KdReserve::truncate();
        KdPlan::truncate();
        KdMorder::truncate();
        KdSerial::truncate();
        KmKoujunDetail::truncate();
        KmWorker::truncate();
        KmTeam::truncate();
        KmTask::truncate();
        KmProcess::truncate();
        DmKisyu::truncate();
        DmEquip::truncate();
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
                'resource_name' => '場所'.str_pad($i, 3, '0', STR_PAD_LEFT),
                'sort_no' => $i,
                'location_type_id' => $locationTypeIds[(($i - 1) % count($locationTypeIds))],
                'back_color' => (($i - 1) % 5) + 1,
                'font_color' => 6,
            ]);
            $locationIds[] = $loc->resource_id;
        }

        $equipIds = [];
        foreach ([1, 2, 3] as $typeId) {
            $equip = DmEquip::create([
                'equip_name' => '装置区分'.$typeId,
                'equip_type_id' => $typeId,
            ]);
            $equipIds[] = $equip->equip_id;
        }

        $kisyuIds = [];
        for ($i = 1; $i <= 100; $i++) {
            $kisyu = DmKisyu::create([
                'kisyu_name' => '機種'.str_pad($i, 3, '0', STR_PAD_LEFT),
                'equip_id' => $equipIds[($i - 1) % count($equipIds)],
                'sort_no' => $i,
                'waku_display' => $i % 3,
            ]);
            $kisyuIds[] = $kisyu->kisyu_id;
        }

        $teamIds = [];
        for ($i = 1; $i <= 20; $i++) {
            $team = KmTeam::create([
                'team_name' => 'チーム'.str_pad($i, 2, '0', STR_PAD_LEFT),
                'sort_no' => $i,
                'equip_group_id' => ($i % 3) + 1,
            ]);
            $teamIds[] = $team->team_id;
        }

        $workerIds = [];
        for ($i = 1; $i <= 100; $i++) {
            $worker = KmWorker::create([
                'worker_name' => '担当者'.str_pad($i, 3, '0', STR_PAD_LEFT),
                'team_id' => $teamIds[($i - 1) % count($teamIds)],
            ]);
            $workerIds[] = $worker->worker_id;
        }

        $processIds = [];
        for ($i = 1; $i <= 20; $i++) {
            $process = KmProcess::create([
                'process_name' => '工程分類'.str_pad($i, 2, '0', STR_PAD_LEFT),
                'sort_no' => $i,
            ]);
            $processIds[] = $process->process_id;
        }

        $taskIds = [];
        for ($i = 1; $i <= 100; $i++) {
            $task = KmTask::create([
                'process_id' => $processIds[($i - 1) % count($processIds)],
                'task_name' => 'タスク'.str_pad($i, 3, '0', STR_PAD_LEFT),
                'back_color' => (($i - 1) % 6) + 1,
                'font_color' => 6,
                'sort_no' => $i,
            ]);
            $taskIds[] = $task->task_id;
        }
        $koujunDetails = $this->seedKoujunDetails($taskIds);

        $serialIds = [];
        $base = strtotime($baseDate);
        for ($i = 1; $i <= 100; $i++) {
            $shippingDate = date('Y-m-d', $base + $this->lcgRange(10, 240) * 86400);
            $serial = KdSerial::create([
                'kisyu_id' => $kisyuIds[($i - 1) % count($kisyuIds)],
                'serial_no' => 'SN-'.str_pad($i, 5, '0', STR_PAD_LEFT),
                'seizo_group_id' => (($i + 1) % 3) + 1,
                'order_no' => 'YG'.str_pad((string) $i, 5, '0', STR_PAD_LEFT),
                'original_no' => $i % 7 === 0 ? 'OLD-'.str_pad((string) $i, 5, '0', STR_PAD_LEFT) : '',
                'r_no' => $i % 5 === 0 ? 'R'.str_pad((string) $i, 4, '0', STR_PAD_LEFT) : '',
                'flg_public' => 1,
                'flg_goso' => $i % 10 === 0 ? 1 : 0,
                'flg_finish' => $i % 12 === 0 ? 1 : 0,
                'flg_syoyo' => $i % 3 === 0 ? 1 : 0,
                'koujun_id' => $i,
                'koutei_pic_no' => str_pad((string) $workerIds[($i - 1) % count($workerIds)], 5, '0', STR_PAD_LEFT),
                'mechanic_pic_no' => str_pad((string) $this->lcgRange(1, 99999), 5, '0', STR_PAD_LEFT),
                'electric_pic_no' => str_pad((string) $this->lcgRange(1, 99999), 5, '0', STR_PAD_LEFT),
                'shipping_date' => $shippingDate,
                'public_remark' => '製番備考'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'customer_name' => '顧客'.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'back_color' => (($i - 1) % 6) + 1,
                'font_color' => 6,
            ]);
            $serialIds[] = $serial->serial_id;
        }

        $morderIds = $this->seedMorders($base);

        $start = strtotime('-1 year', $base);
        $calendarRows = [];
        for ($i = 0; $i < 730; $i++) {
            $ts = $start + $i * 86400;
            $w = (int) date('w', $ts);
            $ds = date('Y-m-d', $ts);
            $dateType = ($w === 0 || $w === 6) ? 1 : 0;
            if (in_array($ds, self::NATIONAL_HOLIDAYS)) {
                $dateType = 3; // 祝日
            } elseif ($dateType === 0 && $this->lcgRange(1, 100) <= 3) {
                $dateType = 4; // 会社休日（平日のみランダム）
            }
            $calendarRows[] = [
                'calendar_date' => $ds,
                'date_type' => $dateType,
            ];
        }

        foreach (array_chunk($calendarRows, 200) as $chunk) {
            DrCalendar::insert($chunk);
        }

        return response()->json([
            'ok' => true,
            'serials' => count($serialIds),
            'workers' => count($workerIds),
            'tasks' => count($taskIds),
            'koujunDetails' => $koujunDetails,
            'resources' => count($locationIds),
            'morders' => count($morderIds),
            'calendar' => count($calendarRows),
        ]);
    }

    public function seedPlans(Request $request)
    {
        $count = $request->input('count', 1000);
        $baseDate = $request->input('baseDate', now()->format('Y-m-01'));
        $months = $request->input('months', 6);
        $seedNum = $request->input('seedNum', 42);
        $productDisplay = $request->input('product_display', 'serial');

        $this->lcgSeed = $seedNum;

        $serialIds = KdSerial::pluck('serial_id')->all();
        $morderIds = KdMorder::where('deleted', 0)->pluck('morder_id')->all();
        $taskIds = KmTask::pluck('task_id')->all();
        $workerIds = KmWorker::pluck('worker_id')->all();
        $locationIds = KmResource::pluck('resource_id')->all();

        if (empty($serialIds) || empty($taskIds) || empty($workerIds) || empty($locationIds) || ($productDisplay === 'morder' && empty($morderIds))) {
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
                'serial_id' => $productDisplay === 'morder' ? -1 : $serialIds[$this->lcgRange(0, count($serialIds) - 1)],
                'morder_id' => $productDisplay === 'morder' ? $morderIds[$this->lcgRange(0, count($morderIds) - 1)] : -1,
                'task_id' => $taskIds[$this->lcgRange(0, count($taskIds) - 1)],
                'worker_id' => $this->lcgRange(1, 100) <= 8 ? null : $workerIds[$this->lcgRange(0, count($workerIds) - 1)],
                'deleted' => 0,
                'start_date' => $startDate,
                'end_date' => $endDate,
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
                'serial_id' => $serialIds[$this->lcgRange(0, count($serialIds) - 1)],
                'start_date' => $startDate,
                'end_date' => $endDate,
                'deleted' => 0,
            ];
        }

        foreach (array_chunk($reserves, 200) as $chunk) {
            KdReserve::insert($chunk);
        }

        return response()->json([
            'ok' => true,
            'plans' => count($plans),
            'morders' => $productDisplay === 'morder' ? count($morderIds) : 0,
            'reserves' => count($reserves),
        ]);
    }

    public function seedDpr(Request $request): JsonResponse
    {
        $count = (int) $request->input('count', 1000);
        $this->lcgSeed = (int) $request->input('seed', 999);

        MDpr::truncate();

        $countries = ['CH', 'KR', 'NA', 'OS', 'PH', 'SD', 'SG', 'SW'];
        $years = ['24', '25', '26'];
        $classifications = ['A', 'B', 'AtoB'];
        $formtypes = [1, 2, 3];
        $deliverytypes = [1, 2];
        $machines = array_map(fn ($n) => '機種'.str_pad($n, 3, '0', STR_PAD_LEFT), range(1, 20));
        $statuses = ['オークション中', '設計中', 'A完了', '枝番発行済', '設計完了', '中止'];
        $customerNames = ['株式会社アルファ', '株式会社ベータ', 'ガンマ工業株式会社', 'デルタ製作所',
            'イプシロン電機株式会社', 'ゼータ精機', 'イータ産業株式会社', 'シータ技術',
            'イオタシステム株式会社', 'カッパ製造'];
        $subjects = ['特別仕様品対応', '機能改善版', 'カスタム仕様', 'オプション追加対応', '海外向け仕様',
            '試作品対応', '量産移行対応', '不具合改修版', '新機能追加', 'コスト削減版'];

        // 国ごとの連番カウンタ
        $counters = array_fill_keys($countries, 1);

        $rows = [];
        for ($i = 0; $i < $count; $i++) {
            $country = $countries[$this->lcgRange(0, count($countries) - 1)];
            $year = $years[$this->lcgRange(0, count($years) - 1)];
            $seq = str_pad($counters[$country]++, 6, '0', STR_PAD_LEFT);
            $dprno = $country.$year.$seq;

            $issueYear = 2024 + intval($year) - 24;
            $issueMonth = $this->lcgRange(1, 12);
            $issueDay = $this->lcgRange(1, 28);
            $issueDate = sprintf('%04d/%02d/%02d', $issueYear, $issueMonth, $issueDay);
            $issueTs = mktime(0, 0, 0, $issueMonth, $issueDay, $issueYear);

            $designOffset = $this->lcgRange(30, 120);
            $partsOffset = $this->lcgRange(60, 150);
            $pplOffset = $this->lcgRange(90, 180);
            $fmtDate = fn (int $ts) => date('Y/m/d', $ts);

            $hasMech = (bool) $this->lcgRange(0, 1);
            $hasElec = (bool) $this->lcgRange(0, 1);
            $hasSoft = (bool) $this->lcgRange(0, 1);
            $hasOther = $this->lcgRange(0, 3) === 0;

            $status = $statuses[$this->lcgRange(0, count($statuses) - 1)];
            $isDone = in_array($status, ['A完了', '設計完了', '枝番発行済'], true);

            $empNo = fn () => str_pad($this->lcgRange(10000, 99999), 5, '0', STR_PAD_LEFT);
            $ca = chr(ord('a') + $this->lcgRange(0, 25)).chr(ord('a') + $this->lcgRange(0, 25));
            $cn = str_pad($this->lcgRange(1000, 9999), 4, '0', STR_PAD_LEFT);

            $rows[] = [
                'dprno' => $dprno,
                'classification' => $classifications[$this->lcgRange(0, count($classifications) - 1)],
                'formtype' => $formtypes[$this->lcgRange(0, count($formtypes) - 1)],
                'deliverytype' => $deliverytypes[$this->lcgRange(0, count($deliverytypes) - 1)],
                'machine' => $machines[$this->lcgRange(0, count($machines) - 1)],
                'customer_code' => $ca.$cn,
                'subject' => $subjects[$this->lcgRange(0, count($subjects) - 1)],
                'dprleader_sytx' => $empNo(),
                'mechanism_sytx' => $hasMech ? $empNo() : null,
                'electricity_sytx' => $hasElec ? $empNo() : null,
                'soft_sytx' => $hasSoft ? $empNo() : null,
                'other_sytx' => $hasOther ? $empNo() : null,
                'status' => $status,
                'issue_date' => $issueDate,
                'orderno' => strtoupper($ca).str_pad($this->lcgRange(100000, 999999), 6, '0', STR_PAD_LEFT),
                'qty' => $this->lcgRange(1, 10),
                'mechanism_design_date' => $hasMech ? $fmtDate($issueTs + $designOffset * 86400) : null,
                'electricity_design_date' => $hasElec ? $fmtDate($issueTs + ($designOffset + $this->lcgRange(-10, 10)) * 86400) : null,
                'soft_design_date' => $hasSoft ? $fmtDate($issueTs + ($designOffset + $this->lcgRange(-10, 10)) * 86400) : null,
                'other_design_date' => $hasOther ? $fmtDate($issueTs + $designOffset * 86400) : null,
                'mechanism_parts_schedule' => $hasMech ? $fmtDate($issueTs + $partsOffset * 86400) : null,
                'electricity_parts_schedule' => $hasElec ? $fmtDate($issueTs + $partsOffset * 86400) : null,
                'soft_parts_schedule' => $hasSoft ? $fmtDate($issueTs + $partsOffset * 86400) : null,
                'other_parts_schedule' => $hasOther ? $fmtDate($issueTs + $partsOffset * 86400) : null,
                'customer_name' => $customerNames[$this->lcgRange(0, count($customerNames) - 1)],
                'mechanism_ppl_date' => ($hasMech && $isDone) ? $fmtDate($issueTs + $pplOffset * 86400) : null,
                'electricity_ppl_date' => ($hasElec && $isDone) ? $fmtDate($issueTs + $pplOffset * 86400) : null,
                'soft_ppl_date' => ($hasSoft && $isDone) ? $fmtDate($issueTs + $pplOffset * 86400) : null,
                'other_ppl_date' => ($hasOther && $isDone) ? $fmtDate($issueTs + $pplOffset * 86400) : null,
                'outputlistflag_m' => ($hasMech && $this->lcgRange(0, 1)) ? 'm' : null,
                'outputlistflag_e' => ($hasElec && $this->lcgRange(0, 1)) ? 'e' : null,
                'outputlistflag_s' => ($hasSoft && $this->lcgRange(0, 1)) ? 's' : null,
            ];
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            MDpr::insert($chunk);
        }

        return response()->json(['ok' => true, 'inserted' => count($rows)]);
    }
}
