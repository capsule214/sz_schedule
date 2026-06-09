<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('km_location', 'km_resource');
    }

    public function down(): void
    {
        Schema::rename('km_resource', 'km_location');
    }
};
