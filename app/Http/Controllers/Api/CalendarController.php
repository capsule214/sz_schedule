<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DrCalendar;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
  public function search(Request $request)
  {
    $data = $request->validate([
      'from' => 'required|date',
      'to'   => 'required|date|after_or_equal:from',
    ]);

    $rows = DrCalendar::whereBetween('calendar_date', [$data['from'], $data['to']])->get();

    return response()->json($rows->map(fn($c) => [
      'date'     => $c->calendar_date,
      'dateType' => $c->date_type,
      'dayType'  => $c->date_type,
    ]));
  }

  public function index()
  {
    return response()->json(DrCalendar::orderBy('calendar_date')->get()->map(fn($c) => [
      'date'     => $c->calendar_date,
      'dateType' => $c->date_type,
      'dayType'  => $c->date_type,
    ]));
  }

  public function store(Request $request)
  {
    $data = $request->validate([
      'date'     => 'required|date',
      'dateType' => 'nullable|integer|in:0,1,6',
      'dayType'  => 'nullable|integer|in:0,1,6',
    ]);

    $cal = DrCalendar::updateOrCreate(
      ['calendar_date' => $data['date']],
      ['date_type' => $data['dateType'] ?? $data['dayType'] ?? 0]
    );

    return response()->json([
      'date'     => $cal->calendar_date,
      'dateType' => $cal->date_type,
      'dayType'  => $cal->date_type,
    ], 201);
  }

  public function destroy(string $date)
  {
    DrCalendar::where('calendar_date', $date)->delete();
    return response()->json(['deleted' => 1]);
  }
}
