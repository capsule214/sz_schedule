<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kk_location_type', function (Blueprint $table) {
            $table->renameColumn('location_name', 'location_type_name');
        });
    }

    public function down(): void
    {
        Schema::table('kk_location_type', function (Blueprint $table) {
            $table->renameColumn('location_type_name', 'location_name');
        });
    }
};
