const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Desktop Header "청약" button
const headerSearch = 'onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); }}>청약</button>';
const headerReplace = 'onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }}>청약</button>';
content = content.replace(headerSearch, headerReplace);

// 2. Update Mobile Nav "청약" button
const mobileSearch = 'onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === "subscription" ? \'text-primary\' : \'text-on-surface-variant\'}`}>';
const mobileReplace = 'onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); window.scrollTo(0,0); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }} className={`flex flex-col items-center gap-1 ${activeTab === "subscription" ? \'text-primary\' : \'text-on-surface-variant\'}`}>';
content = content.replace(mobileSearch, mobileReplace);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added IPO data fetching to Header and Mobile Nav.');
