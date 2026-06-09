<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Create kk_location_type table
        Schema::create('kk_location_type', function (Blueprint $table) {
            $table->increments('location_type_id');
            $table->string('location_name');
        });

        // Drop floor_level, add location_type_id to km_resource
        Schema::table('km_resource', function (Blueprint $table) {
            $table->unsignedInteger('location_type_id')->nullable()->after('sort_no');
        });

        // Drop floor_level column (SQLite compatible approach)
        if (Schema::hasColumn('km_resource', 'floor_level')) {
            Schema::table('km_resource', function (Blueprint $table) {
                $table->dropColumn('floor_level');
            });
        }
    }

    public function down(): void
    {
        Schema::table('km_resource', function (Blueprint $table) {
            $table->tinyInteger('floor_level')->default(3)->after('sort_no');
        });

        if (Schema::hasColumn('km_resource', 'location_type_id')) {
            Schema::table('km_resource', function (Blueprint $table) {
                $table->dropColumn('location_type_id');
            });
        }

        Schema::dropIfExists('kk_location_type');
    }
};
