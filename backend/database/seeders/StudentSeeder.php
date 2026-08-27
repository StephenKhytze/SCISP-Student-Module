<?php

namespace Database\Seeders;

use App\Models\ActivityLog;
use App\Models\Student;
use Illuminate\Database\Seeder;

class StudentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // first one is Juan, his student_number matches the C1234 part
        // of the DelaCruz_Juan_C1234 login account
        $rows = [
            [
                'student' => [
                    'student_number' => 'C1234',
                    'first_name' => 'Juan',
                    'middle_name' => 'Santos',
                    'last_name' => 'Dela Cruz',
                    'nickname' => 'Jun',
                    'email_address' => 'juandelacruz@gmail.com',
                    'institutional_email' => 'juan.delacruz@student.abcschool.edu.ph',
                    'contact_number' => '+63 917 123 4567',
                    'address' => '123 Rizal St., Sampaloc, Manila',
                    'gender' => 'Male',
                    'civil_status' => 'Single',
                    'date_of_birth' => '2004-05-14',
                    'enrollment_status' => 'Enrolled',
                    'date_enrolled' => '2024-07-15',
                ],
                'record' => [
                    'department' => 'College of Computer Studies',
                    'course' => 'BSIT',
                    'year_level' => 3,
                    'section' => 'Section 3A',
                    'total_units' => 21,
                    'cumulative_gpa' => 1.45,
                    'academic_status' => 'Regular',
                    'academic_standing' => "Dean's List Scholar",
                ],
                'emergency' => ['Maria Dela Cruz', '+63 918 987 6543', 'Mother'],
            ],
            [
                'student' => [
                    'student_number' => 'C1235',
                    'first_name' => 'Maria Angelica',
                    'middle_name' => 'Cruz',
                    'last_name' => 'Santos',
                    'nickname' => 'Angel',
                    'email_address' => 'angelica.santos@gmail.com',
                    'institutional_email' => 'maria.santos@student.abcschool.edu.ph',
                    'contact_number' => '+63 918 234 5678',
                    'address' => '45 Mabini St., Quiapo, Manila',
                    'gender' => 'Female',
                    'civil_status' => 'Single',
                    'date_of_birth' => '2004-09-02',
                    'enrollment_status' => 'Enrolled',
                    'date_enrolled' => '2024-07-15',
                ],
                'record' => [
                    'department' => 'College of Computer Studies',
                    'course' => 'BSIT',
                    'year_level' => 3,
                    'section' => 'Section 3A',
                    'total_units' => 21,
                    'cumulative_gpa' => 1.72,
                    'academic_status' => 'Regular',
                    'academic_standing' => 'Good Standing',
                ],
                'emergency' => ['Roberto Santos', '+63 917 555 1122', 'Father'],
            ],
            [
                'student' => [
                    'student_number' => 'C1236',
                    'first_name' => 'Mark Anthony',
                    'middle_name' => 'Reyes',
                    'last_name' => 'Villanueva',
                    'nickname' => 'Mark',
                    'email_address' => 'markvillanueva@gmail.com',
                    'institutional_email' => 'mark.villanueva@student.abcschool.edu.ph',
                    'contact_number' => '+63 919 345 6789',
                    'address' => '78 Bonifacio Ave., Tondo, Manila',
                    'gender' => 'Male',
                    'civil_status' => 'Single',
                    'date_of_birth' => '2003-12-19',
                    'enrollment_status' => 'Enrolled',
                    'date_enrolled' => '2023-07-10',
                ],
                'record' => [
                    'department' => 'College of Computer Studies',
                    'course' => 'BSCS',
                    'year_level' => 4,
                    'section' => 'Section 4B',
                    'total_units' => 15,
                    'cumulative_gpa' => 2.35,
                    'academic_status' => 'Irregular',
                    'academic_standing' => 'Good Standing',
                ],
                'emergency' => ['Elena Villanueva', '+63 916 444 3321', 'Mother'],
            ],
            [
                'student' => [
                    'student_number' => 'C1237',
                    'first_name' => 'Jasmine Rose',
                    'middle_name' => 'Lim',
                    'last_name' => 'Bautista',
                    'nickname' => 'Jas',
                    'email_address' => 'jasminebautista@gmail.com',
                    'institutional_email' => 'jasmine.bautista@student.abcschool.edu.ph',
                    'contact_number' => '+63 920 456 7890',
                    'address' => '12 Luna St., Malate, Manila',
                    'gender' => 'Female',
                    'civil_status' => 'Single',
                    'date_of_birth' => '2005-03-27',
                    'enrollment_status' => 'Enrolled',
                    'date_enrolled' => '2025-07-14',
                ],
                'record' => [
                    'department' => 'College of Computer Studies',
                    'course' => 'BSIT',
                    'year_level' => 2,
                    'section' => 'Section 2C',
                    'total_units' => 24,
                    'cumulative_gpa' => 1.28,
                    'academic_status' => 'Regular',
                    'academic_standing' => "President's Lister",
                ],
                'emergency' => ['Carlos Bautista', '+63 915 222 8890', 'Father'],
            ],
            [
                'student' => [
                    'student_number' => 'C1238',
                    'first_name' => 'Paolo Miguel',
                    'middle_name' => 'Garcia',
                    'last_name' => 'Fernandez',
                    'nickname' => 'Paul',
                    'email_address' => 'paolofernandez@gmail.com',
                    'institutional_email' => 'paolo.fernandez@student.abcschool.edu.ph',
                    'contact_number' => '+63 921 567 8901',
                    'address' => '90 Aguinaldo St., Sta. Mesa, Manila',
                    'gender' => 'Male',
                    'civil_status' => 'Single',
                    'date_of_birth' => '2004-07-08',
                    'enrollment_status' => 'Not Enrolled',
                    'date_enrolled' => '2024-07-15',
                ],
                'record' => [
                    'department' => 'College of Computer Studies',
                    'course' => 'BSCS',
                    'year_level' => 3,
                    'section' => 'Section 3B',
                    'total_units' => 0,
                    'cumulative_gpa' => 2.88,
                    'academic_status' => 'Dropped',
                    'academic_standing' => 'On Probation',
                ],
                'emergency' => ['Teresa Fernandez', '+63 928 777 6543', 'Guardian'],
            ],
            [
                'student' => [
                    'student_number' => 'C1239',
                    'first_name' => 'Kristine Joy',
                    'middle_name' => 'Domingo',
                    'last_name' => 'Ramos',
                    'nickname' => 'Tin',
                    'email_address' => 'kristineramos@gmail.com',
                    'institutional_email' => 'kristine.ramos@student.abcschool.edu.ph',
                    'contact_number' => '+63 922 678 9012',
                    'address' => '33 Del Pilar St., Ermita, Manila',
                    'gender' => 'Female',
                    'civil_status' => 'Married',
                    'date_of_birth' => '2003-01-30',
                    'enrollment_status' => 'Pending',
                    'date_enrolled' => '2023-07-10',
                ],
                'record' => [
                    'department' => 'College of Computer Studies',
                    'course' => 'BSIT',
                    'year_level' => 4,
                    'section' => 'Section 4A',
                    'total_units' => 18,
                    'cumulative_gpa' => 1.91,
                    'academic_status' => 'Regular',
                    'academic_standing' => 'Good Standing',
                ],
                'emergency' => ['Danilo Ramos', '+63 927 333 4455', 'Spouse'],
            ],
        ];

        foreach ($rows as $row) {
            // firstOrCreate so running the seeder again won't error on student_number
            $student = Student::firstOrCreate(
                ['student_number' => $row['student']['student_number']],
                $row['student']
            );

            $student->academicRecords()->firstOrCreate(
                [
                    'semester' => '1st Semester',
                    'school_year' => '2026-2027',
                ],
                $row['record']
            );

            [$name, $number, $relation] = $row['emergency'];

            $student->emergencyContacts()->firstOrCreate(
                ['contact_name' => $name],
                [
                    'contact_number' => $number,
                    'relationship' => $relation,
                ]
            );
        }

        // couple of sample logs, admin_id 2 is the Admin_User_00001 account
        $logs = [
            ['C1236', 'Edit', 'Updated section from 4A to 4B.'],
            ['C1238', 'Archive', 'Student dropped for the semester.'],
        ];

        foreach ($logs as [$studentNumber, $action, $description]) {
            $student = Student::where('student_number', $studentNumber)->first();

            ActivityLog::firstOrCreate([
                'admin_id' => 2,
                'student_id' => $student->student_id,
                'action_type' => $action,
                'description' => $description,
            ]);
        }
    }
}
