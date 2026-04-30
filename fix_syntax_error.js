const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The issue is: (condition) ? ( {/* Task Specific Section */} )
// It needs to be: (condition) ? ( <> {/* Task Specific Section */} )

const brokenSection = '(selectedStatus === "전체 보기" || selectedStatus === "전체 이벤트")) && !searchQuery ? (';
const fix = brokenSection + '\n            <>';

if (content.indexOf(brokenSection) !== -1) {
    content = content.replace(brokenSection, fix);
    console.log('Successfully added missing Fragment opening tag.');
} else {
    console.error('Could not find the broken section to fix.');
}

fs.writeFileSync(filePath, content, 'utf8');
