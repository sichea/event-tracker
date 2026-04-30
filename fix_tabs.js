const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Desktop Header Tabs Update
// We want to remove the "통찰력" button and make "투자 인사이트" point to "landing"
const oldButtons = `              <button className={\`pb-1 font-headline transition-colors \${activeTab === 'landing' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}\`} onClick={() => setActiveTab("landing")}>통찰력</button>
              <button className={\`pb-1 font-headline transition-colors \${activeTab === 'insights' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}\`} onClick={() => setActiveTab("insights")}>투자 인사이트</button>`;

const newButton = `              <button className={\`pb-1 font-headline transition-colors \${activeTab === 'landing' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}\`} onClick={() => {setActiveTab("landing"); setAnalysisResult(null);}}>투자 인사이트</button>`;

if (content.indexOf(oldButtons) !== -1) {
    content = content.replace(oldButtons, newButton);
    console.log('Successfully updated desktop header tabs.');
} else {
    // Fallback if whitespace differs
    const regex = /<button[^>]*onClick=\{[^}]*setActiveTab\("landing"\)[^>]*>통찰력<\/button>\s*<button[^>]*onClick=\{[^}]*setActiveTab\("insights"\)[^>]*>투자 인사이트<\/button>/;
    if (regex.test(content)) {
        content = content.replace(regex, newButton);
        console.log('Successfully updated desktop header tabs using regex.');
    } else {
        console.error('Could not find the header buttons to replace.');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
