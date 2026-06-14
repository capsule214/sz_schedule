<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DmEquip extends Model
{
  protected $table = 'dm_equip';

  protected $primaryKey = 'equip_id';

  public $timestamps = false;

  protected $fillable = ['equip_name', 'equip_type_id'];

  public function dm_kisyus()
  {
    return $this->hasMany(DmKisyu::class, 'equip_id', 'equip_id');
  }
}
