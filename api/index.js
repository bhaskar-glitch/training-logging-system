const { getDatabase } = require('./db');
const { generateToken, authenticateToken } = require('./auth');
const bcrypt = require('bcrypt');
const moment = require('moment');
const ExcelJS = require('exceljs');

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Handle preflight requests
function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.status(200).end();
    return true;
  }
  return false;
}

// Login endpoint
async function handleLogin(req, res) {
  console.log('Login request received:', req.method, req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    
    const db = getDatabase();
    console.log('Database connection established');

    // Wait for database initialization to complete
    const checkDatabase = () => {
      return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
          if (err) {
            console.log('Database not ready yet, retrying...');
            setTimeout(checkDatabase, 100);
            return;
          }
          console.log('Database ready, user count:', row.count);
          resolve();
        });
      });
    };

    await checkDatabase();

    db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email.toLowerCase()], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      console.log('User found:', user ? 'Yes' : 'No');
      
      if (!user) {
        console.log('Email not registered:', email);
        return res.status(401).json({ error: 'Email not registered. Please check your email or contact administrator.' });
      }

      const passwordMatch = bcrypt.compareSync(password, user.password);
      console.log('Password match:', passwordMatch);
      
      if (!passwordMatch) {
        console.log('Incorrect password for email:', email);
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      // Update last login
      const lastLogin = new Date().toISOString();
      db.run('UPDATE users SET last_login = ? WHERE id = ?', [lastLogin, user.id], (err) => {
        if (err) {
          console.error('Error updating last login:', err);
        }
      });

      console.log('Login successful for user:', user.email);
      const token = generateToken({ id: user.id, email: user.email, role: user.role });
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          full_name: user.full_name,
          job_title: user.job_title,
          department: user.department,
          last_login: user.last_login
        } 
      });
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}

// Get all training sessions
async function handleGetSessions(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    db.all('SELECT * FROM training_sessions ORDER BY date DESC, created_at DESC', (err, sessions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(sessions);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Create training session
async function handleCreateSession(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      date, 
      training_date,  // Handle both field names
      department, 
      location, 
      trainer_name, 
      trainer_designation, 
      training_type, 
      training_title, 
      training_content, 
      session_start_time 
    } = req.body;
    
    // Use training_date if date is not provided
    const sessionDate = date || training_date;
    
    // Validate required fields
    if (!sessionDate) {
      return res.status(400).json({ error: 'Date is required' });
    }
    if (!trainer_name) {
      return res.status(400).json({ error: 'Trainer name is required' });
    }

    console.log('Creating session with data:', req.body);
    console.log('Using session date:', sessionDate);
    const db = getDatabase();
    
    // Wait for database to be ready
    const checkDatabase = () => {
      return new Promise((resolve) => {
        db.get('SELECT COUNT(*) as count FROM training_sessions', (err, row) => {
          if (err) {
            console.log('Database not ready for session creation, retrying...');
            setTimeout(checkDatabase, 100);
            return;
          }
          console.log('Database ready for session creation');
          resolve();
        });
      });
    };

    await checkDatabase();
    
    db.run(
      `INSERT INTO training_sessions 
       (date, department, location, trainer_name, trainer_designation, training_type, training_title, training_content, session_start_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionDate, department, location, trainer_name, trainer_designation, training_type, training_title, training_content, session_start_time],
      function(err) {
        if (err) {
          console.error('Database error creating session:', err);
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        console.log('Session created successfully with ID:', this.lastID);
        res.json({ id: this.lastID, message: 'Training session created successfully' });
      }
    );
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}

// Get attendance for a specific session
async function handleGetAttendance(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query.sessionId;
    const db = getDatabase();

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
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Student check-in
async function handleCheckIn(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { comments, sessionId } = req.body;
    console.log('Check-in request body:', { comments, sessionId });
    console.log('User from token:', req.user);
    
    if (!req.user || !req.user.id) {
      console.error('No user found in request');
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const db = getDatabase();

    // Check if already checked in
    db.get('SELECT id FROM attendance WHERE session_id = ? AND student_id = ?', 
           [sessionId, req.user.id], (err, existing) => {
      if (err) {
        console.error('Database error checking existing attendance:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      if (existing) {
        return res.status(400).json({ error: 'Already checked in for this session' });
      }

      // Get user details
      db.get('SELECT full_name, job_title FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
          console.error('Database error getting user details:', err);
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        if (!user) {
          console.error('User not found in database:', req.user.id);
          return res.status(404).json({ error: 'User not found' });
        }

        const checkInTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const signature = user.full_name; // Use full name as signature

        console.log('Inserting attendance record:', {
          sessionId,
          studentId: req.user.id,
          checkInTime,
          signature,
          jobTitle: user.job_title,
          comments
        });

        db.run(
          'INSERT INTO attendance (session_id, student_id, check_in_time, signature, job_title, comments) VALUES (?, ?, ?, ?, ?, ?)',
          [sessionId, req.user.id, checkInTime, signature, user.job_title, comments],
          function(err) {
            if (err) {
              console.error('Database error inserting attendance:', err);
              return res.status(500).json({ error: 'Database error: ' + err.message });
            }
            console.log('Attendance record created with ID:', this.lastID);
            res.json({ message: 'Check-in successful', attendance_id: this.lastID });
          }
        );
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Get today's training session
async function handleGetTodaySession(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    db.get('SELECT * FROM training_sessions WHERE date = ? ORDER BY created_at DESC LIMIT 1', [today], (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(session || null);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Get all students
async function handleGetStudents(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    db.all('SELECT id, username, full_name, job_title, role FROM users WHERE role = ?', ['student'], (err, students) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(students);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Create new student
async function handleCreateStudent(req, res) {
  console.log('Create student request method:', req.method);
  console.log('Create student request body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, full_name, job_title, phone, department } = req.body;
    console.log('Student data:', { email, full_name, job_title, phone, department });
    
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    
    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    const db = getDatabase();
    
    // Check if email already exists
    db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()], (err, existingUser) => {
      if (err) {
        console.error('Database error checking existing user:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered. Please use a different email address.' });
      }
      
      const hashedPassword = bcrypt.hashSync(password, 10);
      
      db.run(
        'INSERT INTO users (email, password, role, full_name, job_title, phone, department) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [email.toLowerCase(), hashedPassword, 'student', full_name, job_title || '', phone || '', department || ''],
        function(err) {
          if (err) {
            console.error('Database error creating student:', err);
            return res.status(500).json({ error: 'Database error: ' + err.message });
          }
          console.log('Student created successfully with ID:', this.lastID);
          res.json({ 
            id: this.lastID, 
            message: 'Student created successfully',
            user: {
              id: this.lastID,
              email: email,
              full_name: full_name,
              job_title: job_title,
              department: department
            }
          });
        }
      );
    });
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// End training session
async function handleEndSession(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, session_id } = req.body;
    const actualSessionId = sessionId || session_id; // Handle both field names
    
    if (!actualSessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const db = getDatabase();
    
    // Get session start time
    db.get('SELECT session_start_time FROM training_sessions WHERE id = ?', [actualSessionId], (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const endTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const startTime = new Date(session.session_start_time);
      const endTimeDate = new Date(endTime);
      const durationMs = endTimeDate - startTime;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      const duration = `${hours}:${minutes.toString().padStart(2, '0')}`;
      
      db.run(
        'UPDATE training_sessions SET session_end_time = ?, duration = ?, duration_minutes = ? WHERE id = ?',
        [endTime, duration, durationMinutes, actualSessionId],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ message: 'Session ended successfully', duration });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Delete training session
async function handleDeleteSession(req, res, sessionId) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    
    // Delete attendance records first
    db.run('DELETE FROM attendance WHERE session_id = ?', [sessionId], (err) => {
      if (err) {
        console.error('Database error deleting attendance:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Delete the session
      db.run('DELETE FROM training_sessions WHERE id = ?', [sessionId], function(err) {
        if (err) {
          console.error('Database error deleting session:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json({ message: 'Session deleted successfully' });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Get attendance by session ID
async function handleGetAttendanceBySession(req, res, sessionId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    
    db.get('SELECT * FROM training_sessions WHERE id = ?', [sessionId], (err, session) => {
      if (err) {
        console.error('Database error:', err);
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
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ session, attendance });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Get today's attendance
async function handleGetTodayAttendance(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's latest session
    db.get('SELECT * FROM training_sessions WHERE date = ? ORDER BY created_at DESC LIMIT 1', [today], (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!session) {
        return res.json({ session: null, attendance: [] });
      }

      db.all(
        'SELECT a.*, u.full_name as student_name FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.session_id = ? ORDER BY a.check_in_time',
        [session.id],
        (err, attendance) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ session, attendance });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Export today's attendance to Excel
async function handleExportTodayExcel(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's latest session
    db.get('SELECT * FROM training_sessions WHERE date = ? ORDER BY created_at DESC LIMIT 1', [today], (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!session) {
        return res.status(404).json({ error: 'No session found for today' });
      }

      // Get attendance for this session
      db.all(
        'SELECT a.*, u.full_name as student_name FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.session_id = ? ORDER BY a.check_in_time',
        [session.id],
        (err, attendance) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          generateExcelFile(res, session, attendance);
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Export session attendance to Excel
async function handleExportSessionExcel(req, res, sessionId) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = getDatabase();
    
    db.get('SELECT * FROM training_sessions WHERE id = ?', [sessionId], (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      db.all(
        'SELECT a.*, u.full_name as student_name FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.session_id = ? ORDER BY a.check_in_time',
        [sessionId],
        (err, attendance) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          generateExcelFile(res, session, attendance);
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// Generate Excel file
function generateExcelFile(res, session, attendance) {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    // Set headers
    worksheet.columns = [
      { header: 'Student Name', key: 'student_name', width: 20 },
      { header: 'Job Title', key: 'job_title', width: 15 },
      { header: 'Check-in Time', key: 'check_in_time', width: 20 },
      { header: 'Signature', key: 'signature', width: 20 },
      { header: 'Comments', key: 'comments', width: 30 }
    ];

    // Add session info
    worksheet.addRow([]);
    worksheet.addRow(['Session Information']);
    worksheet.addRow(['Date:', session.date]);
    worksheet.addRow(['Department:', session.department || 'N/A']);
    worksheet.addRow(['Location:', session.location || 'N/A']);
    worksheet.addRow(['Trainer:', session.trainer_name]);
    worksheet.addRow(['Training Type:', session.training_type || 'N/A']);
    worksheet.addRow(['Start Time:', session.session_start_time || 'N/A']);
    worksheet.addRow(['End Time:', session.session_end_time || 'N/A']);
    worksheet.addRow(['Duration:', session.duration || 'N/A']);
    worksheet.addRow([]);

    // Add attendance data
    worksheet.addRow(['Attendance Records']);
    worksheet.addRow(['Student Name', 'Job Title', 'Check-in Time', 'Signature', 'Comments']);

    attendance.forEach(record => {
      worksheet.addRow([
        record.student_name,
        record.job_title || 'N/A',
        record.check_in_time,
        record.signature || 'N/A',
        record.comments || 'N/A'
      ]);
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${session.date}_${session.id}.xlsx"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Write Excel file to response
    workbook.xlsx.write(res).then(() => {
      res.end();
    }).catch(err => {
      console.error('Excel generation error:', err);
      res.status(500).json({ error: 'Excel generation failed' });
    });

  } catch (error) {
    console.error('Excel file generation error:', error);
    res.status(500).json({ error: 'Excel generation failed' });
  }
}

// Main handler
module.exports = async function handler(req, res) {
  console.log('API Request:', req.method, req.url);
  
  setCorsHeaders(res);

  if (handlePreflight(req, res)) {
    return;
  }

  // Parse the path from the URL - simpler approach for Vercel
  const path = req.url.replace('/api/', '').split('?')[0];
  console.log('Parsed path:', path);

  try {
    // Handle dynamic routes with parameters
    if (path.startsWith('training-session/')) {
      const subPath = path.replace('training-session/', '');
      console.log('Training session subpath:', subPath);
      
      if (subPath === 'today') {
        console.log('Handling training-session/today request');
        return await handleGetTodaySession(req, res);
      } else if (subPath === 'end') {
        console.log('Handling training-session/end request');
        return await handleEndSession(req, res);
      } else if (!isNaN(subPath)) {
        console.log('Handling training-session delete request for ID:', subPath);
        return await handleDeleteSession(req, res, subPath);
      }
    }
    
    if (path.startsWith('attendance/session/')) {
      const sessionId = path.replace('attendance/session/', '');
      console.log('Handling attendance/session request for ID:', sessionId);
      return await handleGetAttendanceBySession(req, res, sessionId);
    }
    
    if (path.startsWith('attendance/today')) {
      console.log('Handling attendance/today request');
      return await handleGetTodayAttendance(req, res);
    }
    
    if (path.startsWith('export/excel/')) {
      const subPath = path.replace('export/excel/', '');
      console.log('Export subpath:', subPath);
      
      if (subPath === 'today') {
        console.log('Handling export/excel/today request');
        return await handleExportTodayExcel(req, res);
      } else if (subPath.startsWith('session/')) {
        const sessionId = subPath.replace('session/', '');
        console.log('Handling export/excel/session request for ID:', sessionId);
        return await handleExportSessionExcel(req, res, sessionId);
      }
    }
    
    switch (path) {
      case 'login':
        console.log('Handling login request');
        return await handleLogin(req, res);
      
      case 'training-sessions':
        console.log('Handling training-sessions request');
        return await handleGetSessions(req, res);
      
      case 'training-session':
        console.log('Handling training-session request');
        return await handleCreateSession(req, res);
      
      case 'attendance/checkin':
        console.log('Handling attendance/checkin request');
        authenticateToken(req, res, () => handleCheckIn(req, res));
        break;
      
      case 'students':
        console.log('Handling students request');
        if (req.method === 'GET') {
          return await handleGetStudents(req, res);
        } else if (req.method === 'POST') {
          return await handleCreateStudent(req, res);
        } else {
          return res.status(405).json({ error: 'Method not allowed' });
        }
      
      case 'student':
        console.log('Handling student creation request');
        return await handleCreateStudent(req, res);
      
      case 'admin/departments':
        console.log('Handling departments request');
        return await handleDepartments(req, res);
      
      case 'admin/job-titles':
        console.log('Handling job titles request');
        return await handleJobTitles(req, res);
      
      case 'admin/training-types':
        console.log('Handling training types request');
        return await handleTrainingTypes(req, res);
      
      case 'admin/students':
        console.log('Handling admin students request');
        return await handleAdminStudents(req, res);
      
      default:
        console.log('Unknown endpoint:', path);
        res.status(404).json({ error: 'API endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Admin: Departments management
async function handleDepartments(req, res) {
  if (req.method === 'GET') {
    try {
      const db = getDatabase();
      db.all('SELECT * FROM departments WHERE is_active = 1 ORDER BY name', (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ departments: rows });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, description } = req.body;
      const db = getDatabase();
      
      db.run('INSERT INTO departments (name, description) VALUES (?, ?)', 
        [name, description], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ id: this.lastID, message: 'Department created successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, name, description } = req.body;
      const db = getDatabase();
      
      db.run('UPDATE departments SET name = ?, description = ? WHERE id = ?', 
        [name, description, id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Department updated successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      const db = getDatabase();
      
      db.run('UPDATE departments SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Department deleted successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Admin: Job titles management
async function handleJobTitles(req, res) {
  if (req.method === 'GET') {
    try {
      const db = getDatabase();
      db.all(`
        SELECT jt.*, d.name as department_name 
        FROM job_titles jt 
        LEFT JOIN departments d ON jt.department_id = d.id 
        WHERE jt.is_active = 1 
        ORDER BY jt.title
      `, (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ jobTitles: rows });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { title, department_id } = req.body;
      const db = getDatabase();
      
      db.run('INSERT INTO job_titles (title, department_id) VALUES (?, ?)', 
        [title, department_id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ id: this.lastID, message: 'Job title created successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, title, department_id } = req.body;
      const db = getDatabase();
      
      db.run('UPDATE job_titles SET title = ?, department_id = ? WHERE id = ?', 
        [title, department_id, id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Job title updated successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      const db = getDatabase();
      
      db.run('UPDATE job_titles SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Job title deleted successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Admin: Training types management
async function handleTrainingTypes(req, res) {
  if (req.method === 'GET') {
    try {
      const db = getDatabase();
      db.all('SELECT * FROM training_types WHERE is_active = 1 ORDER BY name', (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ trainingTypes: rows });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const { name, description } = req.body;
      const db = getDatabase();
      
      db.run('INSERT INTO training_types (name, description) VALUES (?, ?)', 
        [name, description], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ id: this.lastID, message: 'Training type created successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, name, description } = req.body;
      const db = getDatabase();
      
      db.run('UPDATE training_types SET name = ?, description = ? WHERE id = ?', 
        [name, description, id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Training type updated successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      const db = getDatabase();
      
      db.run('UPDATE training_types SET is_active = 0 WHERE id = ?', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Training type deleted successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Admin: Students management
async function handleAdminStudents(req, res) {
  if (req.method === 'GET') {
    try {
      const db = getDatabase();
      db.all(`
        SELECT u.*, d.name as department_name 
        FROM users u 
        LEFT JOIN departments d ON u.department = d.name 
        WHERE u.role = 'student' AND u.is_active = 1 
        ORDER BY u.full_name
      `, (err, rows) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ students: rows });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { id, email, full_name, job_title, phone, department } = req.body;
      const db = getDatabase();
      
      db.run(`
        UPDATE users 
        SET email = ?, full_name = ?, job_title = ?, phone = ?, department = ? 
        WHERE id = ? AND role = 'student'
      `, [email, full_name, job_title, phone, department, id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Student updated successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      const db = getDatabase();
      
      db.run('UPDATE users SET is_active = 0 WHERE id = ? AND role = "student"', [id], function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Student deleted successfully' });
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
