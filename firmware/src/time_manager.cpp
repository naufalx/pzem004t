#include "time_manager.h"

TimeManager::TimeManager() : synchronized(false) {
}

void TimeManager::begin() {
    Serial.println("[NTP] Initializing SNTP client (UTC+0 timezone)...");
    configTime(0, 0, "pool.ntp.org", "time.google.com", "time.nist.gov");
}

bool TimeManager::isSynchronized() const {
    time_t now;
    time(&now);
    return now >= 1700000000; // After Nov 2023
}

uint32_t TimeManager::getUtcEpoch() {
    time_t now;
    time(&now);
    if (now >= 1700000000) {
        synchronized = true;
        return (uint32_t)now;
    }
    return 0; // Not synchronized
}

String TimeManager::getIsoTimestamp() {
    time_t now = getUtcEpoch();
    if (!now) return "1970-01-01T00:00:00Z";
    struct tm timeinfo;
    gmtime_r(&now, &timeinfo);
    char buf[25];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    return String(buf);
}
