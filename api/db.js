const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;

function getDatabase() {
  if (!db) {
    // For Vercel, use in-memory database since file system is read-only
    // In production, you might want to use a cloud database like PlanetScale or Supabase
    if (process.env.NODE_ENV === 'production') {
      // Use in-memory database for Vercel
      db = new sqlite3.Database(':memory:');
    } else {
      // Use file database for local development
      const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'database', 'attendance.db');
      db = new sqlite3.Database(dbPath);
    }
    
    // Initialize database tables
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  if (!db) return;
  
  // Create users table
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

  // Create training_sessions table
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

  // Create attendance table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      check_in_time DATETIME NOT NULL,
      signature TEXT NOT NULL,
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

  // Insert default teacher user if not exists
  db.get('SELECT id FROM users WHERE role = ?', ['teacher'], (err, row) => {
    if (err) {
      console.error('Error checking for teacher user:', err);
      return;
    }
    
    if (!row) {
      const bcrypt = require('bcrypt');
      const hashedPassword = bcrypt.hashSync('teacher123', 10);
      
      db.run(
        'INSERT INTO users (username, password, role, full_name, job_title) VALUES (?, ?, ?, ?, ?)',
        ['teacher', hashedPassword, 'teacher', 'Training Manager', 'Manager'],
        (err) => {
          if (err) {
            console.error('Error creating default teacher user:', err);
          } else {
            console.log('Default teacher user created: username=teacher, password=teacher123');
          }
        }
      );
    }
  });

  // Insert default admin user if not exists
  db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
    if (err) {
      console.error('Error checking for admin user:', err);
      return;
    }
    
    if (!row) {
      const bcrypt = require('bcrypt');
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      
      db.run(
        'INSERT INTO users (username, password, role, full_name, job_title) VALUES (?, ?, ?, ?, ?)',
        ['admin', hashedPassword, 'teacher', 'System Administrator', 'TCO'],
        (err) => {
          if (err) {
            console.error('Error creating default admin user:', err);
          } else {
            console.log('Default admin user created: username=admin, password=admin123');
          }
        }
      );
    }
  });

  // Insert default student user if not exists
  db.get('SELECT id FROM users WHERE role = ?', ['student'], (err, row) => {
    if (err) {
      console.error('Error checking for student user:', err);
      return;
    }
    
    if (!row) {
      const bcrypt = require('bcrypt');
      const hashedPassword = bcrypt.hashSync('student123', 10);
      
      db.run(
        'INSERT INTO users (username, password, role, full_name, job_title) VALUES (?, ?, ?, ?, ?)',
        ['student', hashedPassword, 'student', 'John Doe', 'Trainee'],
        (err) => {
          if (err) {
            console.error('Error creating default student user:', err);
          } else {
            console.log('Default student user created: username=student, password=student123');
          }
        }
      );
    }
  });
}

module.exports = { getDatabase, initializeDatabase };
