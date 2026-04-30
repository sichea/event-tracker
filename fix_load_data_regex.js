const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Using a more flexible regex to find the Promise.all block in loadData
const regex = /const\s+\[fetchedAliases,\s*eventsData,\s*statusUpdate,\s*mData,\s*wData\]\s*=\s*await\s*Promise\.all\(\[\s*fetchAliases\(session\.user\.id\),\s*fetchEvents\(session\.user\.id\),\s*fetchScrapingStatus\(\),\s*fetchMarketInsights\(\),\s*fetch\('\/data\/whale\.json'\)\.then\(r\s*=>\s*r\.json\(\)\)\.catch\(\(\)\s*=>\s*null\)\s*\]\);/;

const replacement = `const [fetchedAliases, eventsData, statusUpdate, mData, wData, ipoData, aptData] = await Promise.all([
        fetchAliases(session.user.id),
        fetchEvents(session.user.id),
        fetchScrapingStatus(),
        fetchMarketInsights(),
        fetch('/data/whale.json').then(r => r.json()).catch(() => null),
        fetchIpoEvents(session.user.id).catch(() => []),
        fetchAptSubscriptions().catch(() => [])
      ]);`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    console.log('Successfully updated Promise.all in loadData.');
    
    // Now update the state setters
    const stateRegex = /setAliases\(fetchedAliases\s*\|\|\s*\[\]\);\s*setEvents\(eventsData\.events\s*\|\|\s*\[\]\);\s*setScrapingStatus\(statusUpdate\);\s*setMarketData\(mData\);\s*setWhaleData\(wData\);/;
    const stateReplacement = `setAliases(fetchedAliases || []);
      setEvents(eventsData.events || []);
      setScrapingStatus(statusUpdate);
      setMarketData(mData);
      setWhaleData(wData);
      setIpoEvents(ipoData || []);
      setAptEvents(aptData || []);`;
    
    if (stateRegex.test(content)) {
        content = content.replace(stateRegex, stateReplacement);
        console.log('Successfully updated state setters in loadData.');
    }
} else {
    console.error('Flexible regex could not find the loadData block.');
}

fs.writeFileSync(filePath, content, 'utf8');
