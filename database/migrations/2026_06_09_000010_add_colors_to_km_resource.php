<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('km_resource', function (Blueprint $table) {
            $table->tinyInteger('back_color')->default(1)->after('location_type_id');
            $table->tinyInteger('font_color')->default(6)->after('back_color');
        });
    }

    public function down(): void
    {
        Schema::table('km_resource', function (Blueprint $table) {
            $table->dropColumn(['back_color', 'font_color']);
        });
    }
};
