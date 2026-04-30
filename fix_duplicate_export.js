const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Remove all instances of "export default App;"
content = content.replace(/export default App;\s*/g, '');

// Add it once at the very end
content = content.trim() + '\n\nexport default App;\n';

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully unified default export.');
