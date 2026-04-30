const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Update Apartment filter logic to use correct properties (title, address) instead of (house_name, location)
const oldFilter = `                  const filteredApts = aptEvents.filter(apt => {
                    const matchesSearch = apt.house_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        apt.location.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  });`;

const newFilter = `                  const filteredApts = aptEvents.filter(apt => {
                    const title = apt.title || "";
                    const address = apt.address || "";
                    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        address.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  });`;

if (content.indexOf(oldFilter) !== -1) {
    content = content.replace(oldFilter, newFilter);
    console.log('Successfully updated Apartment filter logic.');
} else {
    console.error('Could not find Apartment filter block to replace.');
}

fs.writeFileSync(filePath, content, 'utf8');
