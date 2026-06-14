<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('dm_equip', function (Blueprint $table) {
            $table->id('equip_id');
            $table->string('equip_name');
            $table->smallInteger('equip_type_id')->default(0);
        });

        foreach ([1, 2, 3] as $typeId) {
            DB::table('dm_equip')->insert([
                'equip_name' => '装置区分'.$typeId,
                'equip_type_id' => $typeId,
            ]);
        }

        Schema::table('dm_kisyu', function (Blueprint $table) {
            $table->unsignedBigInteger('equip_id')->nullable()->after('kisyu_name');
            $table->foreign('equip_id')->references('equip_id')->on('dm_equip');
        });

        $defaultEquipId = DB::table('dm_equip')->where('equip_type_id', 1)->value('equip_id');
        $equipIdsByType = DB::table('dm_equip')->pluck('equip_id', 'equip_type_id');
        $kisyus = DB::table('dm_kisyu')->pluck('kisyu_id');
        foreach ($kisyus as $kisyuId) {
            $typeId = DB::table('kd_serial')
                ->where('kisyu_id', $kisyuId)
                ->whereNotNull('equip_type_id')
                ->min('equip_type_id');
            DB::table('dm_kisyu')
                ->where('kisyu_id', $kisyuId)
                ->update(['equip_id' => $equipIdsByType[$typeId] ?? $defaultEquipId]);
        }

        Schema::table('kd_serial', function (Blueprint $table) {
            $table->dropColumn('equip_type_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('kd_serial', function (Blueprint $table) {
            $table->tinyInteger('equip_type_id')->nullable()->after('serial_no');
        });

        $equipTypesById = DB::table('dm_equip')->pluck('equip_type_id', 'equip_id');
        $serials = DB::table('kd_serial')
            ->join('dm_kisyu', 'kd_serial.kisyu_id', '=', 'dm_kisyu.kisyu_id')
            ->select('kd_serial.serial_id', 'dm_kisyu.equip_id')
            ->get();
        foreach ($serials as $serial) {
            DB::table('kd_serial')
                ->where('serial_id', $serial->serial_id)
                ->update(['equip_type_id' => $equipTypesById[$serial->equip_id] ?? null]);
        }

        Schema::table('dm_kisyu', function (Blueprint $table) {
            $table->dropForeign(['equip_id']);
            $table->dropColumn('equip_id');
        });

        Schema::dropIfExists('dm_equip');
    }
};
