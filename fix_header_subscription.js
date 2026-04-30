const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Identify and replace the Header buttons for IPO and APT
const lines = content.split('\n');
let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('>공모주</button>')) {
        startIndex = i;
    }
    if (lines[i].includes('>아파트</button>')) {
        endIndex = i;
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    const newHeaderButton = `              <button className={\`pb-1 font-headline transition-colors \${activeTab === 'subscription' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}\`} onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); }}>청약</button>`;
    lines.splice(startIndex, endIndex - startIndex + 1, newHeaderButton);
    content = lines.join('\n');
    console.log('Successfully updated desktop header tabs.');
} else {
    console.error('Could not find the header buttons to replace.');
}

fs.writeFileSync(filePath, content, 'utf8');
