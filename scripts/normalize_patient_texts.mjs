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
  .replace(/Good morning\. My name is _____\. I am a practical nurse\./g, 'Good morning. My name is Anna. I am a practical nurse.')
  .replace(/Good morning\. My name is blank\. I am a practical nurse\./g, 'Good morning. My name is Anna. I am a practical nurse.')
  .replace(/(\d+) kilograms \(/g, '$1 kilograms (')
  .replace(/(\d+) centimeters \(/g, '$1 centimeters (')
  .replace(/\(blood pressure\)/gi, '')
  .replace(/\s+\./g, '.')
  .replace(/ {2,}/g, ' ');

const patients = JSON.parse(text);

for (const patient of patients) {
  if (patient.id === 4 || patient.name === 'Fast') {
    patient.name = 'Michael Fast';
    patient.introAudioText = 'Patient 4. Michael Fast. Rash for one week. Seafood allergy and no underlying disease.';
    patient.lines = (patient.lines || []).map((line) => {
      if (!Array.isArray(line)) return line;
      if (line[1] === 'My name is Fast.' || line[2] === 'My name is Fast.') {
        return [line[0], 'My name is Michael Fast.', 'My name is Michael Fast.'];
      }
      return line;
    });
  }
}

fs.writeFileSync(file, `${JSON.stringify(patients, null, 2)}\n`, 'utf8');
console.log('Normalized patient text labels and units. Nurse name set to Anna. Patient 4 set to Michael Fast.');
