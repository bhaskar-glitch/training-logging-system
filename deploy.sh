#!/bin/bash

echo "🚀 Deploying Training Logging System to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please login to Vercel first:"
    vercel login
fi

# Deploy to Vercel
echo "📦 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables in Vercel Dashboard:"
echo "   - JWT_SECRET: your-secret-key"
echo "   - NODE_ENV: production"
echo ""
echo "2. Default credentials:"
echo "   - Teacher: username=teacher, password=teacher123"
echo "   - Student: username=student, password=student123"
echo ""
echo "3. For production, migrate to a cloud database (see DEPLOYMENT.md)"
echo ""
echo "🌐 Your app is now live on Vercel!"
