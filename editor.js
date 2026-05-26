(() => {
  const AUDIO_LINK_VERSION = 'slide001-wav-20260526d';
  let directAudio = null;
  let directAutoPlay = false;

  function injectMobilePolishStyles() {
    if (document.getElementById('mobile-polish-styles')) return;
    const style = document.createElement('style');
    style.id = 'mobile-polish-styles';
    style.textContent = `
      body.fullscreen-mode .fullscreen-stage{
        min-height:100dvh!important;
        height:100dvh!important;
        padding:max(12px, env(safe-area-inset-top)) 12px calc(112px + env(safe-area-inset-bottom))!important;
        align-items:center!important;
        justify-content:center!important;
      }
      body.fullscreen-mode .fs-slide.active{height:100dvh!important;align-items:center!important;justify-content:center!important;}
      .fs-card,.fs-line{scrollbar-width:none;}
      .fs-card::-webkit-scrollbar,.fs-line::-webkit-scrollbar{display:none;}
      @media(max-width:920px){
        .fs-line{font-size:clamp(1.65rem,5.7vw,3rem)!important;line-height:1.18!important;}
        .vital-tag{white-space:nowrap!important;}
      }
      @media(max-width:640px){
        body.fullscreen-mode .fullscreen-stage{
          padding:max(10px, env(safe-area-inset-top)) 10px calc(116px + env(safe-area-inset-bottom))!important;
        }
        .fs-card,.fs-line{
          width:94vw!important;
          max-height:calc(100dvh - 176px)!important;
          border-radius:22px!important;
          border-width:3px!important;
          padding:clamp(18px,5vw,24px)!important;
          box-shadow:0 10px 28px rgba(0,0,0,.22)!important;
        }
        .fs-line{
          font-size:clamp(1.42rem,5.7vw,1.9rem)!important;
          line-height:1.2!important;
          letter-spacing:0!important;
          word-spacing:.01em!important;
        }
        .speaker{
          font-size:.43em!important;
          letter-spacing:.15em!important;
          margin-bottom:12px!important;
        }
        .vital-tag{
          display:inline-flex!important;
          white-space:nowrap!important;
          font-size:.76em!important;
          line-height:1!important;
          padding:.14em .52em!important;
          margin:.03em .12em!important;
          vertical-align:.03em!important;
          max-width:none!important;
        }
        .slide-audio-btn{
          font-size:clamp(.95rem,4vw,1.05rem)!important;
          line-height:1.05!important;
          padding:10px 18px!important;
          margin-top:20px!important;
          border-radius:999px!important;
        }
        .controls{
          width:94vw!important;
          left:50%!important;
          bottom:calc(8px + env(safe-area-inset-bottom))!important;
          transform:translateX(-50%)!important;
          padding:8px!important;
          gap:6px!important;
          border-radius:28px!important;
          justify-content:space-between!important;
        }
        .controls button{
          font-size:.78rem!important;
          line-height:1.08!important;
          padding:10px 10px!important;
          min-width:0!important;
        }
        .controls .audio-control{
          max-width:150px!important;
          white-space:normal!important;
        }
        .controls span{
          min-width:44px!important;
          font-size:.8rem!important;
        }
        .vitals-grid{grid-template-columns:1fr 1fr!important;gap:8px!important;}
        .vital-box{font-size:.9rem!important;padding:10px!important;border-radius:14px!important;}
        .vital-box span{font-size:1.35rem!important;}
        .vital-box small{font-size:.78rem!important;}
      }
      @media(max-width:390px){
        .fs-card,.fs-line{width:93vw!important;padding:18px!important;max-height:calc(100dvh - 170px)!important;}
        .fs-line{font-size:clamp(1.28rem,5.45vw,1.68rem)!important;line-height:1.22!important;}
        .vital-tag{font-size:.72em!important;padding:.13em .46em!important;}
        .slide-audio-btn{font-size:.92rem!important;padding:9px 15px!important;}
        .controls{width:95vw!important;gap:5px!important;padding:7px!important;}
        .controls button{font-size:.7rem!important;padding:9px 8px!important;}
        .controls .audio-control{max-width:136px!important;}
        .controls span{min-width:38px!important;font-size:.72rem!important;}
      }
    `;
    document.head.appendChild(style);
  }

  injectMobilePolishStyles();

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
