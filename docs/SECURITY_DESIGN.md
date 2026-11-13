# Security Design & Enforcement: `kwh_meter_pzem004t`

Spesifikasi perlindungan keamanan perangkat, kredensial cloud, proteksi API, dan Firebase Security Rules.

---

## 1. Firebase Security Rules (`database.rules.json`)

```json
{
  "rules": {
    "devices": {
      "$deviceId": {
        "status": {
          ".read": true,
          ".write": false
        },
        "latest": {
          ".read": true,
          ".write": false
        },
        "info": {
          ".read": true,
          ".write": "auth != null"
        }
      }
    },
    "history": {
      "$deviceId": {
        ".read": true,
        ".write": false,
        "$date": {
          ".indexOn": ["t"]
        }
      }
    },
    "summaries": {
      "$deviceId": {
        ".read": true,
        ".write": false
      }
    }
  }
}
```

*Catatan Kunci*:
- `.write: false` di semua simpul publik menjamin bahwa **TIDAK ADA client browser yang dapat menyisipkan atau memanipulasi data**.
- Hanya Backend Vercel via Firebase Admin SDK (service account) yang dapat menulis data.
- Pembacaan data publik diizinkan untuk `status`, `latest`, dan `history` (sesuai persetujuan Grill Me Q3: Public Read-Only Dashboard).
- Penulisan konfigurasi (`info`) wajib terautentikasi (`auth != null`).

---

## 2. Token Autentikasi Perangkat (Device Token Guard)

Di backend Vercel:
```javascript
export function verifyDeviceToken(req) {
  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '') || req.headers['x-device-token'];
  const expectedToken = process.env.DEVICE_TOKEN;
  
  if (!token || !expectedToken) return false;
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token.padEnd(64, ' ')),
    Buffer.from(expectedToken.padEnd(64, ' '))
  );
}
```

---

## 3. Environment Variables Configuration

### Server-Side Only (`.env` di Vercel Functions — Rahasia)
```env
DEVICE_ID=kwh-meter-001
DEVICE_TOKEN=c8f93e2b1049a8d7e6f5c4b3a2918273645e4d3c2b1a0987f6e5d4c3b2a10987
FIREBASE_DATABASE_URL=https://kwh-meter-pzem004t-default-rtdb.asia-southeast1.firebasedatabase.app
FIREBASE_PROJECT_ID=kwh-meter-pzem004t
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@kwh-meter-pzem004t.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgI...\n-----END PRIVATE KEY-----\n"
```

### Client-Side (`public/env.js` atau Web Config — Public Read-Only Keys)
```javascript
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "kwh-meter-pzem004t.firebaseapp.com",
  databaseURL: "https://kwh-meter-pzem004t-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kwh-meter-pzem004t",
  storageBucket: "kwh-meter-pzem004t.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
```
