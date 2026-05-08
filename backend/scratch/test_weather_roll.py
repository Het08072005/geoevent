import os
import json
import time
from datetime import datetime, timedelta
import random

# Simulating the exact roll_and_pad_weather_payload logic from weather_cache.py
def roll_and_pad_weather_payload(payload: dict, saved_at: float) -> tuple[dict, bool]:
    if not payload or "daily" not in payload:
        return payload, False

    # Get local calendar date for saved_at and now
    saved_date = datetime.fromtimestamp(saved_at).date()
    current_date = datetime.now().date()
    days_passed = (current_date - saved_date).days

    daily = list(payload.get("daily", []))
    was_changed = False

    if days_passed > 0:
        print(f"--> [SIMULATION] Weather cache is {days_passed} calendar days old! Shifting forecast forward...")
        was_changed = True
        if days_passed < len(daily):
            daily = daily[days_passed:]
        else:
            daily = []

    # Sane padding up to 7 items
    target_len = 7
    if len(daily) < target_len:
        was_changed = True
        
        # Calculate trend-aligned baseline temperatures
        if daily:
            avg_max = sum(d["temp_max"] for d in daily) / len(daily)
            avg_min = sum(d["temp_min"] for d in daily) / len(daily)
        else:
            avg_max = 21.0  # ~70F
            avg_min = 12.0  # ~54F

        pleasant_descs = [
            "clear sky", "few clouds", "scattered clouds", "partly cloudy"
        ]

        while len(daily) < target_len:
            t_max = round(avg_max + random.uniform(-1.5, 1.5))
            t_min = round(avg_min + random.uniform(-1.5, 1.5))
            t_max = max(15, min(33, t_max))
            t_min = max(8, min(19, t_min))

            desc = random.choice(pleasant_descs)
            pop = random.choice([0, 0, 5, 10])

            if daily:
                new_dt = daily[-1]["dt"] + 86400
            else:
                new_dt = int(datetime.combine(current_date, datetime.min.time()).timestamp())

            daily.append({
                "dt": new_dt,
                "temp_max": t_max,
                "temp_min": t_min,
                "description": desc,
                "pop": pop
            })

    payload["daily"] = daily
    return payload, was_changed


def run_simulation():
    print("=" * 60)
    print("WEATHER ROLLING AND PADDING SIMULATION")
    print("=" * 60)

    # 1. Simulate a cache file saved 2 days ago
    # If today is May 8, then 2 days ago was May 6
    two_days_ago = datetime.now() - timedelta(days=2)
    saved_at_epoch = two_days_ago.timestamp()

    # The cached list contains 5 forecast days starting from May 6
    dummy_payload = {
        "status": "success",
        "daily": [
            {
                "dt": int(saved_at_epoch),
                "temp_max": 18,
                "temp_min": 11,
                "description": "broken clouds",
                "pop": 0
            },
            {
                "dt": int(saved_at_epoch + 86400),
                "temp_max": 19,
                "temp_min": 12,
                "description": "light rain",
                "pop": 45
            },
            {
                "dt": int(saved_at_epoch + 172800), # This corresponds to Today (May 8)
                "temp_max": 22,
                "temp_min": 13,
                "description": "clear sky",
                "pop": 0
            },
            {
                "dt": int(saved_at_epoch + 259200), # Tomorrow
                "temp_max": 24,
                "temp_min": 14,
                "description": "few clouds",
                "pop": 0
            },
            {
                "dt": int(saved_at_epoch + 345600), # Today + 2
                "temp_max": 23,
                "temp_min": 13,
                "description": "scattered clouds",
                "pop": 5
            }
        ]
    }

    print(f"Current Date: {datetime.now().date()}")
    print(f"Cache Saved Date: {two_days_ago.date()} (saved_at timestamp: {saved_at_epoch})")
    print("\n--- ORIGINAL DUMMY CACHE payload (5 days): ---")
    for i, d in enumerate(dummy_payload["daily"]):
        day_date = datetime.fromtimestamp(d["dt"]).date()
        print(f"  Day {i} [{day_date}]: Max {d['temp_max']}°C, Min {d['temp_min']}°C, '{d['description']}', pop {d['pop']}%")

    print("\nExecuting 'roll_and_pad_weather_payload'...")
    updated_payload, was_changed = roll_and_pad_weather_payload(dummy_payload, saved_at_epoch)

    print(f"\nResult was_changed: {was_changed}")
    print("\n--- ROLLED AND PADDED PAYLOAD (7 days): ---")
    for i, d in enumerate(updated_payload["daily"]):
        day_date = datetime.fromtimestamp(d["dt"]).date()
        status_label = "OLD (Shifted)" if i < 3 else "NEW (Generated/Padded)"
        print(f"  Day {i} [{day_date}]: Max {d['temp_max']}°C, Min {d['temp_min']}°C, '{d['description']}', pop {d['pop']}%  ({status_label})")
    print("=" * 60)

if __name__ == "__main__":
    run_simulation()
