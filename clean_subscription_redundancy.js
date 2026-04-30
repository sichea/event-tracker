const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// We want to remove lines from 2356 to 2403 (inclusive)
// But let's check the content first to be 100% sure.
// Line 2356 (index 2355) is: "          ) : ("
// Line 2403 (index 2402) is: "          )"

const startIdx = 2355; // 2356th line
const endIdx = 2402;   // 2403rd line

if (lines[startIdx].includes(') : (') && lines[endIdx].trim() === ')') {
    lines.splice(startIdx, endIdx - startIdx + 1);
    content = lines.join('\n');
    console.log('Successfully removed redundant block and fixed syntax.');
} else {
    console.error('Line content mismatch. Expected ") : (" and ")".');
    console.log('Line 2356:', lines[startIdx]);
    console.log('Line 2403:', lines[endIdx]);
}

fs.writeFileSync(filePath, content, 'utf8');
