const fs = require('fs');

const numRows = 20000;   // number of rows in the CSV
const numbersPerRow = 10; // number of numbers in each row
const maxNumber = 1e6;  // maximum random number value

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

let csvContent = '';

for (let i = 0; i < numRows; i++) {
    let row = [];
    for (let j = 0; j < numbersPerRow; j++) {
        row.push(getRandomInt(1, maxNumber));
    }
    csvContent += row.join(',') + '\n';
}

fs.writeFileSync('randomData.csv', csvContent);
