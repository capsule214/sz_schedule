<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('m_dpr', function (Blueprint $table) {
            // 主キーなし・重複あり
            $table->text('dprno');                                          // DPR番号 例: CH26000001
            $table->text('classification');                                 // 種別: A/B/AtoB
            $table->smallInteger('formtype')->default(3);                   // 受注形態: 1:DPR有償/2:DPR無償/3:一括受注
            $table->smallInteger('deliverytype')->default(2);               // 出荷形態: 1:客先直送/2:機械組込
            $table->text('machine');                                        // 機種名
            $table->text('customer_code')->nullable();                      // 顧客コード
            $table->text('subject')->nullable();                            // 件名
            $table->text('dprleader_sytx')->nullable();                     // リーダー社員番号
            $table->text('mechanism_sytx')->nullable();                     // メカ担当社員番号
            $table->text('electricity_sytx')->nullable();                   // エレキ担当社員番号
            $table->text('soft_sytx')->nullable();                          // ソフト担当社員番号
            $table->text('other_sytx')->nullable();                         // その他担当社員番号
            $table->text('status')->default('設計中');                      // ステータス
            $table->text('issue_date')->nullable();                         // DPR発行日 yyyy/mm/dd
            $table->text('orderno')->nullable();                            // 受付No 例: AB123456
            $table->smallInteger('qty')->nullable();                        // 数量 1〜10
            $table->text('mechanism_design_date')->nullable();              // メカ設計納期 yyyy/mm/dd
            $table->text('electricity_design_date')->nullable();            // エレキ設計納期 yyyy/mm/dd
            $table->text('soft_design_date')->nullable();                   // ソフト設計納期 yyyy/mm/dd
            $table->text('other_design_date')->nullable();                  // その他設計納期 yyyy/mm/dd
            $table->text('mechanism_parts_schedule')->nullable();           // メカ部品概略納期 yyyy/mm/dd
            $table->text('electricity_parts_schedule')->nullable();         // エレキ部品概略納期 yyyy/mm/dd
            $table->text('soft_parts_schedule')->nullable();                // ソフト部品概略納期 yyyy/mm/dd
            $table->text('other_parts_schedule')->nullable();               // その他部品概略納期 yyyy/mm/dd
            $table->text('customer_name')->nullable();                      // 顧客名
            $table->text('mechanism_ppl_date')->nullable();                 // メカ部品設定完了日 yyyy/mm/dd
            $table->text('electricity_ppl_date')->nullable();               // エレキ部品設定完了日 yyyy/mm/dd
            $table->text('soft_ppl_date')->nullable();                      // ソフト部品設定完了日 yyyy/mm/dd
            $table->text('other_ppl_date')->nullable();                     // その他部品設定完了日 yyyy/mm/dd
            $table->text('outputlistflag_m')->nullable();                   // メカUAリスト指示 "m" or null
            $table->text('outputlistflag_e')->nullable();                   // エレキUAリスト指示 "e" or null
            $table->text('outputlistflag_s')->nullable();                   // ソフトUAリスト指示 "s" or null
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('m_dpr');
    }
};
