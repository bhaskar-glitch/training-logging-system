const { getDatabase } = require('./db');
const { authenticateToken } = require('./auth');
const bcrypt = require('bcrypt');
const moment = require('moment');

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Get attendance for a specific session
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
  } else if (req.method === 'POST') {
    // Student check-in
    authenticateToken(req, res, () => {
      if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Student access required' });
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
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
