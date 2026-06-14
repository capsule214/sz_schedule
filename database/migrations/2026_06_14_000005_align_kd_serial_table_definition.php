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
        Schema::table('kd_serial', function (Blueprint $table) {
            $table->text('serial_no')->default('')->change();
            $table->integer('kisyu_id')->nullable()->change();
            $table->smallInteger('back_color')->default(0)->change();
            $table->smallInteger('font_color')->default(0)->change();
            if (Schema::hasColumn('kd_serial', 'shipping_date')) {
                $table->date('shipping_date')->nullable()->change();
            }
        });

        Schema::table('kd_serial', function (Blueprint $table) {
            if (! Schema::hasColumn('kd_serial', 'deleted')) {
                $table->smallInteger('deleted')->default(0)->after('serial_id');
            }
            if (! Schema::hasColumn('kd_serial', 'order_no')) {
                $table->text('order_no')->default('')->after('kisyu_id');
            }
            if (! Schema::hasColumn('kd_serial', 'original_no')) {
                $table->text('original_no')->default('')->after('order_no');
            }
            if (! Schema::hasColumn('kd_serial', 'r_no')) {
                $table->text('r_no')->default('')->after('original_no');
            }
            if (! Schema::hasColumn('kd_serial', 'flg_public')) {
                $table->smallInteger('flg_public')->default(0)->after('r_no');
            }
            if (! Schema::hasColumn('kd_serial', 'flg_goso')) {
                $table->smallInteger('flg_goso')->default(0)->after('flg_public');
            }
            if (! Schema::hasColumn('kd_serial', 'flg_finish')) {
                $table->smallInteger('flg_finish')->default(0)->after('flg_goso');
            }
            if (! Schema::hasColumn('kd_serial', 'flg_syoyo')) {
                $table->smallInteger('flg_syoyo')->default(0)->after('flg_finish');
            }
            if (! Schema::hasColumn('kd_serial', 'koujun_id')) {
                $table->integer('koujun_id')->default(0)->after('flg_syoyo');
            }
            if (! Schema::hasColumn('kd_serial', 'koutei_pic_no')) {
                $table->text('koutei_pic_no')->default('')->after('koujun_id');
            }
            if (! Schema::hasColumn('kd_serial', 'mechanic_pic_no')) {
                $table->text('mechanic_pic_no')->default('')->after('koutei_pic_no');
            }
            if (! Schema::hasColumn('kd_serial', 'electric_pic_no')) {
                $table->text('electric_pic_no')->default('')->after('mechanic_pic_no');
            }
            if (! Schema::hasColumn('kd_serial', 'public_remark')) {
                $table->text('public_remark')->default('')->after('shipping_date');
            }
            if (! Schema::hasColumn('kd_serial', 'customer_name')) {
                $table->text('customer_name')->default('')->after('public_remark');
            }
        });

        if (Schema::hasColumn('kd_serial', 'szgroup_id') && ! Schema::hasColumn('kd_serial', 'seizo_group_id')) {
            Schema::table('kd_serial', function (Blueprint $table) {
                $table->renameColumn('szgroup_id', 'seizo_group_id');
            });
        } elseif (! Schema::hasColumn('kd_serial', 'seizo_group_id')) {
            Schema::table('kd_serial', function (Blueprint $table) {
                $table->integer('seizo_group_id')->default(0)->after('customer_name');
            });
        }

        if (Schema::hasColumn('kd_serial', 'responsible')) {
            Schema::table('kd_serial', function (Blueprint $table) {
                $table->dropColumn('responsible');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasColumn('kd_serial', 'szgroup_id') && Schema::hasColumn('kd_serial', 'seizo_group_id')) {
            Schema::table('kd_serial', function (Blueprint $table) {
                $table->renameColumn('seizo_group_id', 'szgroup_id');
            });
        }

        Schema::table('kd_serial', function (Blueprint $table) {
            if (! Schema::hasColumn('kd_serial', 'responsible')) {
                $table->string('responsible', 100)->nullable()->after('shipping_date');
            }
            $table->dropColumn([
                'deleted',
                'order_no',
                'original_no',
                'r_no',
                'flg_public',
                'flg_goso',
                'flg_finish',
                'flg_syoyo',
                'koujun_id',
                'koutei_pic_no',
                'mechanic_pic_no',
                'electric_pic_no',
                'public_remark',
                'customer_name',
            ]);
        });
    }
};
