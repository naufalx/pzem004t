#ifndef TIME_MANAGER_H
#define TIME_MANAGER_H

#include <Arduino.h>
#include <time.h>

class TimeManager {
public:
    TimeManager();
    void begin();
    bool isSynchronized() const;
    uint32_t getUtcEpoch();
    String getIsoTimestamp();

private:
    bool synchronized;
};

#endif // TIME_MANAGER_H
