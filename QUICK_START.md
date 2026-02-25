# Quick Start Guide - Testing the Integration

## Step 1: Start Backend Server

Open a terminal and run:
```bash
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```

Backend running at: **http://127.0.0.1:8000**
API docs at: **http://127.0.0.1:8000/docs**

## Step 2: Start React Native Frontend

Open a new terminal and run:
```bash
cd frontend
npm start
# or
npx expo start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code for physical device

## Step 3: Test Authentication

### First Time User - Signup
1. App opens to Login/Signup screen
2. Tap "Sign Up" link
3. Enter:
   - Email: `yourname@example.com`
   - Password: `YourPassword123`
   - Confirm Password: `YourPassword123`
4. Tap "Sign Up" button
5. ✅ You should be logged in and see the Dashboard

### Existing User - Login
1. Tap "Log In" link
2. Enter your credentials
3. Tap "Log In" button
4. ✅ You should see the Dashboard

## Step 4: Test Protected Routes

Navigate through the app:
- Dashboard (home screen)
- Check-In (mood/metrics entry)
- Insights (trends and analytics)
- Support (counselor chat)

All routes should load with your user context.

## Step 5: Test Token Persistence

1. While logged in, completely close the app
2. Reopen the app
3. ✅ You should still be logged in (no need to re-authenticate)

## Step 6: Test Logout

1. Navigate to Settings or Profile screen
2. Tap "Logout" button
3. ✅ You should be redirected to Login screen

---

## Troubleshooting

### Backend Not Running
**Symptom**: "Network request failed" error  
**Fix**: Ensure backend is running at http://127.0.0.1:8000

### CORS Error
**Symptom**: Blocked by CORS policy  
**Fix**: Backend CORS is already configured. Restart backend server.

### On Physical Device
**Symptom**: Cannot connect to localhost  
**Fix**: Update `frontend/src/services/authService.js`:
```javascript
const API_BASE_URL = 'http://YOUR_COMPUTER_IP:8000';
```

---

## Test Credentials

You can create any account you want! Examples:
- Email: `test@example.com` / Password: `TestPass123`
- Email: `alice@example.com` / Password: `Alice123`
- Email: `bob@example.com` / Password: `Bob12345`

---

**Happy Testing! 🚀**
