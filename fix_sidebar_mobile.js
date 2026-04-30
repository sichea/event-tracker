const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Sidebar to show options for both 'landing' and 'insights'
content = content.replace(
    "{activeTab === 'insights' ? (",
    "{ (activeTab === 'insights' || activeTab === 'landing') ? ("
);

// 2. Update Mobile Nav label from '통찰력' to '투자 인사이트'
content = content.replace(
    '<span className="text-[10px] font-bold">통찰력</span>',
    '<span className="text-[10px] font-bold">투자 인사이트</span>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated sidebar logic and mobile nav label.');
