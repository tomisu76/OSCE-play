import fs from 'node:fs';

const file = 'data/patients.json';
let text = fs.readFileSync(file, 'utf8');

const replacements = [
  ['BP', 'Blood pressure'],
  ['RR', 'Respiratory rate'],
  ['PR', 'Pulse rate'],
  ['BT', 'Body temperature'],
  ['O2 sat', 'Oxygen saturation'],
  ['mmHg', 'millimeters of mercury'],
  ['breaths/min', 'breaths per minute'],
  ['beats/min', 'beats per minute'],
  ['°C', 'degrees Celsius'],
  [' kg ', ' kilograms '],
  [' cm ', ' centimeters '],
  [' a.m.', ' AM']
];

for (const [from, to] of replacements) {
  text = text.split(from).join(to);
}

text = text
  .replace(/(\d+) kilograms \(/g, '$1 kilograms (')
  .replace(/(\d+) centimeters \(/g, '$1 centimeters (')
  .replace(/\(blood pressure\)/gi, '')
  .replace(/\s+\./g, '.')
  .replace(/ {2,}/g, ' ');

const patients = JSON.parse(text);
fs.writeFileSync(file, `${JSON.stringify(patients, null, 2)}\n`, 'utf8');
console.log('Normalized patient text labels and units.');
