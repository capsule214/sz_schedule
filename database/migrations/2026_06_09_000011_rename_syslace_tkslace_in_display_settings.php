<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('display_settings', function (Blueprint $table) {
            if (Schema::hasColumn('display_settings', 'syslace')) {
                $table->renameColumn('syslace', 'syscale');
            }
            if (Schema::hasColumn('display_settings', 'tkslace')) {
                $table->renameColumn('tkslace', 'tkscale');
            }
        });
    }

    public function down(): void
    {
        Schema::table('display_settings', function (Blueprint $table) {
            if (Schema::hasColumn('display_settings', 'syscale')) {
                $table->renameColumn('syscale', 'syslace');
            }
            if (Schema::hasColumn('display_settings', 'tkscale')) {
                $table->renameColumn('tkscale', 'tkslace');
            }
        });
    }
};
