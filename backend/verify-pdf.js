const fs = require('fs');

const pdfBuffer = fs.readFileSync('/tmp/os-mock.pdf').toString('latin1');
// Looking for patterns like /Type /Page or similar
const pageMatches = pdfBuffer.match(/\/Type\s*\/Page\b/g);
console.log('Page objects found:', pageMatches ? pageMatches.length : 0);

// Basic check for "Pág" or "Página" or "1 / 1"
const paginadorMatch = pdfBuffer.match(/P[áa]gin[as]|P[áa]g/);
console.log('Paginator text found:', !!paginadorMatch);
