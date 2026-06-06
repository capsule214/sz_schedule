<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DrCalendar extends Model
{
  protected $table      = 'dr_calendar';
  protected $primaryKey = 'calendar_date';
  protected $keyType    = 'string';
  public    $incrementing = false;
  public    $timestamps   = false;

  protected $fillable = ['calendar_date', 'date_type'];

  protected $casts = [
    'calendar_date' => 'string',
    'date_type'     => 'integer',
  ];
}
