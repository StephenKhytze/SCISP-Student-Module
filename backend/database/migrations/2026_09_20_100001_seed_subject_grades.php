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
        // same trick as the first seed migration, so a database that already has
        // the students picks up the new subject rows on a plain "artisan migrate".
        // firstOrCreate everywhere means running it again changes nothing.
        (new StudentSeeder)->run();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // nothing to undo, create_subject_grades_table drops the rows with the table
    }
};
