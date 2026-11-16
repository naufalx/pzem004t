#include "pzem_manager.h"

PZEMManager::PZEMManager() 
    : pzem(Serial2, PZEM_RX_PIN, PZEM_TX_PIN), errorCount(0) {
}

void PZEMManager::begin() {
    Serial2.begin(PZEM_BAUD_RATE, SERIAL_8N1, PZEM_RX_PIN, PZEM_TX_PIN);
    Serial.println("[PZEM] Hardware UART2 initialized on GPIO16(RX) and GPIO17(TX) at 9600 baud");
}

bool PZEMManager::readTelemetry(TelemetryRecord& outRecord, uint32_t currentEpoch, uint32_t sequence) {
    float v  = pzem.voltage();
    float i  = pzem.current();
    float p  = pzem.power();
    float e  = pzem.energy();
    float pf = pzem.pf();
    float f  = pzem.frequency();

    // Strict validation: Reject NaN or impossible reading
    if (isnan(v) || isnan(i) || isnan(p) || isnan(e) || isnan(pf) || isnan(f)) {
        errorCount++;
        Serial.printf("[PZEM] Sensor read failed (NaN detected). Total errors: %u\n", errorCount);
        return false;
    }

    // Physical bounds check
    if (v < 80.0 || v > 260.0 || i < 0.0 || i > 100.0 || pf < 0.0 || pf > 1.0) {
        errorCount++;
        Serial.printf("[PZEM] Reading out of physical bounds (V=%.1f, I=%.2f, PF=%.2f)\n", v, i, pf);
        return false;
    }

    outRecord.timestamp = currentEpoch;
    outRecord.sequence = sequence;
    outRecord.voltage = v;
    outRecord.current = i;
    outRecord.powerFactor = pf;
    outRecord.activePower = p;
    outRecord.energy = e;
    outRecord.frequency = f;

    return true;
}

bool PZEMManager::resetEnergy() {
    Serial.println("[PZEM] Resetting cumulative energy register...");
    return pzem.resetEnergy();
}
