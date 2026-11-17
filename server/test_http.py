"""
Teacher Register - HTTP & API Integration Test
Spins up uvicorn server, makes live HTTP calls, verifies endpoints and static frontend serving.
"""

import subprocess
import time
import requests
import sys
import os

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PYTHON = os.path.join(os.path.dirname(SERVER_DIR), "venv", "Scripts", "python.exe")

def run_http_tests():
    print("Starting FastAPI + Socket.IO server on port 8000...")
    proc = subprocess.Popen(
        [VENV_PYTHON, "-m", "uvicorn", "main:asgi_app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=SERVER_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    try:
        # Give server time to bind
        time.sleep(2.5)

        base_url = "http://127.0.0.1:8000"

        # 1. Test Static Frontend Serving (Single Service deployment)
        print("Testing Root URL (GET /)...")
        res = requests.get(base_url, timeout=5)
        assert res.status_code == 200
        assert "Teacher Register" in res.text
        print("[OK] Root serves built React application successfully!")

        # 2. Test Teacher Demo Auth
        print("Testing Teacher Demo Login (POST /api/auth/teacher)...")
        auth_res = requests.post(
            f"{base_url}/api/auth/teacher",
            json={"email": "ahmad.hasan@ietlucknow.ac.in", "password": "teacher123", "name": "Dr. Ahmad Hasan", "title": "Prof."},
            timeout=5
        )
        assert auth_res.status_code == 200
        auth_data = auth_res.json()
        assert "token" in auth_data
        token = auth_data["token"]
        print("[OK] Teacher Auth returned valid token!")

        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Classroom under this teacher
        print("Creating classroom CSE-3A...")
        create_res = requests.post(
            f"{base_url}/api/classrooms",
            headers=headers,
            json={"room_id": "CSE-3A", "room_name": "Computer Networks Lab", "room_password": "iet123"},
            timeout=5
        )
        # If already exists from earlier test, 400 is fine
        print("Classroom create response:", create_res.status_code)

        # 4. Add Students
        print("Adding students to CSE-3A...")
        roster_res = requests.post(
            f"{base_url}/api/classrooms/CSE-3A/students",
            headers=headers,
            json={"students": [
                {"roll_no": "2500520100112", "name": "Anant Shukla"},
                {"roll_no": "2500520100131", "name": "Harsh Vardhan Singh"}
            ]},
            timeout=5
        )
        assert roster_res.status_code == 200
        print("[OK] Students added to CSE-3A!")

        # 5. Add Session
        print("Adding session to CSE-3A...")
        sess_res = requests.post(
            f"{base_url}/api/classrooms/CSE-3A/sessions",
            headers=headers,
            json={"session_date": "2026-11-17", "title": "Socket.IO Architecture"},
            timeout=5
        )
        assert sess_res.status_code == 200
        sess_id = sess_res.json()["session_id"]
        print("[OK] Session created with ID:", sess_id)

        # 6. Test Student Login
        print("Testing Student Login (POST /api/student/login)...")
        stu_res = requests.post(
            f"{base_url}/api/student/login",
            json={"room_id": "CSE-3A", "room_password": "iet123", "roll_no": "2500520100112"},
            timeout=5
        )
        assert stu_res.status_code == 200
        stu_data = stu_res.json()
        assert stu_data["student"]["name"] == "Anant Shukla"
        print(f"[OK] Student Login verified for {stu_data['student']['name']}!")

        # 7. Test Student Dashboard
        print("Testing Student Dashboard (GET /api/student/dashboard)...")
        dash_res = requests.get(
            f"{base_url}/api/student/dashboard?room_id=CSE-3A&roll_no=2500520100112",
            timeout=5
        )
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert dash_data["stats"]["percentage"] == 100.0
        assert dash_data["stats"]["is_compliant"] is True
        print("[OK] Student Dashboard calculation and compliance returned accurately!")

        # 8. Test CSV Export
        print("Testing CSV Register Export (GET /api/classrooms/CSE-3A/export)...")
        csv_res = requests.get(f"{base_url}/api/classrooms/CSE-3A/export", headers=headers, timeout=5)
        assert csv_res.status_code == 200
        assert "Roll No,Student Name" in csv_res.text
        assert "Anant Shukla" in csv_res.text
        print("[OK] CSV Export returned valid tabular register data!")

        print("\n==========================================")
        print("ALL HTTP AND FULL-STACK TESTS PASSED 100%!")
        print("==========================================")

    finally:
        print("Terminating test server...")
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_http_tests()
