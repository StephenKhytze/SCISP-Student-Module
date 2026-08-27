<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id('student_id');

            $table->string('student_number', 20)->unique();

            $table->string('first_name', 100);
            $table->string('middle_name', 200)->nullable();
            $table->string('last_name', 100);
            $table->string('nickname', 50)->nullable();

            // page shows two emails, personal and school issued
            $table->string('email_address', 150)->nullable()->unique();
            $table->string('institutional_email', 150)->nullable();
            $table->string('contact_number', 20)->nullable();
            $table->text('address')->nullable();

            $table->string('gender', 20)->nullable();
            $table->string('civil_status', 20)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('profile_picture', 255)->nullable();
            $table->string('enrollment_status', 50)->nullable();

            // when they first enrolled, only set once so it goes here not in academic_records
            $table->date('date_enrolled')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
