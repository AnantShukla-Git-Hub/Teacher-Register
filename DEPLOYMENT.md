# Production Deployment Guide

This document outlines the hosting strategy for Teacher Register, detailing zero-cost deployment options with 24/7 WebSocket persistence and data durability.

---

## Technical Context: Addressing Previous Hosting Constraints

In typical cloud free tiers (e.g., Render, Railway), two operational constraints affect real-time classroom webapps:

1. **Instance Idle Timeout (Cold Starts)**: Free web services spin down after 15 minutes of inactivity. Resuming can incur 50–90 second latency, terminating active WebSocket connections.
2. **Ephemeral Disk Storage**: Virtual container restarts restore the disk image to its clean state, wiping local SQLite files unless mounted to a persistent volume or connected to an external managed database.

### Mitigation in This Application

- **Unified Single-Port Deployment**: The Node.js service serves the compiled Vite React client directly from `client/dist`. A single host URL handles HTTP and WebSocket connections, preventing cross-origin cookie failures and domain mismatches.
- **Continuous Keep-Alive Hook**: An unauthenticated `/api/health` endpoint is available to receive periodic heartbeat requests (e.g., via cron-job.org or UptimeRobot) every 10 minutes, preventing instance suspension.
- **Channel Scoping**: WebSocket traffic uses specific rooms (`room:<ROOM_ID>:student:<ROLL_NO>`), preventing data leakage across connected clients.

---

## Deployment Option 1: Render Web Service (Zero Cost)

1. **Source Repository**:
   - Push this codebase to your GitHub account as a private or public repository.

2. **Render Configuration**:
   - Sign in to [render.com](https://render.com).
   - Select **New** -> **Web Service**.
   - Connect your GitHub repository.
   - Configure build settings:
     - **Name**: `teacher-register`
     - **Environment**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`
     - **Instance Type**: `Free`

3. **Environment Variables**:
   Under the Environment tab in Render, configure:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `JWT_SECRET`: `[Generate a secure 64-character random string]`
   - `GOOGLE_CLIENT_ID`: `961008536205-92pbtpdrau354iha2c054u8u0rf09hao.apps.googleusercontent.com`

4. **Prevent Instance Inactivity**:
   - Register a free recurring monitor on [cron-job.org](https://cron-job.org) or [uptimerobot.com](https://uptimerobot.com).
   - Configure a GET request every 10 minutes to:
     `https://your-service-name.onrender.com/api/health`
   - This keeps the instance active, preserving WebSocket availability for active sessions.

---

## Deployment Option 2: Koyeb

1. Create a free account on [koyeb.com](https://www.koyeb.com).
2. Create an App connected to your GitHub repository.
3. Build command: `npm install && npm run build`
4. Run command: `npm start`
5. Port: `5000`
6. Set the same environment variables as above.

---

## Google Cloud Console Configuration

To permit authentication from your deployed application:

1. Open the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Select your OAuth 2.0 Web Client ID.
3. In **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (Local Vite development server)
   - `http://localhost:5000` (Local production server)
   - `https://your-service-name.onrender.com` (Your deployed Render URL)
4. Save the configuration. Changes generally propagate within 1 to 2 minutes.
