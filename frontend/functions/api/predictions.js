/**
 * Cloudflare Pages Function: /api/predictions
 * Polymarket Gamma API Proxy to handle CORS and format predictions data.
 */
async function translateText(text) {
  if (!text) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) return text;
    const data = await res.json();
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0][0][0];
    }
    return text;
  } catch (e) {
    console.error("Translation error:", e);
    return text;
  }
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || 'trending';
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  // Tag mapping based on our tag keyword search
  const tagMap = {
    'spacex': '63',
    'openai': '537',
    'tech': '1401',
    'science': '74',
    'macro': '100328', // Economy
    'crypto': '21',
    'politics': '2'
  };

  let apiUrl = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volumeNum&ascending=false';
  
  if (category !== 'trending' && tagMap[category]) {
    apiUrl += `&tag_id=${tagMap[category]}`;
  }
  
  apiUrl += `&limit=${limit}`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Polymarket API returned ${res.status}` }), {
        status: res.status,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const data = await res.json();
    
    // Clean and format the data
    const formattedMarkets = await Promise.all(data.map(async item => {
      const safeParseArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            return [];
          }
        }
        return [];
      };

      const outcomes = safeParseArray(item.outcomes);
      const outcomePrices = safeParseArray(item.outcomePrices);
      
      // Translate question
      const translatedQuestion = await translateText(item.question);
      
      // Map outcomes with their prices and translations
      const formattedOutcomes = await Promise.all(outcomes.map(async (name, index) => {
        const priceStr = outcomePrices[index];
        const price = priceStr ? parseFloat(priceStr) : 0.0;
        const probability = Math.round(price * 100);
        
        let translatedName = name;
        if (name === 'Yes') translatedName = '예';
        else if (name === 'No') translatedName = '아니오';
        else if (name === 'Over') translatedName = '초과';
        else if (name === 'Under') translatedName = '미만';
        else {
          translatedName = await translateText(name);
        }

        return {
          name: translatedName,
          price,
          probability
        };
      }));

      return {
        id: item.id,
        question: translatedQuestion,
        slug: item.slug,
        category: item.category,
        volume: item.volume ? parseFloat(item.volume) : 0.0,
        volume24h: item.volume24hr ? parseFloat(item.volume24hr) : 0.0,
        liquidity: item.liquidity ? parseFloat(item.liquidity) : 0.0,
        endDate: item.endDate,
        endDateIso: item.endDateIso,
        outcomes: formattedOutcomes,
        image: item.image || null
      };
    }));

    return new Response(JSON.stringify(formattedMarkets), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60' // Cache for 60 seconds
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
