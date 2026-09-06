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
        Schema::create('academic_records', function (Blueprint $table) {
            $table->id('record_id');

            $table->foreignId('student_id')
                ->constrained('students', 'student_id')
                ->cascadeOnDelete();

            $table->string('department', 100)->nullable();
            $table->string('course', 100);
            $table->integer('year_level')->nullable();
            $table->string('semester', 20);
            $table->string('school_year', 20);
            $table->string('section', 50);
            $table->integer('total_units')->nullable();
            $table->decimal('cumulative_gpa', 4, 2)->nullable();

            // academic_status is Regular/Irregular/Dropped,
            // academic_standing is the honors one like Dean's List
            $table->string('academic_status', 50)->nullable();
            $table->string('academic_standing', 50)->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('academic_records');
    }
};
