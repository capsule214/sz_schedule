<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KkLocationType extends Model
{
  protected $table = 'kk_location_type';
  protected $primaryKey = 'location_type_id';
  public $timestamps = false;
  protected $fillable = ['location_name'];

  public function resources()
  {
    return $this->hasMany(KmResource::class, 'location_type_id', 'location_type_id');
  }
}
