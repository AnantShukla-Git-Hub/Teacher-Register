"""
Teacher Register - Automated System Test Suite
Tests all core APIs, SQLite queries, attendance calculations, and compliance rules.
"""

import sys
import os

# Set path to current directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_connection
from auth import create_jwt_token, decode_jwt_token

def test_full_system():
    print("--- 1. Testing Database Initialization ---")
    init_db()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [r[0] for r in cursor.fetchall()]
    print("Tables found:", tables)
    assert "teachers" in tables
    assert "classrooms" in tables
    assert "students" in tables
    assert "attendance_records" in tables
    assert "evaluation_columns" in tables
    print("[OK] All tables exist!")

    print("\n--- 2. Testing Teacher Auth & Classroom Creation ---")
    # Clean test data
    cursor.execute("DELETE FROM teachers WHERE email='test_guide@ietlucknow.ac.in'")
    cursor.execute("INSERT INTO teachers (email, name, title) VALUES (?, ?, ?)", 
                   ("test_guide@ietlucknow.ac.in", "Dr. Ahmad Hasan", "Prof."))
    conn.commit()
    teacher_id = cursor.lastrowid
    print(f"Teacher created with ID: {teacher_id}")

    token = create_jwt_token({"teacher_id": teacher_id, "email": "test_guide@ietlucknow.ac.in"})
    payload = decode_jwt_token(token)
    assert payload["teacher_id"] == teacher_id
    print("[OK] JWT creation & verification works!")

    # Create Classroom
    cursor.execute("DELETE FROM classrooms WHERE room_id='TEST-3A'")
    cursor.execute("""
        INSERT INTO classrooms (teacher_id, room_id, room_name, room_password)
        VALUES (?, 'TEST-3A', 'Web Engineering Mini Project', 'iet2026')
    """, (teacher_id,))
    conn.commit()
    classroom_id = cursor.lastrowid
    print(f"Classroom created with ID: {classroom_id}")

    print("\n--- 3. Testing Student Roster Addition ---")
    students = [
        ("2500520100112", "Anant Shukla"),
        ("2500520100131", "Harsh Vardhan Singh Kushwaha"),
        ("2500520100132", "Indresh Pratap Singh"),
        ("2500520100137", "Kunal Singh"),
    ]
    for roll, name in students:
        cursor.execute("INSERT OR REPLACE INTO students (classroom_id, roll_no, name) VALUES (?, ?, ?)",
                       (classroom_id, roll, name))
    conn.commit()
    cursor.execute("SELECT COUNT(*) FROM students WHERE classroom_id=?", (classroom_id,))
    count = cursor.fetchone()[0]
    assert count == 4
    print(f"[OK] {count} students added successfully!")

    print("\n--- 4. Testing Attendance Session & Marking ---")
    # Session 1
    cursor.execute("INSERT INTO attendance_sessions (classroom_id, session_date, title) VALUES (?, '2026-11-15', 'Lecture 1')", (classroom_id,))
    s1_id = cursor.lastrowid

    # Session 2
    cursor.execute("INSERT INTO attendance_sessions (classroom_id, session_date, title) VALUES (?, '2026-11-17', 'Lecture 2')", (classroom_id,))
    s2_id = cursor.lastrowid

    # Mark Anant Present in both (100% attendance)
    cursor.execute("SELECT id FROM students WHERE classroom_id=? AND roll_no='2500520100112'", (classroom_id,))
    anant_id = cursor.fetchone()[0]
    cursor.execute("INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'P')", (s1_id, anant_id))
    cursor.execute("INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'P')", (s2_id, anant_id))

    # Mark Kunal Present in S1, Absent in S2 (50% attendance -> shortage alert)
    cursor.execute("SELECT id FROM students WHERE classroom_id=? AND roll_no='2500520100137'", (classroom_id,))
    kunal_id = cursor.fetchone()[0]
    cursor.execute("INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'P')", (s1_id, kunal_id))
    cursor.execute("INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'A')", (s2_id, kunal_id))
    conn.commit()

    # Verify calculation logic
    from main import calculate_student_stats
    anant_stats = calculate_student_stats(classroom_id, anant_id, conn)
    print("Anant Stats:", anant_stats)
    assert anant_stats["percentage"] == 100.0
    assert anant_stats["is_compliant"] is True
    assert anant_stats["status_badge"] == "COMPLIANT"

    kunal_stats = calculate_student_stats(classroom_id, kunal_id, conn)
    print("Kunal Stats:", kunal_stats)
    assert kunal_stats["percentage"] == 50.0
    assert kunal_stats["is_compliant"] is False
    assert kunal_stats["status_badge"] == "SHORTAGE ALERT"
    print("[OK] 75% Compliance threshold logic verified!")

    print("\n--- 5. Testing Continuous Assessment Columns & Scores ---")
    cursor.execute("INSERT INTO evaluation_columns (classroom_id, name, max_marks) VALUES (?, 'Midterm 1', 20.0)", (classroom_id,))
    col_id = cursor.lastrowid

    cursor.execute("INSERT OR REPLACE INTO evaluation_scores (column_id, student_id, score) VALUES (?, ?, 19.5)", (col_id, anant_id))
    conn.commit()

    cursor.execute("SELECT score FROM evaluation_scores WHERE column_id=? AND student_id=?", (col_id, anant_id))
    score = cursor.fetchone()[0]
    assert score == 19.5
    print(f"[OK] Midterm evaluation recorded: {score}/20.0 for Anant Shukla!")

    conn.close()
    print("\n==========================================")
    print("ALL BACKEND AND DATABASE TESTS PASSED 100%!")
    print("==========================================")

if __name__ == "__main__":
    test_full_system()
