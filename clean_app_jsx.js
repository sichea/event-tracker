const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove all local component definitions
const componentsToRemove = [
    { start: 'function IpoCalendar', end: 'return (' + '    <div>' + '      {/* Calendar Header */}', fallbackEnd: 'function InvestmentInsights' },
    { start: 'function InvestmentInsights', end: 'function ParkingCmaComparison' },
    { start: 'function ParkingCmaComparison', end: 'function App()' }
];

// Actually, it's easier to find the functions by their signatures and delete until the next known marker.
// I'll use a more reliable way: find the START of each function and delete until just before the START of the NEXT function.

const ipoStart = content.indexOf('function IpoCalendar');
const insightStart = content.indexOf('function InvestmentInsights');
const parkingStart = content.indexOf('function ParkingCmaComparison');
const appStart = content.indexOf('function App()');

if (ipoStart !== -1 && insightStart !== -1 && parkingStart !== -1 && appStart !== -1) {
    // Delete from ipoStart to appStart
    const before = content.substring(0, ipoStart);
    const after = content.substring(appStart);
    content = before + after;
    console.log('Removed all local component definitions.');
} else {
    console.error('Could not find all function markers.');
}

// 2. Ensure all imports are correct at the top
const imports = `import LandingPage from "./LandingPage";
import AptCalendar from "./AptCalendar";
import IpoCalendar from "./IpoCalendar";
import InvestmentInsights from "./InvestmentInsights";
import ParkingCmaComparison from "./ParkingCmaComparison";`;

if (content.includes('import LandingPage from "./LandingPage";')) {
    // Replace the single import with the full block
    content = content.replace(/import LandingPage from ".\/LandingPage";(\r\n|\n|import AptCalendar from ".\/AptCalendar";(\r\n|\n))*/, imports + '\n');
    console.log('Updated all imports.');
}

fs.writeFileSync(filePath, content, 'utf8');
