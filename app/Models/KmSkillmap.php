<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KmSkillmap extends Model
{
  protected $table = 'km_skillmap';
  protected $primaryKey = 'skillmap_id';
  public $timestamps = false;
  protected $fillable = ['kisyu_id', 'task_id', 'worker_id', 'skill_level'];
}
