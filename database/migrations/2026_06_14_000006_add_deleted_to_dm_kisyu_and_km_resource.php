<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dm_kisyu', function (Blueprint $table) {
            if (! Schema::hasColumn('dm_kisyu', 'deleted')) {
                $table->integer('deleted')->default(0);
            }
        });

        Schema::table('km_resource', function (Blueprint $table) {
            if (! Schema::hasColumn('km_resource', 'deleted')) {
                $table->integer('deleted')->default(0);
            }
        });
    }

    public function down(): void
    {
        Schema::table('dm_kisyu', function (Blueprint $table) {
            if (Schema::hasColumn('dm_kisyu', 'deleted')) {
                $table->dropColumn('deleted');
            }
        });

        Schema::table('km_resource', function (Blueprint $table) {
            if (Schema::hasColumn('km_resource', 'deleted')) {
                $table->dropColumn('deleted');
            }
        });
    }
};
