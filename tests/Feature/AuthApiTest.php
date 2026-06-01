<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_protected_api(): void
    {
        $this->postJson('/api/plan/search', [
            'from' => '2026-06-01',
            'to' => '2026-06-02',
        ])->assertUnauthorized();
    }

    public function test_login_session_can_access_protected_api(): void
    {
        User::create([
            'name' => 'admin',
            'email' => 'admin',
            'password' => Hash::make('12345'),
        ]);

        $this->postJson('/api/login', [
            'loginId' => 'admin',
            'password' => '12345',
        ])->assertOk()
            ->assertJsonPath('user.email', 'admin');

        $this->postJson('/api/plan/search', [
            'from' => '2026-06-01',
            'to' => '2026-06-02',
        ])->assertOk()
            ->assertJson([]);
    }
}
