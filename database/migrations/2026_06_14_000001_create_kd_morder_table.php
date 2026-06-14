<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('kd_morder', function (Blueprint $table) {
            $table->id('morder_id');
            $table->smallInteger('deleted')->default(0);
            $table->smallInteger('back_color')->default(0);
            $table->smallInteger('font_color')->default(0);
            $table->smallInteger('order_type_id')->default(0);
            $table->smallInteger('equip_group_id')->nullable();
            $table->text('morder_no')->default('');
            $table->text('parts_no')->nullable();
            $table->smallInteger('flg_public')->default(0);
            $table->smallInteger('flg_goso')->default(0);
            $table->smallInteger('flg_finish')->default(0);
            $table->text('koutei_pic_no')->default('');
            $table->date('shipping_date')->nullable();
            $table->text('public_remark')->default('');
            $table->text('customer_name')->default('');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('kd_morder');
    }
};
