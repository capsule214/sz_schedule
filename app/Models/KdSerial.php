<?php

namespace App\Models;

use App\Models\Concerns\SoftDeleteFlag;
use Illuminate\Database\Eloquent\Model;

class KdSerial extends Model
{
  use SoftDeleteFlag;

  protected $table = 'kd_serial';

  protected $primaryKey = 'serial_id';

  public $timestamps = false;

  protected $fillable = [
    'deleted',
    'back_color',
    'font_color',
    'serial_no',
    'kisyu_id',
    'order_no',
    'original_no',
    'r_no',
    'flg_public',
    'flg_goso',
    'flg_finish',
    'flg_syoyo',
    'koujun_id',
    'morder_start_date',
    'koutei_pic_no',
    'mechanic_pic_no',
    'electric_pic_no',
    'shipping_date',
    'public_remark',
    'customer_name',
    'seizo_group_id',
  ];

  public function dm_kisyu()
  {
    return $this->belongsTo(DmKisyu::class, 'kisyu_id', 'kisyu_id');
  }

  public function km_koujun_details()
  {
    return $this->hasMany(KmKoujunDetail::class, 'koujun_id', 'koujun_id');
  }
}
