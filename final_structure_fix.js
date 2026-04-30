const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// 1. Remove line 2491: "            </>"
if (lines[2490].trim() === '</>') {
    lines.splice(2490, 1);
    console.log('Removed misplaced Fragment closing tag at 2491.');
}

// 2. Adjust closing tags at the end
// Line 2505-2506 (adjusted after splice)
// Let's search from the end for the specific sequence
for (let i = lines.length - 1; i > 2400; i--) {
    if (lines[i].includes('</>') && lines[i+1] && lines[i+1].includes(')}')) {
        // This is likely the end of the main content
        lines[i] = '      </>';
        lines[i+1] = '    )}';
        console.log('Fixed ending Fragment and Ternary tags.');
        break;
    }
}

content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
