#include "telemetry_client.h"
#include <WiFi.h>
#include <time.h>

TelemetryClient::TelemetryClient() : tokenExpiryMs(0) {}

String TelemetryClient::databaseUrl(const String& path) const {
    String base = String(FIREBASE_DATABASE_URL);
    if (base.endsWith("/")) base.remove(base.length() - 1);
    return base + "/" + path + ".json?auth=" + idToken;
}

bool TelemetryClient::signInAnonymously() {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=") + FIREBASE_API_KEY;
    if (!http.begin(client, url)) return false;
    http.addHeader("Content-Type", "application/json");
    int code = http.POST("{\"returnSecureToken\":true}");
    String body = http.getString();
    http.end();
    if (code != 200) {
        Serial.printf("[Firebase Auth] Anonymous sign-in failed: HTTP %d %s\n", code, body.c_str());
        return false;
    }
    JsonDocument doc;
    if (deserializeJson(doc, body)) return false;
    idToken = doc["idToken"].as<String>();
    refreshToken = doc["refreshToken"].as<String>();
    unsigned long expires = doc["expiresIn"].as<unsigned long>();
    tokenExpiryMs = millis() + (expires > 60 ? (expires - 60) * 1000UL : 300000UL);
    Serial.println("[Firebase Auth] Anonymous authentication successful.");
    return idToken.length() > 0;
}

bool TelemetryClient::refreshIdToken() {
    if (refreshToken.isEmpty()) return signInAnonymously();
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    String url = String("https://securetoken.googleapis.com/v1/token?key=") + FIREBASE_API_KEY;
    if (!http.begin(client, url)) return false;
    http.addHeader("Content-Type", "application/x-www-form-urlencoded");
    String payload = "grant_type=refresh_token&refresh_token=" + refreshToken;
    int code = http.POST(payload);
    String body = http.getString();
    http.end();
    if (code != 200) {
        Serial.printf("[Firebase Auth] Token refresh failed: HTTP %d %s\n", code, body.c_str());
        idToken = "";
        refreshToken = "";
        return signInAnonymously();
    }
    JsonDocument doc;
    if (deserializeJson(doc, body)) return false;
    idToken = doc["id_token"].as<String>();
    refreshToken = doc["refresh_token"].as<String>();
    unsigned long expires = doc["expires_in"].as<unsigned long>();
    tokenExpiryMs = millis() + (expires > 60 ? (expires - 60) * 1000UL : 300000UL);
    Serial.println("[Firebase Auth] ID token refreshed.");
    return idToken.length() > 0;
}

bool TelemetryClient::ensureAuth() {
    if (idToken.isEmpty()) return signInAnonymously();
    if ((long)(millis() - tokenExpiryMs) >= 0) return refreshIdToken();
    return true;
}

bool TelemetryClient::writeJson(const String& path, JsonDocument& doc) {
    if (!ensureAuth()) return false;
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    if (!http.begin(client, databaseUrl(path))) return false;
    http.addHeader("Content-Type", "application/json");
    String body;
    serializeJson(doc, body);
    int code = http.PUT(body);
    String response = http.getString();
    http.end();
    if (code < 200 || code >= 300) {
        Serial.printf("[Firebase] PUT %s failed: HTTP %d %s\n", path.c_str(), code, response.c_str());
        return false;
    }
    return true;
}

bool TelemetryClient::uploadBatch(const TelemetryRecord* records, size_t count) {
    if (!count) return true;
    if (WiFi.status() != WL_CONNECTED || !ensureAuth()) return false;

    bool allOk = true;
    for (size_t i = 0; i < count; i++) {
        const TelemetryRecord& r = records[i];
        if (r.timestamp < 1700000000UL) { allOk = false; continue; }

        JsonDocument latest;
        latest["timestamp"] = r.timestamp;
        latest["sequence"] = r.sequence;
        latest["voltage"] = r.voltage;
        latest["current"] = r.current;
        latest["powerFactor"] = r.powerFactor;
        latest["activePower"] = r.activePower;
        latest["energy"] = r.energy;
        latest["frequency"] = r.frequency;
        latest["firmwareVersion"] = FIRMWARE_VERSION;
        if (!writeJson(String("devices/") + DEVICE_ID + "/latest", latest)) allOk = false;

        // Keep history grouped by Jakarta calendar date.
        time_t localEpoch = (time_t)r.timestamp + 7 * 3600;
        struct tm tmInfo;
        gmtime_r(&localEpoch, &tmInfo);
        char dateKey[11];
        strftime(dateKey, sizeof(dateKey), "%Y-%m-%d", &tmInfo);
        String recordKey = String(r.timestamp) + "_" + String(r.sequence);

        JsonDocument history;
        history["t"] = r.timestamp;
        history["seq"] = r.sequence;
        history["v"] = r.voltage;
        history["i"] = r.current;
        history["p"] = r.activePower;
        history["pf"] = r.powerFactor;
        history["e"] = r.energy;
        history["f"] = r.frequency;
        if (!writeJson(String("history/") + DEVICE_ID + "/" + dateKey + "/" + recordKey, history)) allOk = false;
    }

    const TelemetryRecord& newest = records[count - 1];
    JsonDocument status;
    status["online"] = true;
    status["lastSeen"] = newest.timestamp;
    status["firmwareVersion"] = FIRMWARE_VERSION;
    if (!writeJson(String("devices/") + DEVICE_ID + "/status", status)) allOk = false;

    if (allOk) Serial.printf("[Firebase] Upload berhasil: %u record tersinkronisasi.\n", (unsigned)count);
    return allOk;
}
