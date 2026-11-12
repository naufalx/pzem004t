#include "data_queue.h"

DataQueue::DataQueue() : head(0), tail(0), ramCount(0) {
}

bool DataQueue::begin() {
    if (!LittleFS.begin(true)) {
        Serial.println("[QUEUE] Warning: LittleFS mount failed");
        return false;
    }
    Serial.println("[QUEUE] Data queue initialized. RAM buffer: 1000 records (~32KB)");
    return true;
}

bool DataQueue::enqueue(const TelemetryRecord& record) {
    if (ramCount >= RAM_QUEUE_MAX_RECORDS) {
        // RAM full! Trigger emergency flash spillover
        spilloverToFlash();
    }

    ramQueue[head] = record;
    head = (head + 1) % RAM_QUEUE_MAX_RECORDS;
    ramCount++;
    return true;
}

size_t DataQueue::peekBatch(TelemetryRecord* outBuffer, size_t maxRecords) {
    size_t toExtract = (ramCount < maxRecords) ? ramCount : maxRecords;
    size_t cur = tail;
    for (size_t i = 0; i < toExtract; i++) {
        outBuffer[i] = ramQueue[cur];
        cur = (cur + 1) % RAM_QUEUE_MAX_RECORDS;
    }
    return toExtract;
}

void DataQueue::dropBatch(size_t count) {
    if (count > ramCount) count = ramCount;
    tail = (tail + count) % RAM_QUEUE_MAX_RECORDS;
    ramCount -= count;
}

bool DataQueue::spilloverToFlash() {
    Serial.println("[QUEUE] RAM full! Dumping half buffer to LittleFS /spillover.bin...");
    File f = LittleFS.open("/spillover.bin", FILE_APPEND);
    if (!f) {
        Serial.println("[QUEUE] Failed to open /spillover.bin for append!");
        return false;
    }

    size_t toDump = RAM_QUEUE_MAX_RECORDS / 2;
    for (size_t i = 0; i < toDump; i++) {
        f.write((const uint8_t*)&ramQueue[tail], sizeof(TelemetryRecord));
        tail = (tail + 1) % RAM_QUEUE_MAX_RECORDS;
    }
    ramCount -= toDump;
    f.close();
    Serial.printf("[QUEUE] Spilled %u records to LittleFS. RAM count now: %u\n", toDump, ramCount);
    return true;
}

bool DataQueue::hasEmergencyFlashData() const {
    return LittleFS.exists("/spillover.bin") && LittleFS.open("/spillover.bin", "r").size() >= sizeof(TelemetryRecord);
}

size_t DataQueue::drainFlashToBatch(TelemetryRecord* outBuffer, size_t maxRecords) {
    if (!hasEmergencyFlashData()) return 0;
    File f = LittleFS.open("/spillover.bin", "r");
    if (!f) return 0;

    size_t recordsInFile = f.size() / sizeof(TelemetryRecord);
    size_t toRead = (recordsInFile < maxRecords) ? recordsInFile : maxRecords;
    size_t bytesRead = f.read((uint8_t*)outBuffer, toRead * sizeof(TelemetryRecord));
    f.close();

    // If completely drained, remove file
    if (toRead >= recordsInFile) {
        LittleFS.remove("/spillover.bin");
        Serial.println("[QUEUE] Emergency flash buffer fully drained and cleaned.");
    }

    return bytesRead / sizeof(TelemetryRecord);
}
