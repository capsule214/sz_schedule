<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('km_koujun_detail', function (Blueprint $table) {
            $table->integer('koujun_id')->default(0);
            $table->text('koujun_num')->default('0000');
            $table->integer('task_id')->default(0);
            $table->index(['koujun_id', 'task_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('km_koujun_detail');
    }
};
