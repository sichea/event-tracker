import httpx
import re

def scrape_fred(series_id):
    url = f"https://fred.stlouisfed.org/series/{series_id}"
    try:
        resp = httpx.get(url, timeout=10)
        # Search for the latest value in the HTML
        match = re.search(r'class="series-meta-observation-value">([\d\.]+)', resp.text)
        if match:
            return float(match.group(1))
        
        # Alternative: look for it in the JSON-LD or meta tags
        match = re.search(r'(\d+\.?\d*)\s*</span>\s*Latest Observation', resp.text)
        if match:
            return float(match.group(1))
            
        print(f"Could not find value for {series_id}")
        return None
    except Exception as e:
        print(f"Error scraping {series_id}: {e}")
        return None

if __name__ == "__main__":
    print(f"US Rate: {scrape_fred('FEDFUNDS')}")
    print(f"CPI: {scrape_fred('CPALTT01USM657N')}")
    print(f"GDP: {scrape_fred('A191RL1Q225SBEA')}")
