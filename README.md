# Teacher Register

A simple, real-time classroom attendance register and continuous assessment system designed with an archival paper aesthetic.

**Live Application:** [https://teacher-register.onrender.com](https://teacher-register.onrender.com)

---

## Overview

Teacher Register replicates the feel of a traditional classroom register ledger while providing instant real-time synchronization between instructors and students.

### For Teachers
- **Google Sign-In**: Authenticate using your Google account.
- **Classroom Management**: Create classrooms with custom or auto-generated Room IDs and passwords.
- **Ruled Register Grid**: Mark attendance with one-click mechanical stamp markers: Present (P), Absent (A), and Late (L).
- **Roster Management**: Import student lists via CSV or add students individually.
- **Continuous Assessment**: Add parallel evaluation columns (e.g., Assignment 1, Quiz, Midterm) and update marks inline.
- **Batch Actions**: Mark all students present with one click, search/filter the register, and export data to CSV.

### For Students
- **Instant Access**: Join with Room ID, Password, and your class roll number (e.g., 1, 2, 3... or college roll number).
- **Live Sync**: See attendance status updates the moment your instructor marks them.
- **Private Evaluation Record**: Strict channel isolation ensures students only see their own attendance percentage, session history, and assessment scores.

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Backend**: Node.js, Express
- **Real-Time Engine**: Socket.IO (channel-scoped WebSocket subscriptions)
- **Database**: SQLite (better-sqlite3)
- **Authentication**: Google OAuth 2.0 (google-auth-library) with JWT session tokens

---

## Getting Started Locally

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

```bash
# Clone repository
git clone https://github.com/AnantShukla-Git-Hub/Teacher-Register.git
cd Teacher-Register

# Install dependencies and build client
npm install
npm run build

# Start server
npm start
```

The application will be available at `http://localhost:5000`.

### Development Mode

To run both backend and Vite client with hot reloading:

```bash
npm run dev
```

- Client: `http://localhost:5173`
- Backend: `http://localhost:5000`

---

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## License

MIT License.
