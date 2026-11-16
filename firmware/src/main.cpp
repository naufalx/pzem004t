#include "config.h"
#include "pzem_manager.h"
#include "time_manager.h"
#include "data_queue.h"
#include "telemetry_client.h"
#include "wifi_manager.h"

PZEMManager pzemManager;
TimeManager timeManager;
DataQueue dataQueue;
TelemetryClient telemetryClient;
WiFiManager wifiManager;

unsigned long lastSampleTime = 0;
unsigned long lastUploadTime = 0;
uint32_t sequenceCounter = 1000;

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n==================================================");
    Serial.printf("⚡ KWH METER PZEM-004T v3.0 (ESP32 WROOM-32D)\n");
    Serial.printf("📦 Firmware Version: %s | Device: %s\n", FIRMWARE_VERSION, DEVICE_ID);
    Serial.println("==================================================");

    dataQueue.begin();
    pzemManager.begin();
    wifiManager.begin();
    timeManager.begin();
}

void loop() {
    wifiManager.loop();

    unsigned long now = millis();

    // 1. SENSOR SAMPLING (Setiap 1000ms)
    if (now - lastSampleTime >= SENSOR_SAMPLE_INTERVAL_MS) {
        lastSampleTime = now;

        uint32_t epoch = timeManager.getUtcEpoch();
        TelemetryRecord record;

        if (pzemManager.readTelemetry(record, epoch, ++sequenceCounter)) {
            dataQueue.enqueue(record);
            Serial.printf("[SAMPLE] Seq: %u | V: %.1fV, I: %.2fA, P: %.1fW, PF: %.2f, E: %.3fkWh\n",
                          record.sequence, record.voltage, record.current,
                          record.activePower, record.powerFactor, record.energy);
        }
    }

    // 2. BATCH UPLOAD LANGSUNG KE FIREBASE (Setiap 5000ms)
    if (now - lastUploadTime >= TELEMETRY_UPLOAD_INTERVAL_MS) {
        lastUploadTime = now;

        if (wifiManager.isConnected() && dataQueue.count() > 0) {
            // First check if emergency flash buffer exists and drain it
            if (dataQueue.hasEmergencyFlashData()) {
                TelemetryRecord flashBatch[BATCH_SIZE];
                size_t flashCount = dataQueue.drainFlashToBatch(flashBatch, BATCH_SIZE);
                if (flashCount > 0) {
                    telemetryClient.uploadBatch(flashBatch, flashCount);
                }
            }

            // Normal upload from RAM Queue
            TelemetryRecord batch[BATCH_SIZE];
            size_t count = dataQueue.peekBatch(batch, BATCH_SIZE);

            if (count > 0) {
                if (telemetryClient.uploadBatch(batch, count)) {
                    dataQueue.dropBatch(count);
                }
            }
        }
    }
}
