# Training Logging System - Vercel Deployment

## Quick Start

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Set Environment Variables** in Vercel Dashboard:
   - `JWT_SECRET`: Your secret key for JWT tokens
   - `NODE_ENV`: production

## Default Login Credentials

- **Teacher**: username: `teacher`, password: `teacher123`
- **Student**: username: `student`, password: `student123`

## Important Notes

⚠️ **Database Limitation**: The current setup uses SQLite which is not persistent on Vercel. For production use, migrate to a cloud database like PlanetScale, Supabase, or Vercel Postgres.

## Project Structure

- `api/` - Vercel serverless functions
- `public/` - Static frontend files
- `vercel.json` - Vercel configuration

## API Endpoints

- `POST /api/login` - Authentication
- `GET /api/training-sessions` - Get sessions
- `POST /api/training-sessions` - Create session
- `GET /api/attendance?sessionId=X` - Get attendance
- `POST /api/attendance/checkin` - Check-in

## Production Database Migration

Replace SQLite with a cloud database for production use. See DEPLOYMENT.md for detailed instructions.
