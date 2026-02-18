from google import genai
import os
import json
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Initialize the new Google GenAI Client
client = genai.Client(api_key=GEMINI_API_KEY)

async def analyze_business_impact(store_name, location_name, nearby_events):
    prompt = f"""
    You are a Senior Retail Sales Impact Analyst. 
    Analyze the business '{store_name}' at '{location_name}'.

    NEARBY EVENTS DATA (within 1km):
    {json.dumps(nearby_events[:5], indent=2)}

    LOGIC FOR CALCULATION:
    - Sports Events: 0.5% - 1% conversion rate for footfall.
    - College/Cultural Events: 3% - 5% conversion rate for footfall.
    - Other/Generic Events: 1% - 2% conversion rate.

    YOUR TASK:
    Provide a granular retail impact breakdown. Be precise, short, and data-driven.

    GENERATE A JSON RESPONSE WITH THIS EXACT STRUCTURE:
    {{
      "store_info": {{
        "name": "{store_name}",
        "event_count": {len(nearby_events[:5])}
      }},
      "individual_events": [
        {{
          "name": "Event Name",
          "segment": "Specific demographic (e.g., 'Sports fans (18–40)')",
          "footfall": "Calculated range (e.g., '300–500 customers')",
          "behavior": "One-sentence buying behavior",
          "distance": "Distance in meters"
        }}
      ],
      "combined_analysis": {{
        "composition": [
          {{ "label": "Segment Name", "value": 65, "trend": "+12%" }},
          {{ "label": "Other Segment", "value": 35, "trend": "+5%" }}
        ],
        "total_footfall": "Total calculated range (e.g., '380–650 customers')",
        "peak_window": "Specific time sync (e.g., '4PM–8PM')",
        "operational_rec": "Strategic advice (e.g., 'Increase staffing, promote combos')",
        "summary": "One sharp executive sentence on the #1 impact."
      }},
      "popular_items": [
        {{ "item": "Item 1", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 2", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 3", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 4", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 5", "who_buys": "Segment", "upsell_tip": "One short tip" }},
        {{ "item": "Item 6", "who_buys": "Segment", "upsell_tip": "One short tip" }}
      ],
      "analytics": {{
        "conversion_potential": "X%",
        "visibility_score": "X%",
        "event_synergy": "X%"
      }}
    }}

    Rules:
    - Descriptions MUST be one sentence.
    - Footfall MUST be a range based on the logic above.
    - Return ONLY the JSON object.
    """

    try:
        # Using the absolute latest model 'gemini-3-flash-preview' with the new SDK
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )
        
        text = response.text
        
        # Robust JSON cleaning
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        data = json.loads(text)
        return data
    except Exception as e:
        import traceback
        print(f"Gemini Analysis Error: {str(e)}")
        print(traceback.format_exc())
        return {
            "error": "Failed to generate deep analytics",
            "summary": "The AI is currently recalibrating local market data. Please try again in a moment.",
            "analytics": {"conversion_rate_potential": "0%", "brand_visibility_score": "0%"},
            "customer_segments": [],
            "event_impact": [],
            "popular_items": []
        }
