const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Final update for Apartment filter logic to match local component properties (name, region)
const oldFilter = `                  const filteredApts = aptEvents.filter(apt => {
                    const title = apt.title || "";
                    const address = apt.address || "";
                    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        address.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  });`;

const newFilter = `                  const filteredApts = aptEvents.filter(apt => {
                    const name = apt.name || "";
                    const region = apt.region || "";
                    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        region.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  });`;

if (content.indexOf(oldFilter) !== -1) {
    content = content.replace(oldFilter, newFilter);
    console.log('Successfully updated Apartment filter logic to match local properties.');
} else {
    console.error('Could not find Apartment filter block to replace.');
}

fs.writeFileSync(filePath, content, 'utf8');
