#ifndef DATA_QUEUE_H
#define DATA_QUEUE_H

#include "config.h"
#include <LittleFS.h>

class DataQueue {
public:
    DataQueue();
    bool begin();
    bool enqueue(const TelemetryRecord& record);
    size_t peekBatch(TelemetryRecord* outBuffer, size_t maxRecords);
    void dropBatch(size_t count);
    size_t count() const { return ramCount; }
    bool hasEmergencyFlashData() const;
    size_t drainFlashToBatch(TelemetryRecord* outBuffer, size_t maxRecords);

private:
    TelemetryRecord ramQueue[RAM_QUEUE_MAX_RECORDS];
    size_t head;
    size_t tail;
    size_t ramCount;

    bool spilloverToFlash();
};

#endif // DATA_QUEUE_H
