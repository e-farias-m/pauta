// ── Note Navigation ───────────────────────────────────────────────
// Arrow Left/Right move the selection through notes in the score.
// Arrow Up/Down are already used for octave; we keep that but also handle
// Shift+Arrow for navigating across measures.
function navigateNote(direction, extend) {
  // direction: +1 = forward, -1 = backward
  // extend: true  = Shift+Arrow (extend selection range)
  //         false = plain Arrow (reset range anchor)
  const mi = APP.selectedMeasure;
  const si = APP.selectedStaff;
  const m  = getMeasureBySI(si, mi);
  if (!m) return;

  if (!extend) APP.selStartIdx = -1;
  else if (APP.selStartIdx < 0) APP.selStartIdx = APP.selectedNoteIdx;

  // Filter notes for current voice
  const voiceNotes = m.notes.map((n,i) => ({n,i}))
                             .filter(({n}) => (n.voice||1) === APP.curVoice);

  if (direction === 1) {
    // Move to next note in this measure
    const cur = voiceNotes.findIndex(({i}) => i === APP.selectedNoteIdx);
    if (cur < voiceNotes.length - 1) {
      APP.selectedNoteIdx = voiceNotes[cur + 1].i;
    } else {
      // Move to next measure
      const nextMi = mi + 1;
      const nM = APP.score.parts[0].staves[0].measures.length;
      if (nextMi < nM) {
        APP.selectedMeasure = nextMi;
        const nextM = getMeasureBySI(si, nextMi);
        const nextVN = (nextM?.notes || []).map((n,i)=>({n,i})).filter(({n})=>(n.voice||1)===APP.curVoice);
        APP.selectedNoteIdx = nextVN.length ? nextVN[0].i : 0;
        if (extend) APP.selStartIdx = -1;
      }
    }
  } else {
    // Move to previous note in this measure
    const cur = voiceNotes.findIndex(({i}) => i === APP.selectedNoteIdx);
    if (cur > 0) {
      APP.selectedNoteIdx = voiceNotes[cur - 1].i;
    } else if (mi > 0) {
      // Move to previous measure, last note
      APP.selectedMeasure = mi - 1;
      const prevM = getMeasureBySI(si, mi - 1);
      const prevVN = (prevM?.notes || []).map((n,i)=>({n,i})).filter(({n})=>(n.voice||1)===APP.curVoice);
      APP.selectedNoteIdx = prevVN.length ? prevVN[prevVN.length - 1].i : 0;
      if (extend) APP.selStartIdx = -1;
    }
  }
  renderSelection();
  scrollToSelectedMeasure();
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (n) {
    const label = n.type === 'rest'
      ? `Rest (${VEX_TO_MSCX[n.duration]||n.duration})`
      : `${NOTE_NAMES[PC_TO_DIA[n.pitch%12]].toUpperCase()}${Math.floor(n.pitch/12)-1}`;
    showToast(label);
  }
}
function insertMeasure() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const mi = APP.selectedMeasure;
  const prevM = mi > 0 ? APP.score.parts[0].staves[0].measures[mi - 1] : null;
  const m = { timeSigNum: prevM?.timeSigNum ?? null, timeSigDen: prevM?.timeSigDen ?? null, keySig: prevM?.keySig ?? null, lineBreak: false, notes: [mkRest('w')] };
  commitChange(score => {
    score.parts.forEach(p => p.staves.forEach(s => s.measures.splice(mi, 0, JSON.parse(JSON.stringify(m)))));
    shiftMeasureRefs(score, mi, 'insert');
    APP.selectedNoteIdx = -1;
  }, { toast: 'Measure inserted' });
  _auditAnnotationsAfterEdit(APP.score, 'insertMeasure', mi);
}
function addMeasure() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  commitChange(score => {
    score.parts.forEach(p => p.staves.forEach(s => s.measures.push(emptyMeasure())));
  }, { toast: 'Measure added' });
  _auditAnnotationsAfterEdit(APP.score, 'addMeasure', APP.score.parts[0]?.staves[0]?.measures?.length - 1);
}

function navigateStaff(dir) {
  const nStaves = APP.score.parts.reduce((s, p) => s + p.staves.length, 0);
  const next = APP.selectedStaff + dir;
  if (next < 0 || next >= nStaves) return;
  APP.selectedStaff = next;
  APP.selectedNoteIdx = -1;
  renderSelection();
  scrollToSelectedMeasure();
  showToast('Staff ' + (APP.selectedStaff + 1));
}

// ── Undo/Redo ────────────────────────────────────────────────────
// Uses structuredClone() (3-5× faster than JSON round-trip, no type loss).
// Falls back to JSON for environments that don't support it (Safari < 15.4).
const _cloneScore = typeof structuredClone === 'function'
  ? s => structuredClone(s)
  : s => JSON.parse(JSON.stringify(s));

// Lightweight dirty check: compare measure counts + last-note fingerprint
// so we skip pushing if nothing actually changed (e.g. double-key on empty measure).
function _scoreFingerprint(score) {
  if (!score) return '';
  try {
    const s = JSON.stringify(score);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return (h >>> 0).toString(36);
  } catch(e) { return Math.random().toString(); }
}

function _snapshotUIState() {
  return {
    selectedMeasure: APP.selectedMeasure,
    selectedStaff: APP.selectedStaff,
    selectedNoteIdx: APP.selectedNoteIdx,
    selStartIdx: APP.selStartIdx,
    inputMode: APP.inputMode,
    chordMode: APP.chordMode,
    markingMode: APP.markingMode,
    markingStart: APP.markingStart,
    exerciseMode: APP.exerciseMode,
    exerciseSession: APP.exerciseSession,
    exerciseDifficulty: APP.exerciseDifficulty,
    assignmentMode: APP.assignmentMode,
    currentAssignment: APP.currentAssignment,
    practiceMode: APP.practiceMode,
    curDur: APP.curDur,
    curDot: APP.curDot,
    curRest: APP.curRest,
    curAcc: APP.curAcc,
    curOctave: APP.curOctave,
    curVoice: APP.curVoice,
    curTuplet: APP.curTuplet,
    tupletPending: APP.tupletPending,
    tupletGroupId: APP.tupletGroupId,
  };
}
function _restoreUIState(snapshot) {
  if (!snapshot) return;
  Object.assign(APP, snapshot);
}
function _uiFingerprint() {
  return JSON.stringify(_snapshotUIState());
}
function pushUndo() {
  const fp = _scoreFingerprint(APP.score) + '|' + _uiFingerprint();
  if (APP._lastUndoFP === fp) return;
  APP._lastUndoFP = fp;
  APP.undoStack.push({ score: _cloneScore(APP.score), ui: _cloneScore(_snapshotUIState()) });
  APP.redoStack = [];
  if (APP.undoStack.length > 60) APP.undoStack.shift();
}
function undo() {
  if (!APP.undoStack.length) { showToast('Nothing to undo'); return; }
  APP.redoStack.push({ score: _cloneScore(APP.score), ui: _cloneScore(_snapshotUIState()) });
  const entry = APP.undoStack.pop();
  APP.score = entry.score;
  _restoreUIState(entry.ui);
  APP._lastUndoFP = _scoreFingerprint(APP.score);
  _checkInvariants(APP.score);
  renderScore(); showToast('Undo');
}
function redo() {
  if (!APP.redoStack.length) { showToast('Nothing to redo'); return; }
  APP.undoStack.push({ score: _cloneScore(APP.score), ui: _cloneScore(_snapshotUIState()) });
  const entry = APP.redoStack.pop();
  APP.score = entry.score;
  _restoreUIState(entry.ui);
  APP._lastUndoFP = _scoreFingerprint(APP.score);
  _checkInvariants(APP.score);
  renderScore(); showToast('Redo');
}

// ── Audio Export ──────────────────────────────────────────────────
function showExportDialog() {
  makeModal(`
    <h2>Export Audio</h2>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Format</div>
      <select id="export-format" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
        <option value="wav">WAV (lossless, large)</option>
        <option value="mp3">MP3 (compressed, smaller)</option>
      </select>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Tempo (BPM) — override</div>
      <input id="export-bpm" type="number" value="${APP.tempo}" min="20" max="400"
        style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
    </div>
    <div style="margin-bottom:12px;font-size:11px;color:rgba(74,85,104,0.7)">
      Renders the current score using the internal synth and saves as ${APP.score?.parts?.length > 1 ? 'a stereo mix' : 'a mono/stereo'} file.
    </div>
    <button class="modal-btn primary" data-action="confirmExportAudio">Export</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function confirmExportAudio() {
  const format = document.getElementById('export-format')?.value || 'wav';
  const bpm    = parseInt(document.getElementById('export-bpm')?.value) || APP.tempo;
  closeModal();
  _renderAudio(format, bpm);
}

function _renderAudio(format, bpm) {
  const ctx = getAudioCtx();
  const sampleRate = ctx.sampleRate;
  const beatDur = 60 / bpm;
  const playOrder = buildPlaybackOrder(APP.score);
  let totalBeats = 0;
  APP.score.parts.forEach(part => {
    part.staves.forEach(stave => {
      let beats = 0;
      playOrder.forEach(mi => {
        const m = stave.measures[mi];
        if (!m) return;
        m.notes.forEach(n => { beats += durBeats(n.duration, n.dots, n.tuplet); });
      });
      totalBeats = Math.max(totalBeats, beats);
    });
  });
  const durSec = totalBeats * beatDur + 1;

  const offline = new OfflineAudioContext(2, Math.ceil(sampleRate * durSec), sampleRate);
  const masterGain = offline.createGain();
  masterGain.gain.value = APP.masterVolume;
  masterGain.connect(offline.destination);

  APP.score.parts.forEach(part => {
    if (part.muted) return;
    const oscType = (part.instrument === 'Piano' || part.instrument === 'Harpsichord' || part.instrument === 'Organ')
      ? 'piano' : (part.osc || 'triangle');
    const vol = part.volume || 1;

    part.staves.forEach(stave => {
      let t = 0;
      playOrder.forEach(mi => {
        const m = stave.measures[mi];
        if (!m) return;
        m.notes.forEach(n => {
          const beats = durBeats(n.duration, n.dots, n.tuplet);
          const dur = beats * beatDur;
          if (n.type === 'note') {
            const chordPitches = [n.pitch, ...(n.extraPitches || []).map(ep => ep.pitch)];
            const profile = SYNTH_PROFILES[oscType] || SYNTH_PROFILES.triangle;
            const chordVol = vol / Math.sqrt(chordPitches.length);
            const noteDur = Math.max(dur, 0.08);
            const relTime = t + Math.min(noteDur, noteDur * 0.9);
            const endT = t + noteDur + profile.release;

            function spawnOsc(freq2, gainVal, panVal) {
              const osc = offline.createOscillator();
              const gain = offline.createGain();
              osc.type = 'sine';
              osc.frequency.value = freq2;
              osc.connect(gain);
              const a = profile.attack, d = profile.decay;
              const s = profile.sustain, r = profile.release;
              gain.gain.setValueAtTime(0, t);
              gain.gain.linearRampToValueAtTime(gainVal, t + a);
              gain.gain.exponentialRampToValueAtTime(Math.max(gainVal * s, 0.001), t + a + d);
              gain.gain.setValueAtTime(Math.max(gainVal * s, 0.001), relTime);
              gain.gain.exponentialRampToValueAtTime(0.0001, endT);
              const panner = offline.createStereoPanner ? offline.createStereoPanner() : null;
              if (panner) { panner.pan.value = panVal; gain.connect(panner); panner.connect(masterGain); }
              else { gain.connect(masterGain); }
              osc.start(t);
              osc.stop(endT + 0.05);
            }

            chordPitches.forEach(pitch => {
              const freq = 440 * Math.pow(2, (pitch - 69) / 12);
              const effGain = profile.gain * chordVol;
              const pan = Math.max(-0.6, Math.min(0.6, (pitch - 60) / 40));
              spawnOsc(freq, effGain, pan);
              for (const [h, hGain] of (profile.harmonics || [])) {
                spawnOsc(freq * h, effGain * hGain, pan);
              }
            });
          }
          t += dur;
        });
      });
    });
  });

  showToast('Rendering audio…');
  offline.startRendering().then(buffer => {
    const safe = safeName(APP.score.title);
    if (format === 'mp3') {
      _exportMP3(buffer, safe);
    } else {
      const wav = audioBufferToWav(buffer);
      dlBlob(wav, `${safe}.wav`);
      showToast('Audio exported');
    }
  }).catch(err => {
    console.error(err);
    showToast('Export failed: ' + err.message);
  });
}

function _exportMP3(buffer, name) {
  // Load lamejs on demand, then encode
  if (typeof lamejs !== 'undefined') {
    _encodeMP3(buffer, name);
    return;
  }
  showToast('Loading MP3 encoder…');
  const urls = [
    'https://unpkg.com/lamejs@1.2.1/lame.min.js',
    'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
  ];
  async function tryLoad() {
    for (const url of urls) {
      try {
        await loadScript(url);
        if (typeof lamejs !== 'undefined') { _encodeMP3(buffer, name); return; }
      } catch(e) { /* try next */ }
    }
    showToast('Could not load MP3 encoder. Exporting WAV instead.');
    const wav = audioBufferToWav(buffer);
    dlBlob(wav, `${name}.wav`);
  }
  tryLoad();
}

function _encodeMP3(buffer, name) {
  try {
    const numCh = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(numCh, sampleRate, 192);
    const mp3Data = [];
    const blockSize = 1152;

    // Convert AudioBuffer channels to interleaved Int16 samples
    const chData = [];
    for (let ch = 0; ch < numCh; ch++) chData.push(buffer.getChannelData(ch));
    const totalSamples = buffer.length;
    let pos = 0;

    function floatToInt16(float32) {
      const s = Math.max(-1, Math.min(1, float32));
      return s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    while (pos < totalSamples) {
      const end = Math.min(pos + blockSize, totalSamples);
      const chunkLen = end - pos;
      let sampleBlock;
      if (numCh === 1) {
        sampleBlock = new Int16Array(chunkLen);
        for (let i = 0; i < chunkLen; i++) sampleBlock[i] = floatToInt16(chData[0][pos + i]);
      } else {
        sampleBlock = new Int16Array(chunkLen * numCh);
        for (let i = 0; i < chunkLen; i++) {
          for (let ch = 0; ch < numCh; ch++) {
            sampleBlock[i * numCh + ch] = floatToInt16(chData[ch][pos + i]);
          }
        }
      }
      const mp3Buf = mp3encoder.encodeBuffer(sampleBlock);
      if (mp3Buf.length > 0) mp3Data.push(mp3Buf);
      pos = end;
    }

    const flushBuf = mp3encoder.flush();
    if (flushBuf.length > 0) mp3Data.push(flushBuf);

    const blob = new Blob(mp3Data, { type: 'audio/mpeg' });
    dlBlob(blob, `${name}.mp3`);
    showToast('MP3 exported');
  } catch (err) {
    console.error(err);
    showToast('MP3 export failed, falling back to WAV: ' + err.message);
    const wav = audioBufferToWav(buffer);
    dlBlob(wav, `${name}.wav`);
  }
}

function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const data = new Float32Array(length * numCh);
  // Interleave channels
  for (let ch = 0; ch < numCh; ch++) {
    const chData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i * numCh + ch] = chData[i];
  }

  // WAV header + data
  const byteLen = data.length * 2;
  const buf = new ArrayBuffer(44 + byteLen);
  const dv = new DataView(buf);
  const w = (off, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF');
  dv.setUint32(4, 36 + byteLen, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  dv.setUint32(16, 16, true);        // chunk size
  dv.setUint16(20, 1, true);         // PCM
  dv.setUint16(22, numCh, true);     // channels
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * numCh * 2, true); // byte rate
  dv.setUint16(32, numCh * 2, true); // block align
  dv.setUint16(34, 16, true);        // bits per sample
  w(36, 'data');
  dv.setUint32(40, byteLen, true);

  let off = 44;
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    off += 2;
  }
  return new Blob([buf], {type:'audio/wav'});
}

// ── PDF Export ────────────────────────────────────────────────────
function showExportPDFDialog() {
  makeModal(`
    <h2>Export Engraved PDF</h2>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Page size</div>
      <select id="pdf-page-size" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
        <option value="a4">A4</option>
        <option value="letter">US Letter</option>
      </select>
    </div>
    <div style="margin-bottom:12px;font-size:11px;color:rgba(74,85,104,0.7)">
      Renders the current score view as a high-resolution PDF image.
    </div>
    <button class="modal-btn primary" data-action="confirmExportPDF">Export</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function confirmExportPDF() {
  const size = document.getElementById('pdf-page-size')?.value || 'a4';
  closeModal();
  _exportPDF(size);
}

async function _exportPDF(pageSize) {
  const urls = {
    html2canvas: [
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
      'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
    ],
    jspdf: [
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ]
  };
  showToast('Loading PDF libraries…');
  try {
    for (const url of urls.html2canvas) {
      try { await loadScript(url); break; } catch(e) { /* try next */ }
    }
    for (const url of urls.jspdf) {
      try { await loadScript(url); break; } catch(e) { /* try next */ }
    }
  } catch(e) {
    showToast('Could not load PDF libraries');
    return;
  }
  if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined' || !jspdf.jsPDF) {
    showToast('PDF libraries failed to load');
    return;
  }
  showToast('Rendering score…');
  const container = document.getElementById('score-svg');
  if (!container) { showToast('No score to export'); return; }
  // Hide diagrams for clean print
  positionAllDiagrams(0);
  const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = jspdf;
  const page = pageSize === 'letter' ? { w: 612, h: 792 } : { w: 595.28, h: 841.89 };
  const margin = 36; // 0.5 inch
  const availW = page.w - margin * 2;
  const availH = page.h - margin * 2;
  const imgW = canvas.width;
  const imgH = canvas.height;
  const scale = Math.min(availW / imgW, availH / imgH, 1);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const doc = new jsPDF({ unit: 'pt', format: pageSize === 'letter' ? 'letter' : 'a4' });
  if (drawH <= availH) {
    doc.addImage(imgData, 'PNG', margin, margin, drawW, drawH);
  } else {
    // Multi-page: scale to full width, chop vertically
    const fullScale = availW / imgW;
    const fullDrawW = imgW * fullScale;
    const fullDrawH = imgH * fullScale;
    let y = 0;
    let pageNum = 0;
    while (y < fullDrawH) {
      if (pageNum > 0) doc.addPage();
      const sy = (y / fullDrawH) * imgH;
      const sh = Math.min((availH / fullDrawH) * imgH, imgH - sy);
      const chunk = document.createElement('canvas');
      chunk.width = imgW;
      chunk.height = Math.ceil(sh);
      const ctx = chunk.getContext('2d');
      ctx.drawImage(canvas, 0, -Math.floor(sy));
      const chunkData = chunk.toDataURL('image/png');
      doc.addImage(chunkData, 'PNG', margin, margin, fullDrawW, (sh / imgH) * fullDrawH);
      y += availH;
      pageNum++;
    }
  }
  const safe = safeName(APP.score?.title || 'score');
  doc.save(`${safe}.pdf`);
  showToast('PDF exported');
}

// ── Help & Onboarding ─────────────────────────────────────────────
function showWelcomeModal() {
  const seen = localStorage.getItem('pauta_welcome_seen');
  if (seen) return;
  makeModal(`
    <h2>Welcome to Pauta</h2>
    <div style="font-size:13px;color:#4a5568;line-height:1.5;margin-bottom:14px">
      <p>What would you like to do?</p>
    </div>
    <button class="modal-btn primary" data-action="startLearnerOnboarding" style="margin-bottom:8px;width:100%">🎓 I'm a student — start exercises</button>
    <button class="modal-btn secondary" data-action="startComposerOnboarding" style="margin-bottom:8px;width:100%">🎼 I'm composing — open the editor</button>
    <div style="margin-top:8px;font-size:12px;color:rgba(74,85,104,0.7)">
      You can change your mind anytime via the View menu.
    </div>
  `);
}

function startLearnerOnboarding() {
  applyKit('recorder', 'beginner');
  localStorage.setItem('pauta_welcome_seen', '1');
  localStorage.setItem('pauta_role', 'student');
  _updateDocTitle();
  closeModal();
  setTimeout(() => showExerciseDialog(), 300);
}

function startComposerOnboarding() {
  localStorage.setItem('pauta_welcome_seen', '1');
  localStorage.setItem('pauta_role', 'teacher');
  _updateDocTitle();
  closeModal();
}

function closeWelcome() {
  localStorage.setItem('pauta_welcome_seen', '1');
  closeModal();
}

function _updateDocTitle() {
  const role = localStorage.getItem('pauta_role') || 'teacher';
  document.title = role === 'student' ? 'Pauta — Student Mode' : 'Pauta — Teacher Mode';
}

function switchRole(role) {
  localStorage.setItem('pauta_role', role);
  _updateDocTitle();
  showToast(role === 'student' ? 'Switched to Student Mode' : 'Switched to Teacher Mode');
}

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
  { q: 'How do assignments work?', a: 'Score → Create Assignment to hide notes for students. Share the .mscz file. Students open it, fill in answers, and send it back.' },
  { q: 'What keyboard shortcuts are available?', a: 'Space = play/pause, 0 = rest, Arrow keys = move selection, Home = rewind, Delete = remove note.' },
  { q: 'How do I add a chord?', a: 'Select a note, tap Chord mode (the chord icon), then tap additional note names to stack them.' },
];

function showHelpPanel() {
  makeModal(`
    <h2>Help & Tips</h2>
    <input id="help-search" type="text" placeholder="Search tips…" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111;margin-bottom:10px">
    <div id="help-list" style="max-height:280px;overflow-y:auto;font-size:12px;color:#4a5568;line-height:1.5">
      ${HELP_TIPS.map((t,i) => `<div class="help-tip" data-idx="${i}" style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(192,86,33,0.08)">
        <div style="font-weight:600;color:#2d3748;margin-bottom:2px">${t.q}</div>
        <div>${t.a}</div>
      </div>`).join('')}
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
  // Bind live search
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

function getAudioCtx() {
  if (!APP.audioCtx) {
    APP.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    initAudioChain(APP.audioCtx);
  }
  return APP.audioCtx;
}

function initAudioChain(ctx) {
  // Master gain
  APP.masterGain = ctx.createGain();
  APP.masterGain.gain.value = APP.masterVolume;

  // Master compressor — smooths dynamics, prevents clipping
  APP.compressor = ctx.createDynamicsCompressor();
  APP.compressor.threshold.value = -26;
  APP.compressor.knee.value = 24;
  APP.compressor.ratio.value = 8;
  APP.compressor.attack.value = 0.004;
  APP.compressor.release.value = 0.2;
  APP.masterGain.connect(APP.compressor);
  APP.compressor.connect(ctx.destination);

  // Metronome gain — separate volume control for count-in / metronome clicks
  APP.metronomeGain = ctx.createGain();
  APP.metronomeGain.gain.value = APP.metronomeVolume;
  APP.metronomeGain.connect(APP.compressor);

  // Synthetic reverb — decaying noise-based impulse response
  const irLen = ctx.sampleRate * 1.2;
  const irBuf = ctx.createBuffer(2, irLen, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = irBuf.getChannelData(ch);
    for (let i = 0; i < irLen; i++) {
      const t = i / irLen;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8) * (1 + 0.3 * Math.sin(t * 40));
    }
  }
  APP.reverb = ctx.createConvolver();
  APP.reverb.buffer = irBuf;
  APP.reverbGain = ctx.createGain();
  APP.reverbGain.gain.value = 0.12;
  APP.reverb.connect(APP.reverbGain);
  APP.reverbGain.connect(APP.compressor);
}
function togglePlayback() { APP.playing ? stopPlayback() : startPlayback(); }
function rewindPlayback() {
  stopPlayback();
  clearPlayCursor();
  APP.selectedMeasure = -1;
  APP.selectedStaff = 0;
  APP.selectedNoteIdx = -1;
  document.getElementById('play-pos').textContent = '0:00';
  const scoreArea = document.getElementById('score-area');
  if (scoreArea) scoreArea.scrollTop = 0;
  const scoreSvg = document.getElementById('score-svg');
  if (scoreSvg) scoreSvg.scrollLeft = 0;
  renderSelection();
  showToast('Rewound to start');
}

// Per-instrument sound profiles — richer harmonics, smoother envelopes
const SYNTH_PROFILES = {
  sine:     {attack:0.04, decay:0.20, sustain:0.55, release:0.5,  gain:0.24, filter:null,  harmonics:[[2,0.08],[3,0.04]]},
  triangle: {attack:0.03, decay:0.15, sustain:0.50, release:0.4,  gain:0.28, filter:null,  harmonics:[[2,0.18],[3,0.10],[4,0.05]]},
  square:   {attack:0.02, decay:0.08, sustain:0.40, release:0.3,  gain:0.12, filter:2000,  harmonics:[[2,0.30],[3,0.18],[4,0.10],[5,0.06]]},
  sawtooth: {attack:0.02, decay:0.12, sustain:0.45, release:0.3,  gain:0.10, filter:1800,  harmonics:[[2,0.35],[3,0.22],[4,0.14],[5,0.08],[6,0.04]]},
  // Piano: triangle fundamental + rich decaying harmonics, longer release
  piano:    {attack:0.008,decay:0.9,  sustain:0.12, release:2.0,  gain:0.32, filter:null,  harmonics:[[2,0.55],[3,0.30],[4,0.18],[5,0.10],[6,0.06],[7,0.03]]},
};

function scheduleNote(ctx, midi, startTime, dur, oscType, partVolume) {
  const vol     = partVolume ?? 1;
  const noteDur = Math.max(dur, 0.08);

  // ── Percussion: noise-based synthesis ─────────────────────────
  if (oscType === 'noise') {
    _schedulePercussion(ctx, midi, startTime, noteDur, vol);
    return;
  }

  const freq    = 440 * Math.pow(2, (midi - 69) / 12);
  const profile = SYNTH_PROFILES[oscType] || SYNTH_PROFILES.triangle;
  const relTime = startTime + Math.min(noteDur, noteDur * 0.9);
  // Stereo pan: higher notes → right, lower → left
  const pan = Math.max(-0.6, Math.min(0.6, (midi - 60) / 40));

  function makeOsc(freq, gainVal, type='sine') {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);

    const dest = APP.masterGain || ctx.destination;
    const rev  = APP.reverb || null;
    const effGain = gainVal * vol;

    if (profile.filter) {
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = profile.filter;
      gain.connect(filt);
      // Stereo panner
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = pan; filt.connect(panner); panner.connect(dest); }
      else { filt.connect(dest); }
      if (rev) { gain.connect(rev); }
    } else {
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) { panner.pan.value = pan; gain.connect(panner); panner.connect(dest); }
      else { gain.connect(dest); }
      if (rev) { gain.connect(rev); }
    }

    const a = profile.attack, d = profile.decay;
    const s = profile.sustain, r = profile.release;
    const endT = startTime + noteDur + r;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(effGain, startTime + a);
    gain.gain.exponentialRampToValueAtTime(Math.max(effGain * s, 0.001), startTime + a + d);
    gain.gain.setValueAtTime(Math.max(effGain * s, 0.001), relTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, endT);

    osc.start(startTime);
    osc.stop(endT + 0.05);
    if (APP._activeAudioNodes) APP._activeAudioNodes.push(osc);
  }

  // Fundamental
  makeOsc(freq, profile.gain, oscType === 'piano' ? 'triangle' : profile.osc || 'sine');
  // Harmonics
  (profile.harmonics || []).forEach(([n, rel]) => {
    makeOsc(freq * n, profile.gain * rel, 'sine');
  });
}

// Percussion synthesis using noise buffer + shaped envelopes
function _schedulePercussion(ctx, midi, startTime, dur, vol) {
  const dest = APP.masterGain || ctx.destination;
  const rev  = APP.reverb || null;

  // Create noise buffer (1 second of white noise)
  const bufSize = ctx.sampleRate;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const gain = ctx.createGain();
  const filt = ctx.createBiquadFilter();

  // Map MIDI pitch to drum voice (General MIDI percussion)
  // 35-36 = bass drum, 38-40 = snare, 42-46 = hi-hat, 49-52 = crash/tom, 60-62 = high bongo
  let effGain = 0.5 * vol;
  let filtFreq = 1000;
  let filtQ = 1;
  let decay = 0.15;
  let attack = 0.002;

  if (midi >= 35 && midi <= 36) {
    // Kick / bass drum
    filt.type = 'lowpass';
    filtFreq = 120;
    decay = 0.25;
    effGain = 0.7 * vol;
  } else if (midi >= 38 && midi <= 40) {
    // Snare
    filt.type = 'bandpass';
    filtFreq = 1800;
    filtQ = 2;
    decay = 0.18;
    effGain = 0.55 * vol;
  } else if (midi >= 42 && midi <= 46) {
    // Hi-hat (closed/open/pedal)
    filt.type = 'highpass';
    filtFreq = 7000;
    decay = midi === 46 ? 0.35 : 0.06; // open hat rings longer
    effGain = 0.35 * vol;
  } else if (midi >= 49 && midi <= 52) {
    // Crash / ride / tom
    filt.type = 'bandpass';
    filtFreq = 2500;
    decay = 0.5;
    effGain = 0.45 * vol;
  } else {
    // Generic percussion
    filt.type = 'bandpass';
    filtFreq = 800;
    decay = 0.2;
  }

  filt.frequency.value = filtFreq;
  filt.Q.value = filtQ;

  src.connect(filt);
  filt.connect(gain);
  gain.connect(dest);
  if (rev) gain.connect(rev);

  const endT = startTime + Math.max(dur, decay);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(effGain, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, endT);

  src.start(startTime);
  src.stop(endT + 0.02);
  if (APP._activeAudioNodes) APP._activeAudioNodes.push(src);
}

function toggleCountIn() {
  APP.countIn = !APP.countIn;
  const btn = document.getElementById('btn-countin');
  if (btn) btn.classList.toggle('active', APP.countIn);
  showToast(APP.countIn ? 'Count-in on (4 clicks)' : 'Count-in off');
}

function setMetronomeSubdivision(val) {
  APP.metronomeSubdivision = val;
  document.getElementById('met-subdivision').value = val;
  // Restart metronome if running to pick up new subdivision
  if (APP.metronome && !APP.playing) {
    _stopStandaloneMetronome();
    _startStandaloneMetronome();
  }
  showToast('Metronome: ' + val);
}

function toggleMetronome() {
  APP.metronome = !APP.metronome;
  const btn = document.getElementById('btn-metronome');
  if (btn) btn.classList.toggle('active', APP.metronome);

  if (APP.metronome) {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const beatDur = 60 / APP.tempo;

    if (APP.playing) {
      // Schedule metronome from next beat to end of currently scheduled playback
      const now = ctx.currentTime;
      const nextBeat = Math.ceil(now / beatDur) * beatDur;
      const totalMs = APP._playTotalMs || 0;
      const elapsedMs = Date.now() - (APP._playNoteStartAt || Date.now());
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      const remainingBeats = Math.ceil(remainingMs / (beatDur * 1000));
      for (let b = 0; b < remainingBeats; b++) {
        scheduleMetronomeClick(ctx, nextBeat + b * beatDur, b % 4 === 0);
      }
    } else {
      _startStandaloneMetronome(ctx, beatDur);
    }
  } else {
    _stopStandaloneMetronome();
    APP._metBeat = 0;
  }
  showToast(APP.metronome ? 'Metronome on' : 'Metronome off');
}

function _getSubdivisionInfo() {
  const sub = APP.metronomeSubdivision || 'quarter';
  const beatDur = 60 / APP.tempo;
  switch (sub) {
    case 'eighth':    return { count: 2, dur: beatDur / 2, accent: [true, false] };
    case 'triplet':   return { count: 3, dur: beatDur / 3, accent: [true, false, false] };
    case 'sixteenth': return { count: 4, dur: beatDur / 4, accent: [true, false, false, false] };
    default:          return { count: 1, dur: beatDur,      accent: [true] };
  }
}

function _startStandaloneMetronome(ctx, beatDur) {
  if (APP._metInterval) return;
  const bd = beatDur || 60 / APP.tempo;
  const subInfo = _getSubdivisionInfo();
  const stepDur = subInfo.dur;
  APP._metBeat = 0;
  APP._metSubIndex = 0;
  APP._metInterval = setInterval(() => {
    if (!APP.metronome) { _stopStandaloneMetronome(); return; }
    const ctx2 = ctx || getAudioCtx();
    const si = APP._metSubIndex;
    const accent = subInfo.accent[si % subInfo.count];
    scheduleMetronomeClick(ctx2, ctx2.currentTime + 0.02, accent, si % subInfo.count === 0 ? 1 : 0.5);
    APP._metSubIndex = (si + 1) % subInfo.count;
    if (si === subInfo.count - 1) APP._metBeat++;
  }, stepDur * 1000);
}

function _stopStandaloneMetronome() {
  if (APP._metInterval) { clearInterval(APP._metInterval); APP._metInterval = null; }
}

function scheduleMetronomeClick(ctx, time, accent, intensity = 1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = accent ? 1200 : 800;
  const vol = 0.35 * intensity;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain);
  gain.connect(APP.metronomeGain || ctx.destination);
  osc.start(time);
  osc.stop(time + 0.06);
  if (APP._activeAudioNodes) APP._activeAudioNodes.push(osc);
}

function playCountIn(ctx, beatDur, beats, baseTime) {
  const dest = APP.metronomeGain || APP.masterGain || ctx.destination;
  for (let i = 0; i < beats; i++) {
    const clickTime = baseTime + i * beatDur;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 0 ? 1200 : 880;
    gain.gain.setValueAtTime(0, clickTime);
    gain.gain.linearRampToValueAtTime(0.45, clickTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.06);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(clickTime);
    osc.stop(clickTime + 0.08);
    if (APP._activeAudioNodes) APP._activeAudioNodes.push(osc);
  }
}

function startPlayback() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  APP.playing = true;
  if (APP.masterGain) APP.masterGain.gain.value = APP.masterVolume;
  if (APP.metronomeGain) APP.metronomeGain.gain.value = APP.metronomeVolume;
  if (APP.reverbGain) APP.reverbGain.gain.value = 0.12;
  document.getElementById('play-icon').style.display = 'none';
  document.getElementById('pause-icon').style.display = '';

  const playOrder = buildPlaybackOrder(APP.score);
  APP._playOrder = playOrder; // cache for diagram animation
  const beatDur = 60 / APP.tempo;
  // Align to next beat boundary so music/count-in starts on the beat
  const baseTime = Math.ceil(ctx.currentTime / beatDur) * beatDur + 0.02;

  // Stop standalone metronome if running (playback will schedule its own)
  _stopStandaloneMetronome();

  let countInBeats = 0;
  if (APP.countIn) {
    const ts = resolvedTimeSig(0, 0);
    const beatsPerMeasure = ts.num * (4 / ts.den);
    const firstM = APP.score.parts[0].staves[0].measures[0];
    if (firstM?.pickup) {
      const used = beatsUsed(firstM.notes);
      const extraBeats = beatsPerMeasure - Math.max(used, 0);
      countInBeats = beatsPerMeasure + Math.max(0, extraBeats);
    } else {
      countInBeats = beatsPerMeasure;
    }
  }
  const countInOffset = countInBeats * beatDur;
  let maxT = baseTime + countInOffset;

  // Build note timeline for playback cursor
  APP.playNoteTimeline = [];
  const refNotes = APP.score.parts[0].staves[0].measures;
  let noteMs = 0;
  playOrder.forEach(mi => {
    const m = refNotes[mi];
    if (!m) return;
    m.notes.forEach((n, ni) => {
      const beats = durBeats(n.duration, n.dots, n.tuplet);
      const durMs = beats * beatDur * 1000;
      APP.playNoteTimeline.push({mi, ni, startMs: noteMs, durMs, isNote: n.type === 'note'});
      noteMs += durMs;
    });
  });

  if (APP.countIn) playCountIn(ctx, beatDur, countInBeats, baseTime);

  if (APP.metronome) {
    const subInfo = _getSubdivisionInfo();
    let beatT = baseTime + countInOffset;
    playOrder.forEach(mi => {
      const cap = measureBeatsCapacity(mi, 0);
      for (let b = 0; b < cap; b++) {
        for (let s = 0; s < subInfo.count; s++) {
          const accent = subInfo.accent[s];
          const intensity = s === 0 ? 1 : 0.5;
          scheduleMetronomeClick(ctx, beatT + s * subInfo.dur, accent, intensity);
        }
        beatT += beatDur;
      }
    });
  }

  // Play ALL staves of each part (so piano bass clef is heard)
  APP.score.parts.forEach(part => {
    if (part.muted) return;
    const oscType = (part.instrument === 'Piano' || part.instrument === 'Harpsichord' || part.instrument === 'Organ')
      ? 'piano' : (part.osc || 'triangle');

    part.staves.forEach((stave, localSI) => {
      let gsi = 0;
      for (let p = 0; p < APP.score.parts.indexOf(part); p++) gsi += APP.score.parts[p].staves.length;
      const si = gsi + localSI;

      let t = baseTime + countInOffset;
      playOrder.forEach(mi => {
        const m = stave.measures[mi];
        if (!m) return;
        m.notes.forEach((n, ni) => {
          const beats = durBeats(n.duration, n.dots, n.tuplet);
          const dur   = beats * beatDur;
          if (n.type === 'note') {
            const chordPitches = [n.pitch, ...(n.extraPitches || []).map(ep => ep.pitch)];
            const chordVol = (part.volume || 1) / Math.sqrt(chordPitches.length);
            chordPitches.forEach(p => scheduleNote(ctx, p, t, dur * 0.88, oscType, chordVol));
          }
          t += dur;
        });
      });
      if (t > maxT) maxT = t;
    });
  });

  const totalMs = (maxT - ctx.currentTime - countInOffset) * 1000;
  // Store total continuous width for playback auto-scroll
  APP._playTotalMs = totalMs;
  if (APP.continuousView) {
    const container = document.getElementById('score-svg');
    APP._playTotalWidth = container ? Math.max(container.scrollWidth - container.clientWidth, 1) : 0;
  } else {
    APP._playTotalWidth = 0;
  }
  APP.playTimers.push(setTimeout(stopPlayback, totalMs + 200));

  const startAt = Date.now();
  const noteStartAt = startAt + countInOffset * 1000;
  APP._playNoteStartAt = noteStartAt;

  // Start continuous rAF-based horizontal scroll for continuous view
  if (APP.continuousView && APP._playTotalWidth > 0) {
    const cont = document.getElementById('score-svg');
    if (cont) {
      function scrollTick() {
        if (!APP.playing || !APP.continuousView) return;
        const elapsed = Date.now() - APP._playNoteStartAt;
        if (elapsed > 0) {
          const ratio = Math.min(elapsed / APP._playTotalMs, 1);
          const target = Math.max(0, ratio * APP._playTotalWidth);
          const cur = cont.scrollLeft || 0;
          const diff = target - cur;
          // Keep a small gap so the scroll feels responsive but smooth
          if (Math.abs(diff) > 1) {
            cont.scrollLeft = cur + diff * 0.22;
            positionAllDiagrams();
          }
        }
        APP._playScrollRAF = requestAnimationFrame(scrollTick);
      }
      APP._playScrollRAF = requestAnimationFrame(scrollTick);
    }
  }

  function tick() {
    if (!APP.playing) return;
    const elapsed = (Date.now() - startAt) / 1000;
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60).toString().padStart(2,'0');
    document.getElementById('play-pos').textContent = `${m}:${s}`;
    // Update playback cursor
    const cursorElapsed = Date.now() - noteStartAt;
    if (cursorElapsed >= 0) updatePlayCursor(cursorElapsed);
    _updatePlaybackDiagrams(cursorElapsed);
    APP.playTimers.push(setTimeout(tick, 200));
  }
  tick();
}

function stopPlayback() {
  APP.playing = false;
  clearPlayCursor();
  if (APP._playScrollRAF) cancelAnimationFrame(APP._playScrollRAF);
  // Stop all active audio nodes (oscillators, buffer sources) to prevent orphaned nodes
  if (APP._activeAudioNodes) {
    APP._activeAudioNodes.forEach(node => {
      try { node.stop(); } catch(e) { /* already stopped */ }
      try { node.disconnect(); } catch(e) { /* already disconnected */ }
    });
    APP._activeAudioNodes = [];
  }
  if (APP.masterGain) APP.masterGain.gain.value = 0;
  if (APP.metronomeGain) APP.metronomeGain.gain.value = 0;
  if (APP.reverbGain) APP.reverbGain.gain.value = 0;
  document.getElementById('play-icon').style.display = '';
  document.getElementById('pause-icon').style.display = 'none';
  document.getElementById('play-pos').textContent = '0:00';
  APP.playTimers.forEach(clearTimeout);
  APP.playTimers = [];
  // Restart standalone metronome if toggle is still on
  if (APP.metronome && !APP._metInterval) _startStandaloneMetronome();
}

// ── Playback Diagram Animation ─────────────────────────────────
// Finds the note on a given staff at the current playback elapsed time.
function _findNoteAtPlaybackTime(elapsedMs, staff, playOrder) {
  const beatDur = 60 / APP.tempo;
  let t = 0;
  for (const mi of playOrder) {
    const m = staff.measures[mi];
    if (!m) continue;
    for (let ni = 0; ni < m.notes.length; ni++) {
      const n = m.notes[ni];
      const dur = durBeats(n.duration, n.dots, n.tuplet) * beatDur * 1000;
      if (elapsedMs >= t && elapsedMs < t + dur) {
        return { mi, ni, note: n };
      }
      t += dur;
    }
  }
  return null;
}

function _updatePlaybackDiagrams(elapsedMs) {
  if (!APP.score || !APP._playOrder) return;
  const prevMi = APP.selectedMeasure;
  const prevNi = APP.selectedNoteIdx;
  const prevSi = APP.selectedStaff;

  let gsi = 0;
  for (const part of APP.score.parts) {
    for (let s = 0; s < part.staves.length; s++) {
      const si = gsi + s;
      const instr = getInstrForSI(si);
      if (!instr || (!instr.recorder && !instr.woodwind && !instr.brass)) {
        continue;
      }
      const active = _findNoteAtPlaybackTime(elapsedMs, part.staves[s], APP._playOrder);
      if (active && active.note.type === 'note') {
        APP.selectedMeasure = active.mi;
        APP.selectedNoteIdx = active.ni;
        APP.selectedStaff = si;
        if (instr.recorder) updateRecorderDiagram();
        else if (instr.woodwind) updateWoodwindDiagram();
        else if (instr.brass) updateBrassDiagram();
      }
    }
    gsi += part.staves.length;
  }

  APP.selectedMeasure = prevMi;
  APP.selectedNoteIdx = prevNi;
  APP.selectedStaff = prevSi;
}

function updatePlayCursor(elapsedMs) {
  if (!APP.playNoteTimeline || !APP.playNoteTimeline.length) return;

  const active = APP.playNoteTimeline.filter(n => n.isNote && elapsedMs >= n.startMs && elapsedMs < n.startMs + n.durMs);
  if (active.length === 0) { clearPlayCursor(); return; }
  // Build a key to detect changes
  const key = active.map(n => `${n.mi}:${n.ni}`).join(',');
  if (key !== APP._lastPlayKey && active[0]) {
    APP.selectedMeasure = active[0].mi;
    APP.selectedNoteIdx = active[0].ni;
    // In continuous view, auto-scroll handles the scrolling during playback
    if (!APP.continuousView) scrollToSelectedMeasure();
  }
  if (key === APP._lastPlayKey) return;
  APP._lastPlayKey = key;
  clearPlayCursor();
  const svg = document.getElementById('score-svg')?.querySelector('svg');
  if (!svg) return;
  active.forEach(n => {
    const layouts = APP.noteLayout.filter(l => l.mi === n.mi && l.ni === n.ni);
    layouts.forEach(nl => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
      dot.setAttribute('cx', nl.x);
      dot.setAttribute('cy', nl.y);
      dot.setAttribute('r', '6');
      dot.setAttribute('fill', 'rgba(192,86,33,0.45)');
      dot.setAttribute('stroke', '#c05621');
      dot.setAttribute('stroke-width', '1.2');
      dot.setAttribute('class', 'play-cursor');
      svg.appendChild(dot);
    });
  });
}
function clearPlayCursor() {
  document.querySelectorAll('.play-cursor').forEach(el => el.remove());
  APP._lastPlayKey = '';
}

// ── MIDI Hardware Input (removed — browser permission warning) ──

// ── EVALUATOR: Pure assessment functions (no side effects) ─────
// Takes target + student input, returns a diagnostic result object.
// No APP reads, no UI calls — just data in, data out.
const EVALUATOR = {
  // Note name lookup helpers
  _NOTE_NAMES: ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'],
  _FLAT_NAMES: ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'],

  _noteName(midi) {
    const pc = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    const useFlat = [1,3,6,8,10].includes(pc);
    return (useFlat ? this._FLAT_NAMES : this._NOTE_NAMES)[pc] + oct;
  },

  _pcName(pc) {
    const useFlat = [1,3,6,8,10].includes(pc);
    return (useFlat ? this._FLAT_NAMES : this._NOTE_NAMES)[pc];
  },

  // Core: evaluate a single note attempt against a target
  // target: { pitch: midi, extraPitches?: [{ pitch }] }
  // student: { pitch: midi }
  // Returns: { isPerfect, isCorrectPitchClass, assessment, message, detail }
  evaluateNote(target, student) {
    if (!target || !student || target.pitch == null || student.pitch == null) {
      return { isPerfect: false, isCorrectPitchClass: false, assessment: 'INVALID', message: 'No note to evaluate', detail: null };
    }

    const targetPC = target.pitch % 12;
    const studentPC = student.pitch % 12;
    const targetOct = Math.floor(target.pitch / 12) - 1;
    const studentOct = Math.floor(student.pitch / 12) - 1;
    const extras = (target.extraPitches || []).map(ep => ep.pitch % 12);
    const isCorrectPC = (targetPC === studentPC) || extras.includes(studentPC);
    const isExactMatch = student.pitch === target.pitch || (target.extraPitches || []).some(ep => ep.pitch === student.pitch);

    if (isExactMatch) {
      return {
        isPerfect: true,
        isCorrectPitchClass: true,
        assessment: 'CORRECT',
        message: `✓ ${this._noteName(student.pitch)}`,
        detail: null,
      };
    }

    if (isCorrectPC) {
      const displacement = studentOct - targetOct;
      return {
        isPerfect: false,
        isCorrectPitchClass: true,
        assessment: 'OCTAVE_DISPLACEMENT',
        message: `Right note, wrong octave`,
        detail: {
          target: this._noteName(target.pitch),
          student: this._noteName(student.pitch),
          displacement,
          hint: displacement > 0
            ? `Go down ${displacement} octave${displacement > 1 ? 's' : ''}`
            : `Go up ${Math.abs(displacement)} octave${Math.abs(displacement) > 1 ? 's' : ''}`,
        },
      };
    }

    // Check if it's a nearby note (semitone off)
    const semitoneDiff = Math.abs(studentPC - targetPC);
    const minDiff = Math.min(semitoneDiff, 12 - semitoneDiff);
    if (minDiff === 1) {
      const direction = ((studentPC - targetPC + 12) % 12) <= 6 ? 'up' : 'down';
      return {
        isPerfect: false,
        isCorrectPitchClass: false,
        assessment: 'NEAR_MISS',
        message: `${direction === 'up' ? '↑' : '↓'} One semitone ${direction}`,
        detail: {
          target: this._pcName(targetPC),
          student: this._pcName(studentPC),
          direction,
          hint: `The correct note is one semitone ${direction === 'up' ? 'down' : 'up'}`,
        },
      };
    }

    // Wrong note
    return {
      isPerfect: false,
      isCorrectPitchClass: false,
      assessment: 'WRONG_NOTE',
      message: `Expected ${this._pcName(targetPC)}`,
      detail: {
        target: this._noteName(target.pitch),
        student: this._noteName(student.pitch),
        hint: `Try ${this._pcName(targetPC)}${targetOct}`,
      },
    };
  },

  // Evaluate a pitch class match (for exercises — octave-agnostic)
  evaluatePitchClass(targetPC, studentPC) {
    if (targetPC === studentPC) {
      return { isCorrect: true, assessment: 'CORRECT', message: '✓' };
    }
    const diff = Math.abs(studentPC - targetPC);
    const minDiff = Math.min(diff, 12 - diff);
    if (minDiff === 1) {
      const dir = ((studentPC - targetPC + 12) % 12) <= 6 ? 'up' : 'down';
      return { isCorrect: false, assessment: 'NEAR_MISS', message: `One semitone ${dir}` };
    }
    return { isCorrect: false, assessment: 'WRONG_NOTE', message: `Expected ${this._pcName(targetPC)}` };
  },

  // Evaluate a rhythm attempt (beat positions vs expected)
  // expected: array of beat positions (e.g. [0, 0.5, 1, 2])
  // student: array of beat positions
  // tolerance: allowed deviation in beats (default 0.15)
  evaluateRhythm(expected, student, tolerance = 0.15) {
    if (!expected.length) return { isPerfect: true, correct: 0, total: 0, misses: [], extras: [] };
    const misses = [];
    const matched = new Set();
    expected.forEach(exp => {
      const found = student.findIndex((s, i) => !matched.has(i) && Math.abs(s - exp) <= tolerance);
      if (found >= 0) {
        matched.add(found);
      } else {
        misses.push(exp);
      }
    });
    const extras = student.filter((_, i) => !matched.has(i));
    const correct = expected.length - misses.length;
    return {
      isPerfect: misses.length === 0 && extras.length === 0,
      correct,
      total: expected.length,
      misses,
      extras,
      accuracy: Math.round((correct / expected.length) * 100),
    };
  },
};

// ── SESSION MANAGER: Adaptive difficulty & progression ──────────
// Tracks session scores and adapts difficulty based on performance.
// Provides review loops when performance is low, advances when high.

const SESSION_MANAGER = {
  _SESSION_KEY: 'pauta_session_history',
  _MAX_HISTORY: 50,

  // Load session history from localStorage
  _loadHistory() {
    try { return JSON.parse(localStorage.getItem(this._SESSION_KEY)) || []; }
    catch(e) { return []; }
  },

  // Save session history to localStorage
  _saveHistory(history) {
    localStorage.setItem(this._SESSION_KEY, JSON.stringify(history.slice(-this._MAX_HISTORY)));
  },

  // Record a completed session
  recordSession(type, difficulty, score, total, time) {
    const history = this._loadHistory();
    history.push({
      type, difficulty, score, total,
      pct: Math.round((score / total) * 100),
      time: Math.floor(time / 1000),
      date: Date.now(),
    });
    this._saveHistory(history);
    return this.getRecommendation(type);
  },

  // Get recommendation based on recent performance
  getRecommendation(type) {
    const history = this._loadHistory();
    const relevant = history.filter(h => h.type === type).slice(-5);
    if (relevant.length < 2) return { action: 'continue', reason: 'Need more data' };

    const avgPct = relevant.reduce((s, h) => s + h.pct, 0) / relevant.length;
    const lastPct = relevant[relevant.length - 1].pct;
    const trend = relevant.length >= 3
      ? (relevant[relevant.length - 1].pct + relevant[relevant.length - 2].pct) / 2
        - (relevant[0].pct + relevant[1].pct) / 2
      : 0;

    if (avgPct >= 85 && trend >= 0) {
      return { action: 'advance', reason: `Excellent (${Math.round(avgPct)}% avg)`, avgPct };
    }
    if (avgPct < 60 || (trend < -10 && lastPct < 70)) {
      return { action: 'review', reason: `Needs practice (${Math.round(avgPct)}% avg)`, avgPct };
    }
    return { action: 'continue', reason: `Good progress (${Math.round(avgPct)}% avg)`, avgPct };
  },

  // Get difficulty adjustment based on session performance
  adjustDifficulty(currentDifficulty, sessionPct) {
    const levels = ['beginner', 'intermediate', 'advanced'];
    const idx = levels.indexOf(currentDifficulty);

    // Upgrade threshold
    if (sessionPct >= 85 && idx < 2) {
      return { difficulty: levels[idx + 1], reason: 'Upgrading difficulty' };
    }
    // Downgrade threshold
    if (sessionPct < 50 && idx > 0) {
      return { difficulty: levels[idx - 1], reason: 'Reviewing at easier level' };
    }
    return { difficulty: currentDifficulty, reason: 'Maintaining level' };
  },

  // Get session stats for display
  getStats(type) {
    const history = this._loadHistory();
    const relevant = type ? history.filter(h => h.type === type) : history;
    if (!relevant.length) return null;

    const totalSessions = relevant.length;
    const avgPct = Math.round(relevant.reduce((s, h) => s + h.pct, 0) / totalSessions);
    const totalTime = relevant.reduce((s, h) => s + h.time, 0);
    const bestPct = Math.max(...relevant.map(h => h.pct));
    const currentStreak = this._getCurrentStreak(relevant);

    return { totalSessions, avgPct, totalTime, bestPct, currentStreak };
  },

  // Calculate current streak of improving scores
  _getCurrentStreak(history) {
    if (history.length < 2) return 0;
    let streak = 0;
    for (let i = history.length - 1; i > 0; i--) {
      if (history[i].pct >= history[i - 1].pct) streak++;
      else break;
    }
    return streak;
  },

  // ── Level & Completion History Persistence ─────────────────────
  _PROGRESS_KEY: 'pauta_level_progress',

  _loadProgress() {
    try { return JSON.parse(localStorage.getItem(this._PROGRESS_KEY)) || { level: 1, completionHistory: {}, bestScores: {} }; }
    catch(e) { return { level: 1, completionHistory: {}, bestScores: {} }; }
  },

  _saveProgress(progress) {
    localStorage.setItem(this._PROGRESS_KEY, JSON.stringify(progress));
  },

  // Get current level
  getLevel() {
    return this._loadProgress().level || 1;
  },

  // Set level
  setLevel(level) {
    const progress = this._loadProgress();
    progress.level = level;
    this._saveProgress(progress);
  },

  // Record exercise completion
  recordCompletion(exerciseType, score, total) {
    const progress = this._loadProgress();
    const pct = Math.round((score / total) * 100);

    if (!progress.completionHistory[exerciseType]) {
      progress.completionHistory[exerciseType] = [];
    }
    progress.completionHistory[exerciseType].push({
      score, total, pct,
      date: Date.now(),
    });

    // Update best score
    if (!progress.bestScores[exerciseType] || pct > progress.bestScores[exerciseType]) {
      progress.bestScores[exerciseType] = pct;
    }

    this._saveProgress(progress);
    return progress;
  },

  // Get completion history for an exercise type
  getCompletionHistory(exerciseType) {
    const progress = this._loadProgress();
    return progress.completionHistory[exerciseType] || [];
  },

  // Get best score for an exercise type
  getBestScore(exerciseType) {
    const progress = this._loadProgress();
    return progress.bestScores[exerciseType] || 0;
  },

  // Get all best scores
  getAllBestScores() {
    return this._loadProgress().bestScores || {};
  },

  // Check if user has mastered an exercise type (80%+ on 3+ sessions)
  hasMastered(exerciseType) {
    const history = this.getCompletionHistory(exerciseType);
    if (history.length < 3) return false;
    const recent = history.slice(-3);
    return recent.every(h => h.pct >= 80);
  },

  // Get mastery status for all exercise types
  getMasteryStatus() {
    const types = Object.values(EXERCISE_TYPES);
    const status = {};
    types.forEach(type => {
      status[type] = {
        mastered: this.hasMastered(type),
        bestScore: this.getBestScore(type),
        sessions: this.getCompletionHistory(type).length,
      };
    });
    return status;
  },

  // ── Audio Latency Calibration ──────────────────────────────────
  // Measures the difference between user click and audio engine timing.
  // Stores latencyOffset and applies it to rhythm evaluation.

  _LATENCY_KEY: 'pauta_latency_offset',
  _latencySamples: [],
  _calibrationActive: false,

  // Get stored latency offset (in milliseconds)
  getLatencyOffset() {
    try { return parseInt(localStorage.getItem(this._LATENCY_KEY)) || 0; }
    catch(e) { return 0; }
  },

  // Save latency offset
  _saveLatencyOffset(offset) {
    localStorage.setItem(this._LATENCY_KEY, String(Math.round(offset)));
  },

  // Start calibration session
  startCalibration() {
    this._latencySamples = [];
    this._calibrationActive = true;
    return {
      message: 'Tap the button in sync with the metronome beat',
      beatsNeeded: 8,
    };
  },

  // Record a calibration tap
  // expectedTime: audioContext.currentTime when the beat should have occurred
  // actualTime: audioContext.currentTime when the user tapped
  recordCalibrationTap(expectedTime, actualTime) {
    if (!this._calibrationActive) return null;

    const offset = (actualTime - expectedTime) * 1000; // Convert to ms
    this._latencySamples.push(offset);

    // Need at least 4 samples
    if (this._latencySamples.length < 4) {
      return { samples: this._latencySamples.length, needed: 4 };
    }

    // Calculate median offset (robust against outliers)
    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Save if reasonable (within ±200ms)
    if (Math.abs(median) <= 200) {
      this._saveLatencyOffset(median);
      this._calibrationActive = false;
      return {
        complete: true,
        offset: Math.round(median),
        message: `Calibrated: ${Math.round(median)}ms offset`,
      };
    }

    // Invalid calibration
    this._calibrationActive = false;
    return {
      complete: true,
      offset: 0,
      message: 'Calibration failed — offset too large. Using 0ms.',
    };
  },

  // Apply latency offset to a timestamp
  applyOffset(time) {
    const offset = this.getLatencyOffset();
    return time + (offset / 1000); // Convert ms to seconds
  },

  // Show calibration dialog
  showCalibrationDialog() {
    const result = this.startCalibration();
    let tapCount = 0;
    const totalBeats = result.beatsNeeded;

    makeModal(`
      <h2>Audio Latency Calibration</h2>
      <p style="color:#4a5568;font-size:13px;margin-bottom:12px;text-align:center">
        ${result.message}
      </p>
      <div style="text-align:center;margin-bottom:12px">
        <div id="cal-beat-display" style="font-size:48px;font-weight:700;color:#c05621;margin-bottom:8px">0/${totalBeats}</div>
        <div id="cal-tap-btn" style="width:80px;height:80px;border-radius:50%;background:#c05621;color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer;margin:0 auto;display:flex;align-items:center;justify-content:center">TAP</div>
      </div>
      <div id="cal-result" style="text-align:center;font-size:12px;color:#4a5568;min-height:20px"></div>
      <button class="modal-btn secondary" data-action="closeModal" style="margin-top:8px">Cancel</button>
    `);

    // Start metronome-like beat indicator
    let beatInterval = setInterval(() => {
      const display = document.getElementById('cal-beat-display');
      const btn = document.getElementById('cal-tap-btn');
      if (!display || !btn) { clearInterval(beatInterval); return; }

      tapCount++;
      display.textContent = `${tapCount}/${totalBeats}`;
      btn.style.background = '#22c55e';

      setTimeout(() => { btn.style.background = '#c05621'; }, 100);

      if (tapCount >= totalBeats) {
        clearInterval(beatInterval);
        const finalResult = this.recordCalibrationTap(0, 0);
        const resultEl = document.getElementById('cal-result');
        if (resultEl) {
          resultEl.textContent = finalResult?.message || 'Calibration complete';
          resultEl.style.color = '#22c55e';
        }
      }
    }, 1000); // 1 beat per second = 60 BPM

    // Handle tap button
    setTimeout(() => {
      const tapBtn = document.getElementById('cal-tap-btn');
      if (tapBtn) {
        tapBtn.addEventListener('click', () => {
          const now = getAudioCtx().currentTime;
          const offset = this.getLatencyOffset();
          this.recordCalibrationTap(now - (offset / 1000), now);
        });
      }
    }, 50);
  },
};

// ── Practice Mode ───────────────────────────────────────────────
// MIDI-gated playback: the student must play the correct note on
// a connected MIDI device before the score advances to the next note.
// Rests are skipped automatically. The current selection highlight
// shows the target note.

function togglePracticeMode() {
  if (APP.practiceMode) {
    _stopPracticeMode();
  } else {
    _startPracticeMode();
  }
}

function _startPracticeMode() {
  if (!APP.score) { showToast('Open or create a score first'); return; }
  APP.practiceMode = true;
  APP.practiceWaiting = true;
  stopPlayback();

  // Start at the beginning of the selected staff
  APP.selectedMeasure = 0;
  APP.selectedNoteIdx = -1;
  APP._practiceTargetPitch = null;

  const ok = _practiceAdvance();
  if (!ok) { APP.practiceMode = false; return; }

  showToast('Practice mode ON — play each highlighted note');
  const btn = document.getElementById('btn-practice');
  if (btn) btn.classList.add('active');
}

function _stopPracticeMode() {
  APP.practiceMode = false;
  APP.practiceWaiting = false;
  APP._practiceTargetPitch = null;
  const btn = document.getElementById('btn-practice');
  if (btn) btn.classList.remove('active');
  showToast('Practice mode OFF');
}

// Advance to the next non-rest note on the selected staff.
// Returns true if a note was found, false if end of score.
function _practiceAdvance() {
  if (!APP.practiceMode) return false;
  const stave = getStaveBySI(APP.selectedStaff);
  if (!stave || !stave.measures.length) {
    _stopPracticeMode();
    showToast('Practice complete!');
    return false;
  }

  let mi = APP.selectedMeasure;
  let ni = APP.selectedNoteIdx + 1;

  while (true) {
    const measure = stave.measures[mi];
    if (!measure || ni >= measure.notes.length) {
      mi++;
      ni = 0;
      if (mi >= stave.measures.length) {
        _stopPracticeMode();
        showToast('Practice complete!');
        return false;
      }
      continue;
    }
    const note = measure.notes[ni];
    if (note && note.type === 'note') {
      APP.selectedMeasure = mi;
      APP.selectedNoteIdx = ni;
      APP._practiceTargetPitch = note.pitch;
      renderScore();
      APP.practiceWaiting = true;
      return true;
    }
    // Skip rests, grace notes, etc.
    ni++;
  }
}

// Validate an incoming MIDI pitch against the target note.
// Uses EVALUATOR for pure assessment, then handles UI feedback.
function _checkPracticeNote(incomingPitch) {
  if (!APP.practiceMode || !APP.practiceWaiting) return;
  const measure = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure);
  const note = measure?.notes[APP.selectedNoteIdx];
  if (!note || note.type !== 'note') { _practiceAdvance(); return; }

  // Pure evaluation — no APP reads, no UI calls
  const assessment = EVALUATOR.evaluateNote(
    { pitch: note.pitch, extraPitches: note.extraPitches },
    { pitch: incomingPitch }
  );

  // Visual feedback on the score
  _showPracticeFeedback(assessment, note.pitch);

  if (assessment.isPerfect || assessment.isCorrectPitchClass) {
    // Correct (or correct pitch class, wrong octave) — advance
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    scheduleNote(ctx, note.pitch, ctx.currentTime, 0.35, 'sine', 1);
    _practiceAdvance();
  } else {
    // Wrong note — show diagnostic feedback
    showToast(assessment.message + (assessment.detail?.hint ? ` — ${assessment.detail.hint}` : ''), 1500);
  }
}

function _freqToMidi(freq) {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

// ── Practice Mode Visual Feedback ──────────────────────────────
// Applies visual feedback to notes based on EVALUATOR output.
// Uses SVG overlays on the score for immediate visual reinforcement.

function _showPracticeFeedback(assessment, targetPitch) {
  const container = document.getElementById('score-svg');
  if (!container) return;

  // Find the note position in the layout
  const nl = APP.noteLayout.find(l =>
    l.mi === APP.selectedMeasure && l.si === (APP.selectedStaff || 0) && l.ni === APP.selectedNoteIdx
  );
  if (!nl) return;

  // Determine color and class based on assessment
  let color, cls, label;
  switch (assessment.assessment) {
    case 'CORRECT':
      color = '#22c55e'; cls = 'correct'; label = '✓';
      break;
    case 'OCTAVE_DISPLACEMENT':
      color = '#e6a817'; cls = 'octave'; label = '↕ octave';
      break;
    case 'NEAR_MISS':
      color = '#f59e0b'; cls = 'near'; label = assessment.detail?.direction === 'up' ? '↑ semitone' : '↓ semitone';
      break;
    case 'WRONG_NOTE':
      color = '#e06850'; cls = 'wrong'; label = '✗';
      break;
    default:
      return;
  }

  // Create SVG feedback circle
  const svg = container.querySelector('svg');
  if (!svg) return;

  // Remove any existing practice feedback
  svg.querySelectorAll('.practice-feedback-circle').forEach(el => el.remove());

  // Draw feedback circle
  const circle = _svgCreate('circle', {
    cx: nl.x, cy: nl.y, r: 10,
    fill: 'none', stroke: color,
    'stroke-width': 2.5, opacity: 0.9,
    class: 'practice-feedback-circle',
  }, svg);

  // Add label text
  const text = _svgCreate('text', {
    x: nl.x, y: nl.y - 14,
    'text-anchor': 'middle',
    'font-family': "'Helvetica Neue',Helvetica,Arial,sans-serif",
    'font-size': 10, 'font-weight': 700,
    fill: color, opacity: 0.9,
    class: 'practice-feedback-circle',
  }, svg);
  text.textContent = label;

  // Auto-fade after 1 second
  setTimeout(() => {
    circle?.remove();
    text?.remove();
  }, 1000);
}
