const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Targeting the specific Mobile Nav button for Subscription
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('setActiveTab("subscription")') && lines[i].includes('setSubscriptionSubTab("ipo")') && lines[i].includes('md:hidden fixed bottom-0') === false && i > 2400) {
        // This is likely the Mobile Nav button (line 2512 approx)
        if (!lines[i].includes('fetchIpoEvents')) {
            lines[i] = lines[i].replace(
                'onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); window.scrollTo(0,0); }}',
                'onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); window.scrollTo(0,0); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }}'
            );
            console.log(`Updated Mobile Nav button at line ${i+1}`);
        }
    }
}

content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
