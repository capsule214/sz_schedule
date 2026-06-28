<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DprController extends Controller
{
  /** m_dpr.machine の重複排除済み昇順リストを返す */
  public function machines()
  {
    $machines = DB::table('m_dpr')
      ->select('machine')
      ->distinct()
      ->orderBy('machine')
      ->pluck('machine')
      ->values()
      ->all();

    return response()->json($machines);
  }

  /** m_dpr.dprno 先頭のアルファベット部分（営業拠点コード）を重複排除して返す */
  public function salesLocations()
  {
    $locations = DB::table('m_dpr')
      ->whereNotNull('dprno')
      ->pluck('dprno')
      ->map(function ($dprno) {
        preg_match('/^([A-Za-z]+)/', $dprno, $m);
        return isset($m[1]) ? strtoupper($m[1]) : null;
      })
      ->filter()
      ->unique()
      ->sort()
      ->values()
      ->all();

    return response()->json($locations);
  }

  /** m_dpr.dprno のアルファベット直後の2桁（発行年）を重複排除して返す */
  public function publicationYears()
  {
    $years = DB::table('m_dpr')
      ->whereNotNull('dprno')
      ->pluck('dprno')
      ->map(function ($dprno) {
        preg_match('/^[A-Za-z]+(\d{2})/', $dprno, $m);
        return isset($m[1]) ? $m[1] : null;
      })
      ->filter()
      ->unique()
      ->sortDesc()
      ->values()
      ->all();

    return response()->json($years);
  }

  /**
   * 受注形態・出荷形態・種別・ステータスで絞り込んだ
   * 機種 / 営業拠点 / 発行年 のリストを一括返却する。
   * 各パラメータが空の場合はその条件をかけない（全件対象）。
   */
  public function filterOptions(Request $request)
  {
    $query = DB::table('m_dpr')->whereNotNull('dprno');

    if ($v = array_filter((array) $request->input('formtype', []))) {
      $query->whereIn('formtype', array_map('intval', $v));
    }
    if ($v = array_filter((array) $request->input('deliverytype', []))) {
      $query->whereIn('deliverytype', array_map('intval', $v));
    }
    if ($v = array_filter((array) $request->input('classification', []))) {
      $query->whereIn('classification', $v);
    }
    if ($v = array_filter((array) $request->input('status', []))) {
      $query->whereIn('status', $v);
    }

    $rows = $query->get(['machine', 'dprno']);

    $machines = $rows->pluck('machine')
      ->filter()->unique()->sort()->values()->all();

    $locations = $rows->pluck('dprno')
      ->map(function ($d) {
        preg_match('/^([A-Za-z]+)/', $d, $m);
        return isset($m[1]) ? strtoupper($m[1]) : null;
      })
      ->filter()->unique()->sort()->values()->all();

    $years = $rows->pluck('dprno')
      ->map(function ($d) {
        preg_match('/^[A-Za-z]+(\d{2})/', $d, $m);
        return isset($m[1]) ? $m[1] : null;
      })
      ->filter()->unique()->sortDesc()->values()->all();

    return response()->json(compact('machines', 'locations', 'years'));
  }
}
