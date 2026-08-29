<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DprFilterOptionsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_category_selections_filter_machine_location_and_year_options(): void
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

        $this->actingAs($user)
            ->getJson('/api/dpr/filter-options?formtype[]=1&deliverytype[]=1&classification[]=A&status[]='.urlencode('設計中'))
            ->assertOk()
            ->assertExactJson([
                'machines' => ['機種A'],
                'locations' => ['OS'],
                'years' => ['26'],
            ]);
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
