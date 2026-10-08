<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\DisplaySettingsStore;
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
            ->assertJsonPath('flgdspcustomer', false)
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
                'dprclassificationlist' => ['A', 'B', 'AtoB'],
                'sbdspplplan' => true,
                'sydspnobody' => true,
                'flgdspcustomer' => true,
            ])
            ->assertOk()
            ->assertJsonPath('settingNo', 3)
            ->assertJsonPath('settingName', '工程確認用')
            ->assertJsonPath('sbmodellist', [10, 20])
            ->assertJsonPath('dprclassificationlist', ['A', 'B', 'AtoB'])
            ->assertJsonPath('sbdspplplan', true)
            ->assertJsonPath('sydspnobody', true)
            ->assertJsonPath('flgdspcustomer', true)
            ->assertJsonPath('settingsList.3.settingName', '工程確認用');

        $this->assertDatabaseHas('display_settings', [
            'user_no' => (string) $user->id,
            'setting_no' => 3,
            'setting_name' => '工程確認用',
            'duration' => 1,
            'sbdspplplan' => true,
            'sydspnobody' => true,
            'flgdspcustomer' => true,
        ]);
        $this->assertFalse(Schema::hasColumn('display_settings', 'value'));
        $this->assertFalse(Schema::hasColumn('display_settings', 'is_active'));
        $this->assertTrue(Schema::hasColumn('display_settings', 'sbmodellist'));
        $this->assertTrue(Schema::hasColumn('display_settings', 'sydspnobody'));
        $this->assertTrue(Schema::hasColumn('display_settings', 'flgdspcustomer'));
        $this->assertFalse(Schema::hasColumn('display_settings', 'synobody'));
        $this->assertFalse(Schema::hasColumn('display_settings', 'plscale'));
        $this->assertFalse(Schema::hasColumn('display_settings', 'sbscale'));
        $this->assertFalse(Schema::hasColumn('display_settings', 'syscale'));
        $this->assertFalse(Schema::hasColumn('display_settings', 'tkscale'));
    }

    public function test_active_display_setting_api_does_not_exist(): void
    {
        $user = $this->createUser('user-c');

        $this->actingAs($user)
            ->putJson('/api/display-settings/active', ['settingNo' => 4])
            ->assertStatus(405);
    }

    public function test_postgres_text_array_literal_is_encoded_without_extra_backslashes(): void
    {
        $store = app(DisplaySettingsStore::class);
        $literalMethod = new \ReflectionMethod($store, 'postgresTextArrayLiteral');
        $literalMethod->setAccessible(true);
        $parseMethod = new \ReflectionMethod($store, 'parseList');
        $parseMethod->setAccessible(true);

        $this->assertSame('{"A","B","AtoB"}', $literalMethod->invoke($store, ['A', 'B', 'AtoB']));
        $this->assertSame('{"A\\"B","C\\\\D","E,F"}', $literalMethod->invoke($store, ['A"B', 'C\\D', 'E,F']));
        $this->assertSame(
            ['A', 'B', 'AtoB'],
            $parseMethod->invoke($store, '"{\\"A\\",\\"B\\",\\"AtoB\\"}"'),
        );
        $this->assertSame(
            ['A', 'B', 'AtoB'],
            $parseMethod->invoke($store, ['"{\\"A\\",\\"B\\",\\"AtoB\\"}"']),
        );
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
