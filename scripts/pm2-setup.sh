#!/bin/bash

# PM2 Setup Script for LM Studio Wrapper
# This script sets up PM2 for auto-restart on reboot

set -e

echo "🚀 Setting up PM2 for LM Studio Wrapper..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
    echo "✅ PM2 installed successfully"
else
    echo "✅ PM2 is already installed"
fi

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
else
    echo "✅ Bun is installed"
fi

# Create logs directory if it doesn't exist
mkdir -p logs
echo "✅ Logs directory created"

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Run quality checks
echo "🔍 Running quality checks..."
bun run quality:check

# Generate PM2 startup script
echo "⚙️  Generating PM2 startup script..."
pm2 startup

# Start the application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Show status
echo "📊 Current PM2 status:"
pm2 status

echo ""
echo "🎉 PM2 setup complete!"
echo ""
echo "📋 Useful commands:"
echo "  bun run pm2:status    - Check application status"
echo "  bun run pm2:logs      - View application logs"
echo "  bun run pm2:monit     - Open PM2 monitoring dashboard"
echo "  bun run pm2:restart   - Restart the application"
echo "  bun run pm2:stop      - Stop the application"
echo "  bun run pm2:delete    - Remove the application from PM2"
echo ""
echo "🔄 The application will now auto-start on system reboot!"
