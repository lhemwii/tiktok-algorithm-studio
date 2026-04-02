const fs = require('fs');
const content = fs.readFileSync('h:/CODE/Dev/Code-video/src/main.js', 'utf8');

let stack = [];
let lines = content.split('\n');
let inString = false;
let stringChar = '';

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        let nextChar = line[j+1];

        if (!inString) {
            if (char === '/' && nextChar === '/') break;
            if (char === '"' || char === "'" || char === '`') {
                inString = true;
                stringChar = char;
            } else if (char === '{') {
                stack.push({ line: i + 1, col: j + 1, text: line.trim() });
            } else if (char === '}') {
                if (stack.length === 0) {
                    console.log(`Extra closing brace at line ${i + 1}, col ${j + 1}: ${line.trim()}`);
                } else {
                    stack.pop();
                }
            }
        } else {
            if (char === '\\') { j++; continue; }
            if (char === stringChar) inString = false;
        }
    }
}

if (stack.length > 0) {
    console.log('Unclosed braces (last 10):');
    stack.slice(-10).forEach(s => console.log(`  Line ${s.line}, col ${s.col}: ${s.text}`));
} else {
    console.log('Braces are balanced!');
}
