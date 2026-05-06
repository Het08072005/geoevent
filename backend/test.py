import os
import requests
from dotenv import load_dotenv
from datetime import datetime

# Load env variables
load_dotenv()

API_KEY = os.getenv("WEATHER_API_KEY")

if not API_KEY:
    raise ValueError("API key not found. Check your .env file")

# Palo Alto coordinates
LAT = 37.4419
LON = -122.1430

# API URL
URL = "https://api.openweathermap.org/data/2.5/forecast"

params = {
    "lat": LAT,
    "lon": LON,
    "appid": API_KEY,
    "units": "metric"
}

response = requests.get(URL, params=params)

if response.status_code != 200:
    print("Error:", response.text)
    exit()

data = response.json()

print(f"\n📍 Weather Forecast for Palo Alto\n")

for item in data["list"]:
    dt = datetime.fromtimestamp(item["dt"])
    temp = item["main"]["temp"]
    weather = item["weather"][0]["description"]

    print(f"{dt.strftime('%d-%m-%Y %H:%M')} | 🌡 {temp}°C | ☁️ {weather}")