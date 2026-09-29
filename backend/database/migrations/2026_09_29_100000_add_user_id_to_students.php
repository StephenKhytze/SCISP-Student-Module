<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // a real link from a login account to its student record. before this
        // the student was found by the last part of the username
        // (DelaCruz_Juan_C1234 -> C1234), which breaks the moment the auth
        // side names accounts differently. that match still works as a
        // fallback for accounts nobody has linked yet.
        Schema::table('students', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->after('student_id')
                ->unique()
                ->constrained('users', 'user_id')
                ->nullOnDelete();
        });

        // link the student accounts that already exist, same username rule
        // as before, so nobody loses access to their record
        $accounts = DB::table('users')->where('role', 'student')->get(['user_id', 'username']);

        foreach ($accounts as $account) {
            $parts = explode('_', $account->username);

            DB::table('students')
                ->where('student_number', end($parts))
                ->whereNull('user_id')
                ->update(['user_id' => $account->user_id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
        });
    }
};
