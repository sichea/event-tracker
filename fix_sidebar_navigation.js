const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update Sidebar buttons to also set activeTab to 'insights'
const subTabs = ["macro", "dart", "nps", "legends"];
subTabs.forEach(tab => {
    const searchStr = `onClick={() => { setInsightSubTab("${tab}"); window.scrollTo(0,0); }}`;
    const replaceStr = `onClick={() => { setActiveTab("insights"); setInsightSubTab("${tab}"); window.scrollTo(0,0); }}`;
    content = content.replace(searchStr, replaceStr);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated sidebar buttons to switch activeTab to insights.');
