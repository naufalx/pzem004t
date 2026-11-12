#ifndef TELEMETRY_CLIENT_H
#define TELEMETRY_CLIENT_H

#include "config.h"
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

class TelemetryClient {
public:
    TelemetryClient();
    bool uploadBatch(const TelemetryRecord* records, size_t count);

private:
    WiFiClientSecure secureClient;
    String generateBatchId();
};

#endif // TELEMETRY_CLIENT_H
