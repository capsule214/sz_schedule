<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KmTeam;
use App\Models\KmWorker;

class WorkerController extends Controller
{
  private function formatWorker(KmWorker $w): array
  {
    return [
      'workerId'    => $w->worker_id,
      'workerName'  => $w->worker_name,
      'teamId'      => $w->team_id,
      'teamName'    => $w->km_team ? $w->km_team->team_name : '',
    ];
  }

  public function index()
  {
    $workers = KmWorker::with('km_team')
      ->get()
      ->sortBy(function ($w) {
        return $w->km_team ? $w->km_team->sort_no : 999;
      });

    return response()->json($workers->values()->map(fn($w) => $this->formatWorker($w)));
  }

  public function teams()
  {
    $teams = KmTeam::orderBy('sort_no')->orderBy('team_id')->get();

    return response()->json($teams->map(fn($t) => [
      'teamId'   => $t->team_id,
      'teamName' => $t->team_name,
      'sortNo'   => $t->sort_no,
    ]));
  }

  public function byTeam(int $teamId)
  {
    $workers = KmWorker::with('km_team')
      ->where('team_id', $teamId)
      ->orderBy('worker_id')
      ->get();

    return response()->json($workers->map(fn($w) => $this->formatWorker($w)));
  }

  public function show(int $id)
  {
    $worker = KmWorker::with('km_team')->findOrFail($id);

    return response()->json($this->formatWorker($worker));
  }
}
