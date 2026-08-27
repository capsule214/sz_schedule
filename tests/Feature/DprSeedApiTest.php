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
            'count' => 5,
            'seed' => 123,
        ]);

        $response->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('inserted', 5);

        $this->assertSame(5, Mdpr::query()->count());
        $this->assertNotNull(Mdpr::query()->value('dprno'));
    }
}
