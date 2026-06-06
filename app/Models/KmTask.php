<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KmTask extends Model
{
  protected $table = 'km_task';
  protected $primaryKey = 'task_id';
  public $timestamps = false;
  protected $fillable = ['process_id', 'task_type_id', 'task_name', 'back_color', 'font_color', 'sort_no'];

  public function km_process()
  {
    return $this->belongsTo(KmProcess::class, 'process_id', 'process_id');
  }

  public function kk_task_type()
  {
    return $this->belongsTo(KkTaskType::class, 'task_type_id', 'task_type_id');
  }
}
