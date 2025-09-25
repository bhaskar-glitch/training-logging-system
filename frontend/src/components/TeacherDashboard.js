import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import axios from 'axios';
import moment from 'moment';

const TeacherDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('session');
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Session form state
  const [sessionForm, setSessionForm] = useState({
    trainer_name: user?.full_name || '',
    trainer_designation: user?.job_title || 'TCO',
    training_content: '',
    duration: '',
    session_start_time: moment().format('YYYY-MM-DDTHH:mm')
  });

  // Student form state
  const [studentForm, setStudentForm] = useState({
    username: '',
    password: '',
    full_name: '',
    job_title: ''
  });

  useEffect(() => {
    loadTodaySession();
    loadStudents();
  }, []);

  const loadTodaySession = async () => {
    try {
      const response = await axios.get('/api/training-session/today');
      setSession(response.data);
      if (response.data) {
        loadAttendance(response.data.id);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const loadAttendance = async (sessionId) => {
    try {
      const response = await axios.get(`/api/attendance/today`);
      setAttendance(response.data.attendance || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const loadStudents = async () => {
    try {
      const response = await axios.get('/api/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await axios.post('/api/training-session', sessionForm);
      setMessage('Training session created successfully!');
      loadTodaySession();
      setSessionForm({
        trainer_name: user?.full_name || '',
        trainer_designation: user?.job_title || 'TCO',
        training_content: '',
        duration: '',
        session_start_time: moment().format('YYYY-MM-DDTHH:mm')
      });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error creating session');
    }
    setLoading(false);
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      await axios.post('/api/students', studentForm);
      setMessage('Student added successfully!');
      loadStudents();
      setStudentForm({
        username: '',
        password: '',
        full_name: '',
        job_title: ''
      });
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error adding student');
    }
    setLoading(false);
  };

  const endSession = async () => {
    if (!session) return;
    
    setLoading(true);
    setMessage('');

    try {
      await axios.post('/api/training-session/end', { session_id: session.id });
      setMessage('Session ended successfully!');
      loadTodaySession();
    } catch (error) {
      setMessage(error.response?.data?.error || 'Error ending session');
    }
    setLoading(false);
  };

  const exportToExcel = async () => {
    try {
      const response = await axios.get('/api/export/excel/today', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `training-attendance-${moment().format('YYYY-MM-DD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setMessage('Error exporting to Excel');
    }
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

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'session' ? 'active' : ''}`}
              onClick={() => setActiveTab('session')}
            >
              Training Session
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              Attendance
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              Manage Students
            </button>
          </li>
        </ul>

        {/* Training Session Tab */}
        {activeTab === 'session' && (
          <div className="row">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Create Today's Training Session</h5>
                </div>
                <div className="card-body">
                  {session ? (
                    <div>
                      <h6>Today's Session Details:</h6>
                      <p><strong>Date:</strong> {moment(session.date).format('MMMM DD, YYYY')}</p>
                      <p><strong>Trainer:</strong> {session.trainer_name}, {session.trainer_designation}</p>
                      <p><strong>Content:</strong> {session.training_content}</p>
                      <p><strong>Duration:</strong> {session.duration}</p>
                      <p><strong>Location:</strong> {session.location}</p>
                      <p><strong>Start Time:</strong> {session.session_start_time ? moment(session.session_start_time).format('MMMM DD, YYYY HH:mm') : 'Not set'}</p>
                      {session.session_end_time && (
                        <p><strong>End Time:</strong> {moment(session.session_end_time).format('MMMM DD, YYYY HH:mm')}</p>
                      )}
                      {!session.session_end_time && (
                        <button 
                          className="btn btn-danger mt-2" 
                          onClick={endSession}
                          disabled={loading}
                        >
                          {loading ? 'Ending...' : 'End Session'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSessionSubmit}>
                      <div className="mb-3">
                        <label className="form-label">Trainer Name</label>
                        <input
                          type="text"
                          className="form-control"
                          value={sessionForm.trainer_name}
                          onChange={(e) => setSessionForm({...sessionForm, trainer_name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Designation</label>
                        <input
                          type="text"
                          className="form-control"
                          value={sessionForm.trainer_designation}
                          onChange={(e) => setSessionForm({...sessionForm, trainer_designation: e.target.value})}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Training Content</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={sessionForm.training_content}
                          onChange={(e) => setSessionForm({...sessionForm, training_content: e.target.value})}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Duration</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., 10:30 - 10:50 AM (20 min.)"
                          value={sessionForm.duration}
                          onChange={(e) => setSessionForm({...sessionForm, duration: e.target.value})}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Session Start Time</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={sessionForm.session_start_time}
                          onChange={(e) => setSessionForm({...sessionForm, session_start_time: e.target.value})}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Session'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Session Info</h5>
                </div>
                <div className="card-body">
                  <p><strong>Date of Training:</strong> {moment().format('DD/MM/YYYY')} (Auto-filled)</p>
                  <p><strong>Department:</strong> Manufacturing Facility</p>
                  <p><strong>Training Type:</strong> Code of Conduct - Daily Orientation</p>
                  <p><strong>Location:</strong> Manufacturing Facility</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>Today's Attendance</h5>
              <button className="btn btn-export" onClick={exportToExcel}>
                Export to Excel
              </button>
            </div>
            
            {attendance.length > 0 ? (
              <div className="attendance-table">
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>S. No.</th>
                        <th>Employee Name</th>
                        <th>Job Title</th>
                        <th>Signature</th>
                        <th>Comments</th>
                        <th>Check-in Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((record, index) => (
                        <tr key={record.id}>
                          <td>{index + 1}</td>
                          <td>{record.student_name}</td>
                          <td>{record.job_title || ''}</td>
                          <td>{record.signature}</td>
                          <td>{record.comments || ''}</td>
                          <td>{moment(record.check_in_time).format('HH:mm:ss')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="alert alert-info">
                No attendance records for today yet.
              </div>
            )}
          </div>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="row">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Add New Student</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={handleStudentSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Username</label>
                      <input
                        type="text"
                        className="form-control"
                        value={studentForm.username}
                        onChange={(e) => setStudentForm({...studentForm, username: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={studentForm.password}
                        onChange={(e) => setStudentForm({...studentForm, password: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={studentForm.full_name}
                        onChange={(e) => setStudentForm({...studentForm, full_name: e.target.value})}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Job Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={studentForm.job_title}
                        onChange={(e) => setStudentForm({...studentForm, job_title: e.target.value})}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Adding...' : 'Add Student'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header">
                  <h5>Existing Students</h5>
                </div>
                <div className="card-body">
                  {students.length > 0 ? (
                    <div className="list-group">
                      {students.map(student => (
                        <div key={student.id} className="list-group-item">
                          <div className="d-flex w-100 justify-content-between">
                            <h6 className="mb-1">{student.full_name}</h6>
                            <small>{student.job_title}</small>
                          </div>
                          <p className="mb-1">@{student.username}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">No students added yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
