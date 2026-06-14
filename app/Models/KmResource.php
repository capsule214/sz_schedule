<?php

namespace App\Models;

use App\Models\Concerns\SoftDeleteFlag;
use Illuminate\Database\Eloquent\Model;

class KmResource extends Model
{
  use SoftDeleteFlag;

  protected $table = 'km_resource';
  protected $primaryKey = 'resource_id';
  public $timestamps = false;
  protected $fillable = ['resource_name', 'sort_no', 'location_type_id', 'back_color', 'font_color', 'deleted'];

  public function reserves()
  {
    return $this->hasMany(KdReserve::class, 'resource_id', 'resource_id');
  }

  public function locationType()
  {
    return $this->belongsTo(KkLocationType::class, 'location_type_id', 'location_type_id');
  }
}
