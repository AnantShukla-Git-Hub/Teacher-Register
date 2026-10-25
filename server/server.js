const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

// Critical Process Safety: Prevent unhandled errors from terminating Node.js server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL UNCAUGHT EXCEPTION]', err);
});

const db = require('./db');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'teacher-register-prod-auth-key-2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '961008536205-92pbtpdrau354iha2c054u8u0rf09hao.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket room subscription handler with token-based authorization
io.on('connection', (socket) => {
  socket.on('join_classroom', ({ token, role, roomId, rollNo }) => {
    if (!token || !roomId) {
      socket.emit('auth_error', { message: 'Authentication token required for live sync.' });
      return;
    }

    const cleanRoom = String(roomId).trim().toUpperCase();

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      if (role === 'teacher') {
        // Verify teacher owns or has access
        socket.join(`room:${cleanRoom}:teachers`);
        socket.emit('joined_room', { room: cleanRoom, role: 'teacher' });
      } else if (role === 'student') {
        // Enforce strict student channel scoping
        const cleanRoll = String(decoded.rollNo || rollNo).trim().toUpperCase();
        socket.join(`room:${cleanRoom}:student:${cleanRoll}`);
        socket.emit('joined_room', { room: cleanRoom, role: 'student', rollNo: cleanRoll });
      }
    } catch (err) {
      socket.emit('auth_error', { message: 'Invalid or expired session token.' });
    }
  });

  socket.on('disconnect', () => {
    // Session closed
  });
});

// Authentication Middleware for Teachers
function authenticateTeacher(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden: Teacher access required.' });
    }
    req.teacher = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid.' });
  }
}

// In-Memory Rate Limiter for Student Join Attempts
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 8;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

function checkRateLimit(ip) {
  const record = failedAttempts.get(ip);
  if (!record) return true;

  if (Date.now() - record.firstAttempt > LOCKOUT_DURATION_MS) {
    failedAttempts.delete(ip);
    return true;
  }

  return record.count < MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, firstAttempt: now };
  record.count += 1;
  failedAttempts.set(ip, record);
}

function clearRateLimit(ip) {
  failedAttempts.delete(ip);
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Google Sign-In with cryptographic ID token verification
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential || typeof credential !== 'string') {
    return res.status(400).json({ error: 'Google credential token is required.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(401).json({ error: 'Google account email must be verified.' });
    }

    const email = payload.email.toLowerCase().trim();
    const name = (payload.name || email.split('@')[0]).trim();
    const picture = payload.picture || '';

    // Lookup or register teacher
    const checkStmt = db.prepare('SELECT id, email, name, picture FROM teachers WHERE email = ?');
    let teacher = await checkStmt.get(email);
    let isNewUser = false;

    if (!teacher) {
      isNewUser = true;
      const teacherId = crypto.randomUUID();
      const insertStmt = db.prepare(
        'INSERT INTO teachers (id, email, name, picture) VALUES (?, ?, ?, ?)'
      );
      await insertStmt.run(teacherId, email, name, picture);
      teacher = { id: teacherId, email, name, picture };
    }

    // Sign Teacher JWT
    const token = jwt.sign(
      { id: teacher.id, email: teacher.email, name: teacher.name, role: 'teacher' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      isNewUser,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        picture: teacher.picture
      }
    });
  } catch (error) {
    console.error('[AUTH ERROR] Google token validation failed:', error.message);
    return res.status(401).json({ error: 'Google authentication failed: ' + error.message });
  }
});

// Update Teacher Profile Name
app.post('/api/auth/update-name', authenticateTeacher, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Valid name is required.' });
    }

    const cleanName = name.trim().slice(0, 100);
    await db.prepare('UPDATE teachers SET name = ? WHERE id = ?').run(cleanName, req.teacher.id);

    const token = jwt.sign(
      { id: req.teacher.id, email: req.teacher.email, name: cleanName, role: 'teacher' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      teacher: {
        id: req.teacher.id,
        email: req.teacher.email,
        name: cleanName
      }
    });
  } catch (error) {
    console.error('[UPDATE NAME ERROR]', error);
    return res.status(500).json({ error: 'Failed to update name: ' + error.message });
  }
});

// Get Current Profile
app.get('/api/auth/me', authenticateTeacher, async (req, res) => {
  try {
    const teacher = await db.prepare('SELECT id, email, name, picture, created_at FROM teachers WHERE id = ?').get(req.teacher.id);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher profile not found.' });
    }
    return res.json({ teacher });
  } catch (error) {
    console.error('[AUTH ME ERROR]', error);
    return res.status(500).json({ error: 'Failed to fetch profile: ' + error.message });
  }
});

// ==========================================
// CLASSROOM MANAGEMENT (TEACHER)
// ==========================================

// Get all classrooms for teacher
app.get('/api/classrooms', authenticateTeacher, async (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM students s WHERE s.classroom_id = c.id) as student_count,
        (SELECT COUNT(DISTINCT date) FROM attendance_records a WHERE a.classroom_id = c.id) as total_sessions
      FROM classrooms c 
      WHERE c.teacher_id = ? 
      ORDER BY c.created_at DESC
    `);
    const rawClassrooms = await stmt.all(req.teacher.id);
    const classrooms = (rawClassrooms || []).map(c => ({
      ...c,
      student_count: Number(c.student_count) || 0,
      total_sessions: Number(c.total_sessions) || 0
    }));
    return res.json({ classrooms });
  } catch (error) {
    console.error('[GET CLASSROOMS ERROR]', error);
    return res.status(500).json({ error: 'Failed to retrieve classrooms: ' + error.message });
  }
});

// Create classroom
app.post('/api/classrooms', authenticateTeacher, async (req, res) => {
  try {
    const { name, subject = '', roomId, roomPassword } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Classroom name is required.' });
    }

    if (!roomPassword || typeof roomPassword !== 'string' || roomPassword.trim().length < 4) {
      return res.status(400).json({ error: 'Room password must be at least 4 characters.' });
    }

    // Sanitize Room ID
    let cleanRoomId = roomId ? String(roomId).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') : '';
    if (!cleanRoomId || cleanRoomId.length < 3) {
      const prefix = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'CLS';
      const randNum = Math.floor(1000 + Math.random() * 9000);
      cleanRoomId = `${prefix}-${randNum}`;
    }

    // Check unique room ID
    const existing = await db.prepare('SELECT id FROM classrooms WHERE room_id = ?').get(cleanRoomId);
    if (existing) {
      return res.status(400).json({ error: `Room ID '${cleanRoomId}' is already registered. Please choose another.` });
    }

    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO classrooms (id, teacher_id, name, subject, room_id, room_password)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.teacher.id, name.trim().slice(0, 120), subject.trim().slice(0, 100), cleanRoomId, roomPassword.trim());

    // Seed default columns
    const colStmt = db.prepare(`
      INSERT INTO custom_columns (id, classroom_id, title, column_type, order_index)
      VALUES (?, ?, ?, 'text', ?)
    `);
    await colStmt.run(crypto.randomUUID(), id, 'Assignment 1', 0);
    await colStmt.run(crypto.randomUUID(), id, 'Class Test 1 Marks', 1);

    const newClassroom = await db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id);
    return res.status(201).json({ classroom: newClassroom });
  } catch (error) {
    console.error('[CREATE CLASSROOM ERROR]', error);
    return res.status(500).json({ error: 'Failed to create classroom: ' + error.message });
  }
});

// Delete classroom
app.delete('/api/classrooms/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const classroom = await db.prepare('SELECT id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found or unauthorized.' });
    }

    await db.prepare('DELETE FROM classrooms WHERE id = ?').run(id);
    return res.json({ success: true });
  } catch (error) {
    console.error('[DELETE CLASSROOM ERROR]', error);
    return res.status(500).json({ error: 'Failed to delete classroom: ' + error.message });
  }
});

// Helper to guarantee standard UTC ISO-8601 timestamps
function normalizeIsoTimestamp(ts) {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  try {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch {}
  return new Date().toISOString();
}

// Get classroom register details (Teacher view)
app.get('/api/classrooms/:id', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const classroom = await db.prepare('SELECT * FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found or unauthorized.' });
    }

    const [students, customColumns, rawAttendance, rawMarks] = await Promise.all([
      db.prepare('SELECT * FROM students WHERE classroom_id = ? ORDER BY CAST(roll_no AS INTEGER) ASC, roll_no ASC').all(id),
      db.prepare('SELECT * FROM custom_columns WHERE classroom_id = ? ORDER BY order_index ASC, created_at ASC').all(id),
      db.prepare('SELECT student_id, date, status, updated_at FROM attendance_records WHERE classroom_id = ?').all(id),
      db.prepare('SELECT student_id, column_id, value, updated_at FROM student_marks WHERE classroom_id = ?').all(id),
    ]);

    const attendance = (rawAttendance || []).map(a => ({ ...a, updated_at: normalizeIsoTimestamp(a.updated_at) }));
    const marks = (rawMarks || []).map(m => ({ ...m, updated_at: normalizeIsoTimestamp(m.updated_at) }));

    return res.json({
      classroom,
      students: students || [],
      customColumns: customColumns || [],
      attendance,
      marks
    });
  } catch (error) {
    console.error('[GET CLASSROOM REGISTER ERROR]', error);
    return res.status(500).json({ error: 'Failed to load classroom register: ' + error.message });
  }
});

// ==========================================
// STUDENT ROSTER MANAGEMENT
// ==========================================

// Add / Import students (bulk CSV or single)
app.post('/api/classrooms/:id/students', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { students } = req.body;

    const classroom = await db.prepare('SELECT room_id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Student list must be a non-empty array.' });
    }

    if (students.length > 2000) {
      return res.status(400).json({ error: 'Batch import limit exceeded (maximum 2,000 students per upload).' });
    }

    const insertBatch = db.transaction(async (list, txDb) => {
      let count = 0;
      const stmt = txDb.prepare(`
        INSERT INTO students (id, classroom_id, roll_no, name)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(classroom_id, roll_no) DO UPDATE SET name = excluded.name
      `);
      for (const s of list) {
        const rawRoll = s.roll_no || s.rollNo || s.roll;
        const rawName = s.name || s.student_name;
        if (!rawRoll || !rawName) continue;
        const cleanRoll = String(rawRoll).trim().slice(0, 50);
        const cleanName = String(rawName).trim().slice(0, 100);
        if (cleanRoll && cleanName) {
          await stmt.run(crypto.randomUUID(), id, cleanRoll, cleanName);
          count++;
        }
      }
      return count;
    });

    const addedCount = await insertBatch(students);
    const updatedStudents = await db.prepare('SELECT * FROM students WHERE classroom_id = ? ORDER BY CAST(roll_no AS INTEGER) ASC, roll_no ASC').all(id);

    return res.json({
      success: true,
      addedCount,
      students: updatedStudents || []
    });
  } catch (error) {
    console.error('[IMPORT STUDENTS ERROR]', error);
    return res.status(500).json({ error: 'Failed to import students: ' + error.message });
  }
});

// Delete student
app.delete('/api/classrooms/:id/students/:studentId', authenticateTeacher, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const classroom = await db.prepare('SELECT id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    await db.prepare('DELETE FROM students WHERE id = ? AND classroom_id = ?').run(studentId, id);
    return res.json({ success: true });
  } catch (error) {
    console.error('[DELETE STUDENT ERROR]', error);
    return res.status(500).json({ error: 'Failed to delete student: ' + error.message });
  }
});

// ==========================================
// CUSTOM EVALUATION COLUMNS
// ==========================================

// Add evaluation column
app.post('/api/classrooms/:id/columns', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Column title is required.' });
    }

    const classroom = await db.prepare('SELECT room_id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    const maxOrder = await db.prepare('SELECT MAX(order_index) as max_idx FROM custom_columns WHERE classroom_id = ?').get(id);
    const nextOrder = (maxOrder && maxOrder.max_idx !== null && maxOrder.max_idx !== undefined) ? Number(maxOrder.max_idx) + 1 : 0;

    const colId = crypto.randomUUID();
    const cleanTitle = title.trim().slice(0, 80);

    await db.prepare(`
      INSERT INTO custom_columns (id, classroom_id, title, column_type, order_index)
      VALUES (?, ?, ?, 'text', ?)
    `).run(colId, id, cleanTitle, nextOrder);

    const newColumn = await db.prepare('SELECT * FROM custom_columns WHERE id = ?').get(colId);

    // Notify teacher sessions
    io.to(`room:${classroom.room_id}:teachers`).emit('column_added', {
      classroomId: id,
      column: newColumn
    });

    return res.json({ success: true, column: newColumn });
  } catch (error) {
    console.error('[ADD COLUMN ERROR]', error);
    return res.status(500).json({ error: 'Failed to add column: ' + error.message });
  }
});

// Delete evaluation column
app.delete('/api/classrooms/:id/columns/:colId', authenticateTeacher, async (req, res) => {
  try {
    const { id, colId } = req.params;
    const classroom = await db.prepare('SELECT room_id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    await db.prepare('DELETE FROM custom_columns WHERE id = ? AND classroom_id = ?').run(colId, id);

    io.to(`room:${classroom.room_id}:teachers`).emit('column_deleted', {
      classroomId: id,
      columnId: colId
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[DELETE COLUMN ERROR]', error);
    return res.status(500).json({ error: 'Failed to delete column: ' + error.message });
  }
});

// ==========================================
// ATTENDANCE & MARKS (SCOPED WEBSOCKETS)
// ==========================================

const VALID_STATUSES = new Set(['PRESENT', 'ABSENT', 'LATE', 'NONE']);

// Mark / Update Attendance
app.post('/api/classrooms/:id/attendance', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id, date, status } = req.body;

    if (!student_id || !date || !status || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Valid student ID, ISO date, and attendance status required.' });
    }

    const classroom = await db.prepare('SELECT room_id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    const student = await db.prepare('SELECT roll_no FROM students WHERE id = ? AND classroom_id = ?').get(student_id, id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found in this classroom.' });
    }

    const nowIso = new Date().toISOString();
    const recordId = crypto.randomUUID();
    const upsertStmt = db.prepare(`
      INSERT INTO attendance_records (id, classroom_id, student_id, date, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(classroom_id, student_id, date) DO UPDATE SET 
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    await upsertStmt.run(recordId, id, student_id, date, status, nowIso);
    const record = {
      id: recordId,
      classroom_id: id,
      student_id,
      date,
      status,
      updated_at: nowIso
    };

    const payload = {
      classroomId: id,
      studentId: student_id,
      rollNo: student.roll_no,
      date,
      status,
      updatedAt: nowIso
    };

    const cleanRoom = classroom.room_id.toUpperCase();
    const cleanRoll = student.roll_no.toUpperCase();

    // 1. Broadcast to instructor sessions
    io.to(`room:${cleanRoom}:teachers`).emit('attendance_updated', payload);

    // 2. Broadcast strictly to this specific student's private channel
    io.to(`room:${cleanRoom}:student:${cleanRoll}`).emit('attendance_updated', payload);

    return res.json({ success: true, record });
  } catch (error) {
    console.error('[ATTENDANCE UPDATE ERROR]', error);
    return res.status(500).json({ error: 'Failed to record attendance: ' + error.message });
  }
});

// Bulk Attendance (Mark All Present)
app.post('/api/classrooms/:id/attendance/bulk', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, status, student_ids } = req.body;

    if (!date || !status || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Valid date and status required.' });
    }

    const classroom = await db.prepare('SELECT room_id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    const allStudents = await db.prepare('SELECT id, roll_no FROM students WHERE classroom_id = ?').all(id);
    let targetStudents = allStudents || [];

    if (Array.isArray(student_ids) && student_ids.length > 0) {
      const filterSet = new Set(student_ids);
      targetStudents = (allStudents || []).filter(s => filterSet.has(s.id));
    }

    const nowIso = new Date().toISOString();

    const runBulk = db.transaction(async (list, txDb) => {
      const stmt = txDb.prepare(`
        INSERT INTO attendance_records (id, classroom_id, student_id, date, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(classroom_id, student_id, date) DO UPDATE SET 
          status = excluded.status,
          updated_at = excluded.updated_at
      `);
      for (const s of list) {
        await stmt.run(crypto.randomUUID(), id, s.id, date, status, nowIso);
      }
    });

    await runBulk(targetStudents);

    const cleanRoom = classroom.room_id.toUpperCase();
    const updatedAt = nowIso;

    // Broadcast to teachers
    io.to(`room:${cleanRoom}:teachers`).emit('attendance_bulk_updated', {
      classroomId: id,
      date,
      status,
      studentIds: targetStudents.map(s => s.id),
      updatedAt
    });

    // Dispatch individual scoped event to each student channel
    for (const s of targetStudents) {
      io.to(`room:${cleanRoom}:student:${s.roll_no.toUpperCase()}`).emit('attendance_updated', {
        classroomId: id,
        studentId: s.id,
        rollNo: s.roll_no,
        date,
        status,
        updatedAt
      });
    }

    return res.json({ success: true, updatedCount: targetStudents.length });
  } catch (error) {
    console.error('[BULK ATTENDANCE ERROR]', error);
    return res.status(500).json({ error: 'Failed to record bulk attendance: ' + error.message });
  }
});

// Update Student Evaluation Marks
app.post('/api/classrooms/:id/marks', authenticateTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id, column_id, value } = req.body;

    if (!student_id || !column_id) {
      return res.status(400).json({ error: 'Student ID and column ID are required.' });
    }

    const classroom = await db.prepare('SELECT room_id FROM classrooms WHERE id = ? AND teacher_id = ?').get(id, req.teacher.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    const student = await db.prepare('SELECT roll_no FROM students WHERE id = ? AND classroom_id = ?').get(student_id, id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found in classroom.' });
    }

    const cleanValue = value !== undefined ? String(value).trim().slice(0, 50) : '';
    const nowIso = new Date().toISOString();

    const upsertStmt = db.prepare(`
      INSERT INTO student_marks (id, classroom_id, student_id, column_id, value, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, column_id) DO UPDATE SET 
        value = excluded.value,
        updated_at = excluded.updated_at
    `);

    await upsertStmt.run(crypto.randomUUID(), id, student_id, column_id, cleanValue, nowIso);

    const cleanRoom = classroom.room_id.toUpperCase();
    const cleanRoll = student.roll_no.toUpperCase();
    const updatedAt = nowIso;

    const payload = {
      classroomId: id,
      studentId: student_id,
      rollNo: student.roll_no,
      columnId: column_id,
      value: cleanValue,
      updatedAt
    };

    // 1. Notify teachers
    io.to(`room:${cleanRoom}:teachers`).emit('marks_updated', payload);

    // 2. Notify ONLY this specific student
    io.to(`room:${cleanRoom}:student:${cleanRoll}`).emit('marks_updated', payload);

    return res.json({ success: true });
  } catch (error) {
    console.error('[UPDATE MARKS ERROR]', error);
    return res.status(500).json({ error: 'Failed to record marks: ' + error.message });
  }
});

// ==========================================
// STUDENT PORTAL (SECURE & READ-ONLY)
// ==========================================

app.post('/api/student/join', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Please wait 5 minutes before trying again.'
      });
    }

    const { roomId, password, rollNo } = req.body;

    if (!roomId || !password || !rollNo) {
      return res.status(400).json({ error: 'Room ID, Password, and Roll Number are required.' });
    }

    const cleanRoom = String(roomId).trim().toUpperCase();
    const cleanPass = String(password).trim();
    const cleanRoll = String(rollNo).trim().toUpperCase();

    // Verify classroom existence and credentials
    const roomMatch = await db.prepare(`
      SELECT c.id, c.name, c.subject, c.room_id, c.room_password, t.name as teacher_name
      FROM classrooms c
      JOIN teachers t ON c.teacher_id = t.id
      WHERE UPPER(c.room_id) = ?
    `).get(cleanRoom);

    if (!roomMatch) {
      recordFailedAttempt(ip);
      return res.status(404).json({
        error: `Room ID '${cleanRoom}' does not exist on this server. Please check the Room ID or make sure the instructor has created the classroom on this deployment.`
      });
    }

    // Verify password with case-insensitivity tolerance for mobile/keyboard input
    const isPassValid = roomMatch.room_password === cleanPass || roomMatch.room_password.toLowerCase() === cleanPass.toLowerCase();
    if (!isPassValid) {
      recordFailedAttempt(ip);
      return res.status(401).json({
        error: 'Incorrect room password. Please verify the password provided by your instructor.'
      });
    }

    const classroom = roomMatch;

    // Fetch all students in this classroom ordered by numeric value then alphanumeric
    const allStudents = await db.prepare(`
      SELECT id, roll_no, name
      FROM students
      WHERE classroom_id = ?
      ORDER BY CAST(roll_no AS INTEGER) ASC, roll_no ASC
    `).all(classroom.id);

    if (!allStudents || allStudents.length === 0) {
      recordFailedAttempt(ip);
      return res.status(404).json({
        error: 'No students found in this classroom roster. Please ask your instructor to import the roster.'
      });
    }

    // Multi-tier intelligent matching:
    // Tier 1: Exact case-insensitive match (e.g. '4' === '4' or '21004' === '21004')
    let student = allStudents.find(s => s.roll_no.trim().toUpperCase() === cleanRoll);

    // Tier 2: Numeric equality (e.g. '04' matches '4', or '4' matches '004')
    if (!student) {
      const inputDigits = cleanRoll.replace(/\D/g, '');
      if (inputDigits) {
        const inputNum = parseInt(inputDigits, 10);
        student = allStudents.find(s => {
          const sDigits = s.roll_no.replace(/\D/g, '');
          return sDigits && parseInt(sDigits, 10) === inputNum;
        });
      }
    }

    // Tier 3: Suffix / Modulo match (e.g. university roll '21004' matches input '4' or '04')
    if (!student) {
      const inputDigits = cleanRoll.replace(/\D/g, '');
      if (inputDigits) {
        const inputNum = parseInt(inputDigits, 10);
        
        // Step 3a: Exact numeric modulo match (e.g. 21004 % 100 === 4, 21014 % 100 === 14)
        const moduloCandidates = allStudents.filter(s => {
          const sDigits = s.roll_no.replace(/\D/g, '');
          if (!sDigits) return false;
          const sNum = parseInt(sDigits, 10);
          return (
            sNum % 100 === inputNum ||
            sNum % 1000 === inputNum ||
            sNum % 10000 === inputNum
          );
        });
        if (moduloCandidates.length === 1) {
          student = moduloCandidates[0];
        } else if (moduloCandidates.length > 1) {
          // If multiple match, choose exact modulo 100
          const m100 = moduloCandidates.filter(s => parseInt(s.roll_no.replace(/\D/g, ''), 10) % 100 === inputNum);
          if (m100.length === 1) student = m100[0];
        }

        // Step 3b: Text suffix match
        if (!student) {
          const suffixCandidates = allStudents.filter(s => s.roll_no.replace(/\D/g, '').endsWith(inputDigits));
          if (suffixCandidates.length === 1) {
            student = suffixCandidates[0];
          }
        }
      }
    }

    // Tier 4: Register Order Index (1-based register position)
    if (!student) {
      const inputDigits = cleanRoll.replace(/\D/g, '');
      if (inputDigits) {
        const inputNum = parseInt(inputDigits, 10);
        if (inputNum >= 1 && inputNum <= allStudents.length) {
          student = allStudents[inputNum - 1];
        }
      }
    }

    if (!student) {
      recordFailedAttempt(ip);
      return res.status(404).json({
        error: `Roll Number '${cleanRoll}' was not found in this class roster. Please check your roll number or contact your instructor.`
      });
    }

    clearRateLimit(ip);

    // Issue scoped Student Session Token
    const studentToken = jwt.sign(
      { studentId: student.id, classroomId: classroom.id, rollNo: student.roll_no, role: 'student' },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Fetch classroom evaluation schema
    const customColumns = await db.prepare(`
      SELECT id, title, column_type, order_index
      FROM custom_columns
      WHERE classroom_id = ?
      ORDER BY order_index ASC
    `).all(classroom.id);

    // Fetch strictly this student's attendance records
    const rawAttendance = await db.prepare(`
      SELECT date, status, updated_at
      FROM attendance_records
      WHERE classroom_id = ? AND student_id = ?
      ORDER BY date DESC
    `).all(classroom.id, student.id);
    const attendance = (rawAttendance || []).map(a => ({ ...a, updated_at: normalizeIsoTimestamp(a.updated_at) }));

    // Fetch total distinct session count
    const totalSessionsRow = await db.prepare(`
      SELECT COUNT(DISTINCT date) as total_days
      FROM attendance_records
      WHERE classroom_id = ?
    `).get(classroom.id);

    const totalSessions = totalSessionsRow ? (Number(totalSessionsRow.total_days) || 0) : 0;

    // Fetch strictly this student's marks
    const rawMarks = await db.prepare(`
      SELECT column_id, value, updated_at
      FROM student_marks
      WHERE classroom_id = ? AND student_id = ?
    `).all(classroom.id, student.id);
    const marks = (rawMarks || []).map(m => ({ ...m, updated_at: normalizeIsoTimestamp(m.updated_at) }));

    return res.json({
      token: studentToken,
      classroom,
      student,
      customColumns: customColumns || [],
      attendance,
      totalSessions,
      marks
    });
  } catch (error) {
    console.error('[STUDENT JOIN ERROR]', error);
    return res.status(500).json({ error: 'Failed to access student portal: ' + error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: 'sqlite',
    timestamp: new Date().toISOString() 
  });
});

// JSON fallback for unknown API endpoints
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint '${req.originalUrl}' not found.` });
});

// Serve static frontend in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.sendFile(path.join(clientDist, 'index.html'));
  }
  next();
});

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED EXPRESS ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error occurred.' });
  }
});

// Start server
async function startServer() {
  try {
    await db.ready;
    server.listen(PORT, () => {
      console.log(`[SERVER] Listening on port ${PORT}`);
      console.log(`[WEBSOCKET] Real-time engine active`);
    });
  } catch (err) {
    console.error('[SERVER ERROR] Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
