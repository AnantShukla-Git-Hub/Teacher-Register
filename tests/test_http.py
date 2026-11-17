"""
Teacher Register - HTTP & API Integration Test
Spins up uvicorn server, makes live HTTP calls, verifies endpoints and static frontend serving.
"""

import subprocess
import time
import requests
import sys
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER_DIR = os.path.join(ROOT_DIR, "server")
VENV_PYTHON = os.path.join(ROOT_DIR, "venv", "Scripts", "python.exe")

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
        time.sleep(3.0)

        base_url = "http://127.0.0.1:8000"

        # 1. Test Static Frontend Serving (Single Service deployment)
        print("Testing Root URL (GET /)...")
        res = requests.get(base_url, timeout=5)
        assert res.status_code == 200
        assert "Teacher Register" in res.text
        print("[OK] Root serves built React application successfully!")

        # 2. Test Teacher Auth (Register / Login)
        print("Testing Teacher Registration / Login...")
        reg_res = requests.post(
            f"{base_url}/api/auth/register",
            json={"email": "guide.test@ietlucknow.ac.in", "password": "securepassword123", "name": "Dr. Ahmad Hasan", "title": "Prof."},
            timeout=5
        )
        if reg_res.status_code == 200:
            token = reg_res.json()["token"]
            print("[OK] Teacher registered successfully!")
        else:
            # Login if already registered
            login_res = requests.post(
                f"{base_url}/api/auth/login",
                json={"email": "guide.test@ietlucknow.ac.in", "password": "securepassword123"},
                timeout=5
            )
            assert login_res.status_code == 200
            token = login_res.json()["token"]
            print("[OK] Teacher logged in successfully!")

        headers = {"Authorization": f"Bearer {token}"}

        # 3. Create Classroom under this teacher
        room_code = "CSE-HTTP-3A"
        print(f"Creating classroom {room_code}...")
        create_res = requests.post(
            f"{base_url}/api/classrooms",
            headers=headers,
            json={"room_id": room_code, "room_name": "Computer Networks Lab", "room_password": "iet123"},
            timeout=5
        )
        print("Classroom create response:", create_res.status_code)

        # 4. Add Students
        print(f"Adding students to {room_code}...")
        roster_res = requests.post(
            f"{base_url}/api/classrooms/{room_code}/students",
            headers=headers,
            json={"students": [
                {"roll_no": "2500520100112", "name": "Anant Shukla"},
                {"roll_no": "2500520100131", "name": "Harsh Vardhan Singh"}
            ]},
            timeout=5
        )
        assert roster_res.status_code == 200
        print(f"[OK] Students added to {room_code}!")

        # 5. Add Session
        print(f"Adding session to {room_code}...")
        sess_res = requests.post(
            f"{base_url}/api/classrooms/{room_code}/sessions",
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
            json={"room_id": room_code, "room_password": "iet123", "roll_no": "2500520100112"},
            timeout=5
        )
        assert stu_res.status_code == 200
        stu_data = stu_res.json()
        assert stu_data["student"]["name"] == "Anant Shukla"
        print(f"[OK] Student Login verified for {stu_data['student']['name']}!")

        # 7. Test Student Dashboard
        print("Testing Student Dashboard (GET /api/student/dashboard)...")
        dash_res = requests.get(
            f"{base_url}/api/student/dashboard?room_id={room_code}&roll_no=2500520100112",
            timeout=5
        )
        assert dash_res.status_code == 200
        dash_data = dash_res.json()
        assert dash_data["stats"]["percentage"] == 100.0
        assert dash_data["stats"]["is_compliant"] is True
        print("[OK] Student Dashboard calculation and compliance returned accurately!")

        # 8. Test CSV Export
        print(f"Testing CSV Register Export (GET /api/classrooms/{room_code}/export)...")
        csv_res = requests.get(f"{base_url}/api/classrooms/{room_code}/export", headers=headers, timeout=5)
        assert csv_res.status_code == 200
        assert "Roll No,Student Name" in csv_res.text
        assert "Anant Shukla" in csv_res.text
        print("[OK] CSV Export returned valid tabular register data!")

        # 9. Test Shortage PDF Generation
        print(f"Testing Attendance Shortage PDF Report (GET /api/classrooms/{room_code}/shortage-pdf)...")
        pdf_res = requests.get(f"{base_url}/api/classrooms/{room_code}/shortage-pdf?threshold=75", headers=headers, timeout=5)
        assert pdf_res.status_code == 200
        assert pdf_res.headers.get("content-type") == "application/pdf"
        assert len(pdf_res.content) > 500
        print("[OK] Shortage PDF generated successfully with binary stream!")

        print("\n==========================================")
        print("ALL HTTP AND FULL-STACK TESTS PASSED 100%!")
        print("==========================================")

    finally:
        print("Terminating test server...")
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_http_tests()
