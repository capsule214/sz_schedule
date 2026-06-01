<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KmCalendar;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
  public function search(Request $request)
  {
    $data = $request->validate([
      'from' => 'required|date',
      'to'   => 'required|date|after_or_equal:from',
    ]);

    $rows = KmCalendar::whereBetween('date', [$data['from'], $data['to']])->get();

    return response()->json($rows->map(fn($c) => [
      'date'    => $c->date,
      'dateType' => $c->day_type,
      'dayType' => $c->day_type,
      'memo'    => $c->memo,
    ]));
  }

  public function index()
  {
    return response()->json(KmCalendar::orderBy('date')->get()->map(fn($c) => [
      'date'    => $c->date,
      'dateType' => $c->day_type,
      'dayType' => $c->day_type,
      'memo'    => $c->memo,
    ]));
  }

  public function store(Request $request)
  {
    $data = $request->validate([
      'date'    => 'required|date',
      'dayType' => 'nullable|integer|in:0,1,2',
      'dateType' => 'nullable|integer|in:0,1,2',
      'memo'    => 'nullable|string|max:100',
    ]);

    $cal = KmCalendar::updateOrCreate(
      ['date' => $data['date']],
      ['day_type' => $data['dateType'] ?? $data['dayType'] ?? 0, 'memo' => $data['memo'] ?? null]
    );

    return response()->json(['date' => $cal->date, 'dateType' => $cal->day_type, 'dayType' => $cal->day_type, 'memo' => $cal->memo], 201);
  }

  public function destroy(string $date)
  {
    KmCalendar::where('date', $date)->delete();
    return response()->json(['deleted' => 1]);
  }
}
