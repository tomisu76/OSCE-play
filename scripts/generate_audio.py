#!/usr/bin/env python3
"""
Generate all OSCE Play audio files from audio_manifest.json using Kokoro.

Usage:
  python scripts/generate_audio.py

Output:
  audio/patient-*/slide-*.wav

Notes:
  - Nurse slides use a female Kokoro voice.
  - Patient slides use a male Kokoro voice.
  - This script saves audio files to your local hard drive inside the repo.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "audio_manifest.json"

# You can change these later after testing available Kokoro voices on your machine.
KOKORO_VOICES = {
    "female_nurse": "af_heart",
    "male_patient": "am_adam",
}

# American English. If your installed Kokoro package expects a different lang_code,
# change this value here.
LANG_CODE = "a"
SAMPLE_RATE = 24000


def sanitize_text(text: str) -> str:
    """Small cleanup before sending text to TTS."""
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("a.m.", "A M")
    text = text.replace("p.m.", "P M")
    text = text.replace("OSCE", "oss key")
    return text


def load_manifest() -> list[dict[str, Any]]:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(
            f"Missing {MANIFEST_PATH}. Run: node scripts/extract_audio_manifest.mjs"
        )
    with MANIFEST_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list):
        raise ValueError("audio_manifest.json must contain a list.")
    return data


def generate_one(pipeline: KPipeline, item: dict[str, Any], overwrite: bool) -> bool:
    audio_path = ROOT / item["audioPath"]
    audio_path.parent.mkdir(parents=True, exist_ok=True)

    if audio_path.exists() and not overwrite:
        print(f"SKIP  {audio_path.relative_to(ROOT)}")
        return False

    voice_key = item.get("voice", "female_nurse")
    kokoro_voice = KOKORO_VOICES.get(voice_key, KOKORO_VOICES["female_nurse"])
    tts_text = sanitize_text(item.get("ttsText") or item.get("text") or "")

    if not tts_text:
        print(f"EMPTY {item.get('id', 'unknown')}")
        return False

    print(f"MAKE  {audio_path.relative_to(ROOT)} | {voice_key} -> {kokoro_voice} | {tts_text[:80]}")

    generator = pipeline(tts_text, voice=kokoro_voice)
    for _, _, audio in generator:
        sf.write(audio_path, audio, SAMPLE_RATE)
        return True

    raise RuntimeError(f"Kokoro did not return audio for {item.get('id')}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--overwrite", action="store_true", help="Regenerate existing files.")
    parser.add_argument("--limit", type=int, default=None, help="Generate only first N items for testing.")
    args = parser.parse_args()

    manifest = load_manifest()
    if args.limit is not None:
        manifest = manifest[: args.limit]

    pipeline = KPipeline(lang_code=LANG_CODE)

    made = 0
    for item in manifest:
        if generate_one(pipeline, item, overwrite=args.overwrite):
            made += 1

    print(f"\nDone. Generated {made} file(s).")
    print("Audio folder:", ROOT / "audio")


if __name__ == "__main__":
    main()
