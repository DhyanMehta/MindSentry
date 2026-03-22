@echo off
REM MindSentry Chatbot & Agent System - Quick Setup Script (Windows)
REM This script helps you set up the entire system in minutes

setlocal enabledelayedexpansion

echo.
echo 🚀 MindSentry Chatbot ^& Agent System Setup
echo ==========================================
echo.

REM Step 1: Check Python
echo ✓ Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is required. Please install Python 3.8+
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✅ Python found: %PYTHON_VERSION%
echo.

REM Step 2: Check if in backend directory
echo ✓ Checking directory...
if not exist "requirements.txt" (
    echo ❌ Please run this script from the backend directory
    pause
    exit /b 1
)
echo ✅ In backend directory
echo.

REM Step 3: Create virtual environment
echo ✓ Setting up Python environment...
if not exist "venv" (
    python -m venv venv
    echo ✅ Virtual environment created
) else (
    echo ✅ Virtual environment exists
)
echo.

REM Step 4: Activate venv
echo ✓ Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ❌ Failed to activate virtual environment
    pause
    exit /b 1
)
echo ✅ Virtual environment activated
echo.

REM Step 5: Upgrade pip
echo ✓ Upgrading pip...
python -m pip install --upgrade pip >nul 2>&1
echo ✅ pip upgraded
echo.

REM Step 6: Install dependencies
echo ✓ Installing dependencies (this may take a few minutes)...
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Dependency installation failed
    echo.
    echo Please ensure you have:
    echo   - Internet connection
    echo   - At least 500MB of free disk space
    echo   - The requirements.txt file is readable
    echo.
    echo Retry with: pip install -r requirements.txt
    pause
    exit /b 1
) else (
    echo ✅ Dependencies installed
)
echo.

REM Step 7: Check for .env file
echo ✓ Checking environment configuration...
if not exist ".env" (
    echo ❌ .env file not found
    echo.
    echo Please create a .env file with:
    echo   GROQ_API_KEY=your_groq_api_key
    echo   DATABASE_URL=postgresql://user:password@localhost/mindsentry
    echo.
    echo Get GROQ API key from: https://console.groq.com
    pause
    exit /b 1
)
echo ✅ .env file found
echo.

REM Step 8: Check .env contents
findstr "GROQ_API_KEY" .env >nul
if errorlevel 1 (
    echo ⚠️  GROQ_API_KEY not found in .env
    echo     Get one from: https://console.groq.com
) else (
    echo ✅ GROQ_API_KEY configured
)
echo.

REM Step 9: Summary
echo ==========================================
echo ✅ Setup Complete!
echo ==========================================
echo.
echo 📋 Next Steps:
echo.
echo 1. Start the backend server:
echo    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
echo 2. In another terminal, start frontend:
echo    cd ..\frontend
echo    npm install expo-location expo-permissions
echo    npm start
echo.
echo 3. Test the API with a health check:
echo    curl http://localhost:8000/health
echo.
echo 📚 Documentation:
echo    - Setup Details: CHATBOT_AGENT_SETUP.md
echo    - Implementation: IMPLEMENTATION_GUIDE.md
echo.
echo 🎯 Key Features:
echo    ✨ RAG-Enhanced Chatbot with context awareness
echo    🤖 Intelligent Agent System (ReAct pattern)
echo    🏥 Health Clinic Finder
echo    📅 Appointment Booking
echo    🚑 Emergency Dispatch
echo.
pause
