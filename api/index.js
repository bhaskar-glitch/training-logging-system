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
    const { username, password } = req.body;
    console.log('Login attempt for user:', username);
    
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

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }

      console.log('User found:', user ? 'Yes' : 'No');
      
      if (!user) {
        console.log('User not found');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const passwordMatch = bcrypt.compareSync(password, user.password);
      console.log('Password match:', passwordMatch);
      
      if (!passwordMatch) {
        console.log('Invalid password');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log('Login successful for user:', user.username);
      const token = generateToken({ id: user.id, role: user.role });
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
    const db = getDatabase();

    // Check if already checked in
    db.get('SELECT id FROM attendance WHERE session_id = ? AND student_id = ?', 
           [sessionId, req.user.id], (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        return res.status(400).json({ error: 'Already checked in for this session' });
      }

      // Get user details
      db.get('SELECT full_name, job_title FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        const checkInTime = moment().format('YYYY-MM-DD HH:mm:ss');
        const signature = user.full_name; // Use full name as signature

        db.run(
          'INSERT INTO attendance (session_id, student_id, check_in_time, signature, job_title, comments) VALUES (?, ?, ?, ?, ?, ?)',
          [sessionId, req.user.id, checkInTime, signature, user.job_title, comments],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password, full_name, job_title } = req.body;
    const db = getDatabase();
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(
      'INSERT INTO users (username, password, role, full_name, job_title) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, 'student', full_name, job_title],
      function(err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ id: this.lastID, message: 'Student created successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}

// End training session
async function handleEndSession(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.body;
    const db = getDatabase();
    
    // Get session start time
    db.get('SELECT session_start_time FROM training_sessions WHERE id = ?', [sessionId], (err, session) => {
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
        [endTime, duration, durationMinutes, sessionId],
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
        return await handleGetStudents(req, res);
      
      case 'student':
        console.log('Handling student creation request');
        return await handleCreateStudent(req, res);
      
      default:
        console.log('Unknown endpoint:', path);
        res.status(404).json({ error: 'API endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
