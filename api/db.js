const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

let db = null;
let isInitialized = false;

function getDatabase() {
  if (!db) {
    console.log('Creating database connection...');
    
    // For Vercel, use in-memory database since file system is read-only
    if (process.env.NODE_ENV === 'production') {
      console.log('Using in-memory database for production');
      db = new sqlite3.Database(':memory:');
    } else {
      console.log('Using file database for development');
      const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'database', 'attendance.db');
      db = new sqlite3.Database(dbPath);
    }
    
    // Initialize database tables synchronously
    initializeDatabaseSync();
  }
  return db;
}

function initializeDatabaseSync() {
  if (!db || isInitialized) return;
  
  console.log('Initializing database tables...');
  
  try {
    // Create tables synchronously
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
        full_name TEXT NOT NULL,
        job_title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        department TEXT,
        location TEXT,
        trainer_name TEXT NOT NULL,
        trainer_designation TEXT,
        training_type TEXT,
        training_title TEXT,
        training_content TEXT,
        session_start_time DATETIME,
        session_end_time DATETIME,
        duration TEXT,
        duration_minutes INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        check_in_time DATETIME NOT NULL,
        signature TEXT,
        job_title TEXT,
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES training_sessions (id),
        FOREIGN KEY (student_id) REFERENCES users (id)
      )
    `);

    // Add columns if they don't exist (for existing databases)
    db.run(`ALTER TABLE training_sessions ADD COLUMN session_start_time DATETIME`, () => {});
    db.run(`ALTER TABLE training_sessions ADD COLUMN session_end_time DATETIME`, () => {});
    db.run(`ALTER TABLE training_sessions ADD COLUMN duration TEXT`, () => {});
    db.run(`ALTER TABLE training_sessions ADD COLUMN duration_minutes INTEGER`, () => {});

    console.log('Database tables created successfully');

    // Insert default users synchronously
    const hashedTeacherPassword = bcrypt.hashSync('teacher123', 10);
    const hashedAdminPassword = bcrypt.hashSync('admin123', 10);
    const hashedStudentPassword = bcrypt.hashSync('student123', 10);

    console.log('Inserting default users...');

    // Insert teacher user
    db.run(
      'INSERT OR IGNORE INTO users (username, password, role, full_name, job_title) VALUES (?, ?, ?, ?, ?)',
      ['teacher', hashedTeacherPassword, 'teacher', 'Training Manager', 'Manager'],
      function(err) {
        if (err) {
          console.error('Error creating teacher user:', err);
        } else {
          console.log('Teacher user ready');
        }
      }
    );

    // Insert admin user
    db.run(
      'INSERT OR IGNORE INTO users (username, password, role, full_name, job_title) VALUES (?, ?, ?, ?, ?)',
      ['admin', hashedAdminPassword, 'teacher', 'System Administrator', 'TCO'],
      function(err) {
        if (err) {
          console.error('Error creating admin user:', err);
        } else {
          console.log('Admin user ready');
        }
      }
    );

    // Insert student user
    db.run(
      'INSERT OR IGNORE INTO users (username, password, role, full_name, job_title) VALUES (?, ?, ?, ?, ?)',
      ['student', hashedStudentPassword, 'student', 'John Doe', 'Trainee'],
      function(err) {
        if (err) {
          console.error('Error creating student user:', err);
        } else {
          console.log('Student user ready');
        }
      }
    );

    isInitialized = true;
    console.log('Database initialization completed');
    
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Keep the old function for backward compatibility
function initializeDatabase() {
  initializeDatabaseSync();
}

module.exports = { getDatabase, initializeDatabase };