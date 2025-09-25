import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import axios from 'axios';
import moment from 'moment';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [comments, setComments] = useState('');

  useEffect(() => {
    loadTodaySession();
  }, []);

  const loadTodaySession = async () => {
    try {
      const response = await axios.get('/api/training-session/today');
      setSession(response.data);
      
      if (response.data) {
        loadMyAttendance();
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const loadMyAttendance = async () => {
    try {
      const response = await axios.get('/api/attendance/today');
      const myAttendance = response.data.attendance?.find(record => record.student_id === user.id);
      setAttendance(myAttendance);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    setMessage('');

    try {
      await axios.post('/api/attendance/checkin', { comments });
      setMessage('Check-in successful!');
      setComments('');
      loadMyAttendance();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error checking in');
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Header */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <span className="navbar-brand">Training Logging System</span>
          <div className="navbar-nav ms-auto">
            <span className="navbar-text me-3">Welcome, {user?.full_name}</span>
            <button className="btn btn-outline-light" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mt-4">
        {message && (
          <div className={`alert ${message.includes('Error') ? 'alert-danger' : 'alert-success'}`}>
            {message}
          </div>
        )}

        <div className="row">
          {/* Today's Session Info */}
          <div className="col-md-6">
            <div className="card attendance-card">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">Today's Training Session</h5>
              </div>
              <div className="card-body">
                {session ? (
                  <div>
                    <p><strong>Date:</strong> {moment(session.date).format('MMMM DD, YYYY')}</p>
                    <p><strong>Training Type:</strong> Code of Conduct - Daily Orientation</p>
                    <p><strong>Trainer:</strong> {session.trainer_name}, {session.trainer_designation}</p>
                    <p><strong>Content:</strong> {session.training_content}</p>
                    <p><strong>Duration:</strong> {session.duration}</p>
                    <p><strong>Location:</strong> {session.location}</p>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    No training session scheduled for today.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Check-in Section */}
          <div className="col-md-6">
            <div className="card attendance-card">
              <div className="card-header bg-success text-white">
                <h5 className="mb-0">Attendance Check-in</h5>
              </div>
              <div className="card-body">
                {attendance ? (
                  <div className="text-center">
                    <div className="alert alert-success">
                      <h6>✓ You're checked in!</h6>
                      <p className="mb-1">Check-in time: {moment(attendance.check_in_time).format('HH:mm:ss')}</p>
                      {attendance.comments && (
                        <p className="mb-0">Comments: {attendance.comments}</p>
                      )}
                    </div>
                  </div>
                ) : session ? (
                  <div>
                    <div className="mb-3">
                      <label className="form-label">Comments (Optional)</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="Add any comments about today's session..."
                      />
                    </div>
                    <button
                      className="btn btn-checkin w-100"
                      onClick={handleCheckIn}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="loading-spinner me-2"></span>
                          Checking in...
                        </>
                      ) : (
                        'Check In'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="alert alert-info">
                    No training session available for check-in today.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* My Attendance History */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card attendance-card">
              <div className="card-header">
                <h5 className="mb-0">My Attendance Status</h5>
              </div>
              <div className="card-body">
                {attendance ? (
                  <div className="row">
                    <div className="col-md-6">
                      <h6>Today's Status</h6>
                      <span className="status-badge status-present">Present</span>
                      <p className="mt-2 mb-0">
                        <strong>Check-in Time:</strong> {moment(attendance.check_in_time).format('MMMM DD, YYYY HH:mm:ss')}
                      </p>
                      {attendance.comments && (
                        <p className="mb-0">
                          <strong>Comments:</strong> {attendance.comments}
                        </p>
                      )}
                    </div>
                    <div className="col-md-6">
                      <h6>Session Details</h6>
                      <p className="mb-1"><strong>Signature:</strong> {attendance.signature}</p>
                      <p className="mb-1"><strong>Job Title:</strong> {attendance.job_title || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="status-badge status-absent">Not Checked In</span>
                    <p className="mt-2 text-muted">
                      {session ? 'Click the check-in button above to mark your attendance.' : 'No session available today.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Training Information */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Training Information</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Training Details</h6>
                    <ul className="list-unstyled">
                      <li><strong>Type:</strong> Code of Conduct - Daily Orientation</li>
                      <li><strong>Department:</strong> Manufacturing Facility</li>
                      <li><strong>Location:</strong> Manufacturing Facility</li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <h6>Instructions</h6>
                    <ul className="list-unstyled">
                      <li>• Sign in upon arrival</li>
                      <li>• Add comments if needed</li>
                      <li>• Check-in is required daily</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
