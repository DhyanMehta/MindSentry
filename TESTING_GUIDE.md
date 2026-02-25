# MindSentry - Complete Testing Guide

## 🚀 Quick Start

### For Emulator/Simulator Testing
```bash
# Terminal 1: Start Backend
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload

# Terminal 2: Start Frontend
cd frontend
npm start
```

Then press `i` for iOS or `a` for Android emulator.

---

### For Physical Device Testing (Expo Go)
```bash
# Terminal 1: Start Backend (note: --host 0.0.0.0)
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Start Frontend
cd frontend
npm start
```

Then scan QR code with:
- **iOS:** Camera app
- **Android:** Expo Go app

---

## 📱 Environment Detection

The app automatically uses the correct API URL:

| Testing Method | API URL | Auto-Detected? |
|----------------|---------|----------------|
| iOS Simulator | `http://localhost:8000` | ✅ Yes |
| Android Emulator | `http://10.0.2.2:8000` | ✅ Yes |
| Expo Go (iPhone/Android) | `http://[YOUR_IP]:8000` | ✅ Yes |
| Production Build | From environment variable | ⚙️ Manual |

**You don't need to change anything!** The app automatically detects where it's running.

---

## ✅ Complete Testing Checklist

### Authentication Tests
- [ ] **Signup** - Create new account
  - Email: `test@example.com`
  - Password: `TestPass123`
  - Confirm Password: `TestPass123`
- [ ] **Password Validation** - Try mismatched passwords
- [ ] **Login** - Login with created account
- [ ] **Invalid Login** - Try wrong credentials
- [ ] **Error Messages** - Verify proper error display

### Navigation Tests
- [ ] **Tab Navigation** - Switch between all tabs
- [ ] **Screen Transitions** - Navigate between screens
- [ ] **Back Button** - Android back button works
- [ ] **Deep Linking** - If implemented

### Data Persistence Tests
- [ ] **Stay Logged In** - Close and reopen app
- [ ] **Session Token** - Verify token is stored
- [ ] **User Data** - User info persists
- [ ] **Logout** - Clears all data

### Protected Routes Tests
- [ ] **Dashboard** - Loads after login
- [ ] **Check-In** - Can submit mood data
- [ ] **Insights** - Shows analytics
- [ ] **Support** - Counselor chat works
- [ ] **Unauthorized Access** - Cannot access without login

### API Integration Tests
- [ ] **Signup API** - Creates user in backend
- [ ] **Login API** - Returns valid token
- [ ] **Get User API** - Fetches current user
- [ ] **Protected Endpoints** - Require Bearer token
- [ ] **401 Handling** - Logs out on expired token

### UI/UX Tests
- [ ] **Loading States** - Spinners show during requests
- [ ] **Error States** - Errors display properly
- [ ] **Empty States** - Handle no data gracefully
- [ ] **Input Validation** - Forms validate before submit
- [ ] **Responsive Design** - Works on different screen sizes

### Platform-Specific Tests
- [ ] **iOS Safari** - Keyboard doesn't hide content
- [ ] **Android Back Button** - Proper navigation
- [ ] **Notch/Safe Area** - Content not cut off
- [ ] **Keyboard Avoidance** - Inputs visible when typing

---

## 🐛 Common Issues & Solutions

### Issue: "Network request failed"

**On Emulator:**
- ✅ Backend: `python -m uvicorn app.main:app --reload`
- ✅ Check http://localhost:8000/docs in browser

**On Expo Go (Phone):**
- ✅ Backend: `python -m uvicorn app.main:app --host 0.0.0.0 --reload`
- ✅ Phone and computer on same WiFi
- ✅ Check http://[YOUR_IP]:8000/docs in phone browser

### Issue: "Cannot connect to backend"

1. Find your computer's IP:
   ```powershell
   ipconfig  # Windows
   ```
   Look for IPv4 Address (e.g., 192.168.1.100)

2. Test from phone browser:
   ```
   http://192.168.1.100:8000/docs
   ```

3. If still failing, manually set IP in `frontend/app.json`:
   ```json
   "extra": {
     "apiUrl": "http://192.168.1.100:8000"
   }
   ```

### Issue: "Session expired. Please log in again."

- Token expired (after 30 days)
- Just login again

### Issue: QR code not working

1. Open Expo Go app
2. Tap "Enter URL manually"
3. Type: `exp://[YOUR_IP]:8081`

---

## 📊 Test Data

### Sample Accounts
Create these during testing:
```
Email: alice@example.com
Password: Alice123456

Email: bob@example.com  
Password: Bob123456
```

### Sample Check-In Data
- Mood: Happy (😊)
- Stress Level: Low (3/10)
- Sleep Hours: 7.5 hours
- Notes: "Feeling great today!"

---

## 🔍 Debugging Tools

### View Logs
**Terminal:** Shows all logs
**Browser Console:** Remote JS debugging
**Expo DevTools:** http://localhost:19002

### Developer Menu
**Shake device** or **Cmd+D** (iOS) / **Cmd+M** (Android)
- Reload
- Debug Remote JS
- Toggle Element Inspector
- Toggle Performance Monitor

### Backend Logs
Watch backend terminal for:
```
INFO: 127.0.0.1:xxxx - "POST /auth/login HTTP/1.1" 200 OK
INFO: 127.0.0.1:xxxx - "GET /auth/me HTTP/1.1" 200 OK
```

### Check Database
```bash
cd backend
sqlite3 mindsentry.db
sqlite> SELECT * FROM users;
```

---

## 📖 Documentation Links

- [Expo Go Guide](./EXPO_GO_GUIDE.md) - Detailed Expo Go setup
- [Integration Complete](./INTEGRATION_COMPLETE.md) - Technical details
- [Backend Integration](../backend/FRONTEND_INTEGRATION.md) - API docs

---

## 🎯 Success Criteria

Your integration is successful when:
- ✅ User can signup on device
- ✅ User can login on device
- ✅ Token persists after app restart
- ✅ Protected routes load correctly
- ✅ User can logout
- ✅ API errors display properly
- ✅ App works on both emulator AND Expo Go

---

## 🚨 Important Notes

### Development
- Backend: `--reload` for auto-restart
- Frontend: Changes auto-reload in Expo Go
- Database: Delete `backend/mindsentry.db` to reset

### Expo Go vs Production
- Expo Go: For testing only
- Production: Need to build actual app with `eas build`

### Network Requirements
- Same WiFi for Expo Go
- No VPN blocking connections
- Firewall allows port 8000

---

**Ready to test? Start both servers and scan the QR code! 📱✨**
