<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KmQualification extends Model
{
  protected $table = 'km_qualification';
  protected $primaryKey = 'qualification_id';
  public $timestamps = false;
  protected $fillable = ['qualification_name', 'kisyu_id', 'task_id'];
}
