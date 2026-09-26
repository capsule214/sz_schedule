<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DprController extends Controller
{
  private function dprSalesExpression(): string
  {
    return DB::connection()->getDriverName() === 'sqlite'
      ? 'substr(dprno, 1, 2)'
      : 'LEFT(dprno, 2)';
  }

  private function dprPublishExpression(): string
  {
    return match (DB::connection()->getDriverName()) {
      'pgsql' => 'SUBSTRING(dprno FROM 3 FOR 2)',
      'sqlite' => 'substr(dprno, 3, 2)',
      default => 'SUBSTRING(dprno, 3, 2)',
    };
  }

  /** DPR Noの機種名から機種マスタを介して、関連する製番を返す。 */
  public function relatedSerials(Request $request)
  {
    $data = $request->validate([
      'dprNo' => 'required|string|max:255',
    ]);

    $serials = DB::table('m_dpr')
      ->join('dm_kisyu', 'dm_kisyu.kisyu_name', '=', 'm_dpr.machine')
      ->join('kd_serial', 'kd_serial.kisyu_id', '=', 'dm_kisyu.kisyu_id')
      ->where('m_dpr.dprno', $data['dprNo'])
      ->where('dm_kisyu.deleted', 0)
      ->where('kd_serial.deleted', 0)
      ->where('kd_serial.serial_no', '<>', '')
      ->select('kd_serial.serial_no', 'kd_serial.order_no')
      ->distinct()
      ->orderBy('kd_serial.serial_no')
      ->orderBy('kd_serial.order_no')
      ->get()
      ->map(fn ($serial) => [
        'serialNo' => $serial->serial_no,
        'receiptNo' => $serial->order_no,
      ]);

    return response()->json($serials);
  }

  /** 表示設定用の機種・営業拠点・発行年を1レスポンスで返す。 */
  public function options()
  {
    $salesExpression = $this->dprSalesExpression();
    $publishExpression = $this->dprPublishExpression();

    // m_dprの明細はPHPへ読み込まず、各選択肢をDB側で集約する。
    // UNION ALLでまとめ、表示設定を開いた際のDB往復も1回に抑える。
    $machineOptions = DB::table('m_dpr')
      ->selectRaw("'machine' as option_type, machine as option_value")
      ->whereNotNull('machine')
      ->where('machine', '<>', '')
      ->groupBy('machine');
    $locationOptions = DB::table('m_dpr')
      ->selectRaw("'location' as option_type, {$salesExpression} as option_value")
      ->whereNotNull('dprno')
      ->where('dprno', '<>', '')
      ->groupByRaw($salesExpression);
    $yearOptions = DB::table('m_dpr')
      ->selectRaw("'year' as option_type, {$publishExpression} as option_value")
      ->whereNotNull('dprno')
      ->where('dprno', '<>', '')
      ->groupByRaw($publishExpression);

    $rows = DB::query()
      ->fromSub($machineOptions->unionAll($locationOptions)->unionAll($yearOptions), 'dpr_options')
      ->whereNotNull('option_value')
      ->where('option_value', '<>', '')
      ->orderBy('option_type')
      ->orderBy('option_value')
      ->get()
      ->groupBy('option_type');

    $machines = $rows->get('machine', collect())->pluck('option_value')->values()->all();
    $locations = $rows->get('location', collect())->pluck('option_value')->values()->all();
    $years = $rows->get('year', collect())->pluck('option_value')->reverse()->values()->all();

    return response()->json(compact('machines', 'locations', 'years'));
  }
}
