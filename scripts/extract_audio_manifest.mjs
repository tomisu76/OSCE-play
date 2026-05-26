import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'data', 'patients.json');
const OUT_PATH = path.join(ROOT, 'audio_manifest.json');

const VOICES = {
  intro: 'female_nurse',
  nurse: 'female_nurse',
  patient: 'male_patient'
};

function pad(number, size = 3) {
  return String(number).padStart(size, '0');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripHtml(value) {
  return String(value)
    .replace(/<span[^>]*class=["']vital-tag["'][^>]*>(.*?)<\/span>/gi, '$1 ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeForTTS(rawText) {
  let text = stripHtml(rawText);

  // The visual slide can show both numbers and words, but the audio should read the value once.
  text = text.replace(/\([^)]*\)/g, '');
  text = text.replace(/_____/g, 'blank');

  text = text.replace(/\bBP\s+Your\s+BP\s+is\b/gi, 'Your blood pressure is');
  text = text.replace(/\bRR\s+Your\s+respiratory rate\s+is\b/gi, 'Your respiratory rate is');
  text = text.replace(/\bPR\s+Your\s+pulse rate\s+is\b/gi, 'Your pulse rate is');
  text = text.replace(/\bBT\s+Your\s+body temperature\s+is\b/gi, 'Your body temperature is');
  text = text.replace(/\bO2 sat\s+Your\s+oxygen saturation\s+is\b/gi, 'Your oxygen saturation is');

  text = text.replace(/(\d{2,3})\/(\d{2,3})\s*mmHg\b/gi, '$1 over $2 millimeters of mercury');
  text = text.replace(/\bmmHg\b/gi, 'millimeters of mercury');
  text = text.replace(/(\d+)\s*breaths\/min\b/gi, '$1 breaths per minute');
  text = text.replace(/(\d+)\s*beats\/min\b/gi, '$1 beats per minute');
  text = text.replace(/(\d+(?:\.\d+)?)\s*°C\b/gi, '$1 degrees Celsius');
  text = text.replace(/\bO2 sat\b/gi, 'oxygen saturation');
  text = text.replace(/\b2nd floor\b/gi, 'second floor');
  text = text.replace(/\b1st floor\b/gi, 'first floor');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

function loadPatients() {
  if (!fs.existsSync(DATA_PATH)) {
    throw new Error(`Missing ${path.relative(ROOT, DATA_PATH)}.`);
  }

  const patients = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  if (!Array.isArray(patients)) {
    throw new Error('data/patients.json must contain a JSON array.');
  }
  return patients;
}

function getPatientFolder(patient) {
  return patient.audioFolder || `patient-${patient.id}-${slugify(patient.name)}`;
}

const patients = loadPatients();
const manifest = [];

for (const patient of patients) {
  const patientSlug = getPatientFolder(patient);

  manifest.push({
    id: `p${pad(patient.id, 2)}_s000`,
    patientId: patient.id,
    patientName: patient.name,
    slideIndex: 0,
    speaker: 'intro',
    voice: VOICES.intro,
    text: `Patient ${patient.id}. ${patient.name}. ${patient.scenario}`,
    ttsText: normalizeForTTS(`Patient ${patient.id}. ${patient.name}. ${patient.scenario}`),
    audioPath: `audio/${patientSlug}/slide-000.wav`
  });

  patient.lines.forEach(([speaker, text], index) => {
    const slideIndex = index + 1;
    manifest.push({
      id: `p${pad(patient.id, 2)}_s${pad(slideIndex)}`,
      patientId: patient.id,
      patientName: patient.name,
      slideIndex,
      speaker,
      voice: VOICES[speaker] || 'female_nurse',
      text: stripHtml(text),
      ttsText: normalizeForTTS(text),
      audioPath: `audio/${patientSlug}/slide-${pad(slideIndex)}.wav`
    });
  });
}

fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Created ${path.relative(ROOT, OUT_PATH)} with ${manifest.length} audio items from data/patients.json.`);
