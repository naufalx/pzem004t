#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "config.h"
#include <WiFi.h>

class WiFiManager {
public:
    WiFiManager();
    void begin();
    void loop();
    bool isConnected() const;
    int32_t getRssi() const;
    String getIpAddress() const;

private:
    unsigned long lastReconnectAttempt;
    const unsigned long RECONNECT_INTERVAL_MS = 5000;
};

#endif // WIFI_MANAGER_H
