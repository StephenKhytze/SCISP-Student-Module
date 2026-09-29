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
        // archiving only hides a student from the directory. nothing gets
        // deleted, the grades, history and contacts all stay where they are.
        // a timestamp instead of a yes/no so we also know when it happened.
        Schema::table('students', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('date_enrolled');

            $table->foreignId('archived_by')
                ->nullable()
                ->after('archived_at')
                ->constrained('users', 'user_id')
                ->nullOnDelete();

            // the directory filters on this every time it loads
            $table->index('archived_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropForeign(['archived_by']);
            $table->dropIndex(['archived_at']);
            $table->dropColumn(['archived_at', 'archived_by']);
        });
    }
};
