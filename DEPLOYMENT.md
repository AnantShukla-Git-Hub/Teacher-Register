# Free & Professional Deployment Guide

This guide walks you through deploying **Teacher Register** as a single unified service for **100% free** with **zero configuration headaches** (as specified in your submitted synopsis).

---

## Why Render.com?
- **100% Free Tier** (no credit card required).
- **Single-Service Architecture**: FastAPI serves both the APIs/WebSockets and the pre-built React application from a single URL, completely eliminating CORS errors.
- **Full WebSocket / Socket.IO Support**: Real-time live sync works seamlessly.
- **Free Automatic HTTPS**: Provides a secure `https://...` domain automatically.

---

## Step 1: Push Your Code to GitHub

Open a terminal in your project directory:

```bash
cd C:\Users\anant\.gemini\antigravity\scratch\teacher-register

# 1. Check git status
git status

# 2. Add your GitHub repository as remote (replace with your GitHub repository link)
git remote add origin https://github.com/AnantShukla-Git-Hub/Teacher-Register.git

# 3. Rename branch to main if needed and push
git branch -M main
git push -u origin main --force
```

---

## Step 2: Create Free Web Service on Render

1. Go to **[https://render.com](https://render.com)** and Sign In with your GitHub account.
2. On your Render Dashboard, click the blue **"New +"** button at top right and choose **"Web Service"**.
3. Select your repository: **`Teacher-Register`** and click **Connect**.
4. Fill in the following exact settings:
   - **Name**: `teacher-register` *(or any name you prefer)*
   - **Region**: `Singapore` or `Oregon` *(Singapore is fastest for India)*
   - **Branch**: `main`
   - **Root Directory**: *(leave blank)*
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r server/requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn server.main:asgi_app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: Select **Free** ($0 / month).

5. Click **"Deploy Web Service"** at the bottom.

---

## Step 3: Your App is Live!

- Render will automatically install the requirements and launch your server in approximately **1 to 2 minutes**.
- Once the log says `Application startup complete`, your app is live at:  
  👉 **`https://teacher-register.onrender.com`** *(or your chosen name)*.

---

## Live Sessional Presentation Tips
- **Share Live URL with Guide & Classmates**: Ahmad Hasan sir or your classmates can open the URL directly on their mobile phones using their mobile network or college Wi-Fi.
- **Test Real-Time Live Sync on Phones**:
  1. Open the Instructor Portal on your laptop and mark attendance.
  2. Open the Student Portal on your phone (Room ID, Password, Roll Number).
  3. Change attendance status on your laptop and watch the student's phone screen update in real time without refreshing!
