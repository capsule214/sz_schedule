<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dm_kisyu', function (Blueprint $table) {
            $table->renameColumn('seizo_status', 'waku_display');
        });
    }

    public function down(): void
    {
        Schema::table('dm_kisyu', function (Blueprint $table) {
            $table->renameColumn('waku_display', 'seizo_status');
        });
    }
};
