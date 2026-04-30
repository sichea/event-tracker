const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update loadData function to include IPO and APT data
const oldLoadData = `      const [fetchedAliases, eventsData, statusUpdate, mData, wData] = await Promise.all([
        fetchAliases(session.user.id),
        fetchEvents(session.user.id),
        fetchScrapingStatus(),
        fetchMarketInsights(),
        fetch('/data/whale.json').then(r => r.json()).catch(() => null)
      ]);
      setAliases(fetchedAliases || []);
      setEvents(eventsData.events || []);
      setScrapingStatus(statusUpdate);
      setMarketData(mData);
      setWhaleData(wData);`;

const newLoadData = `      const [fetchedAliases, eventsData, statusUpdate, mData, wData, ipoData, aptData] = await Promise.all([
        fetchAliases(session.user.id),
        fetchEvents(session.user.id),
        fetchScrapingStatus(),
        fetchMarketInsights(),
        fetch('/data/whale.json').then(r => r.json()).catch(() => null),
        fetchIpoEvents(session.user.id).catch(() => []),
        fetchAptSubscriptions().catch(() => [])
      ]);
      setAliases(fetchedAliases || []);
      setEvents(eventsData.events || []);
      setScrapingStatus(statusUpdate);
      setMarketData(mData);
      setWhaleData(wData);
      setIpoEvents(ipoData || []);
      setAptEvents(aptData || []);`;

if (content.indexOf(oldLoadData) !== -1) {
    content = content.replace(oldLoadData, newLoadData);
    console.log('Successfully updated loadData to include IPO and APT data.');
} else {
    console.error('Could not find loadData block to replace.');
}

fs.writeFileSync(filePath, content, 'utf8');
