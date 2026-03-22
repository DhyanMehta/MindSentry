#!/bin/bash
# MindSentry Chatbot & Agent System - Quick Setup Script
# This script helps you set up the entire system in minutes

set -e

echo "🚀 MindSentry Chatbot & Agent System Setup"
echo "=========================================="
echo ""

# Step 1: Check Python
echo "✓ Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required. Please install Python 3.8+"
    exit 1
fi
echo "✅ Python found: $(python3 --version)"
echo ""

# Step 2: Check if in backend directory
echo "✓ Checking directory..."
if [ ! -f "requirements.txt" ]; then
    echo "❌ Please run this script from the backend directory"
    exit 1
fi
echo "✅ In backend directory"
echo ""

# Step 3: Create virtual environment
echo "✓ Setting up Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment exists"
fi

# Activate venv
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi
echo "✅ Virtual environment activated"
echo ""

# Step 4: Upgrade pip
echo "✓ Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1
echo "✅ pip upgraded"
echo ""

# Step 5: Install dependencies
echo "✓ Installing dependencies (this may take a few minutes)..."
if ! pip install -r requirements.txt; then
    echo "❌ Dependency installation failed"
    echo ""
    echo "Please ensure you have:"
    echo "  - Internet connection"
    echo "  - At least 500MB of free disk space"
    echo "  - The requirements.txt file is readable"
    echo ""
    echo "Retry with: pip install -r requirements.txt"
    exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Step 6: Check for .env file
echo "✓ Checking environment configuration..."
if [ ! -f ".env" ]; then
    echo "❌ .env file not found"
    echo ""
    echo "Please create a .env file with:"
    echo "  GROQ_API_KEY=your_groq_api_key"
    echo "  DATABASE_URL=postgresql://user:password@localhost/mindsentry"
    echo ""
    echo "Get GROQ API key from: https://console.groq.com"
    exit 1
fi

# Check for GROQ_API_KEY
if ! grep -q "GROQ_API_KEY" .env; then
    echo "⚠️  GROQ_API_KEY not found in .env"
    echo "   Get one from: https://console.groq.com"
else
    echo "✅ .env file configured"
fi
echo ""

# Step 7: Database
echo "✓ Checking database..."
if grep -q "DATABASE_URL" .env; then
    echo "✅ Database configured"
else
    echo "⚠️  DATABASE_URL not configured in .env"
fi
echo ""

# Step 8: Summary and next steps
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Start the backend server:"
echo "   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "2. In another terminal, start frontend:"
echo "   cd ../frontend"
echo "   npm install expo-location expo-permissions"
echo "   npm start"
echo ""
echo "3. Test the API with a health check:"
echo "   curl http://localhost:8000/health"
echo ""
echo "4. Test chat endpoint (after authentication):"
echo "   curl -X POST http://localhost:8000/api/v2/chat-agent/chat/message \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"message\": \"Hello\"}'"
echo ""
echo "📚 Documentation:"
echo "   - Setup Details: CHATBOT_AGENT_SETUP.md"
echo "   - Implementation: IMPLEMENTATION_GUIDE.md"
echo ""
echo "🎯 Key Features:"
echo "   ✨ RAG-Enhanced Chatbot with context awareness"
echo "   🤖 Intelligent Agent System (ReAct pattern)"
echo "   🏥 Health Clinic Finder"
echo "   📅 Appointment Booking"
echo "   🚑 Emergency Dispatch"
echo ""
