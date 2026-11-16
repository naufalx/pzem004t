#ifndef PZEM_MANAGER_H
#define PZEM_MANAGER_H

#include "config.h"
#include <PZEM004Tv30.h>

class PZEMManager {
public:
    PZEMManager();
    void begin();
    bool readTelemetry(TelemetryRecord& outRecord, uint32_t currentEpoch, uint32_t sequence);
    bool resetEnergy();
    uint32_t getErrorCount() const { return errorCount; }

private:
    PZEM004Tv30 pzem;
    uint32_t errorCount;
};

#endif // PZEM_MANAGER_H
