<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DprFilterOptionsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_returns_all_machine_location_and_year_options_in_one_response(): void
    {
        $user = User::create([
            'name' => 'DPR filter user',
            'email' => 'dpr-filter@example.com',
            'password' => Hash::make('password'),
        ]);
        DB::table('m_dpr')->insert([
            $this->row('OS260001-00', '機種A', 1, 1, 'A', '設計中'),
            $this->row('OS260004-00', '機種A', 1, 1, 'A', '設計中'),
            $this->row('CH250002-00', '機種B', 1, 2, 'B', '設計中'),
            $this->row('KR240003-00', '機種C', 2, 1, 'A', '設計完了'),
        ]);

        $dprQueries = [];
        DB::listen(function (QueryExecuted $query) use (&$dprQueries): void {
            if (str_contains(strtolower($query->sql), 'm_dpr')) {
                $dprQueries[] = $query->sql;
            }
        });

        $this->actingAs($user)
            ->getJson('/api/dpr/options')
            ->assertOk()
            ->assertExactJson([
                'machines' => ['機種A', '機種B', '機種C'],
                'locations' => ['CH', 'KR', 'OS'],
                'years' => ['26', '25', '24'],
            ]);

        $this->assertCount(1, $dprQueries, 'm_dprの表示設定用集約は1回のDBクエリで取得すること');
    }

    private function row(string $dprNo, string $machine, int $formType, int $deliveryType, string $classification, string $status): array
    {
        return [
            'dprno' => $dprNo,
            'machine' => $machine,
            'formtype' => $formType,
            'deliverytype' => $deliveryType,
            'classification' => $classification,
            'status' => $status,
        ];
    }
}
