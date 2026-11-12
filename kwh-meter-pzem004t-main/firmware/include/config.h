#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// Hardware pin definitions (ESP32 WROOM-32D)
#define PZEM_RX_PIN 16 // GPIO16 connected to PZEM TX
#define PZEM_TX_PIN 17 // GPIO17 connected to PZEM RX
#define PZEM_BAUD_RATE 9600

// Network & cloud ingestion configuration
#define DEFAULT_WIFI_SSID "Polinema Hotspot"
#define DEFAULT_WIFI_PASS ""

#define API_HOST "kwh-meter-pzem004t.vercel.app" // Ubah sesuai URL Vercel production
#define API_PORT 443
#define API_ENDPOINT "/api/telemetry"

#define DEVICE_ID "kwh-meter-001"
#define DEVICE_TOKEN "c8f93e2b1049a8d7e6f5c4b3a2918273645e4d3c2b1a0987f6e5d4c3b2a10987"
#define FIRMWARE_VERSION "2.0.0"

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
