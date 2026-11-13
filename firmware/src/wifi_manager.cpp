#include "wifi_manager.h"

WiFiManager::WiFiManager() : lastReconnectAttempt(0) {
}

void WiFiManager::begin() {
    Serial.printf("[WIFI] Connecting to SSID: %s (Non-blocking mode)...\n", DEFAULT_WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);
}

void WiFiManager::loop() {
    if (WiFi.status() != WL_CONNECTED) {
        unsigned long now = millis();
        if (now - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {
            lastReconnectAttempt = now;
            Serial.println("[WIFI] Reconnecting to WiFi...");
            WiFi.disconnect();
            WiFi.reconnect();
        }
    }
}

bool WiFiManager::isConnected() const {
    return WiFi.status() == WL_CONNECTED;
}

int32_t WiFiManager::getRssi() const {
    return isConnected() ? WiFi.RSSI() : -100;
}

String WiFiManager::getIpAddress() const {
    return isConnected() ? WiFi.localIP().toString() : "0.0.0.0";
}
