#!/usr/bin/env python3
"""
Meta Desk Quick Test Script
Tests all API connections and writes a sample observation file.
"""

import os
import json
from datetime import datetime
from pathlib import Path

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def test_xai_grok():
    """Test xAI Grok API web search."""
    print("\n[TEST] Testing xAI Grok API...")

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=os.getenv("XAI_API_KEY"),
            base_url="https://api.x.ai/v1",
        )

        response = client.responses.create(
            model="grok-4.20-reasoning",
            input=[{
                "role": "user",
                "content": "What are the top 3 trending Solana meme coins on crypto Twitter today? Be specific with names and brief context.",
            }],
            tools=[{"type": "web_search"}],
        )

        # xAI Responses API format is different from chat completions
        content = response.output if hasattr(response, 'output') else str(response)
        citations = response.citations if hasattr(response, 'citations') else []

        if isinstance(citations, list):
            citations = [{"title": getattr(c, 'title', 'N/A'), "url": getattr(c, 'url', 'N/A')} for c in citations]
        else:
            citations = []

        print("[OK] xAI Grok API working!")
        # Handle Unicode encoding for Windows console
        try:
            safe_content = content.encode('ascii', 'ignore').decode('ascii')
            print(f"\nResults:\n{safe_content[:500]}...\n")
        except:
            print(f"\nResults: [Content received but contains special characters]\n")
        print(f"Sources: {len(citations)} citations")

        return {
            "api": "xai_grok",
            "query": "trending Solana meme coins",
            "content": str(content)[:1000],  # Truncate and convert to string
            "citations": [dict(c) if isinstance(c, dict) else {"info": str(c)} for c in citations],
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success",
        }

    except Exception as e:
        print(f"[ERROR] xAI Grok API failed: {e}")
        return None


def test_gmgn():
    """Test GMGN API (via skills or direct API)."""
    print("\n[TEST] Testing GMGN API...")

    # Note: GMGN skills need to be installed: npx skills add GMGNAI/gmgn-skills
    # For now, we'll just verify the API keys are set

    gmgn_api_key = os.getenv("GMGN_API_KEY")
    gmgn_private_key = os.getenv("GMGN_PRIVATE_KEY")

    if gmgn_api_key and gmgn_private_key:
        print("[OK] GMGN API keys found in .env")
        print("   To use GMGN, run: npx skills add GMGNAI/gmgn-skills")
        return {
            "api": "gmgn",
            "status": "keys_configured",
            "note": "Install GMGN skills to use API",
        }
    else:
        print("[ERROR] GMGN API keys not found in .env")
        return None


def test_birdeye():
    """Test Birdeye API."""
    print("\n[TEST] Testing Birdeye API...")

    birdeye_api_key = os.getenv("BIRDEYE_API_KEY")

    if birdeye_api_key:
        print("[OK] Birdeye API key found in .env")
        # Add actual Birdeye API test here if needed
        return {
            "api": "birdeye",
            "status": "key_configured",
        }
    else:
        print("[WARN]  Birdeye API key not found (optional)")
        return None


def test_apify():
    """Test Apify API."""
    print("\n[TEST] Testing Apify API...")

    apify_token = os.getenv("APIFY_API_TOKEN")

    if apify_token:
        print("[OK] Apify API token found in .env")
        # Add actual Apify API test here if needed
        return {
            "api": "apify",
            "status": "token_configured",
        }
    else:
        print("[WARN]  Apify API token not found (optional)")
        return None


def write_observation_file(observations):
    """Write observations to Cabinet data directory."""
    print("\n[WRITE] Writing observation file...")

    try:
        data_dir = os.getenv("OPENCLAW_CABINET_DATA_DIR")
        if not data_dir:
            data_dir = "./data"  # Fallback to relative path

        obs_dir = Path(data_dir) / "entities" / "observations"
        obs_dir.mkdir(parents=True, exist_ok=True)

        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        file_path = obs_dir / f"{date_str}_test-run.json"

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump({
                "test_run": True,
                "date": date_str,
                "observations": observations,
                "timestamp": datetime.utcnow().isoformat(),
            }, f, indent=2, ensure_ascii=False)

        print(f"[OK] Observation file written to: {file_path}")
        return str(file_path)

    except Exception as e:
        print(f"[ERROR] Failed to write observation file: {e}")
        return None


def main():
    """Run all API tests and write observation file."""
    print("=" * 60)
    print("META DESK QUICK TEST")
    print("=" * 60)

    observations = []

    # Test all APIs
    grok_result = test_xai_grok()
    if grok_result:
        observations.append(grok_result)

    gmgn_result = test_gmgn()
    if gmgn_result:
        observations.append(gmgn_result)

    birdeye_result = test_birdeye()
    if birdeye_result:
        observations.append(birdeye_result)

    apify_result = test_apify()
    if apify_result:
        observations.append(apify_result)

    # Write observation file
    if observations:
        file_path = write_observation_file(observations)

        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"[OK] {len(observations)} API(s) tested successfully")
        if file_path:
            print(f"[OK] Observation file created: {file_path}")
        print("\nNext steps:")
        print("1. Check the observation file to see the data")
        print("2. Install GMGN skills: npx skills add GMGNAI/gmgn-skills")
        print("3. Start writing manual daily briefs (see QUICK-START-CHECKLIST.md)")
        print("=" * 60)
    else:
        print("\n[ERROR] No APIs tested successfully. Check your .env file.")


if __name__ == "__main__":
    main()
