const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

let db = null;
let isInitialized = false;

function getDatabase() {
  if (!db) {
    console.log('Creating database connection...');
    
    // For Vercel, use in-memory database
    db = new sqlite3.Database(':memory:');
    console.log('Database connection created');
    
    // Initialize database tables and users
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  if (!db || isInitialized) return;
  
  console.log('Starting database initialization...');
  
  // Create tables with proper error handling
  db.serialize(() => {
    // Create users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
        full_name TEXT NOT NULL,
        job_title TEXT,
        phone TEXT,
        department TEXT,
        is_active BOOLEAN DEFAULT 1,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
      } else {
        console.log('Users table created successfully');
      }
    });

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
    `, (err) => {
      if (err) {
        console.error('Error creating training_sessions table:', err);
      } else {
        console.log('Training sessions table created successfully');
      }
    });

    // Create attendance table
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
    `, (err) => {
      if (err) {
        console.error('Error creating attendance table:', err);
      } else {
        console.log('Attendance table created successfully');
      }
    });

    // Create departments table
    db.run(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating departments table:', err);
      } else {
        console.log('Departments table created successfully');
      }
    });

    // Create job_titles table
    db.run(`
      CREATE TABLE IF NOT EXISTS job_titles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT UNIQUE NOT NULL,
        department_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments (id)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating job_titles table:', err);
      } else {
        console.log('Job titles table created successfully');
      }
    });

    // Create training_types table
    db.run(`
      CREATE TABLE IF NOT EXISTS training_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating training_types table:', err);
      } else {
        console.log('Training types table created successfully');
      }
    });

    // Insert default users after tables are created
    db.run(`
      INSERT OR IGNORE INTO users (email, password, role, full_name, job_title, department) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'admin@training.com', 
      bcrypt.hashSync('admin123', 10), 
      'teacher', 
      'System Administrator', 
      'TCO',
      'IT Department'
    ], (err) => {
      if (err) {
        console.error('Error creating admin user:', err);
      } else {
        console.log('Admin user created successfully');
      }
    });

    db.run(`
      INSERT OR IGNORE INTO users (email, password, role, full_name, job_title, department) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'teacher@training.com', 
      bcrypt.hashSync('teacher123', 10), 
      'teacher', 
      'Training Manager', 
      'Manager',
      'Training Department'
    ], (err) => {
      if (err) {
        console.error('Error creating teacher user:', err);
      } else {
        console.log('Teacher user created successfully');
      }
    });

    db.run(`
      INSERT OR IGNORE INTO users (email, password, role, full_name, job_title, department) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'student@training.com', 
      bcrypt.hashSync('student123', 10), 
      'student', 
      'John Doe', 
      'Trainee',
      'Manufacturing'
    ], (err) => {
      if (err) {
        console.error('Error creating student user:', err);
      } else {
        console.log('Student user created successfully');
      }
    });

    // Insert default departments
    const defaultDepartments = [
      ['Manufacturing', 'Production and manufacturing operations'],
      ['Quality Control', 'Quality assurance and control'],
      ['Maintenance', 'Equipment maintenance and repair'],
      ['Safety', 'Safety and compliance'],
      ['Administration', 'Administrative functions'],
      ['IT Department', 'Information technology'],
      ['Training Department', 'Training and development']
    ];

    defaultDepartments.forEach(([name, description]) => {
      db.run(`
        INSERT OR IGNORE INTO departments (name, description) 
        VALUES (?, ?)
      `, [name, description], (err) => {
        if (err) {
          console.error(`Error creating department ${name}:`, err);
        } else {
          console.log(`Department ${name} created successfully`);
        }
      });
    });

    // Insert default job titles
    const defaultJobTitles = [
      ['Trainee', 1], // Manufacturing
      ['Operator', 1],
      ['Supervisor', 1],
      ['Quality Inspector', 2], // Quality Control
      ['QC Manager', 2],
      ['Maintenance Technician', 3], // Maintenance
      ['Maintenance Supervisor', 3],
      ['Safety Officer', 4], // Safety
      ['Safety Manager', 4],
      ['Administrative Assistant', 5], // Administration
      ['Office Manager', 5],
      ['IT Support', 6], // IT Department
      ['System Administrator', 6],
      ['Training Coordinator', 7], // Training Department
      ['Training Manager', 7]
    ];

    defaultJobTitles.forEach(([title, deptId]) => {
      db.run(`
        INSERT OR IGNORE INTO job_titles (title, department_id) 
        VALUES (?, ?)
      `, [title, deptId], (err) => {
        if (err) {
          console.error(`Error creating job title ${title}:`, err);
        } else {
          console.log(`Job title ${title} created successfully`);
        }
      });
    });

    // Insert default training types
    const defaultTrainingTypes = [
      ['Code of Conduct - Daily Orientation', 'Daily orientation and code of conduct training'],
      ['Safety Training', 'Workplace safety and hazard awareness'],
      ['Equipment Operation', 'Training on specific equipment operation'],
      ['Quality Standards', 'Quality control and standards training'],
      ['Emergency Procedures', 'Emergency response and evacuation procedures'],
      ['Compliance Training', 'Regulatory compliance and legal requirements']
    ];

    defaultTrainingTypes.forEach(([name, description]) => {
      db.run(`
        INSERT OR IGNORE INTO training_types (name, description) 
        VALUES (?, ?)
      `, [name, description], (err) => {
        if (err) {
          console.error(`Error creating training type ${name}:`, err);
        } else {
          console.log(`Training type ${name} created successfully`);
        }
      });
    });

    // Mark initialization as complete
    setTimeout(() => {
      isInitialized = true;
      console.log('Database initialization completed successfully');
    }, 2000);
  });
}

module.exports = { getDatabase };