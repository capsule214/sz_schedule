<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KmCalendar extends Model
{
  protected $table      = 'km_calendar';
  protected $primaryKey = 'date';
  protected $keyType    = 'string';
  public    $incrementing = false;
  public    $timestamps   = false;

  protected $fillable = ['date', 'day_type', 'memo'];

  protected $casts = [
    'date'     => 'string',
    'day_type' => 'integer',
  ];
}
