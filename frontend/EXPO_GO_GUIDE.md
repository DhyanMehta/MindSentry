# Expo Go Testing Guide

## What is Expo Go?

Expo Go is a mobile app (available on iOS and Android) that lets you test your React Native app instantly on your physical device without building the app. Just scan a QR code and start testing!

## Prerequisites

1. **Install Expo Go on your phone:**
   - iOS: [Download from App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Download from Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Ensure your phone and computer are on the same WiFi network**

## Starting the Development Server

### Step 1: Start Backend
```bash
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Important:** Use `--host 0.0.0.0` to make the backend accessible from your phone!

### Step 2: Start Frontend
```bash
cd frontend
npm start
# or
npx expo start
```

You'll see:
- A QR code in the terminal
- Metro bundler running
- The Expo DevTools page open in your browser

## Connecting with Expo Go

### For iOS (iPhone/iPad)
1. Open the **Camera** app
2. Point it at the QR code in the terminal
3. Tap the notification that appears
4. Expo Go will open and load your app

### For Android
1. Open the **Expo Go** app
2. Tap "Scan QR code"
3. Point your camera at the QR code
4. The app will load automatically

## Troubleshooting

### "Network request failed" or "Cannot connect to backend"

**Problem:** Your phone can't reach the backend server.

**Solution 1: Check Backend Host**
Make sure backend is running with `--host 0.0.0.0`:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Solution 2: Find Your Computer's IP**

Windows (PowerShell):
```powershell
ipconfig
# Look for "IPv4 Address" under your WiFi adapter
# Example: 192.168.1.100
```

Mac/Linux:
```bash
ifconfig | grep "inet "
# Or
ip addr show
```

**Solution 3: Verify Same Network**
- Ensure phone and computer are on same WiFi
- Disable VPN if active
- Check firewall isn't blocking port 8000

**Solution 4: Manual API URL Override (if auto-detection fails)**

Edit `frontend/app.json`:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://YOUR_COMPUTER_IP:8000"
    }
  }
}
```

Replace `YOUR_COMPUTER_IP` with your actual IP (e.g., `192.168.1.100`).

Then restart the Expo server:
```bash
# Press Ctrl+C to stop, then
npm start
```

### "Unable to resolve module"

**Problem:** Missing dependencies or cache issue.

**Solution:**
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules
npm install
npx expo start --clear
```

### App loads but shows blank screen

**Problem:** JavaScript error or network issue.

**Solution:**
1. Shake your phone to open developer menu
2. Tap "Debug Remote JS" or "Toggle Element Inspector"
3. Check the browser console for errors
4. Look at Expo DevTools in browser for logs

### QR Code not scanning

**Problem:** Camera not recognizing QR code.

**Solution:**
1. Try the "Send link" option in Expo DevTools
2. Use Expo Go's "Enter URL manually" and type:
   ```
   exp://YOUR_COMPUTER_IP:8081
   ```

### Backend CORS errors

**Problem:** Backend rejecting requests from your phone.

**Solution:** CORS is already configured in the backend! But verify:

In `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Testing Checklist

Once connected, test these features:

### ✅ Authentication
- [ ] Signup with new account
- [ ] Login with existing account
- [ ] Password mismatch validation
- [ ] Invalid credentials error handling

### ✅ Navigation
- [ ] Navigate between tabs (Dashboard, Check-In, Insights, Support)
- [ ] Tab bar works correctly
- [ ] Back navigation works

### ✅ Protected Routes
- [ ] Dashboard loads user data
- [ ] Insights shows trends
- [ ] All screens require authentication

### ✅ Session Persistence
- [ ] Close and reopen app
- [ ] Should remain logged in

### ✅ Logout
- [ ] Logout button works
- [ ] Redirects to login screen
- [ ] Cannot access protected routes after logout

## Development Tips

### Live Reload
- Changes to code auto-reload in Expo Go
- Shake phone to access developer menu
- Enable "Fast Refresh" for instant updates

### Debugging
1. **Console Logs:** View in terminal or browser console
2. **Element Inspector:** Shake → "Toggle Element Inspector"
3. **React DevTools:** Shake → "Debug Remote JS"

### Performance Testing
- Real device performance differs from emulator
- Test on actual network conditions
- Check app responsiveness on your phone's screen size

## API URL Auto-Detection

The app automatically detects the correct API URL:

| Environment | API URL | How it Works |
|-------------|---------|--------------|
| **Expo Go (Physical Device)** | `http://YOUR_IP:8000` | Auto-detected from debugger host |
| **iOS Simulator** | `http://localhost:8000` | Direct localhost connection |
| **Android Emulator** | `http://10.0.2.2:8000` | Android emulator's special localhost alias |
| **Production** | `https://api.mindsentry.com` | Set via environment variable |

You'll see the detected URL in the console:
```
🔗 API Base URL: http://192.168.1.100:8000
📱 Platform: ios
🔍 Debugger Host: 192.168.1.100:8081
```

## Common Expo Go Commands

In the Expo terminal, press:
- `r` - Reload app
- `m` - Toggle menu
- `d` - Open developer tools
- `i` - Open iOS simulator
- `a` - Open Android emulator
- `w` - Open web browser
- `c` - Clear Metro bundler cache
- `?` - Show all commands

## Production Notes

For production builds (not Expo Go):

1. Set production API URL in environment:
   ```bash
   export REACT_APP_API_URL=https://api.mindsentry.com
   ```

2. Build for iOS:
   ```bash
   eas build --platform ios
   ```

3. Build for Android:
   ```bash
   eas build --platform android
   ```

---

## Quick Reference

**Start Backend (accessible from phone):**
```bash
cd backend && .\venv\Scripts\Activate.ps1 && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Start Frontend:**
```bash
cd frontend && npm start
```

**Test API from Phone:**
Open browser on phone: `http://YOUR_COMPUTER_IP:8000/docs`

---

**Happy Testing with Expo Go! 📱🚀**
