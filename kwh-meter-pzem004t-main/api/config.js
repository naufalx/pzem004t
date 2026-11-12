/**
 * Public Web Firebase Configuration Endpoint
 * Safely exposes only client-facing Web SDK configuration to frontend clients.
 */

import dotenv from 'dotenv';
dotenv.config();

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCpSjMIFShdy-5eAJgGVeRfi2ZwF8tlXng",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "kwh-meter-pzem004t.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "kwh-meter-pzem004t",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "kwh-meter-pzem004t.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "73107839203",
    appId: process.env.FIREBASE_APP_ID || "1:73107839203:web:09521f54e5cb07d6410dd6",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://kwh-meter-pzem004t-default-rtdb.asia-southeast1.firebasedatabase.app",
    deviceId: process.env.DEVICE_ID || "kwh-meter-001"
  };

  res.status(200).json(config);
}
