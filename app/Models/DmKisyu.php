<?php

namespace App\Models;

use App\Models\Concerns\SoftDeleteFlag;
use Illuminate\Database\Eloquent\Model;

class DmKisyu extends Model
{
    use SoftDeleteFlag;

    protected $table = 'dm_kisyu';

    protected $primaryKey = 'kisyu_id';

    public $timestamps = false;

    protected $fillable = ['kisyu_name', 'equip_id', 'sort_no', 'waku_display', 'deleted'];

    public function serials()
    {
        return $this->hasMany(KdSerial::class, 'kisyu_id', 'kisyu_id');
    }

    public function dm_equip()
    {
        return $this->belongsTo(DmEquip::class, 'equip_id', 'equip_id');
    }
}
