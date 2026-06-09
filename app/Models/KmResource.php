<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KmResource extends Model
{
  protected $table = 'km_resource';
  protected $primaryKey = 'resource_id';
  public $timestamps = false;
  protected $fillable = ['resource_name', 'sort_no', 'location_type_id', 'back_color', 'font_color'];

  public function kd_location_plans()
  {
    return $this->hasMany(KdLocationPlan::class, 'resource_id', 'resource_id');
  }

  public function locationType()
  {
    return $this->belongsTo(KkLocationType::class, 'location_type_id', 'location_type_id');
  }
}
