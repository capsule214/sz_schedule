<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dm_kisyu', function (Blueprint $table) {
            $table->smallInteger('back_color')->default(1);
            $table->smallInteger('font_color')->default(6);
        });
    }

    public function down(): void
    {
        Schema::table('dm_kisyu', function (Blueprint $table) {
            $table->dropColumn(['back_color', 'font_color']);
        });
    }
};
