const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove Filters Section (Row 1 & Row 2)
const filtersSectionRegex = /{\/\* Filters Section \*\/}\s*<section className="mb-8 flex flex-col gap-4">[\s\S]*?<\/section>/;
content = content.replace(filtersSectionRegex, '');

// 2. Remove Providers Grid Overview Section
// We'll target the pattern: /* Providers Grid Overview */ ... </section>
const providersGridRegex = /{\/\* Providers Grid Overview \*\/}\s*<>\s*<section className="grid grid-cols-2[\s\S]*?<\/section>/;
// If the comment style is different, try another one
if (content.indexOf('{/* Providers Grid Overview */}') === -1) {
    // Fallback for simple comment style if needed
    const altRegex = /\/\* Providers Grid Overview \*\/[\s\S]*?<section className="grid grid-cols-2[\s\S]*?<\/section>/;
    content = content.replace(altRegex, '');
} else {
    content = content.replace(providersGridRegex, '');
}

// 3. Ensure the title is "이벤트"
content = content.replace(
    'selectedProvider ? `${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트` : "ETF 이벤트"',
    'selectedProvider ? `${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트` : "이벤트"'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully removed redundant filters and provider grid from dashboard.');
