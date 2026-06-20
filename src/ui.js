// ── Lyrics ────────────────────────────────────────────────────────
/**
 * @namespace UI
 * UI helpers: modals, toasts, status bar, palette, export dialogs.
 * Provides: showToast, makeModal, closeModal, safeName, dlBlob,
 * escHtml, loadScript, updateStatusBar, togglePalette,
 * renderRehearsalMarks, renderStaffTexts,
 * renderChordSymbols, renderLyrics, _autosaveNow.
 */
const UI = {};

// ── Static listeners (called once at boot) ──────────────────────
function initListeners() {
  // ── Keyboard Shortcuts ───────────────────────────────────────────
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if ((e.metaKey||e.ctrlKey) && e.key==='z') { e.preventDefault(); AUDIO.undo(); return; }
    if (e.shiftKey && e.key==='Z')             { e.preventDefault(); AUDIO.undo(); return; }
    if ((e.metaKey||e.ctrlKey) && e.key==='y') { e.preventDefault(); AUDIO.redo(); return; }
    if (e.shiftKey && e.key==='Y')             { e.preventDefault(); AUDIO.redo(); return; }
    if ((e.metaKey||e.ctrlKey) && e.key==='s') { e.preventDefault(); saveMSCZ(); return; }
    if ((e.metaKey||e.ctrlKey) && e.key==='c') { e.preventDefault(); copySelection(); return; }
    if ((e.metaKey||e.ctrlKey) && e.key==='v') { e.preventDefault(); pasteClipboard(); return; }
    if ((e.metaKey||e.ctrlKey) && e.key==='x') { e.preventDefault(); cutSelection(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
    if (e.key === ' ') { e.preventDefault(); AUDIO.togglePlayback(); return; }
    if (e.key === 'Enter') { e.preventDefault(); toggleInputMode(); return; }
    if (e.key === 'i' || e.key === 'I') { toggleInputMode(); return; }
    if (e.key === 'ArrowUp'    && (APP.inputMode || APP.selectedNoteIdx >= 0)) { e.preventDefault(); changeOctave(1);  return; }
    if (e.key === 'ArrowDown'  && (APP.inputMode || APP.selectedNoteIdx >= 0)) { e.preventDefault(); changeOctave(-1); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); AUDIO.navigateStaff(-1); return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); AUDIO.navigateStaff(1);  return; }
    if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); AUDIO.navigateNote(1,true);  return; }
    if (e.key === 'ArrowLeft'  && e.shiftKey) { e.preventDefault(); AUDIO.navigateNote(-1,true); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); AUDIO.navigateNote(1,false);     return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); AUDIO.navigateNote(-1,false);    return; }
    if ((e.metaKey||e.ctrlKey) && e.key === 'a') { e.preventDefault(); selectAllNotes(); return; }
    if (e.key === '.') { e.preventDefault(); toggleDot(); return; }
    if (e.key === 't' || e.key === 'T') { toggleTuplet(3,2); return; }
    if (e.key === 'm' || e.key === 'M') { toggleMeasureNumbers(); return; }
    const durMap = {'1':'w','2':'h','3':'q','4':'8','5':'16','6':'32','7':'64'};
    if (durMap[e.key]) selectDur(durMap[e.key]);
    if (APP.practiceMode) {
      if (e.key === '#' || (e.shiftKey && e.key === '3')) { setAcc('#'); return; }
      if (e.key === 'b' && !e.shiftKey) { /* 'b' is a note name, skip */ }
      else if (e.key === 'b' && e.shiftKey) { setAcc('b'); return; }
      if (e.key === 'n' || e.key === 'N') { setAcc('n'); return; }
    }
    const noteKeys = {c:'C',d:'D',e:'E',f:'F',g:'G',a:'A',b:'B'};
    if ((APP.inputMode || APP.practiceMode) && noteKeys[e.key.toLowerCase()]) insertNoteByName(noteKeys[e.key.toLowerCase()]);
    if (e.key === '0') { e.preventDefault(); insertRest(); }
    if (e.key === '`' || e.key === '~') { e.preventDefault(); toggleDebugOverlay(); }
  }, { capture: true });

  // ── Resize ────────────────────────────────────────────────────────
  let _resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeT);
    _resizeT = setTimeout(renderScore, 220);
  });

  // ── Action delegation (click/input/change) ────────────────────────
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const fn = _ACTION_MAP[action];
    if (fn) { fn(e); return; }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.tagName !== 'INPUT' || el.type !== 'range' || !el.dataset.action) return;
    const fn = _ACTION_MAP[el.dataset.action];
    if (fn) fn(e);
  });
  document.getElementById('score-title')?.addEventListener('dblclick', showTitleDialog);
  document.getElementById('tempo-slider')?.addEventListener('input', e => updateTempo(e.target.value));
  document.getElementById('tempo-input')?.addEventListener('change', e => updateTempo(e.target.value));
  document.getElementById('search-input')?.addEventListener('input', e => filterSearchPanels(e.target.value));
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.tagName !== 'INPUT' || el.type !== 'number' || !el.dataset.action) return;
    const fn = _ACTION_MAP[el.dataset.action];
    if (fn) fn(e);
  });
}

function toggleLyricStyle(style) {
  if (style === 'bold') {
    APP.lyricBold = !APP.lyricBold;
    document.getElementById('btn-lyric-bold').classList.toggle('active', APP.lyricBold);
  } else {
    APP.lyricItalic = !APP.lyricItalic;
    document.getElementById('btn-lyric-italic').classList.toggle('active', APP.lyricItalic);
  }
}

function editLyric() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedNoteIdx < 0) { showToast('Select a note first, then tap Lyric'); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (!n || n.type === 'rest') { showToast('Lyrics go on notes, not rests'); return; }
  openInlineLyricEditor(APP.selectedMeasure, APP.selectedStaff, APP.selectedNoteIdx);
}

function openInlineLyricEditor(mi, si, ni) {
  // Remove any existing editor
  closeLyricEditor();

  const nl = APP.noteLayout.find(l => l.mi===mi && l.si===si && l.ni===ni);
  const sl = APP.staveLayout.find(l => l.mi===mi && l.si===si);
  if (!nl || !sl) { showToast('Tap the note on screen first to select it'); return; }

  const n       = getMeasureBySI(si, mi)?.notes[ni];
  const curText = n?.lyric?.text || '';
  const font    = document.getElementById('lyric-font').value;
  const size    = parseInt(document.getElementById('lyric-size').value) || 11;

  // Get the SVG bounding rect so we can position the input in page coords
  const svgEl  = document.getElementById('score-svg').querySelector('svg');
  const svgRect = svgEl.getBoundingClientRect();
  const svgW   = parseFloat(svgEl.getAttribute('width'))  || svgRect.width;
  const svgH   = parseFloat(svgEl.getAttribute('height')) || svgRect.height;
  const scaleX = svgRect.width  / svgW;
  const scaleY = svgRect.height / svgH;

  // Convert SVG coords to page coords
  const pageX = svgRect.left + nl.x  * scaleX;
  const pageY = svgRect.top  + (sl.bottomY + 28) * scaleY;

  // Create floating input
  const inp = document.createElement('input');
  inp.id    = 'lyric-inline-input';
  inp.type  = 'text';
  inp.value = curText;
  inp.spellcheck = true;
  inp.setAttribute('lang','en');
  inp.setAttribute('autocorrect','on');
  inp.setAttribute('autocapitalize','none');
  Object.assign(inp.style, {
    position:     'fixed',
    left:         (pageX - 60) + 'px',
    top:          (pageY - 12) + 'px',
    width:        '120px',
    padding:      '3px 6px',
    fontSize:     size + 'px',
    fontFamily:   font,
    fontWeight:   APP.lyricBold   ? 'bold'   : 'normal',
    fontStyle:    APP.lyricItalic ? 'italic' : 'normal',
    background:   'rgba(255,255,240,0.97)',
    border: '2px solid var(--pauta-primary)',
    borderRadius: '5px',
    color:        '#111',
    zIndex:       '500',
    outline:      'none',
    boxShadow:    '0 2px 10px rgba(0,0,0,0.3)',
    textAlign:    'center',
  });

  // Commit on Enter or blur
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitLyric(mi, si, ni, inp.value, null); return; }
    if (e.key === 'Escape') { closeLyricEditor(); return; }
    // Dash = syllable separator → commit with dash marker, advance
    if (e.key === '-' && inp.value.length > 0) {
      e.preventDefault();
      commitLyric(mi, si, ni, inp.value, 'dash');
      return;
    }
    // Space = word separator → commit, advance
    if (e.key === ' ' && inp.value.length > 0) {
      e.preventDefault();
      commitLyric(mi, si, ni, inp.value, 'space');
      return;
    }
  });
  inp.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.getElementById('lyric-inline-input')) {
        commitLyric(mi, si, ni, inp.value, null);
      }
    }, 150);
  });

  document.body.appendChild(inp);

  // Mini font/size toolbar below input
  const toolbar = document.createElement('div');
  toolbar.id = 'lyric-toolbar';
  Object.assign(toolbar.style, {
    position:'fixed', left:(Math.max(8,pageX-80))+'px', top:(pageY+22)+'px',
    display:'flex', gap:'4px', alignItems:'center',
    background:'rgba(26,32,44,0.97)', border:'1px solid rgba(192,86,33,0.30)',
    borderRadius:'8px', padding:'4px 7px', zIndex:'501', boxShadow:'0 3px 12px rgba(0,0,0,0.4)',
  });
  const mkSel = (opts, cur, onChange) => {
    const s = document.createElement('select');
    opts.forEach(([v,l]) => { const o=document.createElement('option'); o.value=v; o.textContent=l; if(v===cur||v==cur)o.selected=true; s.appendChild(o); });
    Object.assign(s.style,{background:'transparent',border:'none',color:'var(--pauta-text-subtle)',fontSize:'11px',cursor:'pointer',outline:'none'});
    s.onchange = () => onChange(s.value);
    return s;
  };
  const fontSel = mkSel([
    ["'Helvetica Neue',Helvetica,sans-serif",'Helv'],['Georgia,serif','Georg'],
    ["'Times New Roman',serif",'Times'],['Arial,sans-serif','Arial']
  ], n?.lyric?.font||font, v => { inp.style.fontFamily=v; });
  const sizeSel = mkSel([[9,'9'],[10,'10'],[11,'11'],[12,'12'],[14,'14']], String(size), v => { inp.style.fontSize=v+'px'; });
  const mkTog = (lbl, act0, onToggle) => {
    const b=document.createElement('button');
    b.textContent=lbl;
    let act=act0;
    const upd=()=>{ b.style.background=act?'rgba(192,86,33,0.20)':'transparent'; b.style.color=act?'var(--pauta-primary)':'var(--pauta-text-subtle)'; b.style.border=act?'1px solid rgba(192,86,33,0.50)':'1px solid transparent'; };
    Object.assign(b.style,{borderRadius:'4px',fontSize:'11px',fontWeight:lbl==='B'?'700':'400',fontStyle:lbl==='I'?'italic':'normal',padding:'0 5px',cursor:'pointer',lineHeight:'18px'});
    upd();
    b.onmousedown=ev=>{ ev.preventDefault(); act=!act; onToggle(act); upd(); };
    return b;
  };
  toolbar.appendChild(fontSel);
  toolbar.appendChild(sizeSel);
  toolbar.appendChild(mkTog('B',APP.lyricBold,v=>{ APP.lyricBold=v; inp.style.fontWeight=v?'bold':'normal'; }));
  toolbar.appendChild(mkTog('I',APP.lyricItalic,v=>{ APP.lyricItalic=v; inp.style.fontStyle=v?'italic':'normal'; }));
  document.body.appendChild(toolbar);

  inp.focus();
  inp.select();
}

function closeLyricEditor() {
  document.getElementById('lyric-inline-input')?.remove();
  document.getElementById('lyric-toolbar')?.remove();
}

function commitLyric(mi, si, ni, rawText, separator) {
  closeLyricEditor();
  const text = rawText.trim();
  const n    = getMeasureBySI(si, mi)?.notes[ni];
  if (!n) return;

  SCORE.commitChange(score => {
    if (!text) {
      delete n.lyric;
    } else {
      const _fontEl = document.querySelector('#lyric-toolbar select');
      const _sizeEl = document.querySelectorAll('#lyric-toolbar select')[1];
      n.lyric = {
        text,
        separator,
        font:   _fontEl?.value || document.getElementById('lyric-font')?.value || "'Helvetica Neue',Helvetica,Arial,sans-serif",
        size:   parseInt(_sizeEl?.value) || parseInt(document.getElementById('lyric-size')?.value) || 11,
        bold:   APP.lyricBold,
        italic: APP.lyricItalic,
      };
    }
  });

  // Auto-advance to next note
  if (separator !== null && text.length > 0) {
    const nextNI = ni + 1;
    const measure = getMeasureBySI(si, mi);
    let nextMi = mi, nextSi = si, nextNiActual = nextNI;

    if (!measure || nextNI >= measure.notes.length) {
      // Try next measure
      nextMi = mi + 1; nextNiActual = 0;
    }

    const nextNote = getMeasureBySI(nextSi, nextMi)?.notes[nextNiActual];
    if (nextNote && nextNote.type === 'note') {
      APP.selectedMeasure = nextMi;
      APP.selectedStaff   = nextSi;
      APP.selectedNoteIdx = nextNiActual;
      RENDER.renderScore();
      // Brief delay to let render complete before opening editor
      setTimeout(() => openInlineLyricEditor(nextMi, nextSi, nextNiActual), 80);
    }
  }
}

function clearLyric() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (!n) return;
  SCORE.commitChange(score => { delete n.lyric; }, { toast: 'Lyric removed' });
}

function saveLyric() {
  const input = document.getElementById('lyric-inline-input');
  if (!input) {
    showToast('No lyric being edited');
    return;
  }
  const mi = APP.selectedMeasure;
  const si = APP.selectedStaff;
  const ni = APP.selectedNoteIdx;
  commitLyric(mi, si, ni, input.value, null);
  showToast('Lyric saved');
}

// ── Chord Symbols ─────────────────────────────────────────────────
function editChordSymbol() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedNoteIdx < 0) { showToast('Select a note first'); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (!n || n.type === 'rest') { showToast('Chord symbols go on notes, not rests'); return; }
  openInlineChordEditor(APP.selectedMeasure, APP.selectedStaff, APP.selectedNoteIdx);
}

function openInlineChordEditor(mi, si, ni) {
  closeChordEditor();

  const nl = APP.noteLayout.find(l => l.mi===mi && l.si===si && l.ni===ni);
  const sl = APP.staveLayout.find(l => l.mi===mi && l.si===si);
  if (!nl || !sl) { showToast('Tap the note on screen first to select it'); return; }

  const n       = getMeasureBySI(si, mi)?.notes[ni];
  const curText = n?.chordSymbol || '';

  const svgEl  = document.getElementById('score-svg').querySelector('svg');
  const svgRect = svgEl.getBoundingClientRect();
  const svgW   = parseFloat(svgEl.getAttribute('width'))  || svgRect.width;
  const svgH   = parseFloat(svgEl.getAttribute('height')) || svgRect.height;
  const scaleX = svgRect.width  / svgW;
  const scaleY = svgRect.height / svgH;

  const pageX = svgRect.left + nl.x * scaleX;
  const pageY = svgRect.top  + (sl.topLineY - 36) * scaleY;

  const inp = document.createElement('input');
  inp.id    = 'chord-inline-input';
  inp.type  = 'text';
  inp.value = curText;
  inp.placeholder = 'e.g. Am7';
  inp.setAttribute('autocomplete','off');
  Object.assign(inp.style, {
    position:     'fixed',
    left:         (pageX - 70) + 'px',
    top:          (pageY - 14) + 'px',
    width:        '140px',
    padding:      '4px 8px',
    fontSize:     '18px',
    fontFamily:  "'Helvetica Neue',Helvetica,Arial,sans-serif",
    fontWeight:   'bold',
    background:   'rgba(255,255,240,0.97)',
    border: '2px solid var(--pauta-primary)',
    borderRadius: '5px',
    color:        '#111',
    zIndex:       '500',
    outline:      'none',
    boxShadow:    '0 2px 10px rgba(0,0,0,0.3)',
    textAlign:    'center',
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commitChord(mi, si, ni, inp.value); return; }
    if (e.key === 'Escape') { closeChordEditor(); return; }
  });
  inp.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.getElementById('chord-inline-input')) {
        commitChord(mi, si, ni, inp.value);
      }
    }, 150);
  });

  document.body.appendChild(inp);

  // Toolbar with chord quick-select + style controls
  const toolbar = document.createElement('div');
  toolbar.id = 'chord-toolbar';
  Object.assign(toolbar.style, {
    position:'fixed', left:(Math.max(8,pageX-100))+'px', top:(pageY+30)+'px',
    display:'flex', gap:'3px', alignItems:'center', flexWrap:'wrap', maxWidth:'320px',
    background:'rgba(26,32,44,0.97)', border:'1px solid rgba(192,86,33,0.30)',
    borderRadius:'8px', padding:'3px 6px', zIndex:'501', boxShadow:'0 3px 12px rgba(0,0,0,0.4)',
  });

  const mkBtn = (lbl, val) => {
    const b = document.createElement('button');
    b.textContent = lbl;
    Object.assign(b.style, {
      background:'transparent', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'4px',
      color:'#cbd5e0', fontSize:'12px', padding:'1px 5px', cursor:'pointer', lineHeight:'18px',
    });
    b.onmousedown = ev => { ev.preventDefault(); _appendToChordInput(val); };
    return b;
  };

  const suffixes = ['maj7','7','m7','dim','aug','sus4','sus2','m7♭5','dim7','9','m9','maj9','6','m6','add9','°','ø'];
  suffixes.forEach(s => toolbar.appendChild(mkBtn(s, s)));

  document.body.appendChild(toolbar);
  inp.focus();
  inp.select();
}

function _appendToChordInput(val) {
  const inp = document.getElementById('chord-inline-input');
  if (!inp) return;
  const cursor = inp.selectionStart || inp.value.length;
  inp.value = inp.value.slice(0, cursor) + val + inp.value.slice(cursor);
  inp.focus();
  const newPos = cursor + val.length;
  inp.setSelectionRange(newPos, newPos);
}

function closeChordEditor() {
  document.getElementById('chord-inline-input')?.remove();
  document.getElementById('chord-toolbar')?.remove();
}

function commitChord(mi, si, ni, rawText) {
  closeChordEditor();
  const text = rawText.trim();
  const n    = getMeasureBySI(si, mi)?.notes[ni];
  if (!n) return;
  SCORE.commitChange(score => {
    n.chordSymbol = text || null;
  }, { toast: text ? `Chord: ${text}` : 'Chord symbol removed' });
}

function saveChordSymbol() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const input = document.getElementById('chord-inline-input');
  if (!input) { editChordSymbol(); return; }
  const mi = APP.selectedMeasure;
  const si = APP.selectedStaff;
  const ni = APP.selectedNoteIdx;
  commitChord(mi, si, ni, input.value);
  showToast('Chord saved');
}

function clearChordSymbol() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (!n) return;
  SCORE.commitChange(score => {
    delete n.chordSymbol;
  }, { toast: 'Chord symbol removed' });
}

// ── Rehearsal Marks ───────────────────────────────────────────────
function _nextRehearsalLabel(type) {
  _ensureScoreAnnotationArrays(APP.score);
  const existing = APP.score.rehearsalMarks.map(r => r.label);
  if (type === 'number') {
    let n = 1;
    while (existing.includes(String(n))) n++;
    return String(n);
  } else {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const l of letters) {
      if (!existing.includes(l)) return l;
    }
    return 'A1';
  }
}

function addRehearsalMark(type) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const label = _nextRehearsalLabel(type);
  SCORE.commitChange(score => {
    if (!score.rehearsalMarks) score.rehearsalMarks = [];
    score.rehearsalMarks = score.rehearsalMarks.filter(r => r.mi !== APP.selectedMeasure);
    score.rehearsalMarks.push({mi: APP.selectedMeasure, label});
  }, { toast: `Rehearsal mark ${label} added` });
}

function editRehearsalMark() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const cur = APP.score.rehearsalMarks?.find(r => r.mi === APP.selectedMeasure)?.label || '';
  makeModal(`
    <h2>Rehearsal Mark</h2>
    <p class="dialog-hint">
      Select a measure first, then type a letter or number</p>
    <input id="rm-input" value="${cur}" placeholder="e.g. A, B, 1, Coda"
      style="font-size:22px;font-weight:700;text-align:center;
              font-family:var(--pauta-font-sans)" maxlength="6">
    <button class="modal-btn primary" data-action="saveRehearsalMark">Apply</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
  setTimeout(() => { const el = document.getElementById('rm-input'); if(el){el.focus();el.select();} }, 60);
}

function saveRehearsalMark() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const label = document.getElementById('rm-input')?.value.trim();
  if (!label) { closeModal(); return; }
  SCORE.commitChange(score => {
    if (!score.rehearsalMarks) score.rehearsalMarks = [];
    score.rehearsalMarks = score.rehearsalMarks.filter(r => r.mi !== APP.selectedMeasure);
    score.rehearsalMarks.push({mi: APP.selectedMeasure, label});
  }, { toast: `Rehearsal mark: ${label}` });
}

function clearRehearsalMark() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  SCORE.commitChange(score => {
    score.rehearsalMarks = (score.rehearsalMarks || []).filter(r => r.mi !== APP.selectedMeasure);
  }, { toast: 'Rehearsal mark removed' });
}

function renderRehearsalMarks() {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl || !APP.score) return;
  (APP.score.rehearsalMarks || []).forEach(rm => {
    const sl = APP.staveLayout.find(l => l.mi === rm.mi && l.si === 0);
    if (!sl) return;
    const fs  = 13, pad = 6;
    const tw  = rm.label.length * 8.5 + pad * 2;
    const bh  = fs + pad * 2;
    const boxX = sl.x;
    const boxY = sl.topLineY - bh - 4;

    svgRect(svgEl, {x: boxX, y: boxY, w: tw, h: bh, rx: 2, fill: '#fff', stroke: '#111', strokeWidth: 1.5});
    svgText(svgEl, {x: boxX + tw / 2, y: boxY + bh / 2 + fs * 0.36, text: rm.label, fontSize: fs, fontWeight: '700', anchor: 'middle'});
  });
}

// ── Help Tips ───────────────────────────────────────────────────
const HELP_TIPS = [
  { q: 'How do I add a note?', a: 'Tap ✏️ Input, then tap a note name (C, D, E…) in the palette. The note is inserted at the selected measure.' },
  { q: 'How do I change a note\'s pitch?', a: 'Select the note (tap it on the score), then tap a different note name in the palette.' },
  { q: 'How do I add a rest?', a: 'Tap the rest button (𝄽) in the palette while in input mode, or press the 0 key.' },
  { q: 'How do I play back the score?', a: 'Press Space or tap the ▶ button in the transport bar.' },
  { q: 'How do I add a tie or slur?', a: 'Select the first note, tap Tie or Slur in the Lines panel, then select the end note.' },
  { q: 'How do I transpose?', a: 'Score menu → Transpose, then choose the interval.' },
  { q: 'How do I add lyrics?', a: 'Select a note and tap Lyric in the palette, or use the Lyrics panel.' },
  { q: 'How do I use Practice Mode?', a: 'Tap the Practice button in the transport bar. Play each highlighted note on your MIDI keyboard or microphone.' },
  { q: 'How do I export to PDF?', a: 'File → Export Engraved PDF. The score is rendered as a high-resolution image and saved as a PDF.' },
  { q: 'How do assignments work?', a: 'Teach → Create Assignment to hide notes for students. Share the .mscz file. Students open it, fill in answers, and send it back.' },
  { q: 'What keyboard shortcuts are available?', a: 'Space = play/pause, 0 = rest, Arrow keys = move selection, Home = rewind, Delete = remove note.' },
  { q: 'How do I add a chord?', a: 'Select a note, tap Chord mode (the chord icon), then tap additional note names to stack them.' },
];

function showHelpPanel() {
  makeModal(`
    <h2>Help & Tips</h2>
    <input id="help-search" type="text" placeholder="Search tips…" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111;margin-bottom:10px">
    <div id="help-list" style="flex-shrink:0;max-height:280px;overflow-y:auto;font-size:12px;color:var(--pauta-text-muted);line-height:1.5">
      ${HELP_TIPS.map((t,i) => `<div class="help-tip" data-idx="${i}" style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(192,86,33,0.08)">
        <div style="font-weight:600;color:var(--pauta-text);margin-bottom:2px">${t.q}</div>
        <div>${t.a}</div>
      </div>`).join('')}
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
  setTimeout(() => {
    const inp = document.getElementById('help-search');
    const list = document.getElementById('help-list');
    if (!inp || !list) return;
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      list.querySelectorAll('.help-tip').forEach(el => {
        const text = el.textContent.toLowerCase();
        el.style.display = text.includes(q) ? '' : 'none';
      });
    });
    inp.focus();
  }, 50);
}

// ── Staff Text (free annotations) ────────────────────────────────
function addStaffText() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedNoteIdx < 0 && APP.selectedMeasure < 0) {
    showToast('Select a note or measure first');
    return;
  }
  const cur = (() => {
    if (APP.selectedNoteIdx >= 0) {
      return getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx]?.staffText || '';
    }
    return APP.score.staffTexts?.find(t => t.mi === APP.selectedMeasure && t.si === 0)?.text || '';
  })();

  makeModal(`
    <h2>Staff Text</h2>
    <p class="dialog-hint">
      Free annotation — appears above the staff at this position</p>
    <input id="st-input" value="${cur.replace(/"/g,'&quot;')}"
      placeholder="e.g. Solo, Watch conductor, p dolce"
      spellcheck="true" autocorrect="on">
    <label style="color:rgba(74,85,104,0.55);font-size:10px;text-transform:uppercase;
                  letter-spacing:0.3px;margin-top:2px;display:block">Style</label>
    <div style="display:flex;gap:6px">
      <select id="st-style" style="flex:1;padding:7px;background:rgba(192,86,33,0.06);
        border:1px solid rgba(192,86,33,0.18);border-radius:8px;color:var(--pauta-text-subtle);font-size:12px;
        -webkit-appearance:none">
        <option value="normal">Normal</option>
        <option value="italic">Italic</option>
        <option value="bold">Bold</option>
        <option value="bold-italic">Bold Italic</option>
      </select>
      <select id="st-size" style="flex:0 0 70px;padding:7px;background:rgba(192,86,33,0.06);
        border:1px solid rgba(192,86,33,0.18);border-radius:8px;color:var(--pauta-text-subtle);font-size:12px;
        -webkit-appearance:none">
        <option value="12" selected>12</option>
        <option value="13">13</option>
        <option value="14">14</option>
        <option value="15">15</option>
        <option value="16">16</option>
      </select>
    </div>
    <button class="modal-btn primary" data-action="saveStaffText">Apply</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
  setTimeout(() => { const el = document.getElementById('st-input'); if(el){el.focus();el.select();} }, 60);
}

function saveStaffText() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const text  = document.getElementById('st-input')?.value.trim();
  const style = document.getElementById('st-style')?.value || 'normal';
  const size  = parseInt(document.getElementById('st-size')?.value) || 12;
  SCORE.commitChange(score => {
    if (!score.staffTexts) score.staffTexts = [];

    if (APP.selectedNoteIdx >= 0) {
      const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
      if (n) {
        if (!text) { delete n.staffText; delete n.staffTextStyle; delete n.staffTextSize; }
        else { n.staffText = text; n.staffTextStyle = style; n.staffTextSize = size; }
      }
    } else {
      score.staffTexts = score.staffTexts.filter(t => t.mi !== APP.selectedMeasure || t.si !== 0);
      if (text) score.staffTexts.push({mi: APP.selectedMeasure, si: 0, text, style, size});
    }
  }, { toast: text ? `Text: "${text}"` : 'Text removed' });
}

function clearStaffText() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  SCORE.commitChange(score => {
    if (APP.selectedNoteIdx >= 0) {
      const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
      if (n) { delete n.staffText; delete n.staffTextStyle; delete n.staffTextSize; }
    } else {
      score.staffTexts = (score.staffTexts || []).filter(
        t => t.mi !== APP.selectedMeasure || t.si !== 0);
    }
  }, { toast: 'Text removed' });
}

function renderStaffTexts() {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl || !APP.score) return;

  const drawText = (x, y, text, style, size) => {
    svgText(svgEl, {x, y, text, fontSize: size || 14,
      fontWeight: (style||'').includes('bold') ? 'bold' : 'normal',
      fill: '#111'});
  };

  // Note-attached staff texts
  let gsi = 0;
  APP.score.parts.forEach(part => {
    part.staves.forEach((stave, localSI) => {
      const si = gsi + localSI;
      stave.measures.forEach((measure, mi) => {
        measure.notes.forEach((note, ni) => {
          if (!note.staffText) return;
          const nl = APP.noteLayout.find(l => l.mi===mi && l.si===si && l.ni===ni);
          const sl = APP.staveLayout.find(l => l.mi===mi && l.si===si);
          if (!nl || !sl) return;
          // If this note also has a chord symbol, shift staff text to the right
          // to avoid the two labels colliding (chord sits centred on nl.x).
          const hasChord = !!note.chordSymbol;
          const xOffset  = hasChord ? 18 : -4;
          drawText(nl.x + xOffset, sl.topLineY - 22, note.staffText, note.staffTextStyle, note.staffTextSize);
        });
      });
    });
    gsi += part.staves.length;
  });

  // Measure-attached staff texts
  (APP.score.staffTexts || []).forEach(st => {
    const sl = APP.staveLayout.find(l => l.mi === st.mi && l.si === st.si);
    if (!sl) return;
    drawText(sl.x, sl.topLineY - 22, st.text, st.style, st.size);
  });
}

function renderChordSymbols() {
  // Chord symbols are now VF.Annotation modifiers (attached in buildVFNotes).
}

function renderLyrics() {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl || !APP.score) return;
  let gsi = 0;
  APP.score.parts.forEach(part => {
    part.staves.forEach((stave, localSI) => {
      const si = gsi + localSI;
      stave.measures.forEach((measure, mi) => {
        measure.notes.forEach((note, ni) => {
          if (!note.lyric) return;
          const nl = APP.noteLayout.find(l=>l.mi===mi&&l.si===si&&l.ni===ni);
          const sl = APP.staveLayout.find(l=>l.mi===mi&&l.si===si);
          if (!nl||!sl) return;
          const lyr = note.lyric;

          // Render lyric text
          const el = document.createElementNS('http://www.w3.org/2000/svg','text');
          el.setAttribute('x', nl.x);
          el.setAttribute('y', sl.bottomY + 32);
          el.setAttribute('text-anchor', 'middle');
          el.setAttribute('font-family', lyr.font || 'var(--pauta-font-sans)');
          el.setAttribute('font-size', lyr.size || 11);
          el.setAttribute('font-weight', lyr.bold ? 'bold' : 'normal');
          el.setAttribute('font-style', lyr.italic ? 'italic' : 'normal');
          el.setAttribute('fill', '#555');
          el.setAttribute('pointer-events', 'none');
          el.textContent = lyr.text;
          svgEl.appendChild(el);

          // Dash connector between syllables
          if (lyr.separator !== 'dash') return;
          const nextNL = APP.noteLayout.find(l=>l.mi===mi&&l.si===si&&l.ni===ni+1)
                      || APP.noteLayout.find(l=>l.mi===mi+1&&l.si===si&&l.ni===0);
          if (!nextNL) return;
          const x1 = nl.x + 8 + (lyr.text.length * (lyr.size||11) * 0.28);
          const x2 = nextNL.x - 8;
          if (x2 <= x1 + 4) return;
          const dash = document.createElementNS('http://www.w3.org/2000/svg','text');
          dash.setAttribute('x', (x1+x2)/2);
          dash.setAttribute('y', sl.bottomY + 32);
          dash.setAttribute('text-anchor','middle');
          dash.setAttribute('font-family','var(--pauta-font-sans)');
          dash.setAttribute('font-size', lyr.size||11);
          dash.setAttribute('fill','#555');
          dash.setAttribute('pointer-events','none');
          dash.textContent = '–';
          svgEl.appendChild(dash);
        });
      });
    });
    gsi += part.staves.length;
  });
}

function updateTempo(v) {
  let bpm = parseInt(v);
  if (isNaN(bpm) || bpm < 40) bpm = 40;
  if (bpm > 240) bpm = 240;
  APP.tempo = bpm;
  const input = document.getElementById('tempo-input');
  const slider = document.getElementById('tempo-slider');
  if (input) input.value = bpm;
  if (slider) slider.value = bpm;
}

// ── Score Menu ────────────────────────────────────────────────────
// ── Parts System ─────────────────────────────────────────────────

function showMixer() {
  const parts = APP.score?.parts || [];
  const masterPct = Math.round((APP.masterVolume || 0.65) * 100);
  const metPct = Math.round((APP.metronomeVolume || 0.5) * 100);
  const partSliders = parts.map((p, i) => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="flex:0 0 70px;font-size:11px;color:var(--pauta-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
      <input type="range" min="0" max="100" value="${Math.round((p.volume||1)*100)}"
        data-action="setPartVolume" data-idx="${i}"
        style="flex:1;height:4px;accent-color:var(--pauta-primary);cursor:pointer"
        aria-label="${p.name} volume">
      <span id="mix-part-${i}" style="width:24px;text-align:right;font-size:10px;color:rgba(74,85,104,0.6)">${Math.round((p.volume||1)*100)}</span>
    </div>`).join('');

  makeModal(`
    <h2>Mixer</h2>
    <div style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="flex:0 0 70px;font-size:11px;color:var(--pauta-text-muted)">Master</span>
        <input type="range" min="0" max="100" value="${masterPct}"
          data-action="setMasterVolume"
          style="flex:1;height:4px;accent-color:var(--pauta-primary);cursor:pointer" aria-label="Master volume">
        <span id="mix-master-val" style="width:24px;text-align:right;font-size:10px;color:rgba(74,85,104,0.6)">${masterPct}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="flex:0 0 70px;font-size:11px;color:var(--pauta-text-muted)">Metronome</span>
        <input type="range" min="0" max="100" value="${metPct}"
          data-action="setMetronomeVolume"
          style="flex:1;height:4px;accent-color:var(--pauta-primary);cursor:pointer" aria-label="Metronome volume">
        <span id="mix-met-val" style="width:24px;text-align:right;font-size:10px;color:rgba(74,85,104,0.6)">${metPct}</span>
      </div>
    </div>
    <div class="modal-sep"></div>
    ${parts.length > 0 ? `<div class="modal-sep"></div>${partSliders}` : ''}
    <button class="modal-btn secondary" style="margin-top:8px" data-action="closeModal">Close</button>
  `);
}

function togglePartMute(partIdx) {
  const part = APP.score?.parts[partIdx];
  if (!part) return;
  SCORE.commitChange(score => {
    score.parts[partIdx].muted = !score.parts[partIdx].muted;
  }, { toast: `${part.name} ${!part.muted ? 'muted' : 'unmuted'}` });
}
function setPartVolume(partIdx, val) {
  const part = APP.score?.parts[partIdx];
  if (!part) return;
  SCORE.commitChange(score => {
    score.parts[partIdx].volume = Math.max(0, Math.min(1, val / 100));
  });
}

// ── Pickup Measure ────────────────────────────────────────────────
function showPickupDialog() {
  const firstM = APP.score.parts[0].staves[0].measures[0];
  const isPickup = !!firstM?.pickup;
  const ts = resolvedTimeSig(0, 0);
  const maxPickup = Math.max(1, ts.num - 1);
  makeModal(`
    <h2>Pickup Measure (Anacrusis)</h2>
    ${isPickup ? `<p style="color:var(--pal-label);font-size:11px">First measure is a pickup (<b>${firstM.pickup.num}/${firstM.pickup.den}</b>). Time signature shown at measure 2.</p>` :
      `<p style="color:var(--pal-label);font-size:11px">First measure is full (<b>${ts.num}/${ts.den}</b>). Make it a pickup:</p>`}
    ${!isPickup ? `
      <div class="panel-section-label" style="margin:8px 0 4px">Pickup duration</div>
      <div style="display:flex;gap:6px;align-items:center;justify-content:center;margin-bottom:8px">
        <select id="pu-num" style="background:rgba(192,86,33,0.06);color:var(--pauta-text-subtle);border:1px solid rgba(192,86,33,0.30);border-radius:6px;padding:6px;font-size:14px;outline:none">
          ${Array.from({length: maxPickup}, (_, i) => i + 1).map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
        <span style="color:rgba(74,85,104,0.40);font-size:18px">/</span>
        <select id="pu-den" style="background:rgba(192,86,33,0.06);color:var(--pauta-text-subtle);border:1px solid rgba(192,86,33,0.30);border-radius:6px;padding:6px;font-size:14px;outline:none">
          <option value="4">4</option>
          <option value="8">8</option>
        </select>
        <span style="color:var(--pal-label);font-size:11px">beats</span>
      </div>
      <button class="modal-btn primary" data-action="setPickupMeasure">Set Pickup</button>
    ` : `
      <button class="modal-btn secondary" data-action="removePickupMeasure" style="color:var(--pauta-error);border-color:rgba(224,112,96,0.35)">Remove Pickup</button>
    `}
    <div class="modal-sep"></div>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function setPickupMeasure() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const num = parseInt(document.getElementById('pu-num')?.value) || 1;
  const den = parseInt(document.getElementById('pu-den')?.value) || 4;
  const ts = resolvedTimeSig(0, 0);
  if (num >= ts.num) { showToast('Pickup must be shorter than the time signature'); return; }
  const puBeat = num * (4 / den);
  const bestRest = beatsToBestRestDuration(puBeat);
  const restDur = bestRest ? bestRest.dur : 'q';
  SCORE.commitChange(score => {
    score.parts.forEach(p => p.staves.forEach(s => {
      const m = s.measures[0];
      m.pickup = {num, den};
      m.timeSigNum = ts.num;
      m.timeSigDen = ts.den;
      m.notes = [SCORE.mkRest(restDur)];
    }));
    while (score.parts[0].staves[0].measures.length < 2) {
      score.parts.forEach(p => p.staves.forEach(s => s.measures.push(SCORE.emptyMeasure())));
    }
  }, { toast: `Pickup ${num}/${den} set` });
}

function removePickupMeasure() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  SCORE.commitChange(score => {
    score.parts.forEach(p => p.staves.forEach(s => {
      delete s.measures[0].pickup;
    }));
  }, { toast: 'Pickup removed' });
}

// ── Edit Menu ─────────────────────────────────────────────────────
function showEditMenu(btn) {
  showDropdown(btn, [
    {label:'Undo',  fn:undo},
    {label:'Redo',  fn:redo},
    {sep:true},
    {label:'Cut',   fn:cutSelection},
    {label:'Copy',  fn:copySelection},
    {label:'Paste', fn:pasteClipboard},
  ]);
}

function showScoreMenu(btn) {
  const mi = APP.selectedMeasure + 1;
  const items = [
    {label:'Time Signature', fn:showTimeSigDialog},
    {label:'Key Signature', fn:showKeySigDialog},
    {label:'Transpose…', fn:showTransposeDialog},
    {label:'Add Instrument', fn:showMixer},
    {sep:true},
    {label:'Pickup Measure', fn:showPickupDialog},
    {sep:true},
    {label:`Delete Measure ${mi}`, fn:deleteMeasure, danger:true},
    {sep:true},
    {label:'Add Measure at End', fn:addMeasure},
    {label:'Score Info', fn:showScoreInfo},
  ];
  showDropdown(btn, items);
}

function showViewMenu(btn) {
  const items = [
    {label:`${APP.showMeasureNumbers?'✓':'○'} Measure Numbers`, fn:toggleMeasureNumbers},
    {label:`${APP.showMultiMeasureRests?'✓':'○'} Multi-Rests`, fn:toggleMultiMeasureRests},
    {label:`${APP.continuousView?'✓':'○'} Continuous View`, fn:toggleContinuousView},
    {label:`${document.body.classList.contains('high-contrast')?'✓':'○'} High Contrast`, fn:toggleHighContrast},
    {sep:true},
    {label:`${APP.showTheoryOverlay?'✓':'○'} 🎼 Theory Overlay`, fn:toggleTheoryOverlay},
    {label:`${APP.showRhythmCounting?'✓':'○'} 𝅘𝅥𝅮 Rhythm Counting`, fn:toggleRhythmCounting},
    {sep:true},
    {label:'🎓 Difficulty Profile', fn:showProfileSubmenu},
  ];
  showDropdown(btn, items);
}

// ── Scale / Arpeggio Generator ─────────────────────────────────────
const SCALE_TYPES = [
  { id: 'major',            label: 'Major Scale' },
  { id: 'natural-minor',    label: 'Natural Minor Scale' },
  { id: 'harmonic-minor',   label: 'Harmonic Minor Scale' },
  { id: 'melodic-minor',    label: 'Melodic Minor Scale' },
  { id: 'major-arpeggio',   label: 'Major Arpeggio' },
  { id: 'minor-arpeggio',   label: 'Minor Arpeggio' },
];

const SCALE_INTERVALS = {
  major:            [0, 2, 4, 5, 7, 9, 11],
  'natural-minor':  [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor':  [0, 2, 3, 5, 7, 9, 11],
  'major-arpeggio': [0, 4, 7],
  'minor-arpeggio': [0, 3, 7],
};

const KS_TONIC_PC = {0:0,1:7,2:2,3:9,4:4,5:11,6:6,7:1,"-1":5,"-2":10,"-3":3,"-4":8,"-5":1,"-6":6,"-7":11};

/** Natural pitch class for diatonic index 0=C..6=B */
const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];

const PC_SHARP_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const PC_FLAT_NAMES  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

/**
 * Tonic name for a scale/arpeggio of a given key signature and type.
 * For major scales/arpeggios this is the key signature name (C for ks=0, G for ks=1, etc.).
 * For minor scales/arpeggios this is the relative minor (A for ks=0, E for ks=1, etc.).
 */
function scaleTonicName(ks, type) {
  if (type === 'major' || type === 'major-arpeggio') {
    return keySigName(ks);
  }
  const majorTonicPC = KS_TONIC_PC[ks] ?? 0;
  const minorTonicPC = (majorTonicPC + 9) % 12;
  return (ks < 0 ? PC_FLAT_NAMES : PC_SHARP_NAMES)[minorTonicPC];
}

/**
 * Generate scale/arpeggio notes for a given key and type.
 * @param {number} ks - Key signature (-7..7)
 * @param {string} type - SCALE_TYPES id
 * @param {number} octaves - 1 or 2
 * @param {number} startOctave - Starting octave number (4 = middle C octave)
 * @returns {{pitch:number, accidental:string|null}[]}
 */
function generateScale(ks, type, octaves, startOctave) {
  const majorPC = KS_TONIC_PC[ks] ?? 0;
  const isMinor = type === 'natural-minor' || type === 'harmonic-minor' || type === 'melodic-minor' || type === 'minor-arpeggio';
  const tonicPC = isMinor ? (majorPC + 9) % 12 : majorPC;
  const intervals = SCALE_INTERVALS[type] || SCALE_INTERVALS.major;
  const tonicName = scaleTonicName(ks, type);
  const tonicDiaIdx = NOTE_NAMES.indexOf(tonicName.replace(/[#b]/g, '').toLowerCase());

  /** Resolve a diatonic degree into {pitch, accidental} given the tonic and key. */
  function resolveNote(tonicMidi, diaIdx, pc) {
    const naturalPC = NATURAL_PCS[diaIdx];
    let accidental = null;
    if (pc === (naturalPC + 1) % 12) accidental = '#';
    else if (pc === (naturalPC + 11) % 12) accidental = 'b';
    return { pitch: tonicMidi, accidental };
  }

  const notes = [];

  if (type === 'melodic-minor') {
    // Melodic minor: ascending (raised 6th/7th) then descending (natural minor)
    const ascIntervals  = [0, 2, 3, 5, 7, 9, 11];
    const descIntervals = [10, 8, 7, 5, 3, 2, 0];
    for (let o = 0; o < octaves; o++) {
      const octave = startOctave + o;
      const tonicMidi = (octave + 1) * 12 + tonicPC;
      // Ascending
      for (let d = 0; d < ascIntervals.length; d++) {
        const pc = (tonicPC + ascIntervals[d]) % 12;
        const diaIdx = (tonicDiaIdx + d) % 7;
        const note = resolveNote(tonicMidi + ascIntervals[d], diaIdx, pc);
        if (note.pitch >= 12 && note.pitch <= 120) notes.push(note);
      }
    }
    // Top octave
    const topMidi = (startOctave + octaves + 1) * 12 + tonicPC;
    if (topMidi >= 12 && topMidi <= 120) {
      notes.push(resolveNote(topMidi, tonicDiaIdx, tonicPC));
    }
    // Descending
    for (let o = octaves - 1; o >= 0; o--) {
      const octave = startOctave + o;
      const tonicMidi = (octave + 1) * 12 + tonicPC;
      for (let d = 0; d < descIntervals.length; d++) {
        const pc = (tonicPC + descIntervals[d]) % 12;
        const diaIdx = (tonicDiaIdx + 6 - d) % 7;
        const note = resolveNote(tonicMidi + descIntervals[d], diaIdx, pc);
        if (note.pitch >= 12 && note.pitch <= 120) notes.push(note);
      }
    }
  } else {
    // Standard scales and arpeggios
    for (let o = 0; o < octaves; o++) {
      const octave = startOctave + o;
      const tonicMidi = (octave + 1) * 12 + tonicPC;
      for (let d = 0; d < intervals.length; d++) {
        const pc = (tonicPC + intervals[d]) % 12;
        const diaIdx = (tonicDiaIdx + d) % 7;
        const note = resolveNote(tonicMidi + intervals[d], diaIdx, pc);
        if (note.pitch >= 12 && note.pitch <= 120) notes.push(note);
      }
    }
    // Add the octave at the end for scales (not arpeggios)
    if (octaves > 0 && intervals.length === 7) {
      const topMidi = (startOctave + 1) * 12 + tonicPC + 12 * octaves;
      if (topMidi >= 12 && topMidi <= 120) {
        notes.push(resolveNote(topMidi, tonicDiaIdx, tonicPC));
      }
    }
  }
  return notes;
}

function showScaleGeneratorDialog() {
  const instrOptions = INSTRUMENTS
    .filter(i => !i.percussion)
    .map(i => `<option value="${i.name}">${i.name}</option>`).join('');

  const scaleOptions = SCALE_TYPES.map(st =>
    `<option value="${st.id}">${st.label}</option>`).join('');

  const ksOptions = [];
  for (let ks = -7; ks <= 7; ks++) {
    const name = keySigName(ks) + (ks === 0 ? ' major' : '');
    const rel = ['A min','E min','B min','F# min','C# min','G# min','D# min','A# min','D min','G min','C min','F min','Bb min','Eb min','Ab min'][ks + 7];
    ksOptions.push(`<option value="${ks}">${name} / ${rel}</option>`);
  }

  makeModal(`
    <h2>Generate Scale / Arpeggio</h2>
    <div style="font-size:12px;color:var(--pauta-text-muted);margin-bottom:12px">
      Creates a new score with the selected scale or arpeggio for the chosen instrument.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Instrument</div>
        <select id="sg-instr" style="width:100%;padding:6px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:12px;background:transparent;color:#111">${instrOptions}</select>
      </div>
      <div>
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Type</div>
        <select id="sg-type" style="width:100%;padding:6px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:12px;background:transparent;color:#111">${scaleOptions}</select>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div>
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Key</div>
        <select id="sg-ks" style="width:100%;padding:6px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:12px;background:transparent;color:#111">${ksOptions.join('')}</select>
      </div>
      <div>
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Octaves</div>
        <select id="sg-octaves" style="width:100%;padding:6px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:12px;background:transparent;color:#111">
          <option value="1">1 octave</option>
          <option value="2" selected>2 octaves</option>
        </select>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Starting octave</div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="modal-btn secondary" id="sg-oct-down" style="padding:2px 10px;font-size:14px">−</button>
        <span id="sg-oct-display" style="font-size:16px;font-weight:600;min-width:30px;text-align:center;color:var(--pauta-primary)">4</span>
        <button class="modal-btn secondary" id="sg-oct-up" style="padding:2px 10px;font-size:14px">+</button>
        <span style="font-size:11px;color:var(--pauta-text-muted)">(C<span id="sg-oct-sub">4</span> = middle C)</span>
      </div>
    </div>
    <button class="modal-btn primary" data-action="confirmGenerateScale">Generate</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);

  // Octave +/- controls
  let oct = 4;
  const instr = document.getElementById('sg-instr');
  const display = document.getElementById('sg-oct-display');
  const sub = document.getElementById('sg-oct-sub');
  function updateOct(v) { oct = Math.max(1, Math.min(8, v)); display.textContent = oct; sub.textContent = oct; }
  document.getElementById('sg-oct-down').onclick = () => updateOct(oct - 1);
  document.getElementById('sg-oct-up').onclick = () => updateOct(oct + 1);

  // Auto-adjust octave on instrument change
  instr.onchange = () => {
    const name = instr.value;
    const i = INSTRUMENTS.find(x => x.name === name);
    if (!i) return;
    const autoOct = i.staves[0] === 'bass' ? 2 : 3;
    updateOct(autoOct);
  };
  // Trigger initial auto-octave
  setTimeout(() => { instr.onchange(); }, 0);
}

function confirmGenerateScale() {
  const instrName = document.getElementById('sg-instr')?.value || 'Piano';
  const type = document.getElementById('sg-type')?.value || 'major';
  const ks = parseInt(document.getElementById('sg-ks')?.value) || 0;
  const octaves = parseInt(document.getElementById('sg-octaves')?.value) || 2;
  const octDisplay = document.getElementById('sg-oct-display');
  const startOctave = parseInt(octDisplay?.textContent) || 4;

  const notes = generateScale(ks, type, octaves, startOctave);
  if (!notes.length) { showToast('No notes generated — check range'); return; }

  const instr = instrByName(instrName);
  const score = SCORE.createScore({ title: `${scaleTonicName(ks, type)} ${SCALE_TYPES.find(s => s.id === type)?.label || type}`, instruments: [instrName], ks, ts: {num: notes.length <= 8 ? 4 : 4, den: 4} });
  const stave = score.parts[0].staves[0];

  const beatsPerMeasure = 4;
  stave.measures = [];
  let measureNotes = [], beats = 0;

  for (const n of notes) {
    let dur = 'q';
    // Use smaller durations if many notes for 2 octaves
    if (notes.length > 14) dur = '8';
    else if (notes.length > 8) dur = 'q';

    measureNotes.push(SCORE.mkNote(n.pitch, dur, 0, n.accidental, 1));
    beats += durBeats(dur, 0, null);

    if (beats >= beatsPerMeasure - 0.001 || measureNotes.length >= notes.length) {
      stave.measures.push({
        timeSigNum: stave.measures.length === 0 ? 4 : null,
        timeSigDen: stave.measures.length === 0 ? 4 : null,
        keySig: stave.measures.length === 0 ? ks : null,
        lineBreak: false,
        notes: measureNotes,
      });
      measureNotes = []; beats = 0;
    }
  }

  SCORE.adoptScore(score, { clearHistory: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  RENDER.renderScore();
  showToast(`Generated: ${scaleTonicName(ks, type)} ${SCALE_TYPES.find(s => s.id === type)?.label || type}`);
}

function showLearnMenu(btn) {
  showDropdown(btn, [
    {label:'Curriculum', fn:showCurriculumDialog},
    {label:'Recorder Exercises', fn:showRecorderExercises},
    {label:'Generate Scale / Arpeggio', fn:showScaleGeneratorDialog},
  ]);
}

function showPracticeMenu(btn) {
  const practiceLabel = APP.practiceMode ? 'Stop Practice' : 'Practice Mode';
  const sens = Math.round((APP.practiceSensitivity || 0.3) * 100);
  const tempo = APP.practiceTempo || 80;
  const metronome = APP.practiceMetronome ? 'ON' : 'OFF';
  const loopEnabled = APP.practiceLoop ? 'ON' : 'OFF';
  const transposition = APP.practiceTranspose || 0;
  showDropdown(btn, [
    {label:practiceLabel, fn:togglePracticeMode},
    {sep:true},
    ...(APP.practiceMode ? [{
      label: `Mic Level: <div id="practice-mic-level" style="display:inline-block;width:80px;height:6px;background:var(--pauta-primary);border-radius:3px;vertical-align:middle;margin-left:8px"></div>`,
      fn: () => {},
      danger: false,
      disabled: true
    }, {sep:true}] : []),
    {
      label: `Sensitivity: ${sens}%`,
      fn: () => {
        const newSens = Math.max(10, Math.min(50, sens + 10));
        APP.practiceSensitivity = newSens / 100;
        showPracticeMenu(btn);
      }
    },
    {sep:true},
    {
      label: `Settings  (Tempo=${tempo}  Metronome=${metronome}  Loop=${loopEnabled}  Transpose=${transposition >= 0 ? '+' : ''}${transposition})`,
      fn: showPracticeSettingsMenu
    },
    {sep:true},
    {label:'Rhythm Workout…', fn:showRhythmWorkoutDialog},
    {label:'Rhythm Reading', fn:() => startExerciseSession('rhythm_read', APP.exerciseDifficulty || 'beginner')},
    {label:'Rhythm Dictation', fn:showRhythmWorksheetDialog},
    {sep:true},
    {label:'Note Drills', fn:() => startExerciseSession('note_id', APP.exerciseDifficulty || 'beginner')},
    {label:'Interval Training', fn:() => startExerciseSession('interval_id', APP.exerciseDifficulty || 'beginner')},
    {label:'Key Sig Drills', fn:() => startExerciseSession('key_sig_id', APP.exerciseDifficulty || 'beginner')},
    {label:'Scale Gym', fn:() => startExerciseSession('scale_id', APP.exerciseDifficulty || 'beginner')},
    {sep:true},
    {label:'Melody Dictation', fn:() => startExerciseSession('melody_dictation', APP.exerciseDifficulty || 'beginner')},
  ]);
}

function showPracticeSettingsMenu(btn) {
  const tempo = APP.practiceTempo || 80;
  const metronome = APP.practiceMetronome;
  const loopEnabled = APP.practiceLoop;
  const loopStart = APP.practiceLoopStart || 0;
  const loopEnd = APP.practiceLoopEnd || 0;
  const transposition = APP.practiceTranspose || 0;
  const maxMeasure = Math.max(0, (APP.score?.parts[0]?.staves[0]?.measures?.length || 1) - 1);
  const sens = Math.round((APP.practiceSensitivity || 0.3) * 100);

  function row(label, value, onMinus, onPlus) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(192,86,33,0.08)">
      <span style="font-size:13px;color:var(--pauta-text)">${label}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="pauta-btn ghost sm" data-action="psMinus" data-ps="${onMinus}" style="width:32px;height:32px;font-size:18px;padding:0">−</button>
        <span style="font-size:14px;font-weight:600;min-width:60px;text-align:center;color:var(--pauta-primary)">${value}</span>
        <button class="pauta-btn ghost sm" data-action="psPlus" data-ps="${onPlus}" style="width:32px;height:32px;font-size:18px;padding:0">+</button>
      </div>
    </div>`;
  }
  function toggleRow(label, isOn, action) {
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(192,86,33,0.08)">
      <span style="font-size:13px;color:var(--pauta-text)">${label}</span>
      <button class="pauta-btn ${isOn ? 'primary' : 'ghost'} sm" data-action="${action}" style="min-width:60px;height:32px">${isOn ? 'ON' : 'OFF'}</button>
    </div>`;
  }

  makeModal(`
    <h2>Practice Settings</h2>
    ${row('Tempo', `${tempo} BPM`, 'psTempoMinus', 'psTempoPlus')}
    ${toggleRow('Metronome', metronome, 'psToggleMet')}
    ${toggleRow('Loop', loopEnabled, 'psToggleLoop')}
    ${loopEnabled ? row('Loop Start', `Measure ${loopStart + 1}`, 'psLoopStartMinus', 'psLoopStartPlus') : ''}
    ${loopEnabled ? row('Loop End', `Measure ${loopEnd + 1}`, 'psLoopEndMinus', 'psLoopEndPlus') : ''}
    ${row('Transpose', `${transposition >= 0 ? '+' : ''}${transposition} st`, 'psTransMinus', 'psTransPlus')}
    ${row('Sensitivity', `${sens}%`, 'psSensMinus', 'psSensPlus')}
    <div style="margin-top:12px">
      <button class="pauta-btn secondary block" data-action="closeModal">Done</button>
    </div>
  `);

  // Register one-time action handlers
  const actions = {
    psTempoMinus:    () => { APP.practiceTempo = Math.max(40, tempo - 10); showPracticeSettingsMenu(btn); },
    psTempoPlus:     () => { APP.practiceTempo = Math.min(200, tempo + 10); showPracticeSettingsMenu(btn); },
    psToggleMet:     () => { APP.practiceMetronome = !metronome; showPracticeSettingsMenu(btn); },
    psToggleLoop:    () => { APP.practiceLoop = !loopEnabled; showPracticeSettingsMenu(btn); },
    psLoopStartMinus:() => { APP.practiceLoopStart = Math.max(0, loopStart - 1); showPracticeSettingsMenu(btn); },
    psLoopStartPlus: () => { APP.practiceLoopStart = Math.min(maxMeasure, loopStart + 1); showPracticeSettingsMenu(btn); },
    psLoopEndMinus:  () => { APP.practiceLoopEnd = Math.max(0, loopEnd - 1); showPracticeSettingsMenu(btn); },
    psLoopEndPlus:   () => { APP.practiceLoopEnd = Math.min(maxMeasure, loopEnd + 1); showPracticeSettingsMenu(btn); },
    psTransMinus:    () => { APP.practiceTranspose = Math.max(-12, transposition - 1); showPracticeSettingsMenu(btn); },
    psTransPlus:     () => { APP.practiceTranspose = Math.min(12, transposition + 1); showPracticeSettingsMenu(btn); },
    psSensMinus:     () => { APP.practiceSensitivity = Math.max(10, sens - 10) / 100; showPracticeSettingsMenu(btn); },
    psSensPlus:      () => { APP.practiceSensitivity = Math.min(50, sens + 10) / 100; showPracticeSettingsMenu(btn); },
  };
  // Delegate clicks inside the modal
  const modal = document.querySelector('.pauta-modal, .modal-overlay');
  if (modal) {
    modal.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (el && actions[el.dataset.action]) { e.preventDefault(); actions[el.dataset.action](); }
    });
  }
}

function showTeachMenu(btn) {
  const role = localStorage.getItem('pauta_role') || 'teacher';
  const hasAssignments = (APP.score?.assignments?.length || 0) > 0;
  showDropdown(btn, [
    // Mode
    {label:`${role==='student'?'✓':'○'} Student Mode`, fn:() => AUDIO.switchRole('student')},
    {label:`${role==='teacher'?'✓':'○'} Teacher Mode`, fn:() => AUDIO.switchRole('teacher')},
    {sep:true},
    // Create content
    {label:'Starter Assignments', fn:showStarterAssignmentsDialog},
    ...(hasAssignments || APP.assignmentMode
      ? [{label:'Assignment', fn:showAssignmentSubmenu}]
      : [{label:'Create Assignment', fn:showAssignmentDialog}]),
    {label:'Exercise Builder', fn:showExerciseBuilderDialog},
    {label:'Import Exercise Set', fn:importCustomExercise},
    {sep:true},
    // Compose
    {label:'Rhythm Composer', fn:showRhythmComposer},
    {label:'Melody Composer', fn:showMelodyComposer},
    {sep:true},
    // Monitor
    ...(role === 'teacher'
      ? [{label:'Class Progress', fn:showStudentProgress}]
      : [{label:'My Progress', fn:showStudentProgress}]),
    {label:'Teacher Dashboard', fn:showTeacherDashboard},
    {label:'Diagnostic Assessment', fn:showDiagnosticDialog},
    {sep:true},
    // Settings
    {label:'Calibrate Audio Latency', fn:() => SESSION_MANAGER.showCalibrationDialog()},
  ]);
}

function showProfileSubmenu() {
  const profiles = ['beginner', 'intermediate', 'advanced'];
  const current = APP.uiProfile || 'advanced';
  const items = profiles.map(p => ({
    label: `${p === current ? '✓' : '○'} ${UI_PROFILES[p].description}`,
    fn: () => { applyUIProfile(p); showToast('Profile: ' + UI_PROFILES[p].description); }
  }));
  showDropdown(document.querySelector('[data-action="showScoreMenu"]'), items);
}

function showAssignmentSubmenu() {
  const assignments = APP.score?.assignments || [];
  const studentAnswers = APP.score?.studentAnswers || {};
  const items = [];
  if (!APP.assignmentMode) {
    assignments.forEach(a => {
      const completed = !!studentAnswers[a.id]?.submitted;
      items.push({label:`${completed?'✓':'○'} ${a.title}`, fn:()=>startAssignment(a.id)});
    });
    items.push({sep:true});
    items.push({label:'➕ New Assignment', fn:showAssignmentDialog});
  } else {
    items.push({label:'✅ Check Answers', fn:checkAssignmentAnswers});
    items.push({label:'📤 Submit Assignment', fn:submitAssignment});
    items.push({sep:true});
    items.push({label:'🚪 Exit Assignment Mode', fn:exitAssignmentMode, danger:true});
  }
  showDropdown(document.querySelector('[data-action="showScoreMenu"]'), items);
}

function showAddInstrumentDialog() {
  const allowedNames = _kitInstrumentList();
  const instrs = INSTRUMENTS.filter(i => allowedNames.includes(i.name));
  makeModal(`
    <h2>Add Instrument</h2>
    <p style="color:rgba(74,85,104,0.60);font-size:11px;margin-top:-6px;margin-bottom:10px">
      Adds a new stave below the existing score</p>
    <select id="ai-instr-select" style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(192,86,33,0.25);font-size:13px;background:transparent;color:#111;margin-bottom:10px">
      ${instrs.map(i => `<option value="${i.name}">${i.name}</option>`).join('')}
    </select>
    <button class="modal-btn primary" data-action="confirmAddInstrument">Add</button>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function confirmAddInstrument() {
  const instrName = document.getElementById('ai-instr-select')?.value || 'Piano';
  SCORE.commitChange(score => {
    SCORE.addInstrumentToScore(score, instrName);
  }, { toast: `${instrName} added` });
}

// ── Time Signature Dialog (slider-based) ─────────────────────────
const DEN_VALUES = [2, 4, 8, 16]; // valid denominators

function showTimeSigDialog() {
  const cur    = resolvedTimeSig(APP.selectedMeasure);
  const curNum = cur.num;
  const curDen = cur.den;
  const denIdx = Math.max(0, DEN_VALUES.indexOf(curDen));

  // Named note values for denominator display
  const DEN_NAMES = {2:'Half note',4:'Quarter note',8:'Eighth note',16:'16th note'};

  makeModal(`
    <h2>Time Signature</h2>
    <p class="dialog-hint">
      From measure ${APP.selectedMeasure + 1} onward</p>

    <div style="display:flex;align-items:center;justify-content:center;
                gap:0;margin:4px 0 8px">
      <div style="text-align:center;min-width:60px">
        <div id="ts-preview-num"
             style="font-size:42px;font-weight:700;color:var(--pauta-text);
                     font-family:var(--pauta-font-sans);line-height:1">${curNum}</div>
        <div id="ts-preview-den"
             style="font-size:42px;font-weight:700;color:var(--pauta-text);
                     font-family:var(--pauta-font-sans);line-height:1">${curDen}</div>
      </div>
      <div style="color:rgba(74,85,104,0.4);font-size:12px;margin-left:10px"
           id="ts-beat-label">
        ${beatDescLabel(curNum, curDen)}
      </div>
    </div>

    <div class="modal-sep"></div>

    <label style="color:rgba(74,85,104,0.6);font-size:11px;
                  letter-spacing:0.3px;text-transform:uppercase">
      Beats per measure: <b id="ts-num-val" style="color:var(--pauta-text)">${curNum}</b>
    </label>
    <input type="range" id="ts-num" min="2" max="15" step="1" value="${curNum}"
           style="width:100%;margin:2px 0 8px"
           data-action="tsSliderChange">

    <label style="color:rgba(74,85,104,0.6);font-size:11px;
                  letter-spacing:0.3px;text-transform:uppercase">
      Beat unit: <b id="ts-den-val" style="color:var(--pauta-text)">${curDen} (${DEN_NAMES[curDen]})</b>
    </label>
    <input type="range" id="ts-den" min="0" max="3" step="1" value="${denIdx}"
           style="width:100%;margin:2px 0 8px"
           data-action="tsSliderChange">

    <button class="modal-btn primary" data-action="tsApplyFromSliders">Apply</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function beatDescLabel(num, den) {
  const cap = num * (4 / den);
  const isCompound = num % 3 === 0 && num > 3;
  const groups = isCompound ? num / 3 : num;
  const beatWord = isCompound ? 'dotted ' + {2:'half',4:'quarter',8:'eighth',16:'16th'}[den] :
                                {2:'half',4:'quarter',8:'eighth',16:'16th'}[den];
  return `${cap} quarter beats · ${isCompound ? groups + ' groups of 3' : num + ' beats per bar'}`;
}

function tsSliderChange() {
  const num    = parseInt(document.getElementById('ts-num').value);
  const denIdx = parseInt(document.getElementById('ts-den').value);
  const den    = DEN_VALUES[denIdx];
  const DEN_NAMES = {2:'Half note',4:'Quarter note',8:'Eighth note',16:'16th note'};
  document.getElementById('ts-num-val').textContent     = num;
  document.getElementById('ts-den-val').textContent     = `${den} (${DEN_NAMES[den]})`;
  document.getElementById('ts-preview-num').textContent = num;
  document.getElementById('ts-preview-den').textContent = den;
  document.getElementById('ts-beat-label').textContent  = beatDescLabel(num, den);
}

function tsApplyFromSliders() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const num    = parseInt(document.getElementById('ts-num').value);
  const denIdx = parseInt(document.getElementById('ts-den').value);
  const den    = DEN_VALUES[denIdx];
  applyTimeSig(num, den);
}

function applyTimeSig(num, den) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const mi = APP.selectedMeasure;
  SCORE.commitChange(score => {
    score.parts[0].staves.forEach(stave => {
      const m = stave.measures[mi];
      if (!m) return;
      m.timeSigNum = num;
      m.timeSigDen = den;
      const cap   = num * (4 / den);
      const isEmpty = isWholeRestPlaceholder(m.notes);
      const used  = isEmpty ? 0 : beatsUsed(m.notes);
      if (used > cap + 0.001) {
        showToast(`⚠ Measure ${mi+1} has more notes than ${num}/${den} allows — edit to fit`);
      }
    });
  }, { toast: `Time signature: ${num}/${den}` });
}

// ── Key Signature Dialog ──────────────────────────────────────────
// All 15 major keys: flat keys, C, sharp keys
const ALL_KEY_SIGS = [
  {ks:-7, label:'C♭',  sub:'A♭m'},
  {ks:-6, label:'G♭',  sub:'E♭m'},
  {ks:-5, label:'D♭',  sub:'B♭m'},
  {ks:-4, label:'A♭',  sub:'Fm'},
  {ks:-3, label:'E♭',  sub:'Cm'},
  {ks:-2, label:'B♭',  sub:'Gm'},
  {ks:-1, label:'F',   sub:'Dm'},
  {ks: 0, label:'C',   sub:'Am'},
  {ks: 1, label:'G',   sub:'Em'},
  {ks: 2, label:'D',   sub:'Bm'},
  {ks: 3, label:'A',   sub:'F♯m'},
  {ks: 4, label:'E',   sub:'C♯m'},
  {ks: 5, label:'B',   sub:'G♯m'},
  {ks: 6, label:'F♯',  sub:'D♯m'},
  {ks: 7, label:'C♯',  sub:'A♯m'},
];

function showKeySigDialog() {
  const curKs = getResolvedKeySig(APP.selectedMeasure);

  const btns = ALL_KEY_SIGS.map(k => {
    const cls  = k.ks < 0 ? 'key-flat' : k.ks > 0 ? 'key-sharp' : 'key-nat';
    const sel  = k.ks === curKs ? ' selected' : '';
    const acc  = k.ks < 0
      ? `<span style="font-size:9px;opacity:0.7">${Math.abs(k.ks)}♭</span>`
      : k.ks > 0
      ? `<span style="font-size:9px;opacity:0.7">${k.ks}♯</span>`
      : `<span style="font-size:9px;opacity:0.5">♮</span>`;
    return `<button class="picker-btn ${cls}${sel}" data-action="applyKeySig" data-ks="${k.ks}">
      <div style="font-size:14px;font-weight:700">${k.label}</div>
      <div style="font-size:9px;opacity:0.6">${k.sub}</div>
      ${acc}
    </button>`;
  }).join('');

  makeModal(`
    <h2>Key Signature</h2>
    <p class="dialog-hint">
      From measure ${APP.selectedMeasure + 1} onward · minor keys shown below</p>
    <div class="picker-grid cols-4" style="flex-shrink:0;max-height:60vh;overflow-y:auto">${btns}</div>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function applyKeySig(ks) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const mi = APP.selectedMeasure;
  const info = ALL_KEY_SIGS.find(k => k.ks === ks);
  SCORE.commitChange(score => {
    score.parts[0].staves.forEach(stave => {
      const m = stave.measures[mi];
      if (m) m.keySig = ks;
    });
  }, { toast: `Key: ${info ? info.label + ' major / ' + info.sub : ks}` });
}

// ── File Operations ───────────────────────────────────────────────
function showFileMenu(btn) {
  showDropdown(btn, [
    {label:'Open .mscz / .mscx', fn:openFile},
    {sep:true},
    {label:'Save as .mscz', fn:saveMSCZ},
    {label:'Save as .mscx (XML)', fn:saveMSCX},
    {sep:true},
    {label:'Print / Save as PDF', fn:printScore},
    {label:'Export Engraved PDF', fn:showExportPDFDialog},
    {label:'Export Audio', fn:showExportDialog},
    {sep:true},
    {label:'New Score', fn:showNewScoreDialog},
    {label:'Score Info', fn:showScoreInfo},
  ]);
}

function openFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.mscz,.mscx,.xml,.mxl,.musicxml';
  inp.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    showToast('Opening…');
    try {
      let xmlStr;
      const fname = file.name.toLowerCase();
      if (fname.endsWith('.mscz') || fname.endsWith('.mxl')) {
        const zip = await JSZip.loadAsync(file);
        let entry = null;
        zip.forEach((p, f) => { if (p.endsWith('.mscx') || p.endsWith('.xml')) entry = f; });
        if (!entry) { showToast('No score file found inside archive'); return; }
        xmlStr = await entry.async('string');
      } else {
        xmlStr = await file.text();
      }
      loadScoreFromXML(xmlStr, file.name);
    } catch(err) {
      console.error(err);
      showToast('Error: ' + err.message);
    }
  };
  inp.click();
}

function loadScoreFromXML(xmlStr, filename) {
  try {
    // Detect format: MusicXML has <score-partwise> root, MSCX has <museScore>
    const isMusicXML = xmlStr.includes('<score-partwise') || xmlStr.includes('<score-timewise');
    const raw = isMusicXML ? SCORE.parseMusicXML(xmlStr) : SCORE.parseMSCX(xmlStr);
    SCORE.adoptScore(raw);
    APP.selectedMeasure = 0;
    APP.selectedStaff   = 0;
    APP.selectedNoteIdx = -1;
    if (APP.score.showMeasureNumbers !== undefined) APP.showMeasureNumbers = APP.score.showMeasureNumbers;
    if (APP.score.showMultiMeasureRests !== undefined) APP.showMultiMeasureRests = APP.score.showMultiMeasureRests;
    document.getElementById('score-title').textContent = APP.score.title || 'Untitled Score';
    RENDER.renderScore();
    showToast('Loaded: ' + APP.score.title);
  } catch(err) {
    console.error(err);
    showToast('Parse error: ' + err.message);
  }
}

async function saveMSCZ() {
  const xml  = SCORE.exportMSCX();
  const safe = safeName(APP.score.title);
  const zip  = new JSZip();
  zip.file(`${safe}.mscx`, xml);
  const blob = await zip.generateAsync({type:'blob'});
  dlBlob(blob, `${safe}.mscz`);
  showToast('Saved .mscz');
}
function saveMSCX() {
  const xml  = SCORE.exportMSCX();
  const safe = safeName(APP.score.title);
  dlBlob(new Blob([xml], {type:'text/xml'}), `${safe}.mscx`);
  showToast('Saved .mscx');
}
function safeName(t) { return (t||'score').replace(/[^a-zA-Z0-9_-]/g,'_').substring(0,40); }
function dlBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {href:url, download:name});
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

// ── Key Signature visual data ─────────────────────────────────────
const KEY_SIG_DATA = [
  { ks: -7, major: 'C♭', minor: 'A♭m' },
  { ks: -6, major: 'G♭', minor: 'E♭m' },
  { ks: -5, major: 'D♭', minor: 'B♭m' },
  { ks: -4, major: 'A♭', minor: 'Fm'   },
  { ks: -3, major: 'E♭', minor: 'Cm'   },
  { ks: -2, major: 'B♭', minor: 'Gm'   },
  { ks: -1, major: 'F',   minor: 'Dm'   },
  { ks:  0, major: 'C',   minor: 'Am'   },
  { ks:  1, major: 'G',   minor: 'Em'   },
  { ks:  2, major: 'D',   minor: 'Bm'   },
  { ks:  3, major: 'A',   minor: 'F♯m'  },
  { ks:  4, major: 'E',   minor: 'C♯m'  },
  { ks:  5, major: 'B',   minor: 'G♯m'  },
  { ks:  6, major: 'F♯',  minor: 'D♯m'  },
  { ks:  7, major: 'C♯',  minor: 'A♯m'  },
];

function _ksMiniSVG(ks) {
  const isSharps = ks > 0;
  const count = Math.abs(ks);
  // Fixed width SVG (no expansion with accidentals)
  const fixedWidth = 120;
  const startX = 44;
  const spacing = count > 5 ? 10 : 14; // compress spacing for many accidentals
  const sharpYs = [8, 26, 2, 20, 38, 14, 32];
  const flatYs  = [32, 14, 38, 20, 44, 26, 50];
  const ys = isSharps ? sharpYs : flatYs;
  const accChar = isSharps ? '\uE262' : '\uE260';
  const fg = '#888';

  let accSVG = '';
  for (let i = 0; i < count; i++) {
    const x = startX + i * spacing;
    accSVG += `<text x="${x}" y="${ys[i]}" alignment-baseline="middle" font-size="26" font-family="Bravura,serif" fill="${fg}" text-anchor="middle">${accChar}</text>`;
  }

  let lines = '';
  for (let i = 0; i < 5; i++) {
    const ly = 12 + i * 12;
    lines += `<line x1="8" y1="${ly}" x2="${fixedWidth - 8}" y2="${ly}" stroke="#aaa" stroke-width="1"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fixedWidth}" height="76" viewBox="0 0 ${fixedWidth} 76">` +
    `<text x="10" y="42" alignment-baseline="middle" font-size="36" font-family="Bravura,serif" fill="#999">\uE050</text>` +
    lines + accSVG + `</svg>`;
}

// ── New Score Dialog ─────────────────────────────────────────────
let _ndFamily = 'Recorder'; // tracks selected family between renders
let _ndSelectedInstruments = new Map(); // name → count (allows duplicates)
let _ndLevel = 'advanced';              // beginner | intermediate | advanced
let _ndScrollPos = 0;                    // preserved scroll position for dialog
const TS_DEN_VALUES = [1, 2, 4, 8, 16, 32];

function showNewScoreDialog() {
  // Prompt to save if there are unsaved changes
  if (APP.score && APP.undoStack.length > 0) {
    UI.makeModal(`
      <h2>Unsaved Changes</h2>
      <p style="font-size:13px;color:var(--pauta-text-muted);margin-bottom:14px">The current score has unsaved changes. Create a new score anyway?</p>
      <div style="display:flex;gap:8px">
        <button class="pauta-btn primary" data-action="ndConfirmNew" style="flex:1">New Score</button>
        <button class="pauta-btn secondary" data-action="closeModal" style="flex:1">Cancel</button>
      </div>
    `);
    return;
  }
  _ndFamily = 'Recorder';
  _ndSelectedInstruments = new Map();
  _ndLevel = APP.teachingKitLevel || 'advanced';
  _renderNewScoreDialog();
}

function _renderNewScoreDialog(restoreScroll) {
  const famOrder = ['Recorder','Brass','Woodwinds','Voice'];
  // Temporarily activate the kit for the current family during render
  const _savedKit = APP.teachingKit;
  const _savedLevel = APP.teachingKitLevel;
  const _familyKit = FAMILY_KIT_MAP[_ndFamily];
  if (_familyKit) {
    APP.teachingKit = _familyKit;
    APP.teachingKitLevel = _ndLevel;
  } else {
    APP.teachingKit = null;
    APP.teachingKitLevel = null;
  }
  const levelInstrs = _kitInstrumentList(_ndLevel);
  APP.teachingKit = _savedKit;
  APP.teachingKitLevel = _savedLevel;
  const families  = [...new Set(INSTRUMENTS.map(i => i.family))].sort((a,b) => {
    const ia = famOrder.indexOf(a);
    const ib = famOrder.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  const instrList = INSTRUMENTS.filter(i => i.family === _ndFamily && levelInstrs.includes(i.name));

  // Family tab buttons
  const famBtns = families.map(f => pillBtn(f, {active: f === _ndFamily, action: 'selectNDFamily', dataAttrs: {family: f}})).join('');

  // Instrument grid buttons
  const instrBtns = instrList.map(i => instrGridBtn(i.name, _ndSelectedInstruments.get(i.name) || 0)).join('');

  const totalSelected = [..._ndSelectedInstruments.values()].reduce((a, b) => a + b, 0);
  const createLabel = totalSelected === 0 ? 'Select an instrument first' : 'Create';
  const createStyle = totalSelected === 0 ? 'margin-top:10px;opacity:0.5;pointer-events:none' : 'margin-top:10px';

  // Preserve existing title/composer if modal already open
  const prevTitle    = document.getElementById('nd-title')?.value    || 'Untitled Score';
  const prevComposer = document.getElementById('nd-composer')?.value || '';
  const prevKS       = document.getElementById('nd-ks')?.value       || '0';
  // Preserve TS from previous render
  const initTSnum = parseInt(document.getElementById('nd-ts-num')?.value) || 4;
  const initTSden = parseInt(document.getElementById('nd-ts-den')?.value) || 4;
  // Preserve pickup state
  const prevPickup  = document.getElementById('nd-pickup')?.checked || false;
  const prevPuNum   = document.getElementById('nd-pu-num')?.value   || '1';
  const prevPuDen   = document.getElementById('nd-pu-den')?.value   || '4';

  makeModal(`
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px">
      <h2 style="margin:0">New Score</h2>
      <div style="opacity:0.3"><span style="color:var(--pauta-primary);font-weight:700;font-size:16px">p</span><span style="color:var(--pauta-text);font-weight:300;font-size:16px">auta</span></div>
    </div>

    \x3C!-- Quick Start --\x3E
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
      <button class="pauta-pill" data-action="ndQuickStart" data-preset="piano">🎹 Piano</button>
      <button class="pauta-pill" data-action="ndQuickStart" data-preset="treble">𝄞 Treble</button>
      <button class="pauta-pill" data-action="ndQuickStart" data-preset="bass">𝄢 Bass</button>
      <span style="font-size:10px;color:var(--pauta-text-subtle);align-self:center;margin-left:4px">or pick below</span>
    </div>

    \x3C!-- Title + Composer on one row --\x3E
    <div style="display:flex;gap:6px;margin-bottom:4px">
      <div style="flex:2">${input({id: 'nd-title', placeholder: 'Title', value: prevTitle.replace(/"/g,'&quot;'), label: 'Title'})}</div>
      <div style="flex:1">${input({id: 'nd-composer', placeholder: 'Composer', value: prevComposer.replace(/"/g,'&quot;'), label: 'Composer'})}</div>
    </div>

    \x3C!-- Key + Time + Pickup in one compact row --\x3E
    <div style="display:flex;gap:4px;align-items:stretch;margin-bottom:4px">
      \x3C!-- Key Signature --\x3E
      <div style="flex:1;background:rgba(192,86,33,0.04);border:1px solid rgba(192,86,33,0.12);border-radius:8px;padding:4px 2px;text-align:center">
        <input type="hidden" id="nd-ks" value="${prevKS}">
        <div style="font-size:9px;color:var(--pauta-text-subtle);margin-bottom:2px">Key</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:2px">
          ${iconBtn('▼', {action: 'ndKSAdj', size: 'sm', variant: 'ghost', title: 'Flats (◄)', dataAttrs: {delta: -1}})}
          <div style="min-width:40px">
            <div id="nd-ks-staff" style="line-height:0">${_ksMiniSVG(parseInt(prevKS))}</div>
            <span id="nd-ks-label" style="font-size:9px;color:var(--pauta-primary);font-weight:600">${KEY_SIG_DATA.find(k=>String(k.ks)===prevKS)?.major ?? 'C'}</span>
          </div>
          ${iconBtn('▲', {action: 'ndKSAdj', size: 'sm', variant: 'ghost', title: 'Sharps (►)', dataAttrs: {delta: 1}})}
        </div>
        <div id="nd-ks-accel" style="font-size:8px;color:rgba(74,85,104,0.40)"></div>
      </div>
      \x3C!-- Time Signature --\x3E
      <div style="flex:1;background:rgba(192,86,33,0.04);border:1px solid rgba(192,86,33,0.12);border-radius:8px;padding:4px 2px;text-align:center">
        <input type="hidden" id="nd-ts-num" value="${initTSnum}">
        <input type="hidden" id="nd-ts-den" value="${initTSden}">
        <div style="font-size:9px;color:var(--pauta-text-subtle);margin-bottom:2px">Time</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px">
          <div style="display:flex;flex-direction:row;align-items:center;gap:8px">
            ${iconBtn('▲', {action: 'ndTSNumAdj', size: 'sm', variant: 'ghost', dataAttrs: {delta: 1}, style: 'padding:4px 6px'})}
            ${iconBtn('▼', {action: 'ndTSNumAdj', size: 'sm', variant: 'ghost', dataAttrs: {delta: -1}, style: 'padding:4px 6px'})}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:0;position:relative;min-width:50px">
            <span id="nd-ts-num-label" style="font-size:28px;color:var(--pauta-primary);font-weight:700;line-height:1">${initTSnum}</span>
            <span style="position:relative;display:inline-block;width:48px;height:1px;background:rgba(74,85,104,0.30);margin:2px 0"></span>
            <span id="nd-ts-den-label" style="font-size:28px;color:var(--pauta-primary);font-weight:700;line-height:1">${initTSden}</span>
          </div>
          <div style="display:flex;flex-direction:row;align-items:center;gap:8px">
            ${iconBtn('▲', {action: 'ndTSDenAdj', size: 'sm', variant: 'ghost', dataAttrs: {delta: 1}, style: 'padding:4px 6px'})}
            ${iconBtn('▼', {action: 'ndTSDenAdj', size: 'sm', variant: 'ghost', dataAttrs: {delta: -1}, style: 'padding:4px 6px'})}
          </div>
        </div>
      </div>
      \x3C!-- Pickup --\x3E
      <div style="flex:0 0 72px;background:rgba(192,86,33,0.04);border:1px solid rgba(192,86,33,0.12);border-radius:8px;padding:4px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div style="font-size:9px;color:var(--pauta-text-subtle);margin-bottom:2px">Pickup</div>
        ${checkbox({id: 'nd-pickup', label: '', checked: prevPickup, action: 'ndPickupToggle'})}
        <span id="nd-pickup-dur" style="display:${prevPickup ? 'flex' : 'none'};flex-direction:column;align-items:center;gap:0;margin-top:2px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:0">
            ${select({id: 'nd-pu-num', options: [1,2,3,4,5,6,7].map(v => ({value: v, label: v})), value: prevPuNum, style: 'width:40px'})}
            <span style="color:rgba(74,85,104,0.30);font-size:11px;line-height:1">—</span>
            <span style="position:relative;display:inline-block;width:40px;height:1px;background:rgba(74,85,104,0.30)"></span>
            <span style="color:rgba(74,85,104,0.30);font-size:11px;line-height:1">—</span>
            ${select({id: 'nd-pu-den', options: ['4','8'].map(v => ({value: v, label: v})), value: prevPuDen, style: 'width:40px'})}
          </div>
        </span>
      </div>
    </div>

    ${FAMILY_KIT_MAP[_ndFamily] ? (() => {
      const _kitName = KIT_CONFIGS[FAMILY_KIT_MAP[_ndFamily]]?.name || '';
      const _levelLabels = {
        recorder: { beginner:'Soprano only', intermediate:'Soprano + Alto', advanced:'All recorders' },
        keyboard: { beginner:'Piano only',   intermediate:'Piano + Celesta', advanced:'All keyboards' },
      };
      const _ll = _levelLabels[FAMILY_KIT_MAP[_ndFamily]] || { beginner:'', intermediate:'', advanced:'' };
      return `
    <div style="display:flex;align-items:center;gap:8px;margin:6px 0 2px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.06)">
      <span style="font-size:9px;color:rgba(74,85,104,0.60);text-transform:uppercase;letter-spacing:0.3px;font-weight:600">Level</span>
      <span style="font-size:10px;color:var(--pauta-text-subtle)">— ${_kitName}</span>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:4px">
      ${['beginner','intermediate','advanced'].map(lvl => `
        <button data-action="ndSelectLevel" data-level="${lvl}"
          style="flex:1;padding:4px 2px;border-radius:6px;border:1px solid ${lvl===_ndLevel?'rgba(192,86,33,0.55)':'rgba(192,86,33,0.18)'};
                 background:${lvl===_ndLevel?'rgba(192,86,33,0.18)':'rgba(255,255,255,0.06)'};
                 color:${lvl===_ndLevel?'var(--pauta-primary)':'var(--pauta-text-subtle)'};font-size:10px;font-weight:${lvl===_ndLevel?'700':'500'};
                 cursor:pointer;font-family:var(--pauta-font-sans)">
          ${lvl}
        </button>`
      ).join('')}
    </div>`; })() : ''}

    \x3C!-- Instruments --\x3E
    <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
      ${sectionLabel('Instruments')} <span id="nd-instr-count" style="font-weight:400">(0)</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">
      ${famBtns}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:140px;overflow-y:auto;flex-shrink:0">
      ${instrBtns}
    </div>

    <div style="display:flex;gap:6px;margin-top:8px">
      ${btn(createLabel, {variant: 'primary', block: true, disabled: totalSelected === 0, action: 'createNewScore'})}
      ${btn('Cancel', {variant: 'secondary', block: true, action: 'closeModal'})}
    </div>
  `);

  if (restoreScroll) {
    const modal = document.querySelector('.pauta-modal');
    if (modal) modal.scrollTop = restoreScroll;
  }

  // Update count display
  setTimeout(() => {
    const total = [..._ndSelectedInstruments.values()].reduce((a, b) => a + b, 0);
    const c = document.getElementById('nd-instr-count');
    if (c) c.textContent = '(' + total + ')';
  }, 30);
}

function selectNDFamily(fam) {
  _ndFamily = fam;
  _ndScrollPos = getNDScrollPos();
  _renderNewScoreDialog(_ndScrollPos);
}

function ndSelectLevel(lvl) {
  _ndLevel = lvl;
  const kit = FAMILY_KIT_MAP[_ndFamily];
  // Temporarily pretend this level is active so _kitInstrumentList works
  const prevKit = APP.teachingKit;
  const prevLevel = APP.teachingKitLevel;
  APP.teachingKit = kit;
  APP.teachingKitLevel = lvl;
  const allowed = _kitInstrumentList();
  APP.teachingKit = prevKit;
  APP.teachingKitLevel = prevLevel;
  // Remove instruments that aren't available in this level
  for (const [name] of _ndSelectedInstruments) {
    if (!allowed.includes(name)) _ndSelectedInstruments.delete(name);
  }
  _ndScrollPos = getNDScrollPos();
  _renderNewScoreDialog(_ndScrollPos);
}

function getNDScrollPos() {
  const modal = document.querySelector('.pauta-modal');
  return modal ? modal.scrollTop : 0;
}

function ndKSAdj(dir) {
  const input = document.getElementById('nd-ks');
  const cur = parseInt(input.value) || 0;
  const next = Math.max(-7, Math.min(7, cur + dir));
  if (next === cur) return;
  input.value = String(next);
  const staff = document.getElementById('nd-ks-staff');
  const label = document.getElementById('nd-ks-label');
  const accel = document.getElementById('nd-ks-accel');
  // _ksMiniSVG returns internal, well-formed SVG — parse it safely via DOMParser
  // rather than blasting innerHTML, so the element tree is always well-formed.
  try {
    const doc = new DOMParser().parseFromString(_ksMiniSVG(next), 'image/svg+xml');
    const svgNode = doc.documentElement;
    staff.replaceChildren(svgNode);
  } catch(e) { staff.innerHTML = _ksMiniSVG(next); } // fallback for old parsers
  const data = KEY_SIG_DATA.find(k => k.ks === next);
  if (data) label.textContent = data.major + ' · ' + data.minor;
  const n = Math.abs(next);
  const ch = next > 0 ? '♯' : next < 0 ? '♭' : '';
  accel.textContent = n > 0 ? `${n} ${ch}` : '';
}

function ndTSNumAdj(dir) {
  const input = document.getElementById('nd-ts-num');
  const cur = parseInt(input.value) || 4;
  const next = Math.max(1, Math.min(16, cur + dir));
  if (next === cur) return;
  input.value = next;
  document.getElementById('nd-ts-num-label').textContent = next;
  ndPickupSync();
}

function ndTSDenAdj(dir) {
  const input = document.getElementById('nd-ts-den');
  const cur = parseInt(input.value) || 4;
  const idx = TS_DEN_VALUES.indexOf(cur);
  const nextIdx = Math.max(0, Math.min(TS_DEN_VALUES.length - 1, idx + dir));
  const next = TS_DEN_VALUES[nextIdx];
  if (next === cur) return;
  input.value = next;
  document.getElementById('nd-ts-den-label').textContent = next;
}

function ndPickupToggle() {
  const cb = document.getElementById('nd-pickup');
  const dur = document.getElementById('nd-pickup-dur');
  if (dur) dur.style.display = cb?.checked ? 'flex' : 'none';
  if (cb?.checked) ndPickupSync();
}

function ndPickupSync() {
  const tsNum = parseInt(document.getElementById('nd-ts-num')?.value) || 4;
  const sel = document.getElementById('nd-pu-num');
  if (!sel) return;
  const cur = parseInt(sel.value) || 1;
  const max = Math.max(1, tsNum - 1);
  sel.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = String(i); opt.textContent = String(i);
    if (i === Math.min(cur, max)) opt.selected = true;
    sel.appendChild(opt);
  }
}

function createNewScore() {
  try {
    const title     = document.getElementById('nd-title')?.value.trim()    || 'Untitled Score';
    const composer  = document.getElementById('nd-composer')?.value.trim() || '';
    const ks        = parseInt(document.getElementById('nd-ks')?.value)     || 0;
    const totalInstrs = [..._ndSelectedInstruments.values()].reduce((a, b) => a + b, 0);
    const instrNames = totalInstrs > 0
      ? [..._ndSelectedInstruments].flatMap(([name, count]) => Array(count).fill(name))
      : (() => { showToast('Select at least one instrument'); return null; })();
    if (!instrNames) return;
    const tsNum     = parseInt(document.getElementById('nd-ts-num')?.value) || 4;
    const tsDen     = parseInt(document.getElementById('nd-ts-den')?.value) || 4;
    const ts        = {num:tsNum, den:tsDen};
    const pickup    = document.getElementById('nd-pickup')?.checked;
    const puNum     = pickup ? (parseInt(document.getElementById('nd-pu-num')?.value) || 1) : 0;
    const puDen     = pickup ? (parseInt(document.getElementById('nd-pu-den')?.value) || 4) : 0;

    const raw = SCORE.createScore({title, composer, ts, ks, instruments:instrNames});

    for (let i = 0; i < 3; i++) {
      raw.parts.forEach(p => p.staves.forEach(s => s.measures.push(SCORE.emptyMeasure())));
    }
    if (pickup && puNum > 0 && puNum < tsNum) {
      const puBeat = puNum * (4 / puDen);
      const bestRest = beatsToBestRestDuration(puBeat);
      const restDur = bestRest ? bestRest.dur : 'q';
      raw.parts.forEach(p => p.staves.forEach(s => {
        const m = s.measures[0];
        m.pickup = {num: puNum, den: puDen};
        m.timeSigNum = tsNum;
        m.timeSigDen = tsDen;
        m.notes = [SCORE.mkRest(restDur)];
      }));
    }

    SCORE.adoptScore(raw, { clearHistory: true });
    const selectedFamilies = new Set(instrNames.map(n => INSTRUMENTS.find(i => i.name === n)?.family).filter(Boolean));
    let kitToApply = null;
    for (const fam of selectedFamilies) {
      const k = FAMILY_KIT_MAP[fam];
      if (k) { kitToApply = k; break; }
    }
    if (kitToApply) {
      applyKit(kitToApply, _ndLevel);
    } else {
      clearKit();
    }
    APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
    APP.undoStack = []; APP.redoStack = []; APP._lastUndoFP = '';
    document.getElementById('score-title').textContent = title;
    closeModal();
    requestAnimationFrame(() => {
      try { RENDER.renderScore(); } catch(e) {
        showLibError('Notation engine error: ' + e.message + '<br>Please reload.');
      }
      document.getElementById('score-area').focus({ preventScroll: true });
    });
    showToast(`New score — ${instrNames.length} stave${instrNames.length > 1 ? 's' : ''}`);
  } catch(e) {
    showToast('Error creating score: ' + e.message);
    console.error('createNewScore error:', e);
  }
}

function showTitleDialog() {
  const s        = APP.score;
  const curFont  = s.titleFont || "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const curSize  = s.titleSize || 22;
  const curTitle = s.title || '';
  const curComp  = s.composer || '';

  const fontOpts = [
    ["'Helvetica Neue',Helvetica,Arial,sans-serif", 'Helvetica'],
    ["Georgia,serif",                                'Georgia'],
    ["'Times New Roman',Times,serif",               'Times New Roman'],
    ["'Palatino Linotype',Palatino,serif",          'Palatino'],
    ["'Gill Sans','Gill Sans MT',sans-serif",       'Gill Sans'],
  ].map(([val, label]) =>
    `<option value="${val}" ${val === curFont ? 'selected' : ''}>${label}</option>`
  ).join('');

  const sizeOpts = [14,16,18,20,22,24,28,32,36].map(sz =>
    `<option value="${sz}" ${sz === curSize ? 'selected' : ''}>${sz}</option>`
  ).join('');

  makeModal(`
    <h2>Title & Composer</h2>
    <input id="td-title" value="${curTitle.replace(/"/g,'&quot;')}" placeholder="Title">
    <input id="td-composer" value="${curComp.replace(/"/g,'&quot;')}" placeholder="Composer">
    <label style="color:rgba(74,85,104,0.70);font-size:11px;text-transform:uppercase;letter-spacing:0.3px;font-weight:600">
      Title Font</label>
    <select id="td-font" style="width:100%;padding:8px;background:rgba(192,86,33,0.06);border:1px solid rgba(192,86,33,0.18);border-radius:8px;color:var(--pauta-text-subtle);font-size:13px;-webkit-appearance:none">
      ${fontOpts}
    </select>
    <label style="color:rgba(74,85,104,0.70);font-size:11px;text-transform:uppercase;letter-spacing:0.3px;font-weight:600">
      Title Size</label>
    <select id="td-size" style="width:100%;padding:8px;background:rgba(192,86,33,0.06);border:1px solid rgba(192,86,33,0.18);border-radius:8px;color:var(--pauta-text-subtle);font-size:13px;-webkit-appearance:none">
      ${sizeOpts}
    </select>
    <button class="modal-btn primary" data-action="applyTitleDialog">Apply</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function applyTitleDialog() {
  const title = document.getElementById('td-title').value.trim() || 'Untitled Score';
  const comp  = document.getElementById('td-composer').value.trim();
  const font  = document.getElementById('td-font').value;
  const size  = parseInt(document.getElementById('td-size').value) || 22;
  SCORE.commitChange(score => {
    score.title    = title;
    score.composer = comp;
    score.titleFont = font;
    score.titleSize = size;
    document.getElementById('score-title').textContent = title;
  }, { toast: 'Title updated' });
}

function showScoreInfo() {
  const s = APP.score;
  makeModal(`
    <h2>Score Info</h2>
    <input id="si-title" value="${(s.title||'').replace(/"/g,'&quot;')}" placeholder="Title">
    <input id="si-composer" value="${(s.composer||'').replace(/"/g,'&quot;')}" placeholder="Composer">
    <button class="modal-btn primary" data-action="applyScoreInfo">Apply</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}
function applyScoreInfo() {
  const title    = document.getElementById('si-title').value;
  const composer = document.getElementById('si-composer').value;
  SCORE.commitChange(score => {
    score.title    = title;
    score.composer = composer;
  });
  document.getElementById('score-title').textContent = title;
  closeModal();
}

// ── Modal Helper ──────────────────────────────────────────────────
function makeModal(inner) {
  closeLyricEditor();
  closeModal();
  closeDropdown();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="pauta-modal modal">${inner}</div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
}
function closeModal() { document.querySelectorAll('.modal-overlay').forEach(e=>e.remove()); }

let _activeDropdown = null;
function showDropdown(btnEl, items) {
  closeDropdown();
  const ov = document.createElement('div');
  ov.className = 'dropdown-overlay';
  document.body.appendChild(ov);
  const dd = document.createElement('div');
  dd.className = 'dropdown';
  items.forEach(item => {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'dd-sep';
      dd.appendChild(sep);
    } else {
      const b = document.createElement('button');
      b.className = 'dd-btn' + (item.danger ? ' danger' : '');
      b.innerHTML = item.label;
      b.addEventListener('click', e => { e.stopPropagation(); item.fn(); closeDropdown(); });
      dd.appendChild(b);
    }
  });
  document.body.appendChild(dd);
  ov.addEventListener('click', closeDropdown);
  document.addEventListener('keydown', _dropdownKeyHandler);
  _activeDropdown = dd;
  // Position below the button, right-aligned
  const rect = btnEl.getBoundingClientRect();
  requestAnimationFrame(() => {
    const ddW = dd.offsetWidth || 180;
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.left = Math.max(4, Math.min(window.innerWidth - ddW - 4, rect.right - ddW)) + 'px';
  });
}
function _dropdownKeyHandler(e) { if (e.key === 'Escape') closeDropdown(); }
function closeDropdown() {
  if (_activeDropdown) { _activeDropdown.remove(); _activeDropdown = null; }
  document.querySelectorAll('.dropdown-overlay').forEach(e => e.remove());
  document.removeEventListener('keydown', _dropdownKeyHandler);
}

// ── Status Bar ────────────────────────────────────────────────────
function updateStatusBar() {
  const mi = APP.selectedMeasure;
  const si = APP.selectedStaff;
  document.getElementById('st-measure').textContent = mi + 1;
  document.getElementById('st-beat').textContent    = APP.selectedNoteIdx >= 0 ? APP.selectedNoteIdx + 1 : '—';
  const ts = resolvedTimeSig(mi, si);
  document.getElementById('st-time').textContent = `${ts.num}/${ts.den}`;
  const m  = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure);
  document.getElementById('st-key').textContent = keySigName(m?.keySig || 0);
}
// Subscribe to score:changed so status bar stays current after mutations
if (window.BUS) BUS.on('score:changed', updateStatusBar);

// ── Mode Banner ──────────────────────────────────────────────────
function updateModeBanner() {
  const banner = document.getElementById('mode-banner');
  if (!banner) return;
  let mode = null, label = '', bg = '', color = '';
  if (APP.practiceMode) {
    mode = 'practice'; label = '🎯 Practice Mode — play each highlighted note'; bg = 'rgba(34,197,94,0.15)'; color = '#16a34a';
  } else if (APP.exerciseMode) {
    mode = 'exercise'; label = '📝 Exercise Mode — answer the questions'; bg = 'rgba(74,85,104,0.10)'; color = '#4a5568';
  } else if (APP.assignmentMode) {
    mode = 'assignment'; label = '📋 Assignment Mode — complete your assignment'; bg = 'rgba(59,130,246,0.12)'; color = '#2563eb';
  } else if (APP.inputMode) {
    mode = 'input'; label = '✏️ Note Input — tap a measure, then a note name'; bg = 'rgba(192,86,33,0.12)'; color = '#c05621';
  } else if (APP.chordMode) {
    mode = 'chord'; label = '🎵 Chord Mode — add notes to the selected beat'; bg = 'rgba(0,150,136,0.12)'; color = '#009688';
  } else if (APP.markingMode) {
    const markLabels = {tie:'Tie', slur:'Slur', cresc:'Crescendo', dim:'Diminuendo'};
    mode = 'marking'; label = `🔗 ${markLabels[APP.markingMode] || 'Mark'} — now select the END note`; bg = 'rgba(147,51,234,0.12)'; color = '#9333ea';
  } else if (APP.compositionMode === 'rhythm') {
    mode = 'composition-rhythm'; label = '🎵 Rhythm Composition — tap durations, then tap staff'; bg = 'rgba(255,152,0,0.12)'; color = '#e65100';
  } else if (APP.compositionMode === 'melody') {
    mode = 'composition-melody'; label = '🎵 Melody Composition — choose scale degrees, then tap staff'; bg = 'rgba(0,150,136,0.12)'; color = '#00695c';
  }
  if (mode) {
    banner.style.display = 'block';
    banner.style.background = bg;
    banner.style.color = color;
    banner.textContent = label;
  } else {
    banner.style.display = 'none';
    banner.textContent = '';
  }
}

// ── Toast ─────────────────────────────────────────────────────────
let _toastT = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if (_toastT) clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Auto-save ─────────────────────────────────────────────────────
const AUTOSAVE_KEY      = 'pauta_autosave_v1';
const AUTOSAVE_INTERVAL = 30_000; // ms

function _autosaveNow() {
  if (!APP.score) return;
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(APP.score)); } catch(e) { if (DEBUG) console.warn('[Pauta] autosave:', e.message); }
}

function _startAutosave() {
  setInterval(_autosaveNow, AUTOSAVE_INTERVAL);
  window.addEventListener('beforeunload', _autosaveNow);
}

function restoreAutosave() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return;
  try {
    SCORE.adoptScore(JSON.parse(raw), { clearHistory: true });
    const titleEl = document.getElementById('score-title');
    if (titleEl) titleEl.textContent = APP.score.title || 'Untitled Score';
    APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
    closeModal();
    RENDER.renderScore();
    showToast('Score restored from autosave ✓');
  } catch(e) {
    showToast('Could not restore autosave');
    closeModal();
  }
}

function _checkAndOfferRestore(onDecline) {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) { onDecline(); return; }
  let saved;
  try { saved = JSON.parse(raw); } catch(e) { onDecline(); return; }
  const scoreTitle = saved?.title || 'Untitled Score';
  window._autosaveDecline = onDecline;
  makeModal(`
    <h2 style="margin-bottom:10px">Restore autosaved score?</h2>
    <p style="font-size:13px;color:var(--text-panel);line-height:1.5;margin-bottom:6px">
      Pauta saved a copy of <b>${escHtml(scoreTitle)}</b> before you last closed it.
    </p>
    <p style="font-size:12px;color:var(--text-status);margin-bottom:18px">
      Tap <b>Restore</b> to continue editing, or <b>New score</b> to start fresh.
    </p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="modal-btn secondary" data-action="showNewScoreDialog">New score</button>
      <button class="modal-btn primary"   data-action="restoreAutosave">Restore</button>
    </div>
  `);
}


// ── Boot ──────────────────────────────────────────────────────────

// ── Print ────────────────────────────────────────────────────────
function printScore() {
  closeLyricEditor();
  closeModal();
  if (_activePanel) togglePanel(_activePanel);
  RENDER.positionAllDiagrams(0);
  setTimeout(() => window.print(), 120);
}





// ── Debug Overlay ──────────────────────────────────────────────────
let _debugOverlayOpen = false;

function toggleDebugOverlay() {
  _debugOverlayOpen = !_debugOverlayOpen;
  const el = document.getElementById('debug-overlay');
  if (!el) return;
  if (!_debugOverlayOpen) { el.classList.remove('open'); el.textContent = ''; return; }

  const score = APP.score;
  const mCount = score?.parts?.[0]?.staves?.[0]?.measures?.length || 0;
  const totalStaves = (score?.parts || []).reduce((s, p) => s + (p.staves || []).length, 0);
  const nStavesTotal = (score?.parts || []).reduce((s, p) => (p.staves || []).reduce((s2, st) => s2 + (st.measures || []).reduce((s3, m) => s3 + (m.notes || []).length, 0), s), 0);
  const undoSize = APP.undoStack?.length || 0;
  const redoSize = APP.redoStack?.length || 0;

  const lines = [];

  lines.push('SCORE  parts=' + (score?.parts?.length || 0) + '  staves=' + totalStaves + '  measures=' + mCount + '  notes=' + nStavesTotal);
  lines.push('');

  lines.push('SELECTION  measure=' + APP.selectedMeasure + '/' + (mCount - 1) + '  staff=' + APP.selectedStaff + '/' + (totalStaves - 1) + '  note=' + APP.selectedNoteIdx + '  selStart=' + APP.selStartIdx);
  lines.push('');

  lines.push('MODES');
  const modes = [
    ['inputMode',     APP.inputMode],
    ['chordMode',     APP.chordMode],
    ['markingMode',   APP.markingMode || '—'],
    ['exerciseMode',  APP.exerciseMode],
    ['assignmentMode',APP.assignmentMode],
    ['practiceMode',  APP.practiceMode],
  ];
  for (const [k, v] of modes) lines.push('  ' + k + '=' + (v ? 'true' : 'false'));
  lines.push('  curVoice=' + APP.curVoice + '  curDur=' + APP.curDur + ' curDot=' + APP.curDot + ' curRest=' + APP.curRest);
  lines.push('  curTuplet=' + (APP.curTuplet ? JSON.stringify(APP.curTuplet) : '—') + '  tupletPending=' + APP.tupletPending);
  lines.push('');

  lines.push('ANNOTATIONS');
  lines.push('  slurs='          + (score?.slurs?.length          || 0));
  lines.push('  hairpins='       + (score?.hairpins?.length       || 0));
  lines.push('  rehearsalMarks=' + (score?.rehearsalMarks?.length || 0));
  lines.push('  staffTexts='     + (score?.staffTexts?.length     || 0));
  lines.push('  assignments='    + (score?.assignments?.length    || 0));
  lines.push('');

  lines.push('STATE  tempo=' + APP.tempo + '  zoom=' + APP.zoom.toFixed(2) + '  continuous=' + APP.continuousView + '  volume=' + APP.masterVolume.toFixed(2));
  lines.push('  undo=' + undoSize + '  redo=' + redoSize + '  uiProfile=' + APP.uiProfile + '  kit=' + (APP.teachingKit || '—'));
  lines.push('  playing=' + APP.playing + '  metronome=' + APP.metronome + '  countIn=' + APP.countIn);

  // Collect any recent invariant / audit warnings
  const warns = [];
  try { _validateModeState(); } catch(e) { /* mode validation already logs */ }

  el.textContent = lines.join('\n');
  el.classList.add('open');
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 7: Boot & Event Wiring
// ═══════════════════════════════════════════════════════════════════
function bootApp() {
  if (typeof Vex === 'undefined' || typeof JSZip === 'undefined') {
    document.getElementById('loading').innerHTML =
      '<p style="color:var(--pauta-error);padding:24px;text-align:center;font-size:14px">Could not load required libraries.<br><br>Please check your internet connection and reload the page.</p>';
    return;
  }
  VF = Vex.Flow;

  // Create a minimal blank score so renderScore never runs on null,
  // but don't render it — show the New Score dialog immediately instead.
  APP.score = SCORE.createScore();

  // iPad → continuous view by default; desktop → page view
  const isIPad = /iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  APP.continuousView = isIPad;

  // Restore UI difficulty profile from previous session
  try {
    const savedProfile = localStorage.getItem('pauta_ui_profile');
    if (savedProfile && UI_PROFILES[savedProfile]) {
      APP.uiProfile = savedProfile;
      applyUIProfile(savedProfile);
    }
  } catch(e) { console.warn('[Pauta]', e.message); }

  // Restore palette collapsed state
  try {
    if (localStorage.getItem('pauta_palette_collapsed')) {
      document.getElementById('palette')?.classList.add('collapsed');
      const lbl = document.getElementById('palette-toggle-label');
      if (lbl) lbl.textContent = 'Show Palette';
    }
  } catch(e) { console.warn('[Pauta]', e.message); }

  // Restore teaching kit from previous session
  try {
    const savedKit = localStorage.getItem('pauta_kit');
    const savedKitLevel = localStorage.getItem('pauta_kit_level');
    if (savedKit && KIT_CONFIGS[savedKit] && savedKitLevel) {
      APP.teachingKit = savedKit;
      APP.teachingKitLevel = savedKitLevel;
    }
  } catch(e) { console.warn('[Pauta]', e.message); }

  // Restore role and set document title
  AUDIO._updateDocTitle();

  const loading = document.getElementById('loading');
  loading.classList.add('hidden');
  setTimeout(() => loading.remove(), 500);

  // Start autosave loop (runs every 30 s + on tab close)
  _startAutosave();
  _runBootSelfCheck();

  // Wire up all static DOM listeners (keyboard, resize, action delegation)
  initListeners();
  updateModeBanner();

  // Offer to restore any autosaved score; opens New Score dialog if none found
  _checkAndOfferRestore(showNewScoreDialog);

  // Show welcome modal on first launch
  setTimeout(() => AUDIO.showWelcomeModal(), 600);

  // Double-tap on title for touch devices (set up once)
  let _titleTapT = 0;
  document.getElementById('score-title').addEventListener('touchend', e => {
    const now = Date.now();
    if (now - _titleTapT < 350) { e.preventDefault(); showTitleDialog(); }
    _titleTapT = now;
  });
}

// PWA / iPad Install Hint
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone;
  if (isIOS && !isStandalone) {
    setTimeout(() => showToast('Tip: Add to Home Screen for the full app experience'), 4000);
  }
});

// ── Library Loader ────────────────────────────────────────────────
const _LIB_CACHE = 'pauta-libs-v1';

// Inject a JS string as an inline blob script (used when serving from cache)
function _execBlob(jsText) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([jsText], { type: 'application/javascript' });
    const url  = URL.createObjectURL(blob);
    const s    = document.createElement('script');
    s.src      = url;
    s.onload   = () => { URL.revokeObjectURL(url); resolve(); };
    s.onerror  = () => { URL.revokeObjectURL(url); reject(new Error('blob exec failed')); };
    document.head.appendChild(s);
  });
}

// Load a script — tries Cache API first, then network
async function loadScript(src) {
  // 1. Try the Cache API (works after first successful load)
  if ('caches' in window) {
    try {
      const cacheP   = caches.open(_LIB_CACHE);
      const cache    = await Promise.race([cacheP, new Promise((_,rej) => setTimeout(() => rej(new Error('cache timeout')), 2000))]);
      const cached   = await cache.match(src);
      if (cached) {
        const text = await cached.text();
        await _execBlob(text);
        return; // served from cache ✓
      }
    } catch(e) { /* cache miss or unavailable — fall through to network */ }
  }
  // 2. Fetch from network
  await new Promise((resolve, reject) => {
    const s    = document.createElement('script');
    s.src      = src;
    s.onload   = resolve;
    s.onerror  = () => reject(new Error('Failed: ' + src));
    document.head.appendChild(s);
  });
}

// After a successful network load, silently populate the Cache API
async function _cacheUrl(url) {
  if (!('caches' in window)) return;
  try {
    const cache   = await Promise.race([caches.open(_LIB_CACHE), new Promise((_,rej) => setTimeout(() => rej(new Error('cache timeout')), 2000))]);
    const already = await cache.match(url);
    if (!already) await cache.add(url);
  } catch(e) { /* storage quota or CORS — non-fatal */ }
}

function setLoadingMsg(msg) {
  const p = document.querySelector('#loading p');
  if (p) p.textContent = msg;
}

function showLibError(msg) {
  document.getElementById('loading').innerHTML =
    `<div style="padding:28px;text-align:center;max-width:300px">
       <div style="font-size:22px;margin-bottom:12px;color:var(--pauta-error)">⚠</div>
       <p style="color:var(--pauta-error);font-size:14px;line-height:1.6">${msg}</p>
       <button data-action="reload" style="margin-top:18px;padding:10px 22px;background:var(--pauta-primary);border:none;border-radius:10px;font-size:14px;cursor:pointer">Retry</button>
     </div>`;
}

async function loadLibraries() {
  // ── JSZip ──────────────────────────────────────────────────────
  setLoadingMsg('Loading JSZip…');
  const jszipUrls = [
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  ];
  let jszipLoaded = false;
  for (const url of jszipUrls) {
    try {
      await loadScript(url);
      _cacheUrl(url); // fire-and-forget — populates cache for next offline load
      jszipLoaded = true;
      break;
    } catch(e) { /* try next */ }
  }
  if (!jszipLoaded) {
    showLibError('Could not load JSZip.<br>Please check your internet connection and tap Retry.');
    return;
  }

  // ── VexFlow ────────────────────────────────────────────────────
  setLoadingMsg('Loading VexFlow…');
  const vexCandidates = [
    'https://unpkg.com/vexflow@3.0.9/releases/vexflow-min.js',
    'https://unpkg.com/vexflow@3.0.9/build/vexflow-min.js',
    'https://cdn.jsdelivr.net/npm/vexflow@3.0.9/releases/vexflow-min.js',
    'https://cdn.jsdelivr.net/npm/vexflow@3.0.9/build/vexflow-min.js',
  ];
  let vexOK = false;
  for (const url of vexCandidates) {
    try {
      await loadScript(url);
      if (typeof Vex !== 'undefined' && Vex.Flow) {
        _cacheUrl(url); // cache the first URL that worked
        vexOK = true;
        break;
      }
    } catch(e) { /* try next */ }
  }
  if (!vexOK) {
    showLibError('Could not load VexFlow (notation engine).<br>Please check your internet connection and tap Retry.');
    return;
  }

  setLoadingMsg('Starting Pauta…');
  bootApp();
}

// Kick off loading once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadLibraries);
} else {
  loadLibraries();
}

// ── Event Delegation ──────────────────────────────────────────
// Converts inline onclick="fn(args)" → data-action="fn" data-args="args"
// Usage: elements get data-action="functionName" data-arg1="..." etc.
// This system auto-dispatches clicks on [data-action] elements.
const _ACTION_MAP = {};
function _registerAction(name, fn) { _ACTION_MAP[name] = fn; }

// Register all actions that were previously inline onclick
_registerAction('ndConfirmNew', () => {
  UI.closeModal();
  _ndFamily = 'Recorder';
  _ndSelectedInstruments = new Map();
  _ndLevel = APP.teachingKitLevel || 'advanced';
  _renderNewScoreDialog();
});
_registerAction('addRehearsalMark', (e) => addRehearsalMark(e.target.closest('[data-type]')?.dataset.type));
_registerAction('addStaffText', () => addStaffText());
_registerAction('applyArticulation', (e) => applyArticulation(e.target.closest('[data-type]')?.dataset.type));
_registerAction('applyBarline', (e) => applyBarline(e.target.closest('[data-type]')?.dataset.type));
_registerAction('applyClefChange', (e) => applyClefChange(e.target.closest('[data-type]')?.dataset.type));
_registerAction('applyDynamic', (e) => applyDynamic(e.target.closest('[data-type]')?.dataset.type));
_registerAction('applyFingering', (e) => applyFingering(e.target.closest('[data-f]')?.dataset.f));
_registerAction('applyKeySig', (e) => applyKeySig(parseInt(e.target.closest('[data-ks]')?.dataset.ks)));
_registerAction('applyMarker', (e) => applyMarker(e.target.closest('[data-type]')?.dataset.type));
_registerAction('applyScoreInfo', () => applyScoreInfo());
_registerAction('applyTempo', (e) => applyTempo(e.target.closest('[data-name]')?.dataset.name, parseInt(e.target.closest('[data-bpm]')?.dataset.bpm)));
_registerAction('applyTimeSig', (e) => applyTimeSig(parseInt(e.target.closest('[data-num]')?.dataset.num), parseInt(e.target.closest('[data-den]')?.dataset.den)));
_registerAction('changeOctave', (e) => changeOctave(parseInt(e.target.closest('[data-delta]')?.dataset.delta)));
_registerAction('clearChordSymbol', () => clearChordSymbol());
_registerAction('clearLyric', () => clearLyric());
_registerAction('clearMarker', () => clearMarker());
_registerAction('clearRehearsalMark', () => clearRehearsalMark());
_registerAction('clearSlur', () => clearSlur());
_registerAction('clearStaffText', () => clearStaffText());
_registerAction('clearTie', () => clearTie());
_registerAction('closeModal', () => closeModal());
_registerAction('confirmExportAudio', () => AUDIO.confirmExportAudio());
_registerAction('confirmGenerateScale', () => confirmGenerateScale());
_registerAction('confirmExportPDF', () => AUDIO.confirmExportPDF());
_registerAction('showHelpPanel', () => showHelpPanel());
_registerAction('closeWelcome', () => AUDIO.closeWelcome());
_registerAction('startLearnerOnboarding', () => AUDIO.startLearnerOnboarding());
_registerAction('startComposerOnboarding', () => AUDIO.startComposerOnboarding());
_registerAction('switchRole', (e) => { const role = e.target.closest('[data-role]')?.dataset.role; if (role) AUDIO.switchRole(role); });
_registerAction('loadRecorderExercise', (e) => loadRecorderExercise(e.target.closest('[data-key]')?.dataset.key));
_registerAction('showRecorderExercises', () => showRecorderExercises());
_registerAction('showNewScoreDialog', () => { closeModal(); showNewScoreDialog(); });
_registerAction('confirmAddInstrument', () => confirmAddInstrument());
_registerAction('createNewScore', () => createNewScore());
_registerAction('deleteMeasure', () => deleteMeasure());
_registerAction('editChordSymbol', () => editChordSymbol());
_registerAction('editLyric', () => editLyric());
_registerAction('editRehearsalMark', () => editRehearsalMark());
_registerAction('addMeasure', () => AUDIO.addMeasure());
_registerAction('insertMeasure', () => AUDIO.insertMeasure());
_registerAction('insertNoteByName', (e) => insertNoteByName(e.target.closest('[data-name]')?.dataset.name));
_registerAction('insertRest', () => insertRest());
_registerAction('ndKSAdj', (e) => ndKSAdj(parseInt(e.target.closest('[data-delta]')?.dataset.delta)));
_registerAction('ndTSDenAdj', (e) => ndTSDenAdj(parseInt(e.target.closest('[data-delta]')?.dataset.delta)));
_registerAction('ndTSNumAdj', (e) => ndTSNumAdj(parseInt(e.target.closest('[data-delta]')?.dataset.delta)));
_registerAction('ndPickupToggle', () => ndPickupToggle());
_registerAction('ndPickupSync', () => ndPickupSync());
_registerAction('printScore', () => printScore());
_registerAction('removePickupMeasure', () => removePickupMeasure());
_registerAction('rewindPlayback', () => AUDIO.rewindPlayback());
_registerAction('saveChordSymbol', () => saveChordSymbol());
_registerAction('saveRehearsalMark', () => saveRehearsalMark());
_registerAction('saveStaffText', () => saveStaffText());
_registerAction('ndSelectLevel', (e) => ndSelectLevel(e.target.closest('[data-level]')?.dataset.level));
_registerAction('ndQuickStart', (e) => {
  const preset = e.target.closest('[data-preset]')?.dataset.preset;
  if (!preset) return;
  _ndSelectedInstruments.clear();
  if (preset === 'piano') {
    _ndSelectedInstruments.set('Piano', 1);
  } else if (preset === 'treble') {
    _ndSelectedInstruments.set('Soprano Recorder', 1);
  } else if (preset === 'bass') {
    _ndSelectedInstruments.set('Cello', 1);
  }
  _renderNewScoreDialog(_ndScrollPos);
});
_registerAction('selectDur', (e) => selectDur(e.target.closest('[data-dur]')?.dataset.dur));
_registerAction('selectNDFamily', (e) => selectNDFamily(e.target.closest('[data-family]')?.dataset.family));
_registerAction('setAcc', (e) => setAcc(e.target.closest('[data-acc]')?.dataset.acc));
_registerAction('setPickupMeasure', () => setPickupMeasure());
_registerAction('setVoice', (e) => setVoice(parseInt(e.target.closest('[data-voice]')?.dataset.voice)));
_registerAction('showEditMenu', (e) => showEditMenu(e.target));
_registerAction('showFileMenu', (e) => showFileMenu(e.target));
_registerAction('showKeySigDialog', () => showKeySigDialog());
_registerAction('showMixer', () => showMixer());
_registerAction('showScoreInfo', () => showScoreInfo());
_registerAction('showScoreMenu', (e) => showScoreMenu(e.target));
_registerAction('showViewMenu', (e) => showViewMenu(e.target));
_registerAction('showLearnMenu', (e) => showLearnMenu(e.target));
_registerAction('showPracticeMenu', (e) => showPracticeMenu(e.target));
_registerAction('showTeachMenu', (e) => showTeachMenu(e.target));
_registerAction('applyKit', (e) => { applyKit(e.target.closest('[data-kit]')?.dataset.kit, e.target.closest('[data-level]')?.dataset.level); closeModal(); });
_registerAction('clearKit', () => { clearKit(); closeModal(); });
_registerAction('showAddInstrumentDialog', () => showAddInstrumentDialog());
_registerAction('showTimeSigDialog', () => showTimeSigDialog());
_registerAction('startMarking', (e) => startMarking(e.target.closest('[data-type]')?.dataset.type));
_registerAction('startAssignment', (e) => startAssignment(e.target.closest('[data-id]')?.dataset.id));
_registerAction('stopPlayback', () => AUDIO.stopPlayback());
_registerAction('toggleChordMode', () => toggleChordMode());
_registerAction('toggleContinuousView', () => toggleContinuousView());
_registerAction('toggleCountIn', () => AUDIO.toggleCountIn());
_registerAction('toggleDot', () => toggleDot());
_registerAction('toggleInputMode', () => toggleInputMode());
_registerAction('toggleLineBreak', () => toggleLineBreak());
_registerAction('toggleLyricStyle', (e) => toggleLyricStyle(e.target.closest('[data-style]')?.dataset.style));
_registerAction('toggleMetronome', () => AUDIO.toggleMetronome());
_registerAction('togglePalette', () => togglePalette());
_registerAction('setMetronomeSubdivision', (e) => AUDIO.setMetronomeSubdivision(e.target.value));
_registerAction('toggleNoteLabels', () => toggleNoteLabels());
_registerAction('toggleHighContrast', () => toggleHighContrast());
_registerAction('confirmCreateAssignment', () => confirmCreateAssignment());
_registerAction('checkAssignmentAnswers', () => checkAssignmentAnswers());
_registerAction('submitAssignment', () => submitAssignment());
_registerAction('exitAssignmentMode', () => exitAssignmentMode());
_registerAction('showExerciseDialog', () => showExerciseDialog());
_registerAction('showRhythmWorksheetDialog', () => showRhythmWorksheetDialog());
_registerAction('checkRhythmWorksheet', () => checkRhythmWorksheet());
_registerAction('showStudentProgress', () => showStudentProgress());
_registerAction('exportProgress', () => exportProgress());
_registerAction('importProgress', () => importProgress());
_registerAction('clearProgress', () => clearProgress());
_registerAction('showTeacherDashboard', () => showTeacherDashboard());
_registerAction('clearAllImported', () => clearAllImported());
_registerAction('showDiagnosticDialog', () => showDiagnosticDialog());
_registerAction('diagSubmit', () => _diagSubmit());
_registerAction('showStarterAssignmentsDialog', () => showStarterAssignmentsDialog());
_registerAction('downloadStarterAssignment', (e) => {
  const btn = e.target.closest('[data-action="downloadStarterAssignment"]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx);
  const tpl = STARTER_TEMPLATES[idx];
  if (!tpl) { showToast('Template not found'); return; }
  // Rhythm templates always use percussion clef — skip clef dialog
  if (tpl.id.startsWith('rhythm-')) {
    generateStarterAssignmentWithClef(tpl.id, 'percussion');
  } else {
    showClefSelectionDialog(tpl.id);
  }
});
_registerAction('selectAssignmentClef', (e) => {
  const btn = e.target.closest('[data-action="selectAssignmentClef"]');
  if (!btn) return;
  const clef = btn.dataset.clef;
  const tplId = window._pendingStarterTemplate;
  if (tplId) generateStarterAssignmentWithClef(tplId, clef);
});
_registerAction('confirmStarterDownload', () => confirmStarterDownload());
_registerAction('previewStarterScore', () => previewStarterScore());
_registerAction('startExerciseSession', (e) => {
  closeModal();
  const type = e.target.closest('[data-type]')?.dataset.type;
  const diff = e.target.closest('[data-diff]')?.dataset.diff;
  if (type) startExerciseSession(type, diff);
});
_registerAction('beginExerciseSession', (e) => {
  closeModal();
  const type = e.target.closest('[data-type]')?.dataset.type;
  const diff = e.target.closest('[data-diff]')?.dataset.diff;
  if (type) _beginExerciseSession(type, diff);
});
_registerAction('showRhythmWorkoutDialog', () => { closeModal(); showRhythmWorkoutDialog(); });
_registerAction('rwSetTs', (e) => _rwHandleAction('rwSetTs', e.target.closest('[data-num]')));
_registerAction('rwSetMeasures', (e) => _rwHandleAction('rwSetMeasures', e.target.closest('[data-val]')));
_registerAction('rwSetTempo', (e) => _rwHandleAction('rwSetTempo', e));
_registerAction('rwToggleGroup', (e) => _rwHandleAction('rwToggleGroup', e.target.closest('[data-idx]')));
_registerAction('rwStart', () => _rwHandleAction('rwStart', null));
_registerAction('selectExerciseDifficulty', (e) => selectExerciseDifficulty(e.target.closest('[data-diff]')?.dataset.diff));
_registerAction('nextExercise', () => nextExercise());
_registerAction('skipExercise', () => skipExercise());
_registerAction('retryExercise', () => retryExercise());
_registerAction('retryDictation', () => retryDictation());
_registerAction('endExerciseSession', () => endExerciseSession());
_registerAction('closeModalExercise', () => closeModalExercise());
_registerAction('restartExerciseSession', () => restartExerciseSession());
  _registerAction('reviewExerciseSession', () => reviewExerciseSession());
  _registerAction('showCurriculumDialog', () => showCurriculumDialog());
  _registerAction('showExerciseBuilderDialog', () => showExerciseBuilderDialog());
  _registerAction('importCustomExercise', () => importCustomExercise());
  _registerAction('deleteCustomExercise', (e) => deleteCustomExercise(parseInt(e.target.closest('[data-idx]')?.dataset.idx)));
  _registerAction('exportCustomExercise', (e) => exportCustomExercise(parseInt(e.target.closest('[data-idx]')?.dataset.idx)));
  _registerAction('startCurriculumGrade', (e) => {
    closeModal();
    const grade = e.target.closest('[data-grade]')?.dataset.grade;
    const exercise = e.target.closest('[data-exercise]')?.dataset.exercise;
    if (grade && exercise !== undefined) startCurriculumGrade(grade, parseInt(exercise));
  });
  _registerAction('calibrateLatency', () => SESSION_MANAGER.showCalibrationDialog());
  _registerAction('togglePanel', (e) => togglePanel(e.target.closest('[data-panel]')?.dataset.panel));
_registerAction('togglePartMute', (e) => togglePartMute(parseInt(e.target.closest('[data-idx]')?.dataset.idx)));
_registerAction('togglePlayback', () => AUDIO.togglePlayback());
_registerAction('togglePracticeMode', () => AUDIO.togglePracticeMode());
_registerAction('toggleTempoDisplay', () => toggleTempoDisplay());
_registerAction('toggleTuplet', (e) => toggleTuplet(parseInt(e.target.closest('[data-num]')?.dataset.num), parseInt(e.target.closest('[data-den]')?.dataset.den)));
_registerAction('transposeScore', (e) => { transposeScore(parseInt(e.target.closest('[data-semitones]')?.dataset.semitones)); closeModal(); });
_registerAction('tsApplyFromSliders', () => tsApplyFromSliders());
_registerAction('tsSliderChange', () => tsSliderChange());
_registerAction('zoomIn', () => zoomIn());
_registerAction('zoomOut', () => zoomOut());
_registerAction('zoomReset', () => zoomReset());
_registerAction('setPartVolume', (e) => { const idx = parseInt(e.target.dataset.idx); setPartVolume(idx, e.target.value); });
_registerAction('setMasterVolume', (e) => { APP.masterVolume = e.target.value / 100; if (APP.masterGain) APP.masterGain.gain.value = APP.masterVolume; document.getElementById('mix-master-val').textContent = e.target.value; });
_registerAction('setMetronomeVolume', (e) => { APP.metronomeVolume = e.target.value / 100; if (APP.metronomeGain) APP.metronomeGain.gain.value = APP.metronomeVolume; document.getElementById('mix-met-val').textContent = e.target.value; });
_registerAction('reload', () => location.reload());
// ── Composition Tool Actions ─────────────────────────────────
_registerAction('showRhythmComposer', () => showRhythmComposer());
_registerAction('showMelodyComposer', () => showMelodyComposer());
_registerAction('startRhythmComposer', () => startRhythmComposer());
_registerAction('startMelodyComposer', () => startMelodyComposer());
_registerAction('exitCompositionMode', () => exitCompositionMode());
_registerAction('restoreAutosave', () => restoreAutosave());
_registerAction('applyTitleDialog', () => applyTitleDialog());
_registerAction('selectNDInstr', (e) => {
  const btn = e.target.closest('.nd-instr-btn');
  if (!btn) return;
  const name = btn.dataset.name;
  const cur = _ndSelectedInstruments.get(name) || 0;
  let newCount;
  if (cur === 0) {
    _ndSelectedInstruments.set(name, 1);
    newCount = 1;
  } else if (cur === 1) {
    _ndSelectedInstruments.delete(name);
    newCount = 0;
  } else {
    _ndSelectedInstruments.set(name, cur - 1);
    newCount = cur - 1;
  }
  const sel = newCount > 0;
  btn.classList.toggle('nd-sel', sel);
  btn.style.borderColor = sel ? 'rgba(192,86,33,0.55)' : 'rgba(192,86,33,0.28)';
  btn.style.background = sel ? 'rgba(192,86,33,0.12)' : 'rgba(192,86,33,0.06)';
  btn.style.color = sel ? 'var(--pauta-primary)' : 'var(--pauta-text)';
  let countSpan = btn.querySelector('.nd-count');
  if (newCount > 0) {
    if (!countSpan) {
      countSpan = document.createElement('span');
      countSpan.className = 'nd-count';
      countSpan.style.cssText = 'background:var(--pauta-primary);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:4px';
      btn.appendChild(countSpan);
    }
    countSpan.textContent = newCount;
  } else if (countSpan) {
    countSpan.remove();
  }
  const total = [..._ndSelectedInstruments.values()].reduce((a, b) => a + b, 0);
  const c = document.getElementById('nd-instr-count');
  if (c) c.textContent = '(' + total + ')';
  const createBtn = document.querySelector('[data-action="createNewScore"]');
  if (createBtn) {
    createBtn.textContent = total === 0 ? 'Select an instrument first' : 'Create';
    createBtn.style.opacity = total === 0 ? '0.5' : '1';
    createBtn.style.pointerEvents = total === 0 ? 'none' : 'auto';
    createBtn.disabled = total === 0;
  }
});

// ── UI Component Helpers (design-system aligned) ─────────────────────

function btn(label, {variant = 'primary', size = 'md', block = false, icon = '', action, className = '', disabled = false} = {}) {
  const variantClass = variant ? ` ${variant}` : '';
  const sizeClass = size !== 'md' ? ` ${size}` : '';
  const blockClass = block ? ' block' : '';
  const disabledAttr = disabled ? ' disabled' : '';
  const actionAttr = action ? ` data-action="${action}"` : '';
  const classAttr = className ? ` ${className}` : '';
  const iconHtml = icon ? `<span>${icon}</span>` : '';
  return `<button class="pauta-btn${variantClass}${sizeClass}${blockClass}${classAttr}"${actionAttr}${disabledAttr}>${iconHtml}${label}</button>`;
}

function input({id, placeholder = '', value = '', type = 'text', label = '', required = false, action = '', className = ''} = {}) {
  const labelHtml = label ? `<label class="pauta-label" for="${id}">${label}${required ? ' *' : ''}</label>` : '';
  const actionAttr = action ? ` data-action="${action}"` : '';
  const classAttr = className ? ` ${className}` : '';
  return `${labelHtml}<input class="pauta-input${classAttr}" id="${id}" type="${type}" placeholder="${placeholder}" value="${value}"${actionAttr} ${required ? 'required' : ''}>`;
}

function select({id, options = [], value = '', label = '', action = '', className = '', style = ''} = {}) {
  const labelHtml = label ? `<label class="pauta-label" for="${id}">${label}</label>` : '';
  const actionAttr = action ? ` data-action="${action}"` : '';
  const classAttr = className ? ` ${className}` : '';
  const styleAttr = style ? ` style="${style}"` : '';
  const optsHtml = options.map(o => `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('');
  return `${labelHtml}<select class="pauta-select${classAttr}" id="${id}"${actionAttr}${styleAttr}>${optsHtml}</select>`;
}

function checkbox({id, label = '', checked = false, action = '', className = ''} = {}) {
  const actionAttr = action ? ` data-action="${action}"` : '';
  const classAttr = className ? ` ${className}` : '';
  return `<label class="pauta-checkbox${classAttr}"><input type="checkbox" id="${id}"${checked ? ' checked' : ''}${actionAttr}><span>${label}</span></label>`;
}

function badge(text, {variant = 'default'} = {}) {
  return `<span class="pauta-badge ${variant}">${text}</span>`;
}

function card({title = '', desc = '', meta = '', badge = '', action = '', className = ''} = {}) {
  const actionAttr = action ? ` data-action="${action}"` : '';
  const classAttr = className ? ` ${className}` : '';
  const badgeHtml = badge ? `<span class="pauta-card-badge">${badge}</span>` : '';
  return `<div class="pauta-card${classAttr}"${actionAttr}>${badgeHtml}<div class="pauta-card-title">${title}</div>${desc ? `<div class="pauta-card-desc">${desc}</div>` : ''}${meta ? `<div class="pauta-card-meta">${meta}</div>` : ''}</div>`;
}

function modalHeader({title = '', subtitle = '', actions = ''} = {}) {
  return `<div class="pauta-modal-header"><h2 class="pauta-modal-title">${title}</h2>${subtitle ? `<p class="pauta-modal-subtitle">${subtitle}</p>` : ''}${actions}</div>`;
}

function modalBody(content = '') {
  return `<div class="pauta-modal-body">${content}</div>`;
}

function modalFooter(content = '') {
  return `<div class="pauta-modal-footer">${content}</div>`;
}

function sectionLabel(text) {
  return `<label class="pauta-section-label" style="color:rgba(74,85,104,0.70);font-size:10px;text-transform:uppercase;letter-spacing:0.3px;margin-top:4px;display:block;font-weight:600">${text}</label>`;
}

function gridItem(content, {span = 1} = {}) {
  return `<div style="grid-column:span ${span}">${content}</div>`;
}

// Simple icon button for compact controls
function iconBtn(icon, {variant = 'ghost', size = 'sm', action = '', title = '', className = '', id = '', dataAttrs = {}} = {}) {
  const actionAttr = action ? ` data-action="${action}"` : '';
  const classAttr = className ? ` ${className}` : '';
  const titleAttr = title ? ` title="${title}"` : '';
  const idAttr = id ? ` id="${id}"` : '';
  const dataAttrsStr = Object.entries(dataAttrs).map(([k, v]) => ` data-${k}="${v}"`).join(' ');
  return `<button class="pauta-btn ${variant} ${size} icon-only"${actionAttr}${titleAttr}${classAttr}${idAttr} ${dataAttrsStr}>${icon}</button>`;
}

// Pill-style button for tab/segmented controls
function pillBtn(label, {active = false, action = '', className = '', dataAttrs = {}} = {}) {
  const actionAttr = action ? ` data-action="${action}"` : '';
  const classAttr = className ? ` ${className}` : '';
  const activeClass = active ? ' active' : '';
  const dataAttrsStr = Object.entries(dataAttrs).map(([k, v]) => ` data-${k}="${v}"`).join(' ');
  return `<button class="pauta-pill${activeClass}${classAttr}"${actionAttr}${dataAttrsStr}>${label}</button>`;
}

// Instrument grid item (used in New Score)
function instrGridBtn(name, count = 0, {action = 'selectNDInstr'} = {}) {
  const sel = count > 0;
  const actionAttr = action ? ` data-action="${action}"` : '';
  const selClass = sel ? ' nd-sel' : '';
  const countHtml = count ? `<span class="nd-count" style="background:var(--pauta-primary);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:4px">${count}</span>` : '';
  return `<button${actionAttr} data-name="${name}" class="nd-instr-btn${selClass}">${name}${countHtml}</button>`;
}

// ── Assign UI functions to UI namespace ─────────
 [showToast, makeModal, closeModal, safeName, dlBlob, escHtml, loadScript,
 updateStatusBar, togglePalette, updateModeBanner,
 renderRehearsalMarks, renderStaffTexts,
 renderChordSymbols, renderLyrics, _autosaveNow
].forEach(fn => { UI[fn.name] = fn; });
window.UI = UI;
})();
