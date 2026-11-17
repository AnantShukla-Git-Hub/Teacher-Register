# Teacher Register
### A Web-Based Classroom Attendance Register and Continuous Assessment System
**Mini Project (ICS 354) — B.Tech Computer Science and Engineering | Session 2026-27**  
*Department of Computer Science and Engineering, Institute of Engineering and Technology (IET), Lucknow*  
*Affiliated with Dr. APJ Abdul Kalam Technical University (AKTU), Uttar Pradesh*

---

## 👥 Project Team & Guidance
- **Project Guide:** Ahmad Hasan
- **Submitted By:**
  1. **Anant Shukla** (Roll No: 2500520100112)
  2. **Harsh Vardhan Singh Kushwaha** (Roll No: 2500520100131)
  3. **Indresh Pratap Singh** (Roll No: 2500520100132)
  4. **Kunal Singh** (Roll No: 2500520100137)

---

## 📌 Problem Statement & Objectives
Traditional classroom attendance and internal assessment marks are recorded in paper registers or disconnected spreadsheets, leading to calculation errors, lack of auditability, and delayed alerts to students regarding attendance shortages. Hardware-based systems (biometrics/RFID) are costly and do not integrate continuous assessment.

**Teacher Register solves this by providing:**
1. A **physical register-style ruled ledger** with single-click **P** (Present), **A** (Absent), and **L** (Late) stamp marking.
2. Parallel **continuous assessment columns** (e.g., Assignment 1, Quiz, Midterms) editable inline like a spreadsheet.
3. **Bulk roster import** via CSV (up to 2,000 students) and full-register CSV export.
4. **Student portal requiring zero account creation** (login using Room ID, Room Password, and Roll Number).
5. **Real-time live synchronization** via Socket.IO WebSocket private rooms (`room:ROOM_ID:student:ROLL_NO`).
6. **AKTU 75% Compliance Indicator** alerting students instantly if they fall below the examination eligibility threshold.
7. **Security**: IP-based rate limiting on student logins and verified Google / JWT session tokens.

---

## 🛠️ Technology Stack
- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons.
- **Backend:** Python 3.13 with FastAPI (High-performance ASGI REST APIs).
- **Real-Time Engine:** `python-socketio` (Channel-scoped WebSocket rooms).
- **Database:** SQLite3 (Serverless, file-based relational storage with foreign key constraints).
- **Authentication:** JWT Sessions + Google Identity Services (with quick-viva presentation mode).
- **Deployment Architecture:** Unified single-service deployment where FastAPI serves the compiled client bundle.

---

## 🚀 Quick Start (Running Locally)

### 1. One-Click Launch (Windows)
Double-click `run_project.bat` in the project root folder. It automatically verifies the virtual environment, checks the build, and starts the server at:
👉 **`http://localhost:8000`**

### 2. Manual Terminal Launch
```bash
# 1. Activate Python virtual environment
.\venv\Scripts\activate

# 2. Start the unified FastAPI + Socket.IO server
uvicorn server.main:asgi_app --host 127.0.0.1 --port 8000 --reload
```
Open **`http://localhost:8000`** in your browser.

---

## 🧪 Testing with Demo Data
1. Click **Teacher Sign-In** on the top right.
2. Select **"Enter Instructor Dashboard"** (pre-loaded with *Dr. Ahmad Hasan* profile).
3. Open classroom **`CSE-3A`** (Password: `iet123`).
4. Click **Import Roster** $\to$ upload or copy the provided `sample_roster.csv` in the root folder.
5. In another tab or private window, go to **Student Portal**:
   - Room ID: `CSE-3A`
   - Room Password: `iet123`
   - Roll No: `2500520100112` (Anant Shukla)
6. Back in the teacher window, click the attendance stamp or edit midterm marks:
   - Notice the student tab **updates live in real time without refreshing the page!**

---

## 🎓 Sessional Exam Viva Cheatsheet (Common Examiner Questions)

### Q1: Why did you choose SQLite instead of MySQL or MongoDB?
> **Answer:** SQLite is serverless, zero-configuration, and stores data in a single local database file (`teacher_register.db`). For a classroom attendance system with up to 2,000 students per class, SQLite is faster than client-server databases because it eliminates network latency between the application and database. It fully supports ACID transactions and foreign keys (`PRAGMA foreign_keys = ON;`).

### Q2: How does the real-time live update work without refreshing?
> **Answer:** We used **Socket.IO over WebSockets**. When an instructor clicks to mark attendance or enters a score, the FastAPI backend saves it to SQLite and broadcasts a targeted event to a private channel scoped specifically to that student: `room:{ROOM_ID}:student:{ROLL_NO}`. The student's browser receives this event via WebSocket and updates the UI state immediately.

### Q3: How do you prevent one student from viewing another student's marks?
> **Answer:** Students do not subscribe to a global classroom channel. They subscribe **only** to their private channel `room:ROOM_ID:student:ROLL_NO`. The backend emits individual marks and attendance updates only to that specific channel room, ensuring strict channel-level privacy.

### Q4: How is the 75% compliance threshold computed?
> **Answer:** The backend calculates attendance percentage using:
> $$\text{Attendance } \% = \left(\frac{\text{Classes Attended (Present + Late)}}{\text{Total Sessions Held}}\right) \times 100$$
> If $\text{Percentage} \ge 75.0\%$, the student status is flagged as **COMPLIANT** (Green). If $< 75.0\%$, the system displays a **SHORTAGE ALERT** (Red) warning the student to attend upcoming lectures to maintain university exam eligibility.

### Q5: What security measures did you implement?
> 1. **IP-based Rate Limiter**: Student login limits failed attempts to 5 per minute per IP to prevent brute-force dictionary attacks against classroom passwords.
> 2. **Cryptographic JWT Tokens**: Teacher sessions are signed using HS256 JWT tokens.
> 3. **SQL Injection Prevention**: Parameterized queries are used for all SQLite executions (`?` placeholders).
