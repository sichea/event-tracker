import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

// Helper to translate text using Google Translate public API in Node environment
const translateText = (text) => {
  return new Promise((resolve) => {
    if (!text) return resolve('');
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) return resolve(text);
          const parsed = JSON.parse(data);
          if (parsed && parsed[0] && parsed[0][0] && parsed[0][0][0]) {
            resolve(parsed[0][0][0]);
          } else {
            resolve(text);
          }
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => {
      resolve(text);
    });
  });
};

// Custom dev server proxy for Polymarket predictions API
const predictionsDevPlugin = () => ({
  name: 'predictions-dev-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = req.url ? req.url.split('?')[0] : '';
      if (pathname === '/privacy' || pathname === '/privacy/') {
        req.url = '/privacy/index.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
      } else if (pathname === '/terms' || pathname === '/terms/') {
        req.url = '/terms/index.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
      } else if (pathname === '/about' || pathname === '/about/') {
        req.url = '/about/index.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
      } else if (pathname === '/contact' || pathname === '/contact/') {
        req.url = '/contact/index.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
      }

      if (req.url && req.url.startsWith('/api/predictions')) {
        const url = new URL(req.url, 'http://localhost');
        const category = url.searchParams.get('category') || 'trending';
        const limit = url.searchParams.get('limit') || '20';

        const tagMap = {
          'spacex': '63',
          'openai': '537',
          'tech': '1401',
          'science': '74',
          'macro': '100328',
          'crypto': '21',
          'politics': '2'
        };

        let apiUrl = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volumeNum&ascending=false';
        if (category !== 'trending' && tagMap[category]) {
          apiUrl += `&tag_id=${tagMap[category]}`;
        }
        apiUrl += `&limit=${limit}`;

        https.get(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }, (apiRes) => {
          let data = '';
          apiRes.on('data', (chunk) => { data += chunk; });
          apiRes.on('end', async () => {
            try {
              if (apiRes.statusCode !== 200) {
                res.statusCode = apiRes.statusCode || 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `Polymarket API returned status ${apiRes.statusCode}` }));
                return;
              }
              const json = JSON.parse(data);
              
              // Clean, translate, and format the data
              const formattedMarkets = await Promise.all(json.map(async item => {
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
                
                const translatedQuestion = await translateText(item.question);
                
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

                  return { name: translatedName, price, probability };
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

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(formattedMarkets));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        }).on('error', (err) => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), predictionsDevPlugin()],
  server: {
    host: true,
    port: 5173,
  },
})

