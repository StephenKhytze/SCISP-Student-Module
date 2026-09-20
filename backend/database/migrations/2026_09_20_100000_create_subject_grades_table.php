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
        Schema::create('subject_grades', function (Blueprint $table) {
            $table->id('grade_id');

            // hangs off the student, not the academic record, because the
            // cumulative gpa counts every term and a record is only the current one
            $table->foreignId('student_id')
                ->constrained('students', 'student_id')
                ->cascadeOnDelete();

            $table->string('school_year', 20);
            $table->string('semester', 20);

            $table->string('subject_code', 20);
            $table->string('subject_title', 100);
            $table->integer('units');

            // null until the faculty marks it. 1.00 is the highest on our scale
            // and 5.00 the lowest.
            $table->decimal('grade', 3, 2)->nullable();

            $table->timestamps();

            // one row per subject per term for a student. named by hand because
            // the one laravel builds from four columns goes over mysql's 64 char limit.
            $table->unique(
                ['student_id', 'school_year', 'semester', 'subject_code'],
                'subject_grades_term_subject_unique'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subject_grades');
    }
};
