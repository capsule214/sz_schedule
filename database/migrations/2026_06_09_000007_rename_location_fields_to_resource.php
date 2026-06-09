<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // km_resource: location_id → resource_id, location_name → resource_name
        Schema::table('km_resource', function (Blueprint $table) {
            $table->renameColumn('location_id', 'resource_id');
        });
        Schema::table('km_resource', function (Blueprint $table) {
            $table->renameColumn('location_name', 'resource_name');
        });

        // kd_location_plan: location_id → resource_id
        Schema::table('kd_location_plan', function (Blueprint $table) {
            $table->renameColumn('location_id', 'resource_id');
        });
    }

    public function down(): void
    {
        Schema::table('km_resource', function (Blueprint $table) {
            $table->renameColumn('resource_id', 'location_id');
        });
        Schema::table('km_resource', function (Blueprint $table) {
            $table->renameColumn('resource_name', 'location_name');
        });
        Schema::table('kd_location_plan', function (Blueprint $table) {
            $table->renameColumn('resource_id', 'location_id');
        });
    }
};
