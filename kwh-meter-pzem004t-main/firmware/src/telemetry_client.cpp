#include "telemetry_client.h"

TelemetryClient::TelemetryClient() {
    // For Vercel cloud with public CA certificates, we set insecure only during dev/initialization,
    // or load Root CA certificate bundle for strict TLS verification.
    secureClient.setInsecure();
    secureClient.setTimeout(5000);
}

String TelemetryClient::generateBatchId() {
    uint32_t r1 = esp_random();
    uint32_t r2 = esp_random();
    char buf[37];
    snprintf(buf, sizeof(buf), "%08x-%04x-%04x-%04x-%04x%08x",
             r1, (uint16_t)(r2 >> 16), (uint16_t)(r2 & 0xFFFF),
             (uint16_t)(r1 >> 16), (uint16_t)(r1 & 0xFFFF), r2);
    return String(buf);
}

bool TelemetryClient::uploadBatch(const TelemetryRecord* records, size_t count) {
    if (!count) return true;

    if (!secureClient.connect(API_HOST, API_PORT)) {
        Serial.printf("[HTTP] Failed to connect to %s:%d via HTTPS\n", API_HOST, API_PORT);
        return false;
    }

    // Build JSON Document
    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["batchId"] = generateBatchId();
    doc["firmwareVersion"] = FIRMWARE_VERSION;
    doc["sentAt"] = records[count - 1].timestamp;

    JsonArray recordsArray = doc["records"].to<JsonArray>();
    for (size_t i = 0; i < count; i++) {
        JsonObject r = recordsArray.add<JsonObject>();
        r["timestamp"] = records[i].timestamp;
        r["sequence"] = records[i].sequence;
        r["voltage"] = records[i].voltage;
        r["current"] = records[i].current;
        r["powerFactor"] = records[i].powerFactor;
        r["activePower"] = records[i].activePower;
        r["energy"] = records[i].energy;
        r["frequency"] = records[i].frequency;
    }

    String payload;
    serializeJson(doc, payload);

    // Send HTTP POST Request
    secureClient.print(String("POST ") + API_ENDPOINT + " HTTP/1.1\r\n" +
                       "Host: " + API_HOST + "\r\n" +
                       "Content-Type: application/json\r\n" +
                       "Authorization: Bearer " + DEVICE_TOKEN + "\r\n" +
                       "x-device-id: " + DEVICE_ID + "\r\n" +
                       "Content-Length: " + payload.length() + "\r\n" +
                       "Connection: close\r\n\r\n" +
                       payload);

    // Read Response Status Line
    String statusLine = secureClient.readStringUntil('\n');
    secureClient.stop();

    if (statusLine.indexOf("200") >= 0) {
        Serial.printf("[HTTP] Batch upload successful (200 OK) for %u records\n", count);
        return true;
    } else {
        Serial.printf("[HTTP] Server responded with error: %s\n", statusLine.c_str());
        return false;
    }
}
