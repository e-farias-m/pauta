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
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Format</div>
      <select id="export-format" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
        <option value="wav">WAV (lossless, large)</option>
        <option value="mp3">MP3 (compressed, smaller)</option>
      </select>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Tempo (BPM) — override</div>
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
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Page size</div>
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
    <div style="font-size:13px;color:var(--pauta-text-muted);line-height:1.5;margin-bottom:14px">
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
      dot.setAttribute('stroke', 'var(--pauta-primary)');
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

// ── Practice Mode ───────────────────────────────────────────────
// Microphone-gated playback: the student must play/sing the correct note
// before the score advances to the next note. Rests are skipped automatically.
// The current selection highlight shows the target note.
// Audio pitch detection uses autocorrelation on microphone input.

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

  // Init session stats
  APP._practiceStats = {
    correct: 0,
    incorrect: 0,
    octaveDisplacement: 0,
    nearMiss: 0,
    startTime: Date.now(),
    lastNoteTime: null,
    streak: 0,
    maxStreak: 0
  };

  // Start at the beginning of the selected staff
  APP.selectedMeasure = 0;
  APP.selectedNoteIdx = -1;
  APP._practiceTargetPitch = null;

  const ok = _practiceAdvance();
  if (!ok) { APP.practiceMode = false; return; }

  showToast('Practice mode ON — play each highlighted note');
  const btn = document.getElementById('btn-practice');
  if (btn) btn.classList.add('active');

  _updatePracticeStatusBar(true);
  _startPracticePitchDetection();
}

function _stopPracticeMode() {
  APP.practiceMode = false;
  APP.practiceWaiting = false;
  APP._practiceTargetPitch = null;
  const btn = document.getElementById('btn-practice');
  if (btn) btn.classList.remove('active');
  showToast('Practice mode OFF');
  _stopPracticePitchDetection();
  _updatePracticeStatusBar(false);
  _showPracticeResults();
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

  // Clear previous feedback
  const container = document.getElementById('score-svg');
  if (container) {
    const svg = container.querySelector('svg');
    if (svg) svg.querySelectorAll('.practice-feedback-circle').forEach(el => el.remove());
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

  // Update session stats
  const s = APP._practiceStats;
  if (s) {
    s.lastNoteTime = Date.now();
    if (assessment.assessment === 'CORRECT') {
      s.correct++;
      s.streak++;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
    } else if (assessment.assessment === 'OCTAVE_DISPLACEMENT') {
      s.octaveDisplacement++;
      s.incorrect++;
      s.streak = 0;
    } else if (assessment.assessment === 'NEAR_MISS') {
      s.nearMiss++;
      s.incorrect++;
      s.streak = 0;
    } else {
      s.incorrect++;
      s.streak = 0;
    }
    _renderPracticeStats();
  }

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
      color = 'var(--pauta-success)'; cls = 'correct'; label = '✓';
      break;
    case 'OCTAVE_DISPLACEMENT':
      color = 'var(--pauta-warning)'; cls = 'octave'; label = '↕ octave';
      break;
    case 'NEAR_MISS':
      color = '#f59e0b'; cls = 'near'; label = assessment.detail?.direction === 'up' ? '↑ semitone' : '↓ semitone';
      break;
    case 'WRONG_NOTE':
      color = 'var(--pauta-primary-light)'; cls = 'wrong'; label = '✗';
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
    'font-family': 'var(--pauta-font-sans)',
    'font-size': 10, 'font-weight': 700,
    fill: color, opacity: 0.9,
    class: 'practice-feedback-circle',
  }, svg);
  text.textContent = label;

  // Persist until next note (cleared in _practiceAdvance)
}

// ════════════════════════════════════════════════════════════════════
// Microphone Pitch Detection (for Practice Mode)
// ════════════════════════════════════════════════════════════════════

let _pitchDetectRAF = null;
let _pitchAnalyser = null;
let _pitchMediaStream = null;
let _pitchDetectCallback = null;
let _pitchLevelCallback = null;
let _pitchBuf = null;
let _pitchFreqBuf = null;

// Practice mode sensitivity (0.1–0.5, lower = more sensitive)
APP.practiceSensitivity = 0.3;

function startPitchDetection(pitchCallback, levelCallback) {
  if (_pitchDetectRAF) return; // already running
  _pitchDetectCallback = pitchCallback;
  _pitchLevelCallback = levelCallback;

  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } })
    .then(stream => {
      _pitchMediaStream = stream;
      const ctx = getAudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      _pitchAnalyser = ctx.createAnalyser();
      _pitchAnalyser.fftSize = 2048;
      _pitchAnalyser.smoothingTimeConstant = 0.3;
      source.connect(_pitchAnalyser);
      _pitchBuf = new Float32Array(_pitchAnalyser.fftSize);
      _pitchFreqBuf = new Float32Array(_pitchAnalyser.frequencyBinCount);
      _pitchDetectLoop();
    })
    .catch(err => {
      console.warn('Microphone access denied:', err);
      showToast('Microphone access required for pitch detection');
    });
}

function stopPitchDetection() {
  if (_pitchDetectRAF) {
    cancelAnimationFrame(_pitchDetectRAF);
    _pitchDetectRAF = null;
  }
  if (_pitchMediaStream) {
    _pitchMediaStream.getTracks().forEach(t => t.stop());
    _pitchMediaStream = null;
  }
  _pitchAnalyser = null;
  _pitchDetectCallback = null;
  _pitchLevelCallback = null;
  _pitchBuf = null;
  _pitchFreqBuf = null;
}

function _pitchDetectLoop() {
  if (!_pitchAnalyser || !_pitchBuf) return;

  // Time-domain for pitch detection
  _pitchAnalyser.getFloatTimeDomainData(_pitchBuf);
  const pitch = _autocorrelatePitch(_pitchBuf, getAudioCtx().sampleRate);
  if (pitch && _pitchDetectCallback) {
    const midi = Math.round(69 + 12 * Math.log2(pitch / 440));
    if (midi >= 24 && midi <= 108) _pitchDetectCallback(midi);
  }

  // Frequency-domain for mic level (RMS)
  if (_pitchLevelCallback && _pitchFreqBuf) {
    _pitchAnalyser.getFloatFrequencyData(_pitchFreqBuf);
    let sum = 0;
    for (let i = 0; i < _pitchFreqBuf.length; i++) sum += Math.pow(10, _pitchFreqBuf[i] / 10);
    const rmsDb = 10 * Math.log10(sum / _pitchFreqBuf.length);
    // Normalize: -60dB (silence) to 0dB (loud) → 0.0 to 1.0
    const level = Math.max(0, Math.min(1, (rmsDb + 60) / 60));
    _pitchLevelCallback(level);
  }

  _pitchDetectRAF = requestAnimationFrame(_pitchDetectLoop);
}

// Autocorrelation pitch detection (time domain) — accurate for monophonic audio
function _autocorrelatePitch(buf, sampleRate) {
  const len = buf.length;
  let bestR = 0, bestLag = 0;
  // Search range: ~65Hz (C2) to ~1000Hz (C6)
  const minLag = Math.floor(sampleRate / 1000);
  const maxLag = Math.floor(sampleRate / 65);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < len - lag; i++) sum += buf[i] * buf[i + lag];
    const r = sum / (len - lag);
    if (r > bestR) { bestR = r; bestLag = lag; }
  }
  if (bestR < (APP.practiceSensitivity || 0.3)) return null; // confidence threshold
  return sampleRate / bestLag;
}

// Integrate with practice mode
function _startPracticePitchDetection() {
  startPitchDetection(
    midi => { if (APP.practiceMode && APP.practiceWaiting) _checkPracticeNote(midi); },
    level => { _updatePracticeMicLevel(level); }
  );
}

function _stopPracticePitchDetection() {
  stopPitchDetection();
  _updatePracticeMicLevel(0);
}

function _updatePracticeMicLevel(level) {
  const bar = document.getElementById('practice-mic-level');
  if (bar) {
    bar.style.width = Math.round(level * 100) + '%';
    bar.style.background = level > 0.7 ? 'var(--pauta-success)' : level > 0.3 ? 'var(--pauta-warning)' : 'var(--pauta-primary)';
  }
}

function _updatePracticeStatusBar(active) {
  const el = document.getElementById('st-practice');
  const statsEl = document.getElementById('st-practice-stats');
  if (!el || !statsEl) return;
  if (active) {
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.style.gap = '4px';
    _renderPracticeStats();
  } else {
    el.style.display = 'none';
  }
}

function _renderPracticeStats() {
  const stats = APP._practiceStats;
  if (!stats) return;
  const total = stats.correct + stats.incorrect;
  const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const streak = stats.streak > 0 ? ` 🔥${stats.streak}` : '';
  document.getElementById('st-practice-stats').textContent = 
    `${stats.correct}/${total} (${accuracy}%) ${mm}:${ss}${streak}`;
}

function _showPracticeResults() {
  const stats = APP._practiceStats;
  if (!stats) return;
  const total = stats.correct + stats.incorrect;
  const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const details = [
    `✅ Correct: ${stats.correct}`,
    `❌ Incorrect: ${stats.incorrect}`,
    `↕ Octave: ${stats.octaveDisplacement}`,
    `↗↘ Near miss: ${stats.nearMiss}`,
    `🔥 Max streak: ${stats.maxStreak}`,
    `⏱ Time: ${mm}:${ss}`,
    `📊 Accuracy: ${accuracy}%`
  ].join('\n');

  showToast(`Practice complete! ${accuracy}% accuracy (${stats.correct}/${total})`, 5000);
  setTimeout(() => alert(`Practice Session Complete\n\n${details}`), 100);
}
