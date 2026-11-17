# Teacher Register
### A Web-Based Classroom Attendance Register and Continuous Assessment System

## Problem Statement & Objectives
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

##  Technology Stack
- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons.
- **Backend:** Python 3.13 with FastAPI (High-performance ASGI REST APIs).
- **Real-Time Engine:** `python-socketio` (Channel-scoped WebSocket rooms).
- **Database:** SQLite3 (Serverless, file-based relational storage with foreign key constraints).
- **Authentication:** JWT Sessions + Google Identity Services (with quick-viva presentation mode).
- **Deployment Architecture:** Unified single-service deployment where FastAPI serves the compiled client bundle.

---

##  Quick Start (Running Locally)

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

## Quick Walkthrough

### 1. Teacher Registration & Classroom Creation
1. Open `http://localhost:8000` (or your deployed URL).
2. Under the **Teacher / Instructor** tab:
   - Click **"Register New Account"** to create an instructor account with your name, academic title, email, and password.
   - Or click **"Login"** if you already have an account.
3. In the Teacher Dashboard, click **"+ Create New Classroom"**:
   - Example Room ID: `CSE-3A`
   - Classroom Name: `Web Engineering Mini Project`
   - Classroom Password: `iet123`
4. Click **"Open Register"** to enter the attendance ledger.
5. Click **"Import Roster"** and upload or paste the provided **`students_70.csv`** (contains 70 enrolled students).

### 2. Marking Attendance & Date Management
- **Today's Attendance**: Click the **"+ Add Today (IST)"** button to instantly add a lecture column with the current Indian Standard Time date.
- **Single-Click Stamps**: Click any cell to stamp **P** (Present), **A** (Absent), or **L** (Late).
- **Date Editor**: Click any date header in the register table or use the Date Editor to inspect that day's lecture and use batch actions (**"Mark All Present"** / **"Mark All Absent"**).
- **Shortage PDF Report**: Click **"Download Shortage PDF"**, enter the minimum required percentage (e.g., 75%), and generate an official printable shortage report with signature lines.
- **Export Register**: Click **"Export CSV"** to download the full ledger into Excel.

### 3. Student Portal & Real-Time Sync
1. Open an incognito window or open the site on a mobile phone.
2. Select the **Student Access** tab:
   - Room ID: `CSE-3A`
   - Room Password: `iet123`
   - Roll Number: `2500520100112` (Anant Shukla)
3. Click **"Enter Student Portal"**.
4. Observe the AKTU 75% compliance indicator, lecture history, and continuous assessment marks.
5. When the teacher marks attendance on the instructor window, the student's screen **updates live in real time via Socket.IO** without refreshing!
