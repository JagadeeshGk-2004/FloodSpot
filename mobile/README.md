# FloodSpot Mobile - Expo Go React Native Application

A high-performance, pixel-perfect Expo Go mobile application that mirrors the FloodSpot web experience in visual aesthetics, dark glassmorphism styling, micro-animations, and backend functionality.

---

## Features & Highlights

- **Live Radar Map Screen (`MapScreen.js`)**: Dark Leaflet WebView map with pulsing flood markers, live user GPS location pin, quick filter chips (All, High Water, Moderate, FloodNet-CV Verified), slide-up incident card preview, and safe route check modal powered by backend `/api/routes/safe-check`.
- **Citizen Report Screen (`ReportScreen.js`)**: Direct camera/gallery integration (`expo-image-picker`), automatic device GPS extraction (`expo-location`), water level selector (Ankle, Knee, Waist, Submerged), severity level picker, and FloodNet-CV scanning overlay HUD (`ScanningHUD.js`) connected to FloodNet-CV Hydro-Depth Engine (`/api/reports`).
- **Emergency SOS Distress Screen (`SOSScreen.js`)**: Circular glowing SOS beacon button with Reanimated hold-to-confirm progress ring (2.5s hold), tactile haptic vibrations (`expo-haptics`), GPS broadcast payload to backend, and direct dial emergency helpline shortcuts (112, 1913, 1070, 103).
- **Real-Time Alerts & Activity Feed (`AlertsScreen.js`)**: Live crowd-sourced incident stream, automatic distance calculation from user GPS coordinates ("350m away"), severity filters, search bar, and pull-to-refresh (`RefreshControl`).
- **Custom Floating Glass Tab Bar (`BottomTabNavigator.js`)**: Glassmorphism translucent floating tab bar with `lucide-react-native` icons and elevated glowing SOS action badge.

---

## Zero-Config Backend IP Auto-Detection

The app automatically detects your computer's local Wi-Fi IP address when running in Expo Go via `Constants.expoConfig.hostUri` and connects to the FastAPI backend at `http://<YOUR_LOCAL_IP>:8000`.

If you are using a physical Android/iOS device or custom emulator, you can also edit `mobile/src/config/api.js`:

```javascript
// mobile/src/config/api.js
return 'http://192.168.1.X:8000'; // Replace with your computer's local IP on the Wi-Fi network
```

---

## Quick Start & Running in Expo Go

### 1. Install Mobile Dependencies
```bash
cd mobile
npm install
```

### 2. Start Expo Metro Bundler
From the root workspace directory:
```bash
npm run mobile:start
```
or inside `mobile/`:
```bash
npx expo start
```

### 3. Open on Mobile Device
- Open **Expo Go** on your Android or iOS phone.
- Scan the interactive QR code printed in your terminal console.
- Ensure your phone and computer are connected to the same Wi-Fi network.
