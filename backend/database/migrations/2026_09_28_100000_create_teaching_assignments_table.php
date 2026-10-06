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
        // the teaching load. one row = this faculty handles this subject for this
        // section in this term. grade editing is checked against these rows, not
        // against anything the page sends.
        Schema::create('teaching_assignments', function (Blueprint $table) {
            $table->id('assignment_id');

            $table->foreignId('user_id')
                ->constrained('users', 'user_id')
                ->cascadeOnDelete();

            // same plain strings subject_grades already uses, so the two match
            // up without a subjects or terms table in between
            $table->string('subject_code', 20);
            $table->string('section', 50);
            $table->string('school_year', 20);
            $table->string('semester', 20);

            $table->timestamps();

            // same faculty can't hold the same class twice. names are by hand
            // again because of mysql's 64 char limit.
            $table->unique(
                ['user_id', 'subject_code', 'section', 'school_year', 'semester'],
                'teaching_assignments_load_unique'
            );

            // the lookup the grade check does on every save
            $table->index(
                ['subject_code', 'section', 'school_year', 'semester'],
                'teaching_assignments_class_index'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teaching_assignments');
    }
};
