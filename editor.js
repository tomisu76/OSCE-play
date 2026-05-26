(() => {
  function applyAnnaToText(value) {
    return String(value || '')
      .replace(/Good morning\. My name is _____\. I am a practical nurse\./g, 'Good morning. My name is Anna. I am a practical nurse.')
      .replace(/Good morning\. My name is blank\. I am a practical nurse\./g, 'Good morning. My name is Anna. I am a practical nurse.');
  }

  const originalNormalizeLine = window.normalizeLine;
  if (typeof originalNormalizeLine === 'function') {
    window.normalizeLine = function normalizeLineWithAnna(line) {
      const normalized = originalNormalizeLine(line);
      if (normalized && normalized.speaker === 'nurse') {
        normalized.text = applyAnnaToText(normalized.text);
        normalized.audioText = applyAnnaToText(normalized.audioText);
      }
      return normalized;
    };
  }

  const originalPlayAudioForSlideIndex = window.playAudioForSlideIndex;
  function speakAnnaIntro(text, onEnded) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      originalPlayAudioForSlideIndex?.(1, onEnded);
      return;
    }

    try { window.stopCurrentAudio?.(); } catch {}
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(applyAnnaToText(text));
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices?.() || [];
    const preferredVoice = voices.find(voice => /female|samantha|zira|jenny|aria|natural/i.test(voice.name)) || voices.find(voice => /^en/i.test(voice.lang));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => { if (typeof onEnded === 'function') onEnded(); };
    utterance.onerror = () => { if (typeof onEnded === 'function') onEnded(); };
    window.speechSynthesis.speak(utterance);
  }

  if (typeof originalPlayAudioForSlideIndex === 'function') {
    window.playAudioForSlideIndex = function playCorrectedAudioForSlideIndex(index, onEnded) {
      const patient = window.getPatient?.();
      const line = patient?.lines?.[index - 1] ? window.normalizeLine(patient.lines[index - 1]) : null;
      const correctedAudioText = applyAnnaToText(line?.audioText || line?.text || '');

      if (index === 1 && line?.speaker === 'nurse' && correctedAudioText.includes('Anna')) {
        speakAnnaIntro(correctedAudioText, onEnded);
        return;
      }

      originalPlayAudioForSlideIndex(index, onEnded);
    };
  }

  function injectSeparatedSlideStyles() {
    if (document.getElementById('separated-slide-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'separated-slide-editor-styles';
    style.textContent = `
      .slide-list{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
        gap:10px;
        max-height:360px;
        overflow:auto;
        background:#fff;
        border:1px solid #fed7aa;
        border-radius:16px;
        padding:10px;
      }
      .slide-card{
        border:1px solid #fed7aa;
        background:#fff7ed;
        border-radius:14px;
        padding:10px;
        text-align:left;
        cursor:pointer;
        color:#7c2d12;
        font-weight:800;
      }
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

  function stripTags(value) {
    return String(value || '').replace(/<[^>]+>/g, '');
  }

  function renderEditorSlideList() {
    ensureSeparatedSlideListUI();
    const list = document.getElementById('editorSlideList');
    const patient = getEditedPatient?.();
    if (!list || !patient) return;

    const lines = (patient.lines || []).map(normalizeLine);
    const introScenario = document.getElementById('editorScenario')?.value || patient.scenario || '';
    const introAudio = document.getElementById('editorIntroAudio')?.value || patient.introAudioText || '';

    const cards = [
      `<button type="button" class="slide-card ${editorSlideIndex === 0 ? 'active' : ''}" onclick="selectEditorSlide(0)">
        <small>slide-000.wav</small>
        <span class="line-speaker">Intro</span>
        <span class="line-text">${escapeHtml(introScenario).slice(0, 120)}</span>
        <span class="line-audio">Audio: ${escapeHtml(introAudio).slice(0, 90)}</span>
      </button>`
    ];

    lines.forEach((line, index) => {
      const slideNumber = index + 1;
      const speakerLabel = line.speaker === 'nurse' ? 'Practical nurse' : 'Patient';
      cards.push(
        `<button type="button" class="slide-card ${editorSlideIndex === slideNumber ? 'active' : ''}" onclick="selectEditorSlide(${slideNumber})">
          <small>slide-${pad(slideNumber)}.wav</small>
          <span class="line-speaker">${speakerLabel}</span>
          <span class="line-text">${escapeHtml(stripTags(line.text)).slice(0, 120)}</span>
          <span class="line-audio">Audio: ${escapeHtml(line.audioText || makeAudioText(line.text)).slice(0, 90)}</span>
        </button>`
      );
    });

    list.innerHTML = cards.join('');
  }

  function selectEditorSlide(slideNumber) {
    try {
      saveCurrentSlideToMemory();
      savePatientMetaToMemory();
    } catch (error) {
      setEditorStatus(error.message);
      return;
    }

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

  window.openEditor = function openEditorSeparated() {
    originalOpenEditor?.();
    ensureSeparatedSlideListUI();
    renderEditorSlideList();
  };

  window.loadPatientIntoEditor = function loadPatientIntoSeparatedEditor() {
    originalLoadPatientIntoEditor?.();
    ensureSeparatedSlideListUI();
    renderEditorSlideList();
  };

  window.populateSlideSelect = function populateSeparatedSlideSelect() {
    originalPopulateSlideSelect?.();
    renderEditorSlideList();
  };

  window.loadSlideIntoEditor = function loadSeparatedSlideEditor() {
    originalLoadSlideIntoEditor?.();
    renderEditorSlideList();
  };

  window.markEditorDirty = function markSeparatedEditorDirty() {
    originalMarkEditorDirty?.();
    renderEditorSlideList();
  };

  window.saveEditor = async function saveSeparatedEditor(regenerateAudio) {
    await originalSaveEditor?.(regenerateAudio);
    renderEditorSlideList();
  };

  window.selectEditorSlide = selectEditorSlide;
  window.renderEditorSlideList = renderEditorSlideList;
})();
