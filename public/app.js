// Global variables
let currentUser = null;
let currentToken = null;
let currentSession = null;
let currentAttendance = [];
let allSessions = [];
let selectedSessionId = null; // Track which session is selected for attendance
let sessionTimeout = null; // Track session timeout
let lastActivity = Date.now(); // Track last user activity

// API Base URL
const API_BASE = '';

// Utility functions
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = 'alert alert-danger';
    element.classList.remove('hidden');
}

function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = 'alert alert-success';
    element.classList.remove('hidden');
}

function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    element.classList.add('hidden');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

// API functions
async function apiCall(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(currentToken && { 'Authorization': `Bearer ${currentToken}` })
        },
        ...options
    };

    console.log('Making API call to:', url, 'with config:', config);

    try {
        const response = await fetch(url, config);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication
async function login(email, password) {
    try {
        const data = await apiCall('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        currentUser = data.user;
        currentToken = data.token;
        
        // Store token in localStorage
        localStorage.setItem('token', currentToken);
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        return data;
    } catch (error) {
        throw error;
    }
}

function logout() {
    currentUser = null;
    currentToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear session timeout
    if (sessionTimeout) {
        clearTimeout(sessionTimeout);
        sessionTimeout = null;
    }
    
    showLoginScreen();
}

// Session timeout management
function resetSessionTimeout() {
    lastActivity = Date.now();
    
    if (sessionTimeout) {
        clearTimeout(sessionTimeout);
    }
    
    // Set timeout for 30 minutes of inactivity
    sessionTimeout = setTimeout(() => {
        alert('Your session has expired due to inactivity. Please log in again.');
        logout();
    }, 30 * 60 * 1000); // 30 minutes
}

// Track user activity
function trackActivity() {
    lastActivity = Date.now();
}

// Forgot password functions
function showForgotPassword() {
    const modal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
    modal.show();
}

async function handleForgotPassword() {
    const email = document.getElementById('resetEmail').value;
    
    if (!email) {
        showError('forgotPasswordError', 'Please enter your email address');
        return;
    }
    
    try {
        // For now, just show a message (in a real app, this would send an email)
        showSuccess('forgotPasswordSuccess', 'Password reset instructions have been sent to your email address. Please check your inbox.');
        
        // Clear the form
        document.getElementById('forgotPasswordForm').reset();
        
        // Close modal after 3 seconds
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal'));
            modal.hide();
        }, 3000);
        
    } catch (error) {
        showError('forgotPasswordError', 'Failed to send reset email. Please try again.');
    }
}

// UI Functions
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('teacherDashboard').classList.add('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');
    hideMessage('loginError');
}

function showTeacherDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('teacherDashboard').classList.remove('hidden');
    document.getElementById('studentDashboard').classList.add('hidden');
    
    document.getElementById('teacherName').textContent = `Welcome, ${currentUser.full_name}`;
    loadTeacherData();
    
    // Start session timeout
    resetSessionTimeout();
}

function showStudentDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('teacherDashboard').classList.add('hidden');
    document.getElementById('studentDashboard').classList.remove('hidden');
    
    document.getElementById('studentName').textContent = `Welcome, ${currentUser.full_name}`;
    loadStudentData();
    
    // Start session timeout
    resetSessionTimeout();
}

// Teacher functions
async function loadTeacherData() {
    try {
        // Load today's session
        await loadTodaySession();
        
        // Load all sessions
        await loadAllSessions();
        
        // Load session selector for attendance tab
        await loadSessionSelector();
        
        // Load students
        await loadStudents();
        
        // Set current date and auto-fill all fields
        const today = new Date();
        const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format for date input
        const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Auto-fill all form fields
        document.getElementById('trainingDate').value = dateString;
        document.getElementById('dayOfWeek').value = dayOfWeek;
        document.getElementById('department').value = 'Manufacturing Facility';
        document.getElementById('trainingType').value = 'Code of Conduct - Daily Orientation';
        document.getElementById('trainingTitle').value = 'Code of Conduct - Daily Orientation';
        document.getElementById('location').value = 'Manufacturing Facility';
        
        // Set default times
        document.getElementById('startTime').value = '10:30';
    } catch (error) {
        console.error('Error loading teacher data:', error);
    }
}

async function loadTodaySession() {
    try {
        const session = await apiCall('/api/training-session/today');
        currentSession = session;
        
        if (session) {
            // Check if sessionInfo element exists before trying to update it
            const sessionInfoElement = document.getElementById('sessionInfo');
            if (sessionInfoElement) {
                // Show session info in the exact format from reference
                sessionInfoElement.innerHTML = `
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label"><strong>Date of Training:</strong></label>
                        <input type="text" class="form-control" value="${formatDate(session.date)}" readonly style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>Department:</strong></label>
                        <input type="text" class="form-control" value="Manufacturing Facility" readonly style="background-color: #f8f9fa;">
                    </div>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <label class="form-label"><strong>Trainer Details, Designation:</strong></label>
                        <input type="text" class="form-control" value="${session.trainer_name}, ${session.trainer_designation}" readonly style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>Training Type:</strong></label>
                        <input type="text" class="form-control" value="Code of Conduct - Daily Orientation" readonly style="background-color: #f8f9fa;">
                    </div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label"><strong>Training Content:</strong></label>
                    <textarea class="form-control" rows="3" readonly style="background-color: #f8f9fa;">${session.training_content}</textarea>
                </div>
                
                <div class="mb-3">
                    <label class="form-label"><strong>Duration:</strong></label>
                    <input type="text" class="form-control" value="${session.duration}" readonly style="background-color: #f8f9fa;">
                </div>
                
                <div class="alert alert-success">
                    <h6>✓ Training session created successfully!</h6>
                    <p class="mb-0">Students can now check in for today's session.</p>
                </div>
                
                <div class="text-center mt-3">
                    <button class="btn btn-outline-primary" onclick="showCreateForm()">Create New Session</button>
                </div>
            `;
                document.getElementById('sessionForm').classList.add('hidden');
            }
            
            // Load attendance
            await loadAttendance();
        } else {
            // Show form to create session
            const sessionInfoElement = document.getElementById('sessionInfo');
            if (sessionInfoElement) {
                sessionInfoElement.innerHTML = '';
            }
            document.getElementById('sessionForm').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

async function loadAllSessions() {
    try {
        allSessions = await apiCall('/api/training-sessions');
        displaySessionsList();
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

function displaySessionsList() {
    const sessionsList = document.getElementById('sessionsList');
    
    if (allSessions.length === 0) {
        sessionsList.innerHTML = '<div class="alert alert-info">No training sessions created yet.</div>';
        return;
    }
    
    // Check if mobile screen
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Mobile card layout
        let html = '<div class="row">';
        
        allSessions.forEach(session => {
            const startTime = session.session_start_time ? 
                new Date(session.session_start_time).toLocaleString() : 'Not set';
            const endTime = session.session_end_time ? 
                new Date(session.session_end_time).toLocaleString() : 'Ongoing';
            const statusClass = session.session_end_time ? 'status-completed' : 'status-ongoing';
            const statusText = session.session_end_time ? 'Completed' : 'Active';
            
            html += `
                <div class="col-12 mb-3">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${formatDate(session.date)}</h6>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <div class="card-body">
                            <div class="row mb-2">
                                <div class="col-6"><strong>Trainer:</strong></div>
                                <div class="col-6">${session.trainer_name}, ${session.trainer_designation}</div>
                            </div>
                            <div class="row mb-2">
                                <div class="col-6"><strong>Content:</strong></div>
                                <div class="col-6">${session.training_content.substring(0, 30)}${session.training_content.length > 30 ? '...' : ''}</div>
                            </div>
                            <div class="row mb-2">
                                <div class="col-6"><strong>Start:</strong></div>
                                <div class="col-6">${startTime}</div>
                            </div>
                            <div class="row mb-3">
                                <div class="col-6"><strong>End:</strong></div>
                                <div class="col-6">${endTime}</div>
                            </div>
                            <div class="d-grid gap-2 d-md-flex">
                                ${!session.session_end_time ? 
                                    `<button class="btn btn-danger btn-sm" onclick="endSession(${session.id})">
                                        <i class="fas fa-stop"></i> End
                                     </button>` : ''
                                }
                                <button class="btn btn-info btn-sm" onclick="viewSession(${session.id})">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="btn btn-success btn-sm" onclick="exportSessionExcel(${session.id})">
                                    <i class="fas fa-file-excel"></i> Export
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        sessionsList.innerHTML = html;
    } else {
        // Desktop table layout
        let html = '<div class="table-responsive"><table class="table table-striped">';
        html += '<thead><tr>';
        html += '<th>Date</th>';
        html += '<th>Trainer</th>';
        html += '<th>Content</th>';
        html += '<th>Start Time</th>';
        html += '<th>End Time</th>';
        html += '<th>Status</th>';
        html += '<th>Actions</th>';
        html += '</tr></thead><tbody>';
        
        allSessions.forEach(session => {
            const startTime = session.session_start_time ? 
                new Date(session.session_start_time).toLocaleString() : 'Not set';
            const endTime = session.session_end_time ? 
                new Date(session.session_end_time).toLocaleString() : 'Ongoing';
            const status = session.session_end_time ? 
                '<span class="badge bg-success">Completed</span>' : 
                '<span class="badge bg-warning">Active</span>';
            
            html += '<tr>';
            html += `<td>${formatDate(session.date)}</td>`;
            html += `<td>${session.trainer_name}, ${session.trainer_designation}</td>`;
            html += `<td>${session.training_content.substring(0, 50)}${session.training_content.length > 50 ? '...' : ''}</td>`;
            html += `<td>${startTime}</td>`;
            html += `<td>${endTime}</td>`;
            html += `<td>${status}</td>`;
            html += '<td>';
            
            if (!session.session_end_time) {
                html += `<button class="btn btn-danger btn-sm me-1" onclick="endSession(${session.id})">
                            <i class="fas fa-stop"></i> End Session
                         </button>`;
            }
            
            html += `<button class="btn btn-info btn-sm me-1" onclick="viewSession(${session.id})">
                        <i class="fas fa-eye"></i> View
                     </button>`;
            html += `<button class="btn btn-success btn-sm me-1" onclick="exportSessionExcel(${session.id})">
                        <i class="fas fa-file-excel"></i> Export
                     </button>`;
            html += `<button class="btn btn-danger btn-sm" onclick="deleteSession(${session.id})">
                        <i class="fas fa-trash"></i> Delete
                     </button>`;
            html += '</td></tr>';
        });
        
        html += '</tbody></table></div>';
        sessionsList.innerHTML = html;
    }
}

async function endSession(sessionId) {
    if (!confirm('Are you sure you want to end this session?')) {
        return;
    }
    
    try {
        await apiCall('/api/training-session/end', {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId })
        });
        
        showSuccess('teacherMessage', 'Session ended successfully!');
        await loadAllSessions();
    } catch (error) {
        showError('teacherMessage', error.message);
    }
}

function viewSession(sessionId) {
    const session = allSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const startTime = session.session_start_time ? 
        new Date(session.session_start_time).toLocaleString() : 'Not set';
    const endTime = session.session_end_time ? 
        new Date(session.session_end_time).toLocaleString() : 'Session ongoing';
    
    const modal = `
        <div class="modal fade" id="sessionModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Session Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong>Date:</strong> ${formatDate(session.date)}
                            </div>
                            <div class="col-md-6">
                                <strong>Trainer:</strong> ${session.trainer_name}, ${session.trainer_designation}
                            </div>
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong>Start Time:</strong> ${startTime}
                            </div>
                            <div class="col-md-6">
                                <strong>End Time:</strong> ${endTime}
                            </div>
                        </div>
                        <div class="mb-3">
                            <strong>Content:</strong><br>
                            ${session.training_content}
                        </div>
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong>Duration:</strong> ${session.duration}
                            </div>
                            <div class="col-md-6">
                                <strong>Location:</strong> ${session.location}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('sessionModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modal);
    
    // Show modal
    const modalElement = new bootstrap.Modal(document.getElementById('sessionModal'));
    modalElement.show();
}

async function exportSessionExcel(sessionId) {
    try {
        const response = await fetch(`/api/export/excel/session/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `training-attendance-session-${sessionId}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        showError('teacherMessage', 'Error exporting to Excel: ' + error.message);
    }
}

async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone and will also delete all associated attendance records.')) {
        return;
    }
    
    try {
        await apiCall(`/api/training-session/${sessionId}`, {
            method: 'DELETE'
        });
        
        showSuccess('teacherMessage', 'Session deleted successfully!');
        await loadAllSessions();
    } catch (error) {
        showError('teacherMessage', error.message);
    }
}

// Load session selector dropdown
async function loadSessionSelector() {
    try {
        const sessions = await apiCall('/api/training-sessions');
        const selector = document.getElementById('sessionSelector');
        
        // Clear existing options
        selector.innerHTML = '<option value="">Choose a session...</option>';
        
        // Add sessions to selector
        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = `${formatDate(session.date)} - ${session.trainer_name} (${session.training_type || 'Code of Conduct - Daily Orientation'})`;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading sessions for selector:', error);
    }
}

// Handle session selection
function onSessionSelect() {
    const selector = document.getElementById('sessionSelector');
    const viewBtn = document.getElementById('viewAttendanceBtn');
    
    selectedSessionId = selector.value;
    viewBtn.disabled = !selectedSessionId;
    
    if (selectedSessionId) {
        loadAttendance();
    } else {
        document.getElementById('attendanceTable').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-calendar-alt fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">Select a session to view attendance</h5>
                <p class="text-muted">Choose a training session from the dropdown above.</p>
            </div>
        `;
    }
}

async function loadAttendance() {
    if (!selectedSessionId) {
        document.getElementById('attendanceTable').innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-calendar-alt fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">Select a session to view attendance</h5>
                <p class="text-muted">Choose a training session from the dropdown above.</p>
            </div>
        `;
        return;
    }

    try {
        const data = await apiCall(`/api/attendance/session/${selectedSessionId}`);
        currentAttendance = data.attendance || [];
        
        if (currentAttendance.length > 0) {
            // Check if mobile screen
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // Mobile card layout
                let html = '<div class="row">';
                
                currentAttendance.forEach((record, index) => {
                    html += `
                        <div class="col-12 mb-3">
                            <div class="card">
                                <div class="card-header d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">#${index + 1} ${record.student_name}</h6>
                                    <small class="text-muted">${formatTime(record.check_in_time)}</small>
                                </div>
                                <div class="card-body">
                                    <div class="row mb-2">
                                        <div class="col-6"><strong>Job Title:</strong></div>
                                        <div class="col-6">${record.job_title || 'N/A'}</div>
                                    </div>
                                    <div class="row mb-2">
                                        <div class="col-6"><strong>Signature:</strong></div>
                                        <div class="col-6">${record.signature}</div>
                                    </div>
                                    ${record.comments ? `
                                        <div class="row">
                                            <div class="col-12">
                                                <strong>Comments:</strong>
                                                <p class="mt-1 mb-0 text-muted">${record.comments}</p>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += '</div>';
                document.getElementById('attendanceTable').innerHTML = html;
            } else {
                // Desktop table layout
                const table = `
                    <div class="table-responsive">
                        <table class="table table-striped table-hover">
                            <thead class="table-dark">
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
                                ${currentAttendance.map((record, index) => `
                                    <tr>
                                        <td class="fw-bold">${index + 1}</td>
                                        <td class="fw-semibold">${record.student_name}</td>
                                        <td>${record.job_title || 'N/A'}</td>
                                        <td><span class="badge bg-secondary">${record.signature}</span></td>
                                        <td>${record.comments || '-'}</td>
                                        <td class="text-muted">${formatTime(record.check_in_time)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                document.getElementById('attendanceTable').innerHTML = table;
            }
        } else {
            document.getElementById('attendanceTable').innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-users fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No attendance records for this session</h5>
                    <p class="text-muted">Students will appear here once they check in to this session.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
        document.getElementById('attendanceTable').innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error loading attendance data. Please try again.
            </div>
        `;
    }
}

async function loadStudents() {
    try {
        const students = await apiCall('/api/students');
        
        if (students.length > 0) {
            const list = `
                <div class="list-group">
                    ${students.map(student => `
                        <div class="list-group-item">
                            <div class="d-flex w-100 justify-content-between">
                                <h6 class="mb-1">${student.full_name}</h6>
                                <small>${student.job_title || ''}</small>
                            </div>
                            <p class="mb-1">@${student.username}</p>
                        </div>
                    `).join('')}
                </div>
            `;
            document.getElementById('studentsList').innerHTML = list;
        } else {
            document.getElementById('studentsList').innerHTML = '<p class="text-muted">No students added yet.</p>';
        }
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

// Function to update duration display
// Duration will be calculated automatically when session ends

async function createSession() {
    const trainerName = document.getElementById('trainerName').value;
    const trainerDesignation = document.getElementById('trainerDesignation').value;
    const trainingContent = document.getElementById('trainingContent').value;
    const trainingDate = document.getElementById('trainingDate').value;
    const startTime = document.getElementById('startTime').value;
    const department = document.getElementById('department').value;
    const trainingType = document.getElementById('trainingType').value;
    const location = document.getElementById('location').value;
    const trainingTitle = document.getElementById('trainingTitle').value;
    
    // Create session start time by combining date and time
    const sessionStartTime = `${trainingDate} ${startTime}:00`;
    
    // Duration will be calculated when session ends
    const duration = "Session ongoing";
    
    try {
        await apiCall('/api/training-session', {
            method: 'POST',
            body: JSON.stringify({
                trainer_name: trainerName,
                trainer_designation: trainerDesignation,
                training_content: trainingContent,
                duration: duration,
                department: department,
                training_type: trainingType,
                location: location,
                training_title: trainingTitle,
                training_date: trainingDate,
                session_start_time: sessionStartTime
            })
        });
        
        showSuccess('teacherMessage', 'Training session created successfully!');
        
        // Hide the form
        document.getElementById('sessionFormCard').style.display = 'none';
        
        // Reload data
        await loadTodaySession();
        await loadAllSessions();
    } catch (error) {
        showError('teacherMessage', error.message);
    }
}

async function addStudent() {
    const email = document.getElementById('studentEmail').value;
    const password = document.getElementById('studentPassword').value;
    const fullName = document.getElementById('studentFullName').value;
    const jobTitle = document.getElementById('studentJobTitle').value;
    const phone = document.getElementById('studentPhone').value;
    const department = document.getElementById('studentDepartment').value;
    
    try {
        await apiCall('/api/students', {
            method: 'POST',
            body: JSON.stringify({
                email: email,
                password: password,
                full_name: fullName,
                job_title: jobTitle,
                phone: phone,
                department: department
            })
        });
        
        showSuccess('teacherMessage', 'Student added successfully!');
        
        // Clear form
        document.getElementById('studentForm').reset();
        
        // Reload students
        await loadStudents();
    } catch (error) {
        showError('teacherMessage', error.message);
    }
}

async function exportToExcel() {
    try {
        const response = await fetch('/api/export/excel/today', {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `training-attendance-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        showError('teacherMessage', 'Error exporting to Excel');
    }
}

// Student functions
async function loadStudentData() {
    try {
        await loadLatestSessionForStudent();
    } catch (error) {
        console.error('Error loading student data:', error);
    }
}

async function loadLatestSessionForStudent() {
    try {
        // Get the latest session (most recent)
        const sessions = await apiCall('/api/training-sessions');
        const latestSession = sessions && sessions.length > 0 ? sessions[0] : null;
        currentSession = latestSession;
        
        if (latestSession) {
            // Show session info in the exact format from reference
            document.getElementById('studentSessionInfo').innerHTML = `
                <div class="row mb-2">
                    <div class="col-md-6">
                        <label class="form-label"><strong>Date of Training:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${formatDate(latestSession.date)}" readonly style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>Department:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${latestSession.department || 'Manufacturing Facility'}" readonly style="background-color: #f8f9fa;">
                    </div>
                </div>
                
                <div class="row mb-2">
                    <div class="col-md-6">
                        <label class="form-label"><strong>Trainer Details, Designation:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${latestSession.trainer_name}, ${latestSession.trainer_designation}" readonly style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>Training Type:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${latestSession.training_type || 'Code of Conduct - Daily Orientation'}" readonly style="background-color: #f8f9fa;">
                    </div>
                </div>
                
                <div class="mb-2">
                    <label class="form-label"><strong>Training Content:</strong></label>
                    <textarea class="form-control form-control-sm" rows="2" readonly style="background-color: #f8f9fa;">${latestSession.training_content}</textarea>
                </div>
                
                <div class="row mb-2">
                    <div class="col-md-6">
                        <label class="form-label"><strong>Duration:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${latestSession.duration || 'Session ongoing'}" readonly style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>Location:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${latestSession.location || 'Manufacturing Facility'}" readonly style="background-color: #f8f9fa;">
                    </div>
                </div>
                
                <div class="row mb-2">
                    <div class="col-md-6">
                        <label class="form-label"><strong>Start Time:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${latestSession.session_start_time ? new Date(latestSession.session_start_time).toLocaleString() : 'Not set'}" readonly style="background-color: #f8f9fa;">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label"><strong>End Time:</strong></label>
                        <input type="text" class="form-control form-control-sm" value="${latestSession.session_end_time ? new Date(latestSession.session_end_time).toLocaleString() : 'Session ongoing'}" readonly style="background-color: #f8f9fa;">
                    </div>
                </div>
            `;
            
            // Load my attendance for this session
            await loadMyAttendance(latestSession.id);
        } else {
            document.getElementById('studentSessionInfo').innerHTML = `
                <div class="alert alert-warning">No training session available.</div>
            `;
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

async function loadMyAttendance(sessionId) {
    try {
        const data = await apiCall('/api/attendance/today');
        const myAttendance = data.attendance?.find(record => record.student_id === currentUser.id && record.session_id === sessionId);
        
        if (myAttendance) {
            // Show check-in status
            document.getElementById('checkinSection').innerHTML = `
                <div class="text-center">
                    <div class="alert alert-success">
                        <h6>✓ You're checked in!</h6>
                        <p class="mb-1">Check-in time: ${formatTime(myAttendance.check_in_time)}</p>
                        ${myAttendance.comments ? `<p class="mb-0">Comments: ${myAttendance.comments}</p>` : ''}
                    </div>
                </div>
            `;
        } else if (currentSession) {
            // Show check-in form
            document.getElementById('checkinSection').innerHTML = `
                <div>
                    <div class="mb-3">
                        <label class="form-label">Comments (Optional)</label>
                        <textarea class="form-control" rows="3" id="checkinComments" placeholder="Add any comments about today's session..."></textarea>
                    </div>
                    <button class="btn btn-checkin w-100" onclick="checkIn()">
                        Check In
                    </button>
                </div>
            `;
        } else {
            // No session available
            document.getElementById('checkinSection').innerHTML = `
                <div class="alert alert-info">No training session available for check-in today.</div>
            `;
        }
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

async function checkIn() {
    const comments = document.getElementById('checkinComments').value;
    
    if (!currentSession) {
        showError('studentMessage', 'No active session available for check-in');
        return;
    }
    
    try {
        await apiCall('/api/attendance/checkin', {
            method: 'POST',
            body: JSON.stringify({ 
                comments: comments,
                sessionId: currentSession.id 
            })
        });
        
        showSuccess('studentMessage', 'Check-in successful!');
        
        // Reload data
        await loadMyAttendance(currentSession.id);
    } catch (error) {
        showError('studentMessage', error.message);
    }
}

// Teacher tab functions
function showTeacherTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Load data for specific tabs
    if (tabName === 'attendance') {
        loadAttendance();
    }
}

function showCreateForm() {
    // Show the form card
    document.getElementById('sessionFormCard').style.display = 'block';
    
    // Auto-fill all fields
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Set date and time fields
    document.getElementById('trainingDate').value = dateString;
    document.getElementById('startTime').value = '10:30';
    document.getElementById('dayOfWeek').value = dayOfWeek;
    
    // Set default values
    document.getElementById('department').value = 'Manufacturing Facility';
    document.getElementById('trainingType').value = 'Code of Conduct - Daily Orientation';
    document.getElementById('trainingTitle').value = 'Code of Conduct - Daily Orientation';
    document.getElementById('location').value = 'Manufacturing Facility';
    
    // Clear the fields that need to be filled by teacher
    document.getElementById('trainerName').value = '';
    document.getElementById('trainerDesignation').value = 'TCO';
    document.getElementById('trainingContent').value = '';
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentToken = token;
        currentUser = JSON.parse(user);
        
        if (currentUser.role === 'teacher') {
            showTeacherDashboard();
        } else {
            showStudentDashboard();
        }
    } else {
        showLoginScreen();
    }
    
    // Handle window resize for responsive design
    window.addEventListener('resize', function() {
        if (document.getElementById('sessionsList') && allSessions) {
            displaySessionsList();
        }
        if (document.getElementById('attendanceTable') && currentAttendance) {
            loadAttendance();
        }
    });
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('Login form submitted');
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        console.log('Attempting login with:', email);
        
        try {
            const data = await login(email, password);
            console.log('Login successful:', data);
            
            if (data.user.role === 'teacher') {
                showTeacherDashboard();
            } else {
                showStudentDashboard();
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('loginError', error.message);
        }
    });
    
    // Session form
    document.getElementById('sessionForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await createSession();
    });
    
    // Student form
    document.getElementById('studentForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await addStudent();
    });
    
    // Forgot password form
    document.getElementById('forgotPasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await handleForgotPassword();
    });
    
    // Track user activity for session timeout
    document.addEventListener('click', trackActivity);
    document.addEventListener('keypress', trackActivity);
    document.addEventListener('scroll', trackActivity);
    
    // Date field event listener to update day of week
    document.getElementById('trainingDate').addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
        document.getElementById('dayOfWeek').value = dayOfWeek;
    });
    
});
