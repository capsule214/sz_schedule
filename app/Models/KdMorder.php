<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KdMorder extends Model
{
  protected $table = 'kd_morder';

  protected $primaryKey = 'morder_id';

  public $timestamps = false;

  protected $fillable = [
    'deleted',
    'back_color',
    'font_color',
    'order_type_id',
    'equip_group_id',
    'morder_no',
    'parts_no',
    'flg_public',
    'flg_goso',
    'flg_finish',
    'koutei_pic_no',
    'shipping_date',
    'public_remark',
    'customer_name',
  ];

  public function kd_plans()
  {
    return $this->hasMany(KdPlan::class, 'morder_id', 'morder_id');
  }
}
