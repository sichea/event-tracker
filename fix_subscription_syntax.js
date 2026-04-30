const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The issue is redundant blocks and mismatched parens after the subscription block.
// We need to find the end of the subscription block and ensure it links to the dashboard tab correctly.

// 1. Find the subscription block end
// It ends with:
//                   return filteredApts.map(apt => (
//                     <AptCard key={apt.id} apt={apt} />
//                   ));
//                 })()}
//               </div>
//             )
//           )

// 2. Identify the redundant section starting with "아파트 청약" label
// and ending before the dashboard tab logic.

const redundantStart = ') : ('; // This is at line 2356
const redundantEnd = ') : activeTab === "dashboard" ? ('; // Where it SHOULD continue to dashboard

// Let's use a more surgical approach. 
// We will replace the entire block from activeTab === "subscription" to activeTab === "dashboard"
// to ensure it's clean.

const oldBlockRegex = /activeTab === "subscription" \? \([\s\S]*?\n\s*\) : \( [\s\S]*? \n\s*\) : activeTab === "dashboard" \? \(/;
// Wait, the regex might be tricky. Let's just find the specific redundant part.

const redundantPartRegex = /\n\s*\) : \(\s*\n\s*<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">[\s\S]*?아파트 청약[\s\S]*?<\/div>\s*\n\s*\)/;

if (redundantPartRegex.test(content)) {
    content = content.replace(redundantPartRegex, '');
    console.log('Successfully removed redundant Apt section.');
} else {
    // Try a more direct string replace if regex fails
    console.log('Regex failed, trying direct block replacement.');
    // We want to replace the part from line 2356 to where the dashboard starts
}

fs.writeFileSync(filePath, content, 'utf8');
