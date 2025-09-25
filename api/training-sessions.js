const { getDatabase } = require('./db');
const { authenticateToken } = require('./auth');

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
  } else if (req.method === 'POST') {
    authenticateToken(req, res, () => {
      if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Teacher access required' });
      }

      try {
        const { 
          date, 
          department, 
          location, 
          trainer_name, 
          trainer_designation, 
          training_type, 
          training_title, 
          training_content, 
          session_start_time 
        } = req.body;

        const db = getDatabase();
        
        db.run(
          `INSERT INTO training_sessions 
           (date, department, location, trainer_name, trainer_designation, training_type, training_title, training_content, session_start_time) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [date, department, location, trainer_name, trainer_designation, training_type, training_title, training_content, session_start_time],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ id: this.lastID, message: 'Training session created successfully' });
          }
        );
      } catch (error) {
        res.status(500).json({ error: 'Server error' });
      }
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
