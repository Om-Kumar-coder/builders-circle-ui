#!/bin/bash

# Builder's Circle - Appwrite Infrastructure Setup Script
# This script automates the installation of Docker, Docker Compose, and Appwrite

set -e

echo "=========================================="
echo "Builder's Circle Infrastructure Setup"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "Please do not run this script as root"
   exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo ""
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed successfully"
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose
echo ""
echo "🔧 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed successfully"
else
    echo "✅ Docker Compose already installed"
fi

# Verify installations
echo ""
echo "🔍 Verifying installations..."
docker --version
docker-compose --version

# Install Appwrite
echo ""
echo "🚀 Installing Appwrite..."
mkdir -p ~/appwrite
cd ~/appwrite

if [ ! -f "docker-compose.yml" ]; then
    curl -o docker-compose.yml https://appwrite.io/install/compose
    echo "✅ Appwrite downloaded"
else
    echo "✅ Appwrite already downloaded"
fi

# Start Appwrite
echo ""
echo "🎯 Starting Appwrite..."
docker-compose up -d

# Wait for Appwrite to start
echo ""
echo "⏳ Waiting for Appwrite to start (this may take a minute)..."
sleep 30

# Check status
echo ""
echo "📊 Checking Appwrite status..."
docker ps | grep appwrite

echo ""
echo "=========================================="
echo "✅ Installation Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Access Appwrite Console at: http://$(curl -s ifconfig.me)"
echo "2. Create your admin account"
echo "3. Create a new project named 'Builder's Circle'"
echo "4. Follow the INFRASTRUCTURE_RECONSTRUCTION_GUIDE.md for database setup"
echo ""
echo "⚠️  IMPORTANT: You may need to logout and login again for Docker group changes to take effect"
echo ""
