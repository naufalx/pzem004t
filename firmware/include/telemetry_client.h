#ifndef TELEMETRY_CLIENT_H
#define TELEMETRY_CLIENT_H

#include "config.h"
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

class TelemetryClient {
public:
    TelemetryClient();
    bool uploadBatch(const TelemetryRecord* records, size_t count);

private:
    String idToken;
    String refreshToken;
    unsigned long tokenExpiryMs;
    bool ensureAuth();
    bool signInAnonymously();
    bool refreshIdToken();
    bool writeJson(const String& path, JsonDocument& doc);
    String databaseUrl(const String& path) const;
};

#endif
