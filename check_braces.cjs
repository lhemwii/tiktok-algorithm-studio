const fs = require('fs');
const content = fs.readFileSync('h:/CODE/Dev/Code-video/src/main.js', 'utf8');

let stack = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        if (line[j] === '{') {
            stack.push({ line: i + 1, col: j + 1 });
        } else if (line[j] === '}') {
            if (stack.length === 0) {
                console.log(`Extra closing brace at line ${i + 1}, col ${j + 1}`);
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    console.log('Unclosed braces:');
    stack.forEach(s => console.log(`  Line ${s.line}, col ${s.col}`));
} else {
    console.log('Braces are balanced!');
}
