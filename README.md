# WhatsApp Group Creation Agent & APK Manager (Production Ready)

An automated WhatsApp Group Agent with an Android-ready mobile interface (APK), Admin Panel, Single-Device Login Enforcement, and Anti-Crack Code Obfuscation.

---

## 🌟 Features

### 1. Security & Single-Device Enforcement
- **Single Active Device Policy**: A user can only be logged into **one device at a time**. If an account is logged into a new device (Device B), the previous device (Device A) is immediately terminated and locked out.
- **Controlled Account Access**: Public registration is disabled. When an unauthorized user taps **"Sign Up"**, a modal prompts them to contact **Mr. Hassan (+923107612528)** with 1-tap WhatsApp and Call buttons.
- **APK Anti-Crack Obfuscation**: The production bundle is compiled with `javascript-obfuscator`, encoding all string arrays (Base64/RC4), flattening control flow, and mangling identifiers so nobody can inspect or reverse-engineer your app code from the APK.
- **Sensitive Logic Isolation**: All WhatsApp sockets, session keys, and user credentials stay strictly on the private backend server—never embedded inside client APK files.

### 2. Admin Panel (For Mr. Hassan)
- Accessible exclusively by users with the `admin` role.
- **User Provisioning**: Create new user logins (Username, Password, Role).
- **Session Control**: View which users have active device sessions and click **"Kick Device"** to force-terminate them.
- **Account Suspension**: One-click toggle to activate or suspend any user account.
- **System Overview**: Live metrics on total users, active accounts, connected devices, and total WhatsApp groups created.

### 3. Modern Sidebar & Multi-Tab Navigation
- Responsive mobile sliding drawer with:
  - 📱 **WhatsApp Link**: Pairing code companion linking with auto-reconnect.
  - 👥 **Group Creator**: Automated group creation engine with anti-detection delay.
  - 📜 **Groups History**: Record of all created groups and clickable invite links.
  - 🛡️ **Admin Panel**: Visible only to administrators.
  - 🚪 **Logout**: Secure session termination.

### 4. WhatsApp Companion Engine with 8-Digit Pairing Code
- Official 8-digit Pairing Code (no QR camera scan needed).
- Automatic reconnection on WhatsApp's pairing restart (Status Code 515).
- Anti-ban cooldown delay interval slider (10–30s).
- Instant extraction of WhatsApp invite links (`https://chat.whatsapp.com/...`).

---

## 🚀 How to Run

### Method 1: One-Click Windows Launcher
Double-click `start.bat` in the root folder. Both backend (port 3001) and client UI (port 5173) will launch automatically.

### Method 2: Manual Terminal Commands
1. **Backend Server**:
   ```powershell
   cd server
   npm start
   ```
2. **Client Interface**:
   ```powershell
   cd client
   npm run dev
   ```
Open in browser at: `http://localhost:5173`.

---

## 📱 How to Build the Protected Android APK File

1. **Build and Obfuscate the Client Web Assets**:
   ```powershell
   cd client
   npm run build
   ```
   *This bundles and runs `obfuscate.js`, encrypting all JavaScript code against decompilers.*

2. **Add Capacitor Android Platform (First Time Only)**:
   ```powershell
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   ```

3. **Copy Assets & Apply ProGuard Rules**:
   ```powershell
   npx cap copy android
   ```
   *Copy `proguard-rules.pro` into `android/app/proguard-rules.pro` to ensure Android native bytecode is also obfuscated.*

4. **Build APK in Android Studio**:
   ```powershell
   npx cap open android
   ```
   Click **Build > Build Bundle(s) / APK(s) > Build APK(s)** to export your production `.apk`!
