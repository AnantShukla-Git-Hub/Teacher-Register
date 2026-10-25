const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

let db = null;

if (DATABASE_URL) {
  // ==========================================
  // POSTGRESQL ENGINE (RENDER / NEON / SUPABASE)
  // ==========================================
  console.log('[DATABASE] Connecting to Cloud PostgreSQL database...');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Convert SQLite syntax to PostgreSQL
  function toPgSql(sql) {
    let paramIndex = 0;
    return sql
      .replace(/\?/g, () => `$${++paramIndex}`)
      .replace(/ORDER\s+BY\s+CAST\(roll_no\s+AS\s+INTEGER\)\s+ASC,\s*roll_no\s+ASC/gi,
        "ORDER BY NULLIF(regexp_replace(roll_no, '\\D', '', 'g'), '')::bigint ASC NULLS LAST, roll_no ASC")
      .replace(/CAST\(roll_no\s+AS\s+INTEGER\)\s+ASC/gi,
        "NULLIF(regexp_replace(roll_no, '\\D', '', 'g'), '')::bigint ASC NULLS LAST")
      .replace(/CAST\(roll_no\s+AS\s+INTEGER\)/gi,
        "NULLIF(regexp_replace(roll_no, '\\D', '', 'g'), '')::bigint");
  }

  function cleanParams(params) {
    return params.map(p => (p === undefined ? null : p));
  }

  // Initialize PostgreSQL Schema
  async function initPg() {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS teachers (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          picture TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS classrooms (
          id TEXT PRIMARY KEY,
          teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          subject TEXT DEFAULT '',
          room_id TEXT UNIQUE NOT NULL,
          room_password TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          roll_no TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (classroom_id, roll_no)
        );

        CREATE TABLE IF NOT EXISTS custom_columns (
          id TEXT PRIMARY KEY,
          classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          column_type TEXT DEFAULT 'text',
          order_index INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS attendance_records (
          id TEXT PRIMARY KEY,
          classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          status TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (classroom_id, student_id, date)
        );

        CREATE TABLE IF NOT EXISTS student_marks (
          id TEXT PRIMARY KEY,
          classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          column_id TEXT NOT NULL REFERENCES custom_columns(id) ON DELETE CASCADE,
          value TEXT DEFAULT '',
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (student_id, column_id)
        );

        CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
        CREATE INDEX IF NOT EXISTS idx_classrooms_room_id ON classrooms(room_id);
        CREATE INDEX IF NOT EXISTS idx_students_classroom ON students(classroom_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON attendance_records(classroom_id, date);
        CREATE INDEX IF NOT EXISTS idx_marks_student ON student_marks(student_id);
      `);
      console.log('[DATABASE] Cloud PostgreSQL schema initialized successfully.');
    } catch (err) {
      console.error('[DATABASE ERROR] Failed to initialize PostgreSQL schema:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  const readyPromise = initPg();

  db = {
    isPostgres: true,
    ready: readyPromise,
    prepare: (sql) => {
      const pgSql = toPgSql(sql);
      return {
        get: async (...params) => {
          const res = await pool.query(pgSql, cleanParams(params));
          return res.rows[0] || null;
        },
        all: async (...params) => {
          const res = await pool.query(pgSql, cleanParams(params));
          return res.rows;
        },
        run: async (...params) => {
          const res = await pool.query(pgSql, cleanParams(params));
          return { changes: res.rowCount };
        }
      };
    },
    transaction: (fn) => {
      return async (items) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Proxy runner inside transaction client
          const txDb = {
            prepare: (sql) => {
              const pgSql = toPgSql(sql);
              return {
                run: async (...params) => {
                  const res = await client.query(pgSql, cleanParams(params));
                  return { changes: res.rowCount };
                },
                get: async (...params) => {
                  const res = await client.query(pgSql, cleanParams(params));
                  return res.rows[0] || null;
                },
                all: async (...params) => {
                  const res = await client.query(pgSql, cleanParams(params));
                  return res.rows;
                }
              };
            }
          };
          const result = await fn(items, txDb);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      };
    }
  };

} else {
  // ==========================================
  // SQLITE ENGINE (ZERO-CONFIG LOCAL FALLBACK)
  // ==========================================
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'register.db');
  const sqlite = new Database(dbPath);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  function initSqlite() {
    sqlite.exec(`
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

    console.log('[DATABASE] Local SQLite database initialized at:', dbPath);
  }

  initSqlite();

  db = {
    isPostgres: false,
    ready: Promise.resolve(),
    prepare: (sql) => {
      const stmt = sqlite.prepare(sql);
      return {
        get: async (...params) => stmt.get(...params),
        all: async (...params) => stmt.all(...params),
        run: async (...params) => stmt.run(...params)
      };
    },
    transaction: (fn) => {
      return async (items) => {
        sqlite.exec('BEGIN IMMEDIATE');
        try {
          const txDb = {
            prepare: (sql) => {
              const stmt = sqlite.prepare(sql);
              return {
                run: async (...params) => stmt.run(...params),
                get: async (...params) => stmt.get(...params),
                all: async (...params) => stmt.all(...params)
              };
            }
          };
          const result = await fn(items, txDb);
          sqlite.exec('COMMIT');
          return result;
        } catch (err) {
          sqlite.exec('ROLLBACK');
          throw err;
        }
      };
    }
  };
}

module.exports = db;

