"""
Teacher Register - Main FastAPI Application
Includes REST APIs, SQLite operations, rate limiting, and Socket.IO real-time engine.
Designed for 3rd semester B.Tech mini project (clean, readable, zero-overhead).
"""

import os
import sys
import io
import csv
import time
from collections import defaultdict
from typing import Optional, List

# Ensure server directory is in sys.path regardless of working directory
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from fastapi import FastAPI, HTTPException, Depends, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import socketio

from database import init_db, get_connection
from auth import create_jwt_token, decode_jwt_token, verify_google_token, GOOGLE_CLIENT_ID

# Initialize Database tables
init_db()

# -------------------------------------------------------------
# Real-Time Socket.IO Setup
# -------------------------------------------------------------
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = FastAPI(title="Teacher Register API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Rate Limiting (In-Memory IP Limiter for Student Login)
# -------------------------------------------------------------
login_attempts = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_ATTEMPTS = 5

def check_rate_limit(client_ip: str):
    now = time.time()
    # Filter attempts within the time window
    login_attempts[client_ip] = [t for t in login_attempts[client_ip] if now - t < RATE_LIMIT_WINDOW]
    if len(login_attempts[client_ip]) >= RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 1 minute before trying again."
        )

def record_failed_attempt(client_ip: str):
    login_attempts[client_ip].append(time.time())

# -------------------------------------------------------------
# Pydantic Request Models
# -------------------------------------------------------------
class TeacherRegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    title: Optional[str] = "Prof."

class TeacherLoginRequest(BaseModel):
    email: str
    password: str

class TeacherAuthRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    title: Optional[str] = "Prof."
    demo_email: Optional[str] = None
    demo_name: Optional[str] = None
    demo_title: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    title: str
    name: str

class ClassroomCreateRequest(BaseModel):
    room_id: str
    room_name: str
    room_password: str

class StudentCreateItem(BaseModel):
    roll_no: str
    name: str

class StudentsBatchRequest(BaseModel):
    students: List[StudentCreateItem]

class SessionCreateRequest(BaseModel):
    session_date: Optional[str] = None
    title: Optional[str] = "Lecture"

class AttendanceRecordItem(BaseModel):
    student_id: int
    status: str  # 'P', 'A', 'L'

class AttendanceBatchUpdateRequest(BaseModel):
    session_id: int
    records: List[AttendanceRecordItem]

class EvaluationColumnCreateRequest(BaseModel):
    name: str
    max_marks: float = 100.0

class ScoreUpdateRequest(BaseModel):
    student_id: int
    score: float

class StudentLoginRequest(BaseModel):
    room_id: str
    room_password: str
    roll_no: str

# -------------------------------------------------------------
# Authentication Dependency
# -------------------------------------------------------------
def get_current_teacher_id(authorization: Optional[str] = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ")[1]
    payload = decode_jwt_token(token)
    if not payload or "teacher_id" not in payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid token")
    return payload["teacher_id"]

# -------------------------------------------------------------
# Helper: Calculate Student Stats
# -------------------------------------------------------------
def calculate_student_stats(classroom_id: int, student_id: int, conn):
    cursor = conn.cursor()
    # Total sessions
    cursor.execute("SELECT COUNT(*) FROM attendance_sessions WHERE classroom_id = ?", (classroom_id,))
    total_sessions = cursor.fetchone()[0]

    # Attended sessions (Present = 1, Late = 1, Absent = 0)
    cursor.execute("""
        SELECT ar.status, COUNT(*) 
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE s.classroom_id = ? AND ar.student_id = ?
        GROUP BY ar.status
    """, (classroom_id, student_id))
    rows = cursor.fetchall()
    counts = {r[0]: r[1] for r in rows}
    present_count = counts.get("P", 0)
    late_count = counts.get("L", 0)
    absent_count = counts.get("A", 0)
    attended_count = present_count + late_count

    percentage = round((attended_count / total_sessions * 100), 1) if total_sessions > 0 else 100.0
    is_compliant = percentage >= 75.0

    return {
        "total_sessions": total_sessions,
        "attended_count": attended_count,
        "present_count": present_count,
        "late_count": late_count,
        "absent_count": absent_count,
        "percentage": percentage,
        "is_compliant": is_compliant,
        "status_badge": "COMPLIANT" if is_compliant else "SHORTAGE ALERT",
        "badge_color": "green" if is_compliant else "red"
    }

# -------------------------------------------------------------
# REST API Endpoints: Teacher Authentication & Profile
# -------------------------------------------------------------
@app.post("/api/auth/register")
def register_teacher(data: TeacherRegisterRequest):
    """
    Registers a new teacher account with email and custom password.
    """
    email = data.email.strip().lower()
    password = data.password.strip()
    name = data.name.strip()
    title = data.title.strip() if data.title else "Prof."

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if not password or len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long.")
    if not name:
        raise HTTPException(status_code=400, detail="Faculty name is required.")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM teachers WHERE LOWER(email) = ?", (email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please login instead.")

    cursor.execute(
        "INSERT INTO teachers (email, password, name, title) VALUES (?, ?, ?, ?)",
        (email, password, name, title)
    )
    conn.commit()
    teacher_id = cursor.lastrowid
    conn.close()

    token = create_jwt_token({
        "teacher_id": teacher_id,
        "email": email,
        "name": name,
        "title": title
    })

    return {
        "token": token,
        "teacher": {
            "id": teacher_id,
            "email": email,
            "name": name,
            "title": title
        }
    }

@app.post("/api/auth/login")
def login_teacher(data: TeacherLoginRequest):
    """
    Logs in an existing teacher using email and password.
    """
    email = data.email.strip().lower()
    password = data.password.strip()

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password, name, title FROM teachers WHERE LOWER(email) = ?", (email,))
    teacher = cursor.fetchone()
    conn.close()

    if not teacher:
        raise HTTPException(status_code=404, detail="No teacher account found with this email. Please register first.")

    stored_pwd = teacher["password"] or ""
    if stored_pwd != password:
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    token = create_jwt_token({
        "teacher_id": teacher["id"],
        "email": teacher["email"],
        "name": teacher["name"],
        "title": teacher["title"]
    })

    return {
        "token": token,
        "teacher": {
            "id": teacher["id"],
            "email": teacher["email"],
            "name": teacher["name"],
            "title": teacher["title"]
        }
    }

@app.post("/api/auth/teacher")
def authenticate_teacher(payload: TeacherAuthRequest):
    """
    Authenticates teacher via Email & Password, or Google OAuth.
    """
    user_info = None
    if payload.credential:
        user_info = verify_google_token(payload.credential)

    email = (payload.email or payload.demo_email or (user_info.get("email") if user_info else "")).strip().lower()
    password = (payload.password or "teacher123").strip()
    name = (payload.name or payload.demo_name or (user_info.get("name") if user_info else "Faculty Member")).strip()
    title = (payload.title or payload.demo_title or "Prof.").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Teacher email is required.")
    if not payload.credential and not payload.password:
        raise HTTPException(status_code=400, detail="Teacher password is required.")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password, name, title FROM teachers WHERE LOWER(email) = ?", (email,))
    teacher = cursor.fetchone()

    if teacher:
        # Check password if not logging in via Google verified credential
        if not payload.credential:
            stored_pwd = teacher["password"] or "teacher123"
            if stored_pwd != password:
                conn.close()
                raise HTTPException(status_code=401, detail="Invalid teacher password. Please try again.")
        teacher_id = teacher["id"]
        title = teacher["title"]
        name = teacher["name"]
    else:
        cursor.execute(
            "INSERT INTO teachers (email, password, name, title, google_id) VALUES (?, ?, ?, ?, ?)",
            (email, password, name, title, user_info.get("google_id") if user_info else None)
        )
        conn.commit()
        teacher_id = cursor.lastrowid

    conn.close()

    token = create_jwt_token({
        "teacher_id": teacher_id,
        "email": email,
        "name": name,
        "title": title
    })

    return {
        "token": token,
        "teacher": {
            "id": teacher_id,
            "email": email,
            "name": name,
            "title": title
        }
    }

@app.get("/api/teacher/me")
def get_teacher_profile(teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, title FROM teachers WHERE id = ?", (teacher_id,))
    teacher = cursor.fetchone()
    conn.close()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    return dict(teacher)

@app.put("/api/teacher/profile")
def update_teacher_profile(data: ProfileUpdateRequest, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE teachers SET title = ?, name = ? WHERE id = ?", (data.title, data.name, teacher_id))
    conn.commit()
    conn.close()
    return {"message": "Profile updated successfully"}

# -------------------------------------------------------------
# REST API Endpoints: Classroom Management
# -------------------------------------------------------------
@app.get("/api/classrooms")
def list_classrooms(teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.room_id, c.room_name, c.room_password, c.created_at,
               (SELECT COUNT(*) FROM students s WHERE s.classroom_id = c.id) as student_count,
               (SELECT COUNT(*) FROM attendance_sessions ses WHERE ses.classroom_id = c.id) as session_count
        FROM classrooms c
        WHERE c.teacher_id = ?
        ORDER BY c.created_at DESC
    """, (teacher_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/classrooms")
def create_classroom(data: ClassroomCreateRequest, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    # Check uniqueness of room_id
    cursor.execute("SELECT id FROM classrooms WHERE room_id = ?", (data.room_id.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Room ID already exists. Choose a different one.")

    cursor.execute(
        "INSERT INTO classrooms (teacher_id, room_id, room_name, room_password) VALUES (?, ?, ?, ?)",
        (teacher_id, data.room_id.strip().upper(), data.room_name.strip(), data.room_password.strip())
    )
    conn.commit()
    conn.close()
    return {"message": "Classroom created successfully", "room_id": data.room_id.strip().upper()}

@app.delete("/api/classrooms/{room_id}")
def delete_classroom(room_id: str, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM classrooms WHERE room_id = ? AND teacher_id = ?", (room_id.upper(), teacher_id))
    conn.commit()
    conn.close()
    return {"message": "Classroom deleted"}

# -------------------------------------------------------------
# REST API Endpoints: Register Sheet View (Full Data Grid)
# -------------------------------------------------------------
@app.get("/api/classrooms/{room_id}")
def get_classroom_register(room_id: str, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.room_id, c.room_name, c.room_password, t.name as teacher_name, t.title as teacher_title
        FROM classrooms c
        JOIN teachers t ON c.teacher_id = t.id
        WHERE c.room_id = ? AND c.teacher_id = ?
    """, (room_id.upper(), teacher_id))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cid = classroom["id"]

    # 1. Students list
    cursor.execute("SELECT id, roll_no, name FROM students WHERE classroom_id = ? ORDER BY roll_no ASC", (cid,))
    students = [dict(s) for s in cursor.fetchall()]

    # 2. Sessions list
    cursor.execute("SELECT id, session_date, title FROM attendance_sessions WHERE classroom_id = ? ORDER BY id ASC", (cid,))
    sessions = [dict(ses) for ses in cursor.fetchall()]

    # 3. Attendance records lookup { session_id: { student_id: status } }
    cursor.execute("""
        SELECT ar.session_id, ar.student_id, ar.status
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE s.classroom_id = ?
    """, (cid,))
    attendance_records = defaultdict(dict)
    for row in cursor.fetchall():
        attendance_records[row["session_id"]][row["student_id"]] = row["status"]

    # 4. Evaluation columns
    cursor.execute("SELECT id, name, max_marks FROM evaluation_columns WHERE classroom_id = ? ORDER BY id ASC", (cid,))
    evaluations = [dict(e) for e in cursor.fetchall()]

    # 5. Evaluation scores lookup { column_id: { student_id: score } }
    cursor.execute("""
        SELECT es.column_id, es.student_id, es.score
        FROM evaluation_scores es
        JOIN evaluation_columns ec ON es.column_id = ec.id
        WHERE ec.classroom_id = ?
    """, (cid,))
    scores = defaultdict(dict)
    for row in cursor.fetchall():
        scores[row["column_id"]][row["student_id"]] = row["score"]

    # 6. Precompute student percentages
    student_stats = {}
    for st in students:
        stats = calculate_student_stats(cid, st["id"], conn)
        student_stats[st["id"]] = stats

    conn.close()

    return {
        "classroom": dict(classroom),
        "students": students,
        "sessions": sessions,
        "attendance": attendance_records,
        "evaluations": evaluations,
        "scores": scores,
        "student_stats": student_stats
    }

# -------------------------------------------------------------
# REST API Endpoints: Roster (Students CSV & Single Add)
# -------------------------------------------------------------
@app.post("/api/classrooms/{room_id}/students")
def add_students_roster(room_id: str, data: StudentsBatchRequest, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM classrooms WHERE room_id = ? AND teacher_id = ?", (room_id.upper(), teacher_id))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cid = classroom["id"]
    inserted_count = 0
    for st in data.students:
        roll = st.roll_no.strip()
        name = st.name.strip()
        if roll and name:
            cursor.execute("""
                INSERT INTO students (classroom_id, roll_no, name) 
                VALUES (?, ?, ?)
                ON CONFLICT(classroom_id, roll_no) DO UPDATE SET name=excluded.name
            """, (cid, roll, name))
            inserted_count += 1

    conn.commit()
    conn.close()
    return {"message": f"Successfully processed {inserted_count} student(s)"}

@app.delete("/api/classrooms/{room_id}/students/{student_id}")
def remove_student(room_id: str, student_id: int, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM students 
        WHERE id = ? AND classroom_id = (SELECT id FROM classrooms WHERE room_id = ? AND teacher_id = ?)
    """, (student_id, room_id.upper(), teacher_id))
    conn.commit()
    conn.close()
    return {"message": "Student removed"}

# -------------------------------------------------------------
# REST API Endpoints: Attendance Sessions & Real-Time Marking
# -------------------------------------------------------------
@app.post("/api/classrooms/{room_id}/sessions")
async def create_attendance_session(room_id: str, data: SessionCreateRequest, teacher_id: int = Depends(get_current_teacher_id)):
    session_date = data.session_date or time.strftime("%Y-%m-%d")
    title = data.title or f"Lecture {session_date}"

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM classrooms WHERE room_id = ? AND teacher_id = ?", (room_id.upper(), teacher_id))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cid = classroom["id"]
    cursor.execute(
        "INSERT INTO attendance_sessions (classroom_id, session_date, title) VALUES (?, ?, ?)",
        (cid, session_date, title)
    )
    session_id = cursor.lastrowid

    # Automatically set all existing students to 'P' (Present) by default for fast marking
    cursor.execute("SELECT id, roll_no FROM students WHERE classroom_id = ?", (cid,))
    all_students = cursor.fetchall()
    for st in all_students:
        cursor.execute(
            "INSERT OR REPLACE INTO attendance_records (session_id, student_id, status) VALUES (?, ?, 'P')",
            (session_id, st["id"])
        )

    conn.commit()
    conn.close()

    # Notify teacher channel of new session
    await sio.emit("session_added", {"session_id": session_id, "date": session_date, "title": title}, room=f"room:{room_id.upper()}")

    # Notify all students in this room with their updated attendance stats
    conn = get_connection()
    for st in all_students:
        stats = calculate_student_stats(cid, st["id"], conn)
        channel = f"room:{room_id.upper()}:student:{st['roll_no']}"
        await sio.emit("live_update", {"type": "attendance", "stats": stats}, room=channel)
    conn.close()

    return {"message": "Session added", "session_id": session_id, "session_date": session_date}

@app.delete("/api/classrooms/{room_id}/sessions/{session_id}")
async def delete_attendance_session(room_id: str, session_id: int, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM attendance_sessions 
        WHERE id = ? AND classroom_id = (SELECT id FROM classrooms WHERE room_id = ? AND teacher_id = ?)
    """, (session_id, room_id.upper(), teacher_id))
    conn.commit()
    conn.close()
    await sio.emit("session_deleted", {"session_id": session_id}, room=f"room:{room_id.upper()}")
    return {"message": "Session deleted"}

@app.post("/api/classrooms/{room_id}/attendance")
async def update_attendance_records(room_id: str, data: AttendanceBatchUpdateRequest, teacher_id: int = Depends(get_current_teacher_id)):
    """
    Updates single or multiple attendance records (P / A / L) and pushes live update to the student channel!
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM classrooms WHERE room_id = ? AND teacher_id = ?", (room_id.upper(), teacher_id))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cid = classroom["id"]
    updated_students = []

    for rec in data.records:
        cursor.execute("""
            INSERT INTO attendance_records (session_id, student_id, status, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id, student_id) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP
        """, (data.session_id, rec.student_id, rec.status))

        # Get student's roll number to push private live update
        cursor.execute("SELECT roll_no FROM students WHERE id = ?", (rec.student_id,))
        row = cursor.fetchone()
        if row:
            updated_students.append((rec.student_id, row["roll_no"], rec.status))

    conn.commit()

    # Real-Time WebSocket Push (Channel-Scoped to protect student privacy)
    for st_id, roll_no, st_status in updated_students:
        stats = calculate_student_stats(cid, st_id, conn)
        student_channel = f"room:{room_id.upper()}:student:{roll_no}"
        await sio.emit("live_update", {
            "type": "attendance",
            "session_id": data.session_id,
            "status": st_status,
            "stats": stats
        }, room=student_channel)

    conn.close()
    return {"message": "Attendance records updated"}

# -------------------------------------------------------------
# REST API Endpoints: Evaluation Columns & Inline Marks
# -------------------------------------------------------------
@app.post("/api/classrooms/{room_id}/evaluations")
async def add_evaluation_column(room_id: str, data: EvaluationColumnCreateRequest, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM classrooms WHERE room_id = ? AND teacher_id = ?", (room_id.upper(), teacher_id))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cursor.execute(
        "INSERT INTO evaluation_columns (classroom_id, name, max_marks) VALUES (?, ?, ?)",
        (classroom["id"], data.name.strip(), data.max_marks)
    )
    conn.commit()
    col_id = cursor.lastrowid
    conn.close()

    await sio.emit("evaluation_column_added", {"id": col_id, "name": data.name, "max_marks": data.max_marks}, room=f"room:{room_id.upper()}")
    return {"message": "Evaluation column created", "column_id": col_id}

@app.delete("/api/classrooms/{room_id}/evaluations/{column_id}")
async def delete_evaluation_column(room_id: str, column_id: int, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM evaluation_columns 
        WHERE id = ? AND classroom_id = (SELECT id FROM classrooms WHERE room_id = ? AND teacher_id = ?)
    """, (column_id, room_id.upper(), teacher_id))
    conn.commit()
    conn.close()
    await sio.emit("evaluation_column_deleted", {"column_id": column_id}, room=f"room:{room_id.upper()}")
    return {"message": "Column deleted"}

@app.post("/api/classrooms/{room_id}/evaluations/{column_id}/score")
async def update_student_score(room_id: str, column_id: int, data: ScoreUpdateRequest, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO evaluation_scores (column_id, student_id, score, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(column_id, student_id) DO UPDATE SET score = excluded.score, updated_at = CURRENT_TIMESTAMP
    """, (column_id, data.student_id, data.score))
    conn.commit()

    # Get student roll number and column details to push to private student channel
    cursor.execute("SELECT roll_no FROM students WHERE id = ?", (data.student_id,))
    st_row = cursor.fetchone()
    cursor.execute("SELECT name, max_marks FROM evaluation_columns WHERE id = ?", (column_id,))
    col_row = cursor.fetchone()
    conn.close()

    if st_row and col_row:
        student_channel = f"room:{room_id.upper()}:student:{st_row['roll_no']}"
        await sio.emit("live_update", {
            "type": "score",
            "column_id": column_id,
            "column_name": col_row["name"],
            "max_marks": col_row["max_marks"],
            "score": data.score
        }, room=student_channel)

    return {"message": "Score updated"}

# -------------------------------------------------------------
# REST API Endpoints: CSV Export
# -------------------------------------------------------------
@app.get("/api/classrooms/{room_id}/export")
def export_classroom_register_csv(room_id: str, teacher_id: int = Depends(get_current_teacher_id)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, room_name FROM classrooms WHERE room_id = ? AND teacher_id = ?", (room_id.upper(), teacher_id))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cid = classroom["id"]
    cursor.execute("SELECT id, roll_no, name FROM students WHERE classroom_id = ? ORDER BY roll_no ASC", (cid,))
    students = cursor.fetchall()

    cursor.execute("SELECT id, session_date FROM attendance_sessions WHERE classroom_id = ? ORDER BY id ASC", (cid,))
    sessions = cursor.fetchall()

    cursor.execute("SELECT id, name, max_marks FROM evaluation_columns WHERE classroom_id = ? ORDER BY id ASC", (cid,))
    evaluations = cursor.fetchall()

    cursor.execute("""
        SELECT session_id, student_id, status FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE s.classroom_id = ?
    """, (cid,))
    att_dict = defaultdict(dict)
    for r in cursor.fetchall():
        att_dict[r["session_id"]][r["student_id"]] = r["status"]

    cursor.execute("""
        SELECT column_id, student_id, score FROM evaluation_scores es
        JOIN evaluation_columns ec ON es.column_id = ec.id
        WHERE ec.classroom_id = ?
    """, (cid,))
    score_dict = defaultdict(dict)
    for r in cursor.fetchall():
        score_dict[r["column_id"]][r["student_id"]] = r["score"]

    output = io.StringIO()
    writer = csv.writer(output)

    # Header Row
    headers = ["Roll No", "Student Name"]
    for s in sessions:
        headers.append(f"Att: {s['session_date']}")
    headers.extend(["Total Classes", "Classes Attended", "Attendance %", "Compliance Status"])
    for ev in evaluations:
        headers.append(f"{ev['name']} (Max {ev['max_marks']})")

    writer.writerow(headers)

    # Data Rows
    total_sess_count = len(sessions)
    for st in students:
        row = [st["roll_no"], st["name"]]
        attended = 0
        for s in sessions:
            status_val = att_dict[s["id"]].get(st["id"], "-")
            row.append(status_val)
            if status_val in ("P", "L"):
                attended += 1

        pct = round((attended / total_sess_count * 100), 1) if total_sess_count > 0 else 100.0
        compliance = "COMPLIANT" if pct >= 75.0 else "SHORTAGE ALERT"

        row.extend([total_sess_count, attended, f"{pct}%", compliance])

        for ev in evaluations:
            sc = score_dict[ev["id"]].get(st["id"], "-")
            row.append(sc)

        writer.writerow(row)

    conn.close()
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={room_id}_register.csv"}
    )

# -------------------------------------------------------------
# REST API Endpoints: Attendance Shortage PDF Report
# -------------------------------------------------------------
@app.get("/api/classrooms/{room_id}/shortage-pdf")
def export_attendance_shortage_pdf(
    room_id: str,
    threshold: float = 75.0,
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """
    Generates an official PDF report of students with attendance below the specified threshold.
    """
    auth_token = None
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token

    if not auth_token:
        raise HTTPException(status_code=401, detail="Authentication token required")

    payload = decode_jwt_token(auth_token)
    if not payload or "teacher_id" not in payload:
        raise HTTPException(status_code=401, detail="Invalid session token")
    teacher_id = payload["teacher_id"]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.room_id, c.room_name, t.name as teacher_name, t.title as teacher_title
        FROM classrooms c
        JOIN teachers t ON c.teacher_id = t.id
        WHERE c.room_id = ? AND c.teacher_id = ?
    """, (room_id.upper(), teacher_id))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cid = classroom["id"]

    cursor.execute("SELECT id, session_date FROM attendance_sessions WHERE classroom_id = ? ORDER BY id ASC", (cid,))
    sessions = cursor.fetchall()
    total_sessions = len(sessions)

    cursor.execute("SELECT id, roll_no, name FROM students WHERE classroom_id = ? ORDER BY roll_no ASC", (cid,))
    students = cursor.fetchall()

    cursor.execute("""
        SELECT ar.student_id, ar.status
        FROM attendance_records ar
        JOIN attendance_sessions s ON ar.session_id = s.id
        WHERE s.classroom_id = ?
    """, (cid,))
    att_counts = defaultdict(lambda: {"P": 0, "L": 0, "A": 0})
    for r in cursor.fetchall():
        if r["status"] in ("P", "L", "A"):
            att_counts[r["student_id"]][r["status"]] += 1

    conn.close()

    shortage_list = []
    for st in students:
        counts = att_counts[st["id"]]
        attended = counts["P"] + counts["L"]
        pct = round((attended / total_sessions * 100), 1) if total_sessions > 0 else 100.0
        if pct < threshold:
            shortage_list.append({
                "roll_no": st["roll_no"],
                "name": st["name"],
                "attended": attended,
                "total": total_sessions,
                "percentage": pct
            })

    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    elements = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        alignment=1,
        spaceAfter=4
    )
    sub_style = ParagraphStyle(
        "ReportSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        alignment=1,
        textColor=colors.HexColor("#444444"),
        spaceAfter=12
    )

    elements.append(Paragraph("ATTENDANCE SHORTAGE REPORT", title_style))
    elements.append(Paragraph(f"Course: {classroom['room_name']} ({classroom['room_id']})", sub_style))

    meta_data = [
        [f"Instructor: {classroom['teacher_title']} {classroom['teacher_name']}", f"Required Threshold: {threshold}%"],
        [f"Total Lectures Conducted: {total_sessions}", f"Total Students Enrolled: {len(students)}"],
        [f"Students Below Threshold: {len(shortage_list)}", f"Date: {time.strftime('%Y-%m-%d')}"]
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor("#333333")),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 14))

    if len(shortage_list) == 0:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"<b>Notice:</b> All enrolled students have attendance meeting or exceeding the {threshold}% requirement.", styles["Normal"]))
    else:
        table_data = [["#", "Roll Number", "Student Name", "Attended", "Total", "Attendance %", "Deficit"]]
        for i, st in enumerate(shortage_list, 1):
            needed = max(0, int((threshold / 100.0 * total_sessions) - st["attended"] + 0.99))
            table_data.append([
                str(i),
                st["roll_no"],
                st["name"],
                f"{st['attended']}",
                f"{st['total']}",
                f"{st['percentage']}%",
                f"-{needed} classes"
            ])

        col_widths = [30, 110, 180, 55, 45, 70, 50]
        report_table = Table(table_data, colWidths=col_widths)
        report_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f0f0f0")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#111111")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8.5),
            ('ALIGN', (0,0), (0,-1), 'CENTER'),
            ('ALIGN', (3,0), (-1,-1), 'CENTER'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cccccc")),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TEXTCOLOR', (5,1), (5,-1), colors.HexColor("#cc0000")),
            ('FONTNAME', (5,1), (5,-1), 'Helvetica-Bold'),
        ]))
        elements.append(report_table)

    elements.append(Spacer(1, 35))
    sig_data = [
        ["", "_____________________________________"],
        ["", f"Signature: {classroom['teacher_title']} {classroom['teacher_name']}"],
        ["", "Faculty / Course Instructor"]
    ]
    sig_table = Table(sig_data, colWidths=[300, 240])
    sig_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
    ]))
    elements.append(sig_table)

    doc.build(elements)
    buf.seek(0)

    filename = f"{room_id}_shortage_report.pdf"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# -------------------------------------------------------------
# REST API Endpoints: Student Portal & Rate Limiting
# -------------------------------------------------------------
@app.post("/api/student/login")
def student_login(data: StudentLoginRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(client_ip)

    room_id = data.room_id.strip().upper()
    password = data.room_password.strip()
    roll_no = data.roll_no.strip()

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.room_id, c.room_name, c.room_password, t.name as teacher_name, t.title as teacher_title
        FROM classrooms c
        JOIN teachers t ON c.teacher_id = t.id
        WHERE c.room_id = ?
    """, (room_id,))
    classroom = cursor.fetchone()

    if not classroom or classroom["room_password"] != password:
        record_failed_attempt(client_ip)
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid Room ID or Password.")

    cursor.execute("SELECT id, roll_no, name FROM students WHERE classroom_id = ? AND roll_no = ?", (classroom["id"], roll_no))
    student = cursor.fetchone()
    if not student:
        record_failed_attempt(client_ip)
        conn.close()
        raise HTTPException(status_code=404, detail=f"Roll Number '{roll_no}' is not enrolled in this classroom.")

    conn.close()
    return {
        "success": True,
        "room_id": room_id,
        "classroom_name": classroom["room_name"],
        "teacher_name": f"{classroom['teacher_title']} {classroom['teacher_name']}".strip(),
        "student": dict(student)
    }

@app.get("/api/student/dashboard")
def get_student_dashboard(room_id: str, roll_no: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.room_id, c.room_name, t.name as teacher_name, t.title as teacher_title
        FROM classrooms c
        JOIN teachers t ON c.teacher_id = t.id
        WHERE c.room_id = ?
    """, (room_id.upper(),))
    classroom = cursor.fetchone()
    if not classroom:
        conn.close()
        raise HTTPException(status_code=404, detail="Classroom not found")

    cid = classroom["id"]
    cursor.execute("SELECT id, roll_no, name FROM students WHERE classroom_id = ? AND roll_no = ?", (cid, roll_no.strip()))
    student = cursor.fetchone()
    if not student:
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")

    sid = student["id"]

    # Calculate stats
    stats = calculate_student_stats(cid, sid, conn)

    # Session history
    cursor.execute("""
        SELECT s.id as session_id, s.session_date, s.title, COALESCE(ar.status, 'Unmarked') as status
        FROM attendance_sessions s
        LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = ?
        WHERE s.classroom_id = ?
        ORDER BY s.id DESC
    """, (sid, cid))
    history = [dict(h) for h in cursor.fetchall()]

    # Evaluation Marks
    cursor.execute("""
        SELECT ec.id as column_id, ec.name, ec.max_marks, COALESCE(es.score, 0) as score
        FROM evaluation_columns ec
        LEFT JOIN evaluation_scores es ON es.column_id = ec.id AND es.student_id = ?
        WHERE ec.classroom_id = ?
        ORDER BY ec.id ASC
    """, (sid, cid))
    evaluations = [dict(ev) for ev in cursor.fetchall()]

    conn.close()

    return {
        "classroom_name": classroom["room_name"],
        "teacher_name": f"{classroom['teacher_title']} {classroom['teacher_name']}".strip(),
        "student": dict(student),
        "stats": stats,
        "history": history,
        "evaluations": evaluations
    }

# -------------------------------------------------------------
# Socket.IO Real-Time Event Handlers
# -------------------------------------------------------------
@sio.event
async def connect(sid, environ):
    pass

@sio.event
async def disconnect(sid):
    pass

@sio.event
async def join_student_channel(sid, data):
    room_id = data.get("room_id", "").strip().upper()
    roll_no = data.get("roll_no", "").strip()
    if room_id and roll_no:
        channel_name = f"room:{room_id}:student:{roll_no}"
        await sio.enter_room(sid, channel_name)

@sio.event
async def join_teacher_channel(sid, data):
    room_id = data.get("room_id", "").strip().upper()
    if room_id:
        channel_name = f"room:{room_id}"
        await sio.enter_room(sid, channel_name)

# -------------------------------------------------------------
# Serve Static Client Bundle in Production (Single Service)
# -------------------------------------------------------------
CLIENT_DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "dist")

if os.path.isdir(CLIENT_DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(CLIENT_DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(CLIENT_DIST_DIR, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(CLIENT_DIST_DIR, "index.html"))

# Combine FastAPI and Socket.IO ASGI App
asgi_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Teacher Register server starting on http://localhost:{port}")
    uvicorn.run("main:asgi_app", host="0.0.0.0", port=port, reload=True)
