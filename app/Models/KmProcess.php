<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KmProcess extends Model
{
  protected $table      = 'km_process';
  protected $primaryKey = 'process_id';
  public    $timestamps   = false;
  protected $fillable = ['process_name', 'sort_no'];

  public function km_tasks()
  {
    return $this->hasMany(KmTask::class, 'process_id', 'process_id');
  }
}
