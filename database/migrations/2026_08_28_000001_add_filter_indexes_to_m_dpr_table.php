<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('m_dpr', function (Blueprint $table) {
            $table->index('formtype', 'm_dpr_formtype_index');
            $table->index('deliverytype', 'm_dpr_deliverytype_index');
            $table->index('classification', 'm_dpr_classification_index');
            $table->index('status', 'm_dpr_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('m_dpr', function (Blueprint $table) {
            $table->dropIndex('m_dpr_formtype_index');
            $table->dropIndex('m_dpr_deliverytype_index');
            $table->dropIndex('m_dpr_classification_index');
            $table->dropIndex('m_dpr_status_index');
        });
    }
};
