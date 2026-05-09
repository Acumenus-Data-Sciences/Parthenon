<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('pgsql')->create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('display_name');
            $table->string('billing_status')->default('active');
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        // Insert Tenant#1 ('default') as part of the migration so every
        // environment (prod, dev, test with RefreshDatabase) has the
        // default tenant immediately after migrate. The BelongsToTenant
        // trait depends on this — without it, every User::create call
        // would throw via SingleTenantResolver -> Tenant::default().
        //
        // Using DB::table() (not Eloquent) so the migration doesn't depend
        // on the App\Tenancy\Tenant model class existing at migrate-time.
        DB::connection('pgsql')->table('tenants')->insert([
            'id' => 1,
            'slug' => 'default',
            'display_name' => 'Default Tenant',
            'billing_status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Bump sequence past id=1 so subsequent auto-increment inserts
        // (e.g. EE creating additional tenants) start at id=2+.
        DB::connection('pgsql')->statement(
            "SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1))"
        );
    }

    public function down(): void
    {
        Schema::connection('pgsql')->dropIfExists('tenants');
    }
};
