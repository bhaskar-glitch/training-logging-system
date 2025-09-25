# Vercel Deployment Guide

This guide will help you deploy the Training Logging System to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Node.js**: Version 18 or higher
3. **Git**: For version control

## Deployment Steps

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy the Project

From the project root directory:

```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No**
- What's your project's name? **training-logging-system**
- In which directory is your code located? **./**

### 4. Environment Variables

Set the following environment variables in your Vercel dashboard:

```bash
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=production
```

### 5. Database Configuration

**Important**: The current setup uses SQLite which is not suitable for production on Vercel. For production, consider:

1. **PlanetScale** (MySQL)
2. **Supabase** (PostgreSQL)
3. **MongoDB Atlas**
4. **Vercel Postgres**

### 6. Redeploy

After setting environment variables:

```bash
vercel --prod
```

## Project Structure

```
training-logging-system/
├── api/                    # Vercel API routes
│   ├── db.js              # Database utilities
│   ├── auth.js            # Authentication utilities
│   ├── login.js           # Login endpoint
│   ├── training-sessions.js # Sessions API
│   └── attendance.js      # Attendance API
├── public/                 # Static files
│   ├── index.html         # Main application
│   ├── app.js            # Frontend JavaScript
│   └── styles.css        # Styling
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies
└── .vercelignore         # Files to ignore
```

## API Endpoints

- `POST /api/login` - User authentication
- `GET /api/training-sessions` - Get all sessions
- `POST /api/training-sessions` - Create new session
- `GET /api/attendance?sessionId=X` - Get session attendance
- `POST /api/attendance/checkin` - Student check-in

## Default Credentials

- **Teacher**: username: `teacher`, password: `teacher123`
- **Student**: username: `student`, password: `student123`

## Production Considerations

### 1. Database Migration

Replace SQLite with a cloud database:

```javascript
// Example with PlanetScale
const mysql = require('mysql2/promise');

const connection = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false }
});
```

### 2. Security

- Change default JWT secret
- Use strong passwords
- Enable HTTPS (automatic with Vercel)
- Add rate limiting
- Implement input validation

### 3. Performance

- Enable Vercel's CDN
- Optimize images
- Use caching headers
- Monitor function execution time

### 4. Monitoring

- Set up Vercel Analytics
- Monitor API usage
- Set up error tracking
- Database performance monitoring

## Troubleshooting

### Common Issues

1. **Function timeout**: Increase `maxDuration` in vercel.json
2. **Database errors**: Check connection string and credentials
3. **CORS issues**: Verify CORS headers in API routes
4. **Build failures**: Check Node.js version compatibility

### Debug Commands

```bash
# Check deployment status
vercel ls

# View logs
vercel logs

# Redeploy
vercel --prod

# Remove deployment
vercel remove
```

## Custom Domain

1. Go to Vercel Dashboard
2. Select your project
3. Go to Settings > Domains
4. Add your custom domain
5. Update DNS records as instructed

## Backup Strategy

- Regular database backups
- Export data to Excel regularly
- Version control all code changes
- Document configuration changes

## Support

For issues with:
- **Vercel**: Check [Vercel Documentation](https://vercel.com/docs)
- **Database**: Check your database provider's documentation
- **Application**: Check the project's GitHub issues
