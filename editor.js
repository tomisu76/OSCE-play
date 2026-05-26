(() => {
  const AUDIO_LINK_VERSION = 'slide001-wav-20260526d';
  let directAudio = null;
  let directAutoPlay = false;

  function getActiveSlideIndex() {
    const slides = Array.from(document.querySelectorAll('.fs-slide'));
    const index = slides.findIndex(slide => slide.classList.contains('active'));
    return index >= 0 ? index : 0;
  }

  function getDirectAudioPath(slideIndex = getActiveSlideIndex()) {
    const patient = window.getPatient?.();
    if (!patient) return '';
    const folder = patient.audioFolder || `patient-${patient.id}-${String(patient.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    const fileNumber = String(slideIndex).padStart(3, '0');
    return `/audio/${folder}/slide-${fileNumber}.wav?v=${AUDIO_LINK_VERSION}`;
  }

  function stopDirectAudio() {
    if (directAudio) {
      directAudio.pause();
      directAudio.currentTime = 0;
      directAudio = null;
    }
  }

  function showAudioError(path) {
    const activeSlide = document.querySelector('.fs-slide.active');
    const button = activeSlide?.querySelector('.slide-audio-btn');
    if (button) {
      button.textContent = `Audio not found: ${path}`;
      button.classList.add('audio-missing');
    }
    console.error('OSCE Play audio failed:', path);
  }

  window.playCurrentAudio = function playCurrentAudioDirect(onEnded) {
    const slideIndex = getActiveSlideIndex();
    const path = getDirectAudioPath(slideIndex);
    if (!path) return;

    stopDirectAudio();
    directAudio = new Audio(path);
    directAudio.preload = 'auto';
    directAudio.onended = () => {
      directAudio = null;
      if (typeof onEnded === 'function') onEnded();
    };
    directAudio.onerror = () => {
      showAudioError(path);
      if (typeof onEnded === 'function') onEnded();
    };
    directAudio.play().catch(() => showAudioError(path));
  };

  window.togglePresentationPlayback = function toggleDirectPresentationPlayback() {
    const button = document.getElementById('playAllButton');
    if (directAutoPlay) {
      directAutoPlay = false;
      stopDirectAudio();
      if (button) button.textContent = '▶ Prehraj celú prezentáciu';
      return;
    }

    directAutoPlay = true;
    if (button) button.textContent = '⏸ Stop';

    const playThenNext = () => {
      if (!directAutoPlay) return;
      const slides = Array.from(document.querySelectorAll('.fs-slide'));
      const currentIndex = getActiveSlideIndex();
      window.playCurrentAudio(() => {
        if (!directAutoPlay) return;
        if (currentIndex >= slides.length - 1) {
          directAutoPlay = false;
          if (button) button.textContent = '▶ Prehraj celú prezentáciu';
          return;
        }
        window.nextSlide?.();
        setTimeout(playThenNext, 450);
      });
    };

    playThenNext();
  };

  const originalGetAudioPath = window.getAudioPath;
  if (typeof originalGetAudioPath === 'function') {
    window.getAudioPath = function getFixedAudioPath(patient, slideNumber) {
      const originalPath = String(originalGetAudioPath(patient, slideNumber) || '');
      const cleanPath = originalPath.split('?')[0].replace(/^\/+/, '');
      return `/${cleanPath}?v=${AUDIO_LINK_VERSION}`;
    };
  }

  function normalizeIntroNamePlaceholder(value) {
    return String(value || '')
      .replace(/Good morning\. My name is Anna\. I am a practical nurse\./g, 'Good morning. My name is _____. I am a practical nurse.')
      .replace(/Good morning\. My name is blank\. I am a practical nurse\./g, 'Good morning. My name is _____. I am a practical nurse.');
  }

  const originalNormalizeLine = window.normalizeLine;
  if (typeof originalNormalizeLine === 'function') {
    window.normalizeLine = function normalizeLineWithPlaceholder(line) {
      const normalized = originalNormalizeLine(line);
      if (normalized && normalized.speaker === 'nurse') {
        normalized.text = normalizeIntroNamePlaceholder(normalized.text);
        normalized.audioText = normalizeIntroNamePlaceholder(normalized.audioText);
      }
      return normalized;
    };
  }

  function injectSeparatedSlideStyles() {
    if (document.getElementById('separated-slide-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'separated-slide-editor-styles';
    style.textContent = `
      .slide-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;max-height:360px;overflow:auto;background:#fff;border:1px solid #fed7aa;border-radius:16px;padding:10px;}
      .slide-card{border:1px solid #fed7aa;background:#fff7ed;border-radius:14px;padding:10px;text-align:left;cursor:pointer;color:#7c2d12;font-weight:800;}
      .slide-card:hover{border-color:#fb923c;background:#ffedd5;}
      .slide-card.active{border:3px solid var(--orange);background:#fff;}
      .slide-card small{display:block;color:#9a3412;margin-bottom:4px;}
      .slide-card .line-speaker{display:inline-block;background:#e0f2fe;color:#075985;border-radius:999px;padding:2px 8px;font-size:.78rem;margin-bottom:6px;}
      .slide-card .line-text{display:block;font-size:.9rem;line-height:1.35;color:#7c2d12;}
      .slide-card .line-audio{display:block;margin-top:6px;font-size:.82rem;color:#64748b;font-weight:700;}
    `;
    document.head.appendChild(style);
  }

  function ensureSeparatedSlideListUI() {
    injectSeparatedSlideStyles();
    if (document.getElementById('editorSlideList')) return;
    const grid = document.querySelector('#editor .editor-grid');
    const vitals = document.getElementById('editorVitals');
    if (!grid || !vitals) return;
    const label = document.createElement('label');
    label.textContent = 'Separated conversation lines';
    const list = document.createElement('div');
    list.id = 'editorSlideList';
    list.className = 'slide-list';
    const allChildren = Array.from(grid.children);
    const vitalsIndex = allChildren.indexOf(vitals);
    const insertBefore = vitalsIndex >= 0 ? allChildren[vitalsIndex + 1] : null;
    grid.insertBefore(label, insertBefore || null);
    grid.insertBefore(list, insertBefore || null);
    const editorTitle = document.querySelector('#editor h2');
    if (editorTitle) editorTitle.textContent = 'Admin separated slide editor';
    const hint = document.querySelector('#editor .hint');
    if (hint) hint.textContent = 'Each conversation line is now a separate slide card. Click one card, edit slide text and audio text, then save.';
  }

  function stripTags(value) { return String(value || '').replace(/<[^>]+>/g, ''); }

  function renderEditorSlideList() {
    ensureSeparatedSlideListUI();
    const list = document.getElementById('editorSlideList');
    const patient = getEditedPatient?.();
    if (!list || !patient) return;
    const lines = (patient.lines || []).map(normalizeLine);
    const introScenario = document.getElementById('editorScenario')?.value || patient.scenario || '';
    const introAudio = document.getElementById('editorIntroAudio')?.value || patient.introAudioText || '';
    const cards = [`<button type="button" class="slide-card ${editorSlideIndex === 0 ? 'active' : ''}" onclick="selectEditorSlide(0)"><small>slide-000.wav</small><span class="line-speaker">Intro</span><span class="line-text">${escapeHtml(introScenario).slice(0, 120)}</span><span class="line-audio">Audio: ${escapeHtml(introAudio).slice(0, 90)}</span></button>`];
    lines.forEach((line, index) => {
      const slideNumber = index + 1;
      const speakerLabel = line.speaker === 'nurse' ? 'Practical nurse' : 'Patient';
      cards.push(`<button type="button" class="slide-card ${editorSlideIndex === slideNumber ? 'active' : ''}" onclick="selectEditorSlide(${slideNumber})"><small>slide-${pad(slideNumber)}.wav</small><span class="line-speaker">${speakerLabel}</span><span class="line-text">${escapeHtml(stripTags(line.text)).slice(0, 120)}</span><span class="line-audio">Audio: ${escapeHtml(line.audioText || makeAudioText(line.text)).slice(0, 90)}</span></button>`);
    });
    list.innerHTML = cards.join('');
  }

  function selectEditorSlide(slideNumber) {
    try { saveCurrentSlideToMemory(); savePatientMetaToMemory(); }
    catch (error) { setEditorStatus(error.message); return; }
    editorSlideIndex = Number(slideNumber) || 0;
    populateSlideSelect();
    loadSlideIntoEditor();
    renderEditorSlideList();
  }

  const originalOpenEditor = window.openEditor;
  const originalLoadPatientIntoEditor = window.loadPatientIntoEditor;
  const originalPopulateSlideSelect = window.populateSlideSelect;
  const originalLoadSlideIntoEditor = window.loadSlideIntoEditor;
  const originalMarkEditorDirty = window.markEditorDirty;
  const originalSaveEditor = window.saveEditor;
  window.openEditor = function openEditorSeparated() { originalOpenEditor?.(); ensureSeparatedSlideListUI(); renderEditorSlideList(); };
  window.loadPatientIntoEditor = function loadPatientIntoSeparatedEditor() { originalLoadPatientIntoEditor?.(); ensureSeparatedSlideListUI(); renderEditorSlideList(); };
  window.populateSlideSelect = function populateSeparatedSlideSelect() { originalPopulateSlideSelect?.(); renderEditorSlideList(); };
  window.loadSlideIntoEditor = function loadSeparatedSlideEditor() { originalLoadSlideIntoEditor?.(); renderEditorSlideList(); };
  window.markEditorDirty = function markSeparatedEditorDirty() { originalMarkEditorDirty?.(); renderEditorSlideList(); };
  window.saveEditor = async function saveSeparatedEditor(regenerateAudio) { await originalSaveEditor?.(regenerateAudio); renderEditorSlideList(); };
  window.selectEditorSlide = selectEditorSlide;
  window.renderEditorSlideList = renderEditorSlideList;
})();
