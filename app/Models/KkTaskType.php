<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KkTaskType extends Model
{
  protected $table = 'kk_task_type';
  protected $primaryKey = 'task_type_id';
  public $timestamps = false;
  protected $fillable = ['task_type_id', 'task_type_name'];
}
