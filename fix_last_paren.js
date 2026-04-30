const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// Target line 2356 (index 2355)
// It is currently: "        ) : activeTab === "parking" ? ("
// We want it to be: "          ) ) : activeTab === "parking" ? ("

const targetIdx = 2355; 
if (lines[targetIdx].includes(') : activeTab === "parking" ? (')) {
    lines[targetIdx] = '          ) ) : activeTab === "parking" ? (';
    content = lines.join('\n');
    console.log('Successfully added the missing closing parenthesis.');
} else {
    console.error('Line content mismatch at 2356:', lines[targetIdx]);
}

fs.writeFileSync(filePath, content, 'utf8');
