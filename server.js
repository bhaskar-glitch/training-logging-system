const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const ExcelJS = require('exceljs');
const moment = require('moment');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./database/attendance.db');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('teacher', 'student')),
    full_name TEXT NOT NULL,
    job_title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Training sessions table
  db.run(`CREATE TABLE IF NOT EXISTS training_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    trainer_name TEXT NOT NULL,
    trainer_designation TEXT NOT NULL,
    training_content TEXT NOT NULL,
    duration TEXT NOT NULL,
    department TEXT DEFAULT 'Manufacturing Facility',
    training_type TEXT DEFAULT 'Code of Conduct - Daily Orientation',
    location TEXT DEFAULT 'Manufacturing Facility',
    training_title TEXT DEFAULT 'Code of Conduct - Daily Orientation',
    session_start_time DATETIME,
    session_end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add new columns to existing table if they don't exist
  db.run(`ALTER TABLE training_sessions ADD COLUMN department TEXT DEFAULT 'Manufacturing Facility'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Department column already exists or error:', err.message);
    }
  });
  
  db.run(`ALTER TABLE training_sessions ADD COLUMN training_type TEXT DEFAULT 'Code of Conduct - Daily Orientation'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Training type column already exists or error:', err.message);
    }
  });
  
  db.run(`ALTER TABLE training_sessions ADD COLUMN training_title TEXT DEFAULT 'Code of Conduct - Daily Orientation'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Training title column already exists or error:', err.message);
    }
  });
  
  db.run(`ALTER TABLE training_sessions ADD COLUMN session_start_time DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Session start time column already exists or error:', err.message);
    }
  });
  
  db.run(`ALTER TABLE training_sessions ADD COLUMN session_end_time DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.log('Session end time column already exists or error:', err.message);
    }
  });

  // Attendance table
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    job_title TEXT,
    signature TEXT,
    comments TEXT,
    check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES training_sessions (id),
    FOREIGN KEY (student_id) REFERENCES users (id)
  )`);

  // Create default teacher account
  const defaultPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password, role, full_name, job_title) 
          VALUES ('admin', ?, 'teacher', 'System Administrator', 'TCO')`, [defaultPassword]);
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        job_title: user.job_title
      }
    });
  });
});

// Get current training session
app.get('/api/training-session/today', (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  
  db.get('SELECT * FROM training_sessions WHERE date = ?', [today], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(session);
  });
});

// Get all training sessions (accessible by both teachers and students)
app.get('/api/training-sessions', authenticateToken, (req, res) => {
  db.all('SELECT * FROM training_sessions ORDER BY date DESC, created_at DESC', (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(sessions);
  });
});

// Create training session (Teacher only)
app.post('/api/training-session', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }

  const { trainer_name, trainer_designation, training_content, duration, department, training_type, location, training_title, training_date, session_start_time } = req.body;
  const sessionDate = training_date || moment().format('YYYY-MM-DD');
  const startTime = session_start_time || moment().format('YYYY-MM-DD HH:mm:ss');

  // Create session (allow multiple sessions per date)
  db.run(
    'INSERT INTO training_sessions (date, trainer_name, trainer_designation, training_content, duration, department, training_type, location, training_title, session_start_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [sessionDate, trainer_name, trainer_designation, training_content, duration, department, training_type, location, training_title, startTime],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, message: 'Training session created successfully' });
    }
  );
});

// End training session
app.post('/api/training-session/end', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }

  const { session_id } = req.body;
  const endTime = moment().format('YYYY-MM-DD HH:mm:ss');

  // First get the session to calculate duration
  db.get('SELECT * FROM training_sessions WHERE id = ?', [session_id], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Calculate duration
    const startMoment = moment(session.session_start_time);
    const endMoment = moment(endTime);
    const durationMinutes = endMoment.diff(startMoment, 'minutes');
    const startTimeStr = startMoment.format('HH:mm');
    const endTimeStr = endMoment.format('HH:mm');
    const duration = `${startTimeStr} - ${endTimeStr} (${durationMinutes} min.)`;

    // Update session with end time and calculated duration
    db.run(
      'UPDATE training_sessions SET session_end_time = ?, duration = ? WHERE id = ?',
      [endTime, duration, session_id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ 
          message: 'Session ended successfully', 
          end_time: endTime,
          duration: duration,
          duration_minutes: durationMinutes
        });
      }
    );
  });
});

// Delete training session
app.delete('/api/training-session/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }

  const sessionId = req.params.id;

  // First delete all attendance records for this session
  db.run('DELETE FROM attendance WHERE session_id = ?', [sessionId], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database error deleting attendance records' });
    }

    // Then delete the session
    db.run('DELETE FROM training_sessions WHERE id = ?', [sessionId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error deleting session' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json({ message: 'Session and all associated attendance records deleted successfully' });
    });
  });
});

// Student check-in
app.post('/api/attendance/checkin', authenticateToken, (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Student access required' });
  }

  const { comments } = req.body;
  const today = moment().format('YYYY-MM-DD');

  // Get today's training session
  db.get('SELECT id FROM training_sessions WHERE date = ?', [today], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!session) {
      return res.status(400).json({ error: 'No training session found for today' });
    }

    // Check if already checked in
    db.get('SELECT id FROM attendance WHERE session_id = ? AND student_id = ?', 
           [session.id, req.user.id], (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        return res.status(400).json({ error: 'Already checked in for today' });
      }

      // Get user details
      db.get('SELECT full_name, job_title FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Create signature from username
        const signature = req.user.username.toUpperCase();

        // Use current system time for check-in
        const checkInTime = moment().format('YYYY-MM-DD HH:mm:ss');
        
        db.run(
          'INSERT INTO attendance (session_id, student_id, student_name, job_title, signature, comments, check_in_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [session.id, req.user.id, user.full_name, user.job_title, signature, comments || '', checkInTime],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Check-in successful', check_in_time: checkInTime });
          }
        );
      });
    });
  });
});

// Get attendance for a specific session
app.get('/api/attendance/session/:sessionId', authenticateToken, (req, res) => {
  const sessionId = req.params.sessionId;

  db.get('SELECT * FROM training_sessions WHERE id = ?', [sessionId], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!session) {
      return res.status(404).json({ error: 'Training session not found' });
    }

    db.all(
      'SELECT a.*, u.full_name as student_name FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.session_id = ? ORDER BY a.check_in_time',
      [sessionId],
      (err, attendance) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ session, attendance });
      }
    );
  });
});

// Get attendance for today's latest session (for backward compatibility)
app.get('/api/attendance/today', authenticateToken, (req, res) => {
  const today = moment().format('YYYY-MM-DD');

  db.get('SELECT * FROM training_sessions WHERE date = ? ORDER BY created_at DESC LIMIT 1', [today], (err, session) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!session) {
      return res.status(404).json({ error: 'No training session found for today' });
    }

    db.all(
      'SELECT a.*, u.full_name as student_name FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.session_id = ? ORDER BY a.check_in_time',
      [session.id],
      (err, attendance) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ session, attendance });
      }
    );
  });
});

// Export to Excel
app.get('/api/export/excel/:date', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }

  const { date } = req.params;
  const targetDate = date || moment().format('YYYY-MM-DD');

  try {
    // Get session data
    const session = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM training_sessions WHERE date = ?', [targetDate], (err, session) => {
        if (err) reject(err);
        else resolve(session);
      });
    });

    if (!session) {
      return res.status(404).json({ error: 'No training session found for the specified date' });
    }

    // Get attendance data
    const attendance = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM attendance WHERE session_id = ? ORDER BY check_in_time', [session.id], (err, attendance) => {
        if (err) reject(err);
        else resolve(attendance);
      });
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Training Attendance Sheet');

    // Add training details exactly as in reference
    worksheet.addRow(['Training Record']);
    worksheet.addRow([]);
    worksheet.addRow(['Date of Training:', moment(session.date).format('DD/MM/YYYY')]);
    worksheet.addRow(['Department:', 'Manufacturing Facility']);
    worksheet.addRow(['Trainer Details, Designation:', `${session.trainer_name}, ${session.trainer_designation}`]);
    worksheet.addRow(['Training Type:', 'Code of Conduct - Daily Orientation']);
    worksheet.addRow(['Training Content:', session.training_content]);
    worksheet.addRow(['Session Start Time:', session.session_start_time ? moment(session.session_start_time).format('DD/MM/YYYY HH:mm') : 'Not set']);
    if (session.session_end_time) {
      worksheet.addRow(['Session End Time:', moment(session.session_end_time).format('DD/MM/YYYY HH:mm')]);
    }
    worksheet.addRow([]);
    worksheet.addRow(['Training Attendance Sheet:']);
    worksheet.addRow(['Training Title:', 'Code of Conduct - Daily Orientation']);
    worksheet.addRow(['Date/Day:', `${moment(session.date).format('DD/MM/YYYY')}, ${moment(session.date).format('dddd')}`]);
    worksheet.addRow(['Location:', 'Manufacturing Facility']);
    worksheet.addRow(['Duration:', session.duration]);
    worksheet.addRow([]);

    // Add attendance table headers
    worksheet.addRow(['S. No.', 'Employee Name', 'Job Title', 'Signature', 'Comments']);
    
    // Add attendance data
    attendance.forEach((record, index) => {
      worksheet.addRow([
        index + 1,
        record.student_name,
        record.job_title || '',
        record.signature,
        record.comments || ''
      ]);
    });

    // Style the worksheet
    worksheet.getRow(1).font = { bold: true, size: 14 };
    worksheet.getRow(12).font = { bold: true };
    worksheet.getRow(13).font = { bold: true };
    worksheet.getRow(14).font = { bold: true };
    worksheet.getRow(15).font = { bold: true };
    worksheet.getRow(16).font = { bold: true };
    worksheet.getRow(18).font = { bold: true };

    // Set column widths
    worksheet.columns = [
      { width: 10 },
      { width: 25 },
      { width: 20 },
      { width: 15 },
      { width: 20 }
    ];

    // Generate Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="training-attendance-${targetDate}.xlsx"`);
    res.setHeader('Cache-Control', 'no-cache');

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Excel generation error:', err);
    res.status(500).json({ error: 'Error generating Excel file: ' + err.message });
  }
});

// Test Excel export endpoint (for debugging)
app.get('/api/test-excel', (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Test Sheet');
    
    worksheet.addRow(['Test', 'Data']);
    worksheet.addRow(['Hello', 'World']);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="test.xlsx"');
    
    workbook.xlsx.write(res).then(() => {
      res.end();
    }).catch(err => {
      console.error('Test Excel error:', err);
      res.status(500).json({ error: 'Test Excel error: ' + err.message });
    });
  } catch (err) {
    console.error('Test Excel error:', err);
    res.status(500).json({ error: 'Test Excel error: ' + err.message });
  }
});

// Export to Excel for a specific session
app.get('/api/export/excel/session/:sessionId', authenticateToken, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }

  try {
    const sessionId = req.params.sessionId;
    
    // Get training session
    const session = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM training_sessions WHERE id = ?', [sessionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!session) {
      return res.status(404).json({ error: 'Training session not found' });
    }

    // Get attendance records for this specific session
    const attendance = await new Promise((resolve, reject) => {
      db.all(`
        SELECT a.*, u.full_name as student_name 
        FROM attendance a 
        JOIN users u ON a.student_id = u.id 
        WHERE a.session_id = ? 
        ORDER BY a.check_in_time
      `, [sessionId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Training Attendance Sheet');

    // Add training details exactly as in reference
    worksheet.addRow(['Training Record']);
    worksheet.addRow([]);
    worksheet.addRow(['Date of Training:', moment(session.date).format('DD/MM/YYYY')]);
    worksheet.addRow(['Department:', session.department || 'Manufacturing Facility']);
    worksheet.addRow(['Trainer Details, Designation:', `${session.trainer_name}, ${session.trainer_designation}`]);
    worksheet.addRow(['Training Type:', session.training_type || 'Code of Conduct - Daily Orientation']);
    worksheet.addRow(['Training Content:', session.training_content]);
    worksheet.addRow(['Session Start Time:', session.session_start_time ? moment(session.session_start_time).format('DD/MM/YYYY HH:mm') : 'Not set']);
    if (session.session_end_time) {
      worksheet.addRow(['Session End Time:', moment(session.session_end_time).format('DD/MM/YYYY HH:mm')]);
    }
    worksheet.addRow([]);
    worksheet.addRow(['Training Attendance Sheet:']);
    worksheet.addRow(['Training Title:', session.training_type || 'Code of Conduct - Daily Orientation']);
    worksheet.addRow([]);

    // Add attendance headers
    worksheet.addRow(['S. No.', 'Employee Name', 'Job Title', 'Signature', 'Comments', 'Check-in Time']);

    // Add attendance data
    attendance.forEach((record, index) => {
      worksheet.addRow([
        index + 1,
        record.student_name || 'N/A',
        record.job_title || 'N/A',
        record.signature,
        record.comments || 'N/A',
        moment(record.check_in_time).format('DD/MM/YYYY HH:mm:ss')
      ]);
    });

    // Style the header
    const headerRow = worksheet.getRow(worksheet.rowCount - attendance.length);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=training-attendance-${session.date}-session-${sessionId}.xlsx`);
    res.setHeader('Cache-Control', 'no-cache');

    // Write the file
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

// Get current user info
app.get('/api/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, role, full_name, job_title FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ user });
  });
});

// Get all students
app.get('/api/students', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }

  db.all('SELECT id, username, full_name, job_title FROM users WHERE role = "student"', (err, students) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(students);
  });
});

// Add student
app.post('/api/students', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }

  const { username, password, full_name, job_title } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, password, role, full_name, job_title) VALUES (?, ?, "student", ?, ?)',
    [username, hashedPassword, full_name, job_title],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, message: 'Student added successfully' });
    }
  );
});

// Serve static files
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
