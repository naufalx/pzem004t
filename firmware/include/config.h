#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Hardware pin definitions (ESP32 WROOM-32D)
#define PZEM_RX_PIN 16 // GPIO16 connected to PZEM TX
#define PZEM_TX_PIN 17 // GPIO17 connected to PZEM RX
#define PZEM_BAUD_RATE 9600

// Wi-Fi and Firebase Realtime Database configuration
#define DEFAULT_WIFI_SSID "Polinema Hotspot"
#define DEFAULT_WIFI_PASS ""

// Firebase Web API key (public client configuration)
#define FIREBASE_API_KEY "AIzaSyCpSjMIFShdy-5eAJgGVeRfi2ZwF8tlXng"
#define FIREBASE_DATABASE_URL "https://kwh-meter-pzem004t-default-rtdb.asia-southeast1.firebasedatabase.app"
#define DEVICE_ID "kwh-meter-001"
#define FIRMWARE_VERSION "2.1.0"

// Timing intervals
#define SENSOR_SAMPLE_INTERVAL_MS 1000  // Sampling PZEM setiap 1 detik
#define TELEMETRY_UPLOAD_INTERVAL_MS 5000 // Upload batch setiap 5 detik
#define NTP_SYNC_TIMEOUT_MS 10000

// Queue & buffer limits
#define RAM_QUEUE_MAX_RECORDS 1000      // 1000 records (~16.6 menit di RAM)
#define BATCH_SIZE 5                    // 5 records per payload

struct TelemetryRecord {
    uint32_t timestamp;
    uint32_t sequence;
    float voltage;
    float current;
    float powerFactor;
    float activePower;
    float energy;
    float frequency;
};

#endif // CONFIG_H
