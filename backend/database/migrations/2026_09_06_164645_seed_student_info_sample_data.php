<?php

use Database\Seeders\StudentSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // loads the sample students here instead of from DatabaseSeeder, so the
        // page has data after a plain "artisan migrate". the shared seeder is not
        // ours to edit, and migrate --seed crashes there on a duplicate username.
        // StudentSeeder uses firstOrCreate so running this twice is safe.
        (new StudentSeeder)->run();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // nothing to undo, the create_*_table migrations drop the rows with the tables
    }
};
