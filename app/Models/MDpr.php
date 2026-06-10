<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MDpr extends Model
{
    protected $table = 'm_dpr';
    public $incrementing = false;
    public $timestamps   = false;
    protected $primaryKey = null;  // 主キーなし

    protected $fillable = [
        'dprno', 'classification', 'formtype', 'deliverytype',
        'machine', 'customer_code', 'subject',
        'dprleader_sytx', 'mechanism_sytx', 'electricity_sytx', 'soft_sytx', 'other_sytx',
        'status', 'issue_date', 'orderno', 'qty',
        'mechanism_design_date', 'electricity_design_date', 'soft_design_date', 'other_design_date',
        'mechanism_parts_schedule', 'electricity_parts_schedule', 'soft_parts_schedule', 'other_parts_schedule',
        'customer_name',
        'mechanism_ppl_date', 'electricity_ppl_date', 'soft_ppl_date', 'other_ppl_date',
        'outputlistflag_m', 'outputlistflag_e', 'outputlistflag_s',
    ];
}
