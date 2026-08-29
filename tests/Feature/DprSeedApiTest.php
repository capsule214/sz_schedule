<?php

namespace Tests\Feature;

use App\Models\Mdpr;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DprSeedApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_replace_m_dpr_with_sample_data(): void
    {
        $user = User::create([
            'name' => 'DPR tester',
            'email' => 'dpr-test@example.com',
            'password' => Hash::make('password'),
        ]);

        $response = $this->actingAs($user)->postJson('/api/seed/dpr', [
            'count' => 11,
            'seed' => 123,
        ]);

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('inserted', 11);

        $this->assertSame(11, Mdpr::query()->count());
        Mdpr::query()->pluck('dprno')->each(function ($dprNo): void {
            $this->assertMatchesRegularExpression('/^(OS|CH|KR|TH|SG)(26|25|24|23|22|21|20|19|09|08|07)\d{4}-00$/', $dprNo);
        });
        $this->assertSame(
            ['07', '08', '09', '19', '20', '21', '22', '23', '24', '25', '26'],
            Mdpr::query()->pluck('dprno')->map(fn ($dprNo) => substr($dprNo, 2, 2))->sort()->values()->all(),
        );
    }
}
