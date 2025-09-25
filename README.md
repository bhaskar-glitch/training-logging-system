# Training Logging System

A comprehensive digital training attendance and data logging system built with Node.js, SQLite, and modern web technologies. Features mobile-responsive design, session management, and Excel export capabilities.

## 🚀 Features

### For Teachers
- **Session Management**: Create, view, edit, and delete training sessions
- **Attendance Tracking**: View session-specific attendance records
- **Student Management**: Add and manage student accounts
- **Excel Export**: Generate detailed attendance reports
- **Mobile Responsive**: Works perfectly on all devices

### For Students
- **Easy Check-in**: Simple one-click attendance check-in
- **Session Information**: View current training session details
- **Mobile Optimized**: Touch-friendly interface for mobile devices

### System Features
- **Session-Specific Attendance**: Each session has its own attendance records
- **JWT Authentication**: Secure user authentication and authorization
- **Real-time Updates**: Live attendance tracking and updates
- **Excel Integration**: Export attendance data to Excel format
- **Mobile-First Design**: Optimized for mobile and desktop use

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (development), Cloud databases (production)
- **Frontend**: Vanilla JavaScript, Bootstrap 5, HTML5, CSS3
- **Authentication**: JWT (JSON Web Tokens)
- **Export**: ExcelJS for Excel file generation
- **Deployment**: Vercel (Serverless)
- **Version Control**: Git, GitHub

## 📱 Mobile Responsive

The application is fully optimized for mobile devices with:
- Touch-friendly interface
- Responsive design for all screen sizes
- Mobile-specific layouts for better usability
- Optimized performance for mobile networks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for local development)
- Git
- Vercel account (for deployment)

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd training-logging-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - Open http://localhost:5000 in your browser

### Default Credentials

- **Teacher Account**:
  - Username: `teacher`
  - Password: `teacher123`

- **Student Account**:
  - Username: `student`
  - Password: `student123`

## 🌐 Deployment

### Vercel Deployment (Recommended)

1. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the project structure

2. **Set Environment Variables**:
   - `JWT_SECRET`: Your secret key for JWT tokens
   - `NODE_ENV`: production

3. **Deploy**:
   - Vercel will automatically deploy on every push to main branch

### Manual Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## 📁 Project Structure

```
training-logging-system/
├── api/                    # Vercel serverless functions
│   ├── db.js              # Database utilities
│   ├── auth.js            # Authentication utilities
│   ├── login.js           # Login endpoint
│   ├── training-sessions.js # Sessions API
│   └── attendance.js      # Attendance API
├── public/                 # Static frontend files
│   ├── index.html         # Main application
│   ├── app.js            # Frontend JavaScript
│   └── styles.css        # Mobile-optimized CSS
├── database/              # SQLite database (local only)
├── exports/               # Excel export files
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies and scripts
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## 🔧 API Endpoints

### Authentication
- `POST /api/login` - User login

### Training Sessions
- `GET /api/training-sessions` - Get all sessions
- `POST /api/training-sessions` - Create new session
- `PUT /api/training-sessions/:id` - Update session
- `DELETE /api/training-sessions/:id` - Delete session

### Attendance
- `GET /api/attendance?sessionId=X` - Get session attendance
- `POST /api/attendance/checkin` - Student check-in

### Export
- `GET /api/export/excel/session/:sessionId` - Export session to Excel

## 🎯 Key Features Explained

### Session-Specific Attendance
- Each training session has its own attendance records
- Students can only check into specific sessions
- Teachers can view attendance for individual sessions
- Excel exports are session-specific

### Mobile Optimization
- Responsive design works on all screen sizes
- Touch-friendly interface for mobile devices
- Optimized performance for mobile networks
- Card-based layout for better mobile experience

### Security
- JWT-based authentication
- Role-based access control (Teacher/Student)
- Secure password hashing with bcrypt
- CORS protection

## 🔄 CI/CD Pipeline

The project includes a complete CI/CD pipeline:

1. **Code Push**: Push changes to GitHub
2. **Automatic Build**: Vercel automatically builds the project
3. **Deployment**: Changes are deployed to production automatically
4. **Environment Management**: Environment variables managed in Vercel dashboard

## 📊 Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `password` - Hashed password
- `role` - 'teacher' or 'student'
- `full_name` - User's full name
- `job_title` - User's job title

### Training Sessions Table
- `id` - Primary key
- `date` - Session date
- `department` - Department name
- `location` - Training location
- `trainer_name` - Trainer's name
- `trainer_designation` - Trainer's designation
- `training_type` - Type of training
- `training_content` - Training content description
- `session_start_time` - Session start time
- `session_end_time` - Session end time
- `duration` - Calculated duration

### Attendance Table
- `id` - Primary key
- `session_id` - Foreign key to training_sessions
- `student_id` - Foreign key to users
- `check_in_time` - Check-in timestamp
- `signature` - Student signature
- `job_title` - Student's job title
- `comments` - Optional comments

## 🛡️ Security Considerations

- Change default passwords in production
- Use strong JWT secrets
- Implement rate limiting
- Use HTTPS in production
- Regular security updates
- Database backup strategy

## 📈 Performance Optimization

- Serverless architecture for scalability
- CDN for static assets
- Optimized database queries
- Mobile-first responsive design
- Efficient Excel generation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the [Issues](https://github.com/your-username/training-logging-system/issues) page
- Review the [Deployment Guide](DEPLOYMENT.md)
- Contact the development team

## 🔄 Version History

- **v1.0.0** - Initial release with core features
- Mobile-responsive design
- Session-specific attendance
- Excel export functionality
- Vercel deployment ready

---

**Built with ❤️ for efficient training management**