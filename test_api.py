#!/usr/bin/env python3
"""Quick test of the SerpAPI integration"""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Load env from backend folder
sys.path.insert(0, r'c:\Users\panch\OneDrive\Desktop\vikara\march\location_based\backend')
os.chdir(r'c:\Users\panch\OneDrive\Desktop\vikara\march\location_based\backend')
load_dotenv('.env')

from app.services.serpapi_search import serpapi_service

async def test():
    print("Testing SerpAPI with Palo Alto, CA...")
    result = await serpapi_service.search_event_sources("Palo Alto, CA")
    
    print("\n[OK] API Key:", "SET" if serpapi_service.api_key else "NOT SET")
    print("Status:", result.get('status'))
    print("Total sources found:", result.get('total_sources', 0))
    print("Categories:", list(result.get('websites', {}).keys()) if isinstance(result.get('websites'), dict) else "N/A")
    
    if result.get('websites'):
        websites = result['websites']
        if isinstance(websites, list):
            print(f"\nFirst 5 websites:")
            for w in websites[:5]:
                print(f"  - {w.get('name')} ({w.get('category')}) [Priority: {w.get('priority')}]")
        elif isinstance(websites, dict):
            print("\nWebsites by category:")
            for cat, sites in list(websites.items())[:3]:
                print(f"  {cat}: {len(sites)} sources")
                for site in sites[:2]:
                    print(f"    - {site.get('name')}")

asyncio.run(test())
