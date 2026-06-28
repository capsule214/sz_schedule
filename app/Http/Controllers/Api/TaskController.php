<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\KmTask;

class TaskController extends Controller
{
  public function index()
  {
    $tasks = KmTask::with(['km_process', 'kk_task_type'])->orderBy('sort_no')->get();

    return response()->json($tasks->map(function ($t) {
      $p = $t->km_process;
      $tt = $t->kk_task_type;
      return [
        'taskId'        => $t->task_id,
        'taskName'      => $t->task_name,
        'backColor'     => $t->back_color,
        'fontColor'     => $t->font_color,
        'sortNo'        => $t->sort_no,
        'processId'     => $p?->process_id,
        'processName'   => $p?->process_name ?? null,
        'processSortNo' => $p?->sort_no ?? 0,
        'taskTypeId'    => $tt?->task_type_id,
        'taskTypeName'  => $tt?->task_type_name ?? null,
        'seizoGroupId'  => $t->seizo_group_id,
      ];
    }));
  }
}
