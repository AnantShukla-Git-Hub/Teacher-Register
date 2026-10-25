const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'register.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT DEFAULT '',
      room_id TEXT UNIQUE NOT NULL,
      room_password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL,
      roll_no TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
      UNIQUE (classroom_id, roll_no)
    );

    CREATE TABLE IF NOT EXISTS custom_columns (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL,
      title TEXT NOT NULL,
      column_type TEXT DEFAULT 'text',
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE (classroom_id, student_id, date)
    );

    CREATE TABLE IF NOT EXISTS student_marks (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      column_id TEXT NOT NULL,
      value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES custom_columns(id) ON DELETE CASCADE,
      UNIQUE (student_id, column_id)
    );

    CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_classrooms_room_id ON classrooms(room_id);
    CREATE INDEX IF NOT EXISTS idx_students_classroom ON students(classroom_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON attendance_records(classroom_id, date);
    CREATE INDEX IF NOT EXISTS idx_marks_student ON student_marks(student_id);
  `);

  console.log('Database initialized successfully at:', dbPath);
}

initDb();

module.exports = db;
