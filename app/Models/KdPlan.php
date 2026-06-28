<?php

namespace App\Models;

use App\Models\Concerns\SoftDeleteFlag;
use Illuminate\Database\Eloquent\Model;

class KdPlan extends Model
{
  use SoftDeleteFlag;

  protected $table = 'kd_plan';

  protected $primaryKey = 'plan_id';

  const CREATED_AT = null;    // created_at は管理しない

  public $timestamps = true;   // updated_at のみ自動更新

  protected $fillable = [
    'serial_id',
    'morder_id',
    'task_id',
    'worker_id',
    'educator_worker_id',
    'deleted',
    'start_date',
    'end_date',
    'planned_minutes',
    'price',
    'remark',
  ];

  public function kd_serial()
  {
    return $this->belongsTo(KdSerial::class, 'serial_id', 'serial_id');
  }

  public function km_task()
  {
    return $this->belongsTo(KmTask::class, 'task_id', 'task_id');
  }

  public function kd_morder()
  {
    return $this->belongsTo(KdMorder::class, 'morder_id', 'morder_id');
  }

  public function km_worker()
  {
    return $this->belongsTo(KmWorker::class, 'worker_id', 'worker_id');
  }
}
