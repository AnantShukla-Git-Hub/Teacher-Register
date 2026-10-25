# Teacher Register

A high-performance classroom attendance register and continuous assessment system. Built with React 19, Vite, Tailwind CSS, Node.js Express, Socket.IO, and SQLite.

---

## System Overview

Teacher Register is designed for educational institutions requiring reliable, real-time classroom attendance tracking and assessment management without infrastructure overhead.

### Instructor Capabilities
- **Google OAuth Authentication**: Cryptographically verified sign-in using Google Identity Services (GSI).
- **First-Time Profile Initialization**: Automatic onboarding for instructor title and official name display.
- **Classroom Administration**: Creation and management of classrooms with unique Room IDs and passwords.
- **Interactive Register Sheet**: Real-life paper-style register grid with single-click Present (P), Absent (A), and Late (L) toggles.
- **CSV Roster Import**: Import student rosters with `Roll No` and `Name` headers in bulk (up to 2,000 students per batch).
- **Parallel Evaluation Columns**: Add custom columns (e.g., Assignment 1, Class Test 1 Marks, Midterm) with inline spreadsheet editing.
- **Batch Operations**: One-click "Mark All Present", search/filter, and full register CSV export.

### Student Capabilities (Read-Only Portal)
- **Zero Account Creation Overhead**: Students authenticate with Room ID, Room Password, and their official Roll Number.
- **Real-Time Live Updates**: Instant UI state reflection as the instructor marks attendance via scoped WebSocket channels.
- **Strict Data Privacy**: Network-level channel scoping ensures students can strictly view only their own records and scores.
- **Attendance Analytics**: Percentage calculations, compliance threshold indicators, and historical records.

---

## Architectural & Security Design

1. **Cryptographic Token Verification**: Google ID tokens are verified directly against Google's public key infrastructure using `google-auth-library`. Unverified tokens and spoofed signatures are strictly rejected.
2. **Channel-Scoped WebSockets**: Student connections subscribe exclusively to `room:<ROOM_ID>:student:<ROLL_NO>`. Evaluation marks and attendance updates for other roll numbers are never broadcast to unauthorized student connections.
3. **Brute-Force Rate Limiting**: The student authentication endpoint enforces IP-based rate limiting to prevent automated credential enumeration.
4. **Unified Deployment Model**: The Express service serves the compiled client bundle in production, eliminating cross-origin resource sharing (CORS) complications and multi-service failure points.

---

## Local Development

### Prerequisites
- Node.js (v18 or newer)
- npm (v9 or newer)

### Installation & Execution
From the project root:

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Launch development environment (Backend + Frontend concurrently)
npm run dev
```

- Client Application: `http://localhost:5173`
- Backend API & WebSockets: `http://localhost:5000`

### Production Build
```bash
npm run build
npm start
```

---

## Environment Configuration

Configure the following variables in `.env`:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secure-random-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

In Google Cloud Console, ensure the following origins are registered under **Authorized JavaScript origins**:
- `http://localhost:5173` (Local Client)
- `http://localhost:5000` (Local Server)
- `https://your-domain.onrender.com` (Production Host)

---

## License
MIT License. Clean, production-grade software for classroom management.
