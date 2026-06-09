<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('display_settings', function (Blueprint $table) {
            if (Schema::hasColumn('display_settings', 'plslace')) {
                $table->renameColumn('plslace', 'plscale');
            }
            if (Schema::hasColumn('display_settings', 'sbslace')) {
                $table->renameColumn('sbslace', 'sbscale');
            }
        });
    }

    public function down(): void
    {
        Schema::table('display_settings', function (Blueprint $table) {
            if (Schema::hasColumn('display_settings', 'plscale')) {
                $table->renameColumn('plscale', 'plslace');
            }
            if (Schema::hasColumn('display_settings', 'sbscale')) {
                $table->renameColumn('sbscale', 'sbslace');
            }
        });
    }
};
