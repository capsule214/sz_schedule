<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const COLUMNS = ['plscale', 'sbscale', 'syscale', 'tkscale'];

    public function up(): void
    {
        foreach (self::COLUMNS as $column) {
            if (! Schema::hasColumn('display_settings', $column)) {
                continue;
            }

            Schema::table('display_settings', function (Blueprint $table) use ($column) {
                $table->dropColumn($column);
            });
        }
    }

    public function down(): void
    {
        foreach (self::COLUMNS as $column) {
            if (Schema::hasColumn('display_settings', $column)) {
                continue;
            }

            Schema::table('display_settings', function (Blueprint $table) use ($column) {
                $table->smallInteger($column)->default(1);
            });
        }
    }
};
