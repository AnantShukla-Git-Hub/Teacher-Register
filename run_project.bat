@echo off
title Teacher Register - ICS 354 Mini Project (IET Lucknow)
echo =====================================================================
echo           TEACHER REGISTER - MINI PROJECT (ICS 354)
echo     Institute of Engineering and Technology (IET), Lucknow
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Python virtual environment...
if not exist "venv\Scripts\python.exe" (
    echo Error: Virtual environment not found. Creating venv...
    python -m venv venv
    call venv\Scripts\pip install -r server\requirements.txt
)

echo [2/3] Checking client production build...
if not exist "client\dist\index.html" (
    echo Building React client...
    cd client
    call npm install
    call npm run build
    cd ..
)

echo.
echo [3/3] Starting Unified FastAPI + Socket.IO Server...
echo ---------------------------------------------------------------------
echo  Application is running at: http://localhost:8000
echo.
echo  - Instructor Portal: Sign in with demo profile or Google
echo  - Student Portal: Enter Room ID, Password, and Roll Number
echo  - Live Socket.IO updates are active on channels
echo ---------------------------------------------------------------------
echo.

venv\Scripts\python.exe -m uvicorn server.main:asgi_app --host 0.0.0.0 --port 8000 --reload
pause
