<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KmKoujunDetail extends Model
{
  protected $table = 'km_koujun_detail';

  protected $primaryKey = null;

  public $incrementing = false;

  public $timestamps = false;

  protected $fillable = [
    'koujun_id',
    'koujun_num',
    'task_id',
  ];
}
