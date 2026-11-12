/**
 * Firebase Admin SDK Database Adapter with Local In-Memory Fallback
 * Allows zero-setup local development and seamless production deployment to Firebase RTDB.
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

let dbInstance = null;
let isMockStore = false;

// In-Memory store for offline development / testing
const memoryStore = {
  devices: {},
  history: {},
  summaries: {},
  processedBatches: {}
};

/**
 * Initializes Firebase Admin or falls back to local memory store.
 */
export function getDatabase() {
  if (dbInstance) {
    if (!isMockStore && (!admin.apps || admin.apps.length === 0)) {
      dbInstance = null;
    } else {
      return { db: dbInstance, isMock: isMockStore };
    }
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL } = process.env;

  const hasCredentials = FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY && FIREBASE_DATABASE_URL;

  if (hasCredentials && !admin.apps.length) {
    try {
      const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey
        }),
        databaseURL: FIREBASE_DATABASE_URL
      });
      dbInstance = admin.database();
      isMockStore = false;
      console.log('✓ Firebase Admin initialized with production Realtime Database:', FIREBASE_DATABASE_URL);
      return { db: dbInstance, isMock: false };
    } catch (err) {
      console.warn('⚠ Failed to initialize Firebase Admin with credentials, falling back to local memory store:', err.message);
    }
  }

  // Fallback memory adapter mimicking Firebase Realtime Database API
  isMockStore = true;
  dbInstance = {
    ref(path = '') {
      const cleanPath = path.replace(/^\/+|\/+$/g, '');
      const parts = cleanPath.split('/').filter(Boolean);

      function getRef(p) {
        let curr = memoryStore;
        for (const seg of p) {
          if (!curr[seg]) curr[seg] = {};
          curr = curr[seg];
        }
        return curr;
      }

      function setRef(p, value) {
        if (p.length === 0) return;
        let curr = memoryStore;
        for (let i = 0; i < p.length - 1; i++) {
          const seg = p[i];
          if (!curr[seg] || typeof curr[seg] !== 'object') curr[seg] = {};
          curr = curr[seg];
        }
        curr[p[p.length - 1]] = value;
      }

      return {
        async once(event) {
          let curr = memoryStore;
          for (const seg of parts) {
            if (curr && typeof curr === 'object') {
              curr = curr[seg];
            } else {
              curr = null;
              break;
            }
          }
          return {
            val() {
              return curr !== undefined ? JSON.parse(JSON.stringify(curr)) : null;
            },
            exists() {
              return curr !== undefined && curr !== null;
            }
          };
        },
        async set(value) {
          setRef(parts, JSON.parse(JSON.stringify(value)));
        },
        async remove() {
          setRef(parts, null);
        },
        async update(values) {
          if (!values || typeof values !== 'object') return;
          for (const [k, v] of Object.entries(values)) {
            const fullPath = parts.concat(k.split('/').filter(Boolean));
            setRef(fullPath, JSON.parse(JSON.stringify(v)));
          }
        },
        async push(value) {
          const key = `rec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const subRef = parts.concat(key);
          setRef(subRef, JSON.parse(JSON.stringify(value)));
          return { key };
        }
      };
    }
  };

  return { db: dbInstance, isMock: true, memoryStore };
}
