<?php

namespace App\Models;

use App\Models\Concerns\SoftDeleteFlag;
use Illuminate\Database\Eloquent\Model;

class KdReserve extends Model
{
  use SoftDeleteFlag;

  protected $table = 'kd_reserve';
  protected $primaryKey = 'reserve_id';
  public $timestamps = false;
  protected $fillable = ['resource_id', 'serial_id', 'start_date', 'end_date', 'deleted'];

  public function km_resource()
  {
    return $this->belongsTo(KmResource::class, 'resource_id', 'resource_id');
  }

  public function kd_serial()
  {
    return $this->belongsTo(KdSerial::class, 'serial_id', 'serial_id');
  }
}
