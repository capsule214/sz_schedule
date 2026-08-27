<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('m_dpr', function (Blueprint $table) {
            $table->index(['machine', 'dprno'], 'm_dpr_machine_dprno_index');
        });
    }

    public function down(): void
    {
        Schema::table('m_dpr', function (Blueprint $table) {
            $table->dropIndex('m_dpr_machine_dprno_index');
        });
    }
};
