<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            // m_dpr は主キーなし・dprno重複可のため、DB外部キーではなくアプリケーションで関連付ける。
            $table->text('dpr_no')->nullable();
            $table->text('user_no')->nullable();
            $table->index('dpr_no');
        });
    }

    public function down(): void
    {
        Schema::table('kd_plan', function (Blueprint $table) {
            $table->dropIndex(['dpr_no']);
            $table->dropColumn(['dpr_no', 'user_no']);
        });
    }
};
