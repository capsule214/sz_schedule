<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('km_qualification', function (Blueprint $table) {
            $table->increments('qualification_id');
            $table->text('qualification_name')->default('');
            $table->integer('kisyu_id')->nullable();
            $table->integer('task_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('km_qualification');
    }
};
