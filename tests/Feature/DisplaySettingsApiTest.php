<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DisplaySettingsApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_gets_five_display_setting_slots(): void
    {
        $user = $this->createUser('user-a');

        $this->actingAs($user)
            ->getJson('/api/display-settings')
            ->assertOk()
            ->assertJsonPath('userNo', (string) $user->id)
            ->assertJsonPath('settingNo', 0)
            ->assertJsonCount(5, 'settingsList');
    }

    public function test_user_can_update_named_setting_slot(): void
    {
        $user = $this->createUser('user-b');

        $this->actingAs($user)
            ->putJson('/api/display-settings', [
                'settingNo' => 3,
                'settingName' => '工程確認用',
                'sbmodellist' => ['10', '20'],
                'sbdspplplan' => true,
            ])
            ->assertOk()
            ->assertJsonPath('settingNo', 3)
            ->assertJsonPath('settingName', '工程確認用')
            ->assertJsonPath('sbmodellist', [10, 20])
            ->assertJsonPath('sbdspplplan', true)
            ->assertJsonPath('settingsList.3.settingName', '工程確認用');

        $this->assertDatabaseHas('display_settings', [
            'user_no' => (string) $user->id,
            'setting_no' => 3,
            'setting_name' => '工程確認用',
            'duration' => 1,
            'sbdspplplan' => true,
        ]);
        $this->assertFalse(Schema::hasColumn('display_settings', 'value'));
        $this->assertFalse(Schema::hasColumn('display_settings', 'is_active'));
        $this->assertTrue(Schema::hasColumn('display_settings', 'sbmodellist'));
    }

    public function test_active_display_setting_api_does_not_exist(): void
    {
        $user = $this->createUser('user-c');

        $this->actingAs($user)
            ->putJson('/api/display-settings/active', ['settingNo' => 4])
            ->assertStatus(405);
    }

    private function createUser(string $email): User
    {
        return User::create([
            'name' => $email,
            'email' => $email,
            'password' => Hash::make('12345'),
        ]);
    }
}
