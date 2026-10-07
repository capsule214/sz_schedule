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

    public function test_it_returns_empty_options_without_querying_dpr_when_no_category_is_checked(): void
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
            ->postJson('/api/dpr/options', [])
            ->assertOk()
            ->assertExactJson([
                'machines' => [],
                'locations' => [],
                'years' => [],
            ]);

        $this->assertCount(0, $dprQueries, 'チェック未選択時はm_dprへ問い合わせないこと');
    }

    public function test_it_filters_all_option_lists_by_dpr_category_selections(): void
    {
        $user = User::create([
            'name' => 'DPR filtered option user',
            'email' => 'dpr-filtered-options@example.com',
            'password' => Hash::make('password'),
        ]);
        DB::table('m_dpr')->insert([
            $this->row('OS260001-00', '機種A', 1, 1, 'A', '設計中'),
            $this->row('CH250002-00', '機種B', 1, 2, 'B', '設計中'),
            $this->row('KR240003-00', '機種C', 2, 1, 'A', '設計完了'),
        ]);

        $this->actingAs($user)
            ->postJson('/api/dpr/options', [
                'formtype' => [1],
                'deliverytype' => [1],
                'classification' => ['A'],
                'status' => ['設計中'],
            ])
            ->assertOk()
            ->assertExactJson([
                'machines' => ['機種A'],
                'locations' => ['OS'],
                'years' => ['26'],
            ]);
    }

    public function test_it_returns_empty_options_when_any_category_has_no_selection(): void
    {
        $user = User::create([
            'name' => 'DPR incomplete filter user',
            'email' => 'dpr-incomplete-filter@example.com',
            'password' => Hash::make('password'),
        ]);
        DB::table('m_dpr')->insert($this->row('OS260001-00', '機種A', 1, 1, 'A', '設計中'));

        foreach (['formtype', 'deliverytype', 'classification', 'status'] as $emptyKey) {
            $filters = [
                'formtype' => [1],
                'deliverytype' => [1],
                'classification' => ['A'],
                'status' => ['設計中'],
            ];
            $filters[$emptyKey] = [];

            $this->actingAs($user)
                ->postJson('/api/dpr/options', $filters)
                ->assertOk()
                ->assertExactJson([
                    'machines' => [],
                    'locations' => [],
                    'years' => [],
                ]);
        }
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
