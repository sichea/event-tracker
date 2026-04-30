const fs = require('fs');
const path = require('path');

const filesToFix = [
    'frontend/src/App.jsx',
    'frontend/src/AptCalendar.jsx',
    'frontend/src/IpoCalendar.jsx',
    'frontend/src/InvestmentInsights.jsx',
    'frontend/src/ParkingCmaComparison.jsx'
];

filesToFix.forEach(relPath => {
    const fullPath = path.join(__dirname, relPath);
    if (fs.existsSync(fullPath)) {
        let content = fs.readFileSync(fullPath, 'utf8');
        // Remove any potentially invisible characters or BOM
        content = content.replace(/^\uFEFF/, ''); 
        // Re-save as UTF-8
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed encoding for ${relPath}`);
    }
});
