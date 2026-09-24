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

  private function applyCategoryFilters($query, array $data): void
  {
    if (! empty($data['formtype'])) {
      $query->whereIn('formtype', array_map('intval', $data['formtype']));
    }
    if (! empty($data['deliverytype'])) {
      $query->whereIn('deliverytype', array_map('intval', $data['deliverytype']));
    }
    if (! empty($data['classification'])) {
      $query->whereIn('classification', $data['classification']);
    }
    if (! empty($data['status'])) {
      $query->whereIn('status', $data['status']);
    }
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

  /** m_dpr.machine の重複排除済み昇順リストを返す。 */
  public function machines()
  {
    return response()->json(DB::table('m_dpr')
      ->select('machine')
      ->whereNotNull('machine')
      ->where('machine', '<>', '')
      ->groupBy('machine')
      ->orderBy('machine')
      ->pluck('machine')
      ->values()
      ->all());
  }

  /** m_dpr.dprno 先頭のアルファベット部分（営業拠点コード）を重複排除して返す。 */
  public function salesLocations()
  {
    $expression = $this->dprSalesExpression();
    $locations = DB::table('m_dpr')
      ->whereNotNull('dprno')
      ->where('dprno', '<>', '')
      ->selectRaw("{$expression} as dprsales")
      ->groupByRaw($expression)
      ->orderBy('dprsales')
      ->pluck('dprsales')
      ->filter()
      ->values()
      ->all();

    return response()->json($locations);
  }

  /** m_dpr.dprno のアルファベット直後の2桁（発行年）を重複排除して返す。 */
  public function publicationYears()
  {
    $expression = $this->dprPublishExpression();
    $years = DB::table('m_dpr')
      ->whereNotNull('dprno')
      ->where('dprno', '<>', '')
      ->selectRaw("{$expression} as dprpublish")
      ->groupByRaw($expression)
      ->orderByDesc('dprpublish')
      ->pluck('dprpublish')
      ->filter()
      ->values()
      ->all();

    return response()->json($years);
  }

  /** 絞り込み条件に合う機種・営業拠点・発行年の選択肢を一括返却する。 */
  public function filterOptions(Request $request)
  {
    $data = $request->validate([
      'formtype' => 'nullable|array',
      'formtype.*' => 'integer|in:1,2,3',
      'deliverytype' => 'nullable|array',
      'deliverytype.*' => 'integer|in:1,2',
      'classification' => 'nullable|array',
      'classification.*' => 'string|max:50',
      'status' => 'nullable|array',
      'status.*' => 'string|max:100',
    ]);
    $baseQuery = DB::table('m_dpr')->whereNotNull('dprno')->where('dprno', '<>', '');
    $this->applyCategoryFilters($baseQuery, $data);

    $salesExpression = $this->dprSalesExpression();
    $publishExpression = $this->dprPublishExpression();
    $machines = (clone $baseQuery)
      ->whereNotNull('machine')->where('machine', '<>', '')
      ->select('machine')->groupBy('machine')->orderBy('machine')
      ->pluck('machine')->values()->all();
    $locations = (clone $baseQuery)
      ->selectRaw("{$salesExpression} as dprsales")
      ->groupByRaw($salesExpression)->orderBy('dprsales')
      ->pluck('dprsales')->filter()->values()->all();
    $years = (clone $baseQuery)
      ->selectRaw("{$publishExpression} as dprpublish")
      ->groupByRaw($publishExpression)->orderByDesc('dprpublish')
      ->pluck('dprpublish')->filter()->values()->all();

    return response()->json(compact('machines', 'locations', 'years'));
  }
}
