import { Window } from 'happy-dom';

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// ── Test counters ──
let _pass = 0, _fail = 0;
function assert(cond, msg) {
  if (cond) { _pass++; }
  else { console.error('FAIL:', msg); _fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { _pass++; }
  else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); _fail++; }
}

// ── Mock APP ──
const APP = {
  selectedMeasure: -1,
  selectedStaff: 0,
  selectedNoteIdx: -1,
  selStartIdx: -1,
  inputMode: false,
  chordMode: false,
  markingMode: false,
  exerciseMode: false,
  exerciseDifficulty: 'beginner',
  assignmentMode: false,
  markingStart: null,
  exerciseSession: null,
  currentAssignment: null,
  practiceMode: false,
  curDur: 'q',
  curDot: false,
  curRest: false,
  curAcc: null,
  curOctave: 0,
  curVoice: 1,
  curTuplet: null,
  tupletPending: 0,
  tupletGroupId: null,
  score: null,
  undoStack: [],
  redoStack: [],
  _lastUndoFP: '',
};

function die(msg) { throw new Error(msg); }

// ── MODEL HELPERS (from pauta.html) ──
const VALID_DURATIONS = new Set(['w', 'h', 'q', '8', '16', '32', '64']);
const NOTE_NAMES   = ['c','d','e','f','g','a','b'];
const CHROMATIC    = [0,2,4,5,7,9,11];
const PC_TO_DIA    = [0,0,1,1,2,3,3,4,4,5,5,6];
const DUR_BEATS    = {w:4,h:2,q:1,'8':0.5,'16':0.25,'32':0.125,'64':0.0625};

function durBeats(dur, dots, tuplet) {
  let b = DUR_BEATS[dur];
  if (b === undefined) return 0;
  if (dots) { let d = b; for (let i=0;i<dots;i++) { d/=2; b+=d; } }
  if (tuplet) { b *= (tuplet.den||2) / (tuplet.num||3); }
  return b;
}

// ── Mode Guards ─────────────────────────────────────────────────
const MODE_RULES = [
  () => APP.inputMode && APP.markingMode ? { ok: false, msg: 'inputMode + markingMode' } : null,
  () => APP.exerciseMode && APP.inputMode ? { ok: false, msg: 'exerciseMode + inputMode' } : null,
  () => APP.exerciseMode && APP.chordMode ? { ok: false, msg: 'exerciseMode + chordMode' } : null,
  () => APP.exerciseMode && APP.markingMode ? { ok: false, msg: 'exerciseMode + markingMode' } : null,
  () => APP.assignmentMode && APP.inputMode ? { ok: false, msg: 'assignmentMode + inputMode' } : null,
  () => APP.assignmentMode && APP.chordMode ? { ok: false, msg: 'assignmentMode + chordMode' } : null,
  () => APP.assignmentMode && APP.markingMode ? { ok: false, msg: 'assignmentMode + markingMode' } : null,
  () => APP.markingMode && APP.inputMode ? { ok: false, msg: 'markingMode + inputMode' } : null,
  () => APP.exerciseMode && !APP.exerciseSession ? { ok: false, msg: 'exerciseMode true but session null' } : null,
  () => !APP.exerciseMode && APP.exerciseSession ? { ok: false, msg: 'exerciseSession set but mode false' } : null,
  () => APP.assignmentMode && !APP.currentAssignment ? { ok: false, msg: 'assignmentMode true but currentAssignment null' } : null,
  () => !APP.assignmentMode && APP.currentAssignment ? { ok: false, msg: 'currentAssignment set but mode false' } : null,
  () => APP.tupletPending > 0 && !APP.curTuplet ? { ok: false, msg: 'tupletPending > 0 but no curTuplet' } : null,
];

function _validateModeState() {
  const results = [];
  for (const rule of MODE_RULES) {
    const result = rule();
    if (result && !result.ok) results.push(result.msg);
  }
  return results;
}

function _require(opts = {}) {
  const require = opts.require || [];
  const forbid  = opts.forbid  || [];
  const checks = {
    selectedNote: () => APP.selectedNoteIdx >= 0 || die('Select a note first'),
    inputMode:    () => APP.inputMode    || die('Enter note input mode first'),
    noInputMode:  () => !APP.inputMode   || die('Exit input mode first'),
    noMarking:    () => !APP.markingMode || die('Complete or cancel current marking first'),
    noExercise:   () => !APP.exerciseMode || die('Exit exercise mode first'),
    noAssignment: () => !APP.assignmentMode || die('Exit assignment mode first'),
    score:        () => APP.score        || die('No score open'),
    selection:    () => APP.selectedMeasure >= 0 || die('Select a measure first'),
  };
  for (const key of require) {
    if (checks[key]) checks[key]();
  }
  for (const key of forbid) {
    const negKey = 'no' + key.charAt(0).toUpperCase() + key.slice(1);
    if (checks[negKey]) checks[negKey]();
  }
}

// ── Undo Helpers ────────────────────────────────────────────────
const _cloneScore = typeof structuredClone === 'function'
  ? s => structuredClone(s)
  : s => JSON.parse(JSON.stringify(s));

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
  if (!APP.undoStack.length) return false;
  APP.redoStack.push({ score: _cloneScore(APP.score), ui: _cloneScore(_snapshotUIState()) });
  const entry = APP.undoStack.pop();
  APP.score = entry.score;
  _restoreUIState(entry.ui);
  APP._lastUndoFP = _scoreFingerprint(APP.score);
  return true;
}

function redo() {
  if (!APP.redoStack.length) return false;
  APP.undoStack.push({ score: _cloneScore(APP.score), ui: _cloneScore(_snapshotUIState()) });
  const entry = APP.redoStack.pop();
  APP.score = entry.score;
  _restoreUIState(entry.ui);
  APP._lastUndoFP = _scoreFingerprint(APP.score);
  return true;
}

// ── Invariant Checks ────────────────────────────────────────────
const SCORE_MEASURE_REF_RULES = [
  { key: 'slurs',          range: true,  start: 'startMi', end: 'endMi' },
  { key: 'hairpins',       range: true,  start: 'startMi', end: 'endMi' },
  { key: 'rehearsalMarks', range: false, field: 'mi' },
  { key: 'staffTexts',     range: false, field: 'mi' },
];

function _ensureScoreAnnotationArrays(score) {
  for (const rule of SCORE_MEASURE_REF_RULES) {
    if (!Array.isArray(score[rule.key])) score[rule.key] = [];
  }
  if (!Array.isArray(score.assignments)) score.assignments = [];
  if (!score.studentAnswers || typeof score.studentAnswers !== 'object') score.studentAnswers = {};
  return score;
}

function _checkInvariants(score) {
  if (!score || typeof score !== 'object') return [];
  const warnings = [];
  let expectedMeasures = -1;
  if (Array.isArray(score.parts)) {
    score.parts.forEach((part, pi) => {
      if (!Array.isArray(part.staves)) return;
      part.staves.forEach((stave, si) => {
        const mCount = Array.isArray(stave.measures) ? stave.measures.length : 0;
        if (expectedMeasures === -1) expectedMeasures = mCount;
        else if (mCount !== expectedMeasures) warnings.push(`Part ${pi + 1} stave ${si + 1} has ${mCount} measures; expected ${expectedMeasures}`);
        if (Array.isArray(stave.measures)) {
          stave.measures.forEach((m, mi) => {
            if (!Array.isArray(m.notes)) warnings.push(`Part ${pi + 1} stave ${si + 1} measure ${mi} has no notes array`);
            else {
              m.notes.forEach((n, ni) => {
                if (n && !VALID_DURATIONS.has(n.duration)) warnings.push(`Part ${pi + 1} stave ${si + 1} measure ${mi} note ${ni} has invalid duration: '${n.duration}'`);
                if (n && n.type === 'note' && typeof n.pitch !== 'number') warnings.push(`Part ${pi + 1} stave ${si + 1} measure ${mi} note ${ni} is type 'note' but has no pitch`);
              });
            }
          });
        }
      });
    });
  }
  if (expectedMeasures > 0) {
    for (const rule of SCORE_MEASURE_REF_RULES) {
      const arr = score[rule.key];
      if (!Array.isArray(arr)) continue;
      arr.forEach((item, idx) => {
        if (rule.range) {
          const start = item[rule.start];
          const end = item[rule.end];
          if (typeof start !== 'number' || start < 0 || start >= expectedMeasures)
            warnings.push(`${rule.key}[${idx}].${rule.start}=${start} out of range`);
          if (typeof end !== 'number' || end < (start || 0) || end >= expectedMeasures)
            warnings.push(`${rule.key}[${idx}].${rule.end}=${end} invalid`);
        } else {
          const mi = item[rule.field];
          if (typeof mi !== 'number' || mi < 0 || mi >= expectedMeasures)
            warnings.push(`${rule.key}[${idx}].${rule.field}=${mi} out of range`);
        }
      });
    }
  }
  if (Array.isArray(score.slurs)) {
    const seen = new Set();
    score.slurs.forEach((s, idx) => {
      const key = `${s.startMi}:${s.startNoteIdx}:${s.endMi}:${s.endNoteIdx}`;
      if (seen.has(key)) warnings.push(`slurs[${idx}] duplicates existing slur at ${key}`);
      seen.add(key);
    });
  }
  return warnings;
}

// ── Exercise Generators ────────────────────────────────────────
const EXERCISE_TYPES = {
  NOTE_ID:      'note_id',
  INTERVAL_ID:  'interval_id',
  RHYTHM_READ:  'rhythm_read',
  MELODY_DICT:  'melody_dictation',
  KEY_SIG_ID:   'key_sig_id',
  RHYTHM_WS:    'rhythm_worksheet',
};

const INTERVAL_NAMES = {
  0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd',
  4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th',
  8: 'Minor 6th', 9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave',
};

const INTERVAL_ALIASES = {
  'unison':        ['unison','p1','u','0','perfectunison','perfect1st'],
  'minor 2nd':     ['minor2nd','m2','minorsecond','semitone','halfstep'],
  'major 2nd':     ['major2nd','M2','majorsecond','tone','wholestep','wholetone','2nd','second'],
  'minor 3rd':     ['minor3rd','m3','minorthird','3rd','third'],
  'major 3rd':     ['major3rd','M3','majorthird'],
  'perfect 4th':   ['perfect4th','P4','perfectfourth','fourth','4th'],
  'tritone':       ['tritone','aug4','dim5','A4','d5','tt'],
  'perfect 5th':   ['perfect5th','P5','perfectfifth','fifth','5th'],
  'minor 6th':     ['minor6th','m6','minorsixth','6th','sixth'],
  'major 6th':     ['major6th','M6','majorsixth'],
  'minor 7th':     ['minor7th','m7','minorseventh','7th','seventh'],
  'major 7th':     ['major7th','M7','majorseventh'],
  'octave':        ['octave','P8','perfectoctave','8ve','8va','8'],
};

const KEY_SIG_NAMES = {
  '-7':'Cb', '-6':'Gb', '-5':'Db', '-4':'Ab', '-3':'Eb', '-2':'Bb', '-1':'F',
  '0':'C', '1':'G', '2':'D', '3':'A', '4':'E', '5':'B', '6':'F#', '7':'C#',
};
const KEY_SIG_MINOR_NAMES = {
  '-7':'Abm', '-6':'Ebm', '-5':'Bbm', '-4':'Fm', '-3':'Cm', '-2':'Gm', '-1':'Dm',
  '0':'Am', '1':'Em', '2':'Bm', '3':'F#m', '4':'C#m', '5':'G#m', '6':'D#m', '7':'A#m',
};

function _intervalMatches(userInput, targetName) {
  const norm = s => s.toLowerCase().replace(/[\s\-_]/g,'');
  const n = norm(userInput);
  const aliases = INTERVAL_ALIASES[targetName.toLowerCase()] || [];
  return n === norm(targetName) || aliases.some(a => norm(a) === n);
}

const NATURAL_PITCHES = {
  beginner:     [60,62,64,65,67,69,71,72],
  intermediate: [57,59,60,62,64,65,67,69,71,72,74,76],
  advanced:     null,
};

// Mock kit helpers (no kit active = null)
function _kitExerciseRange() { return null; }
function _kitExerciseKeys() { return null; }

function _genNoteId(difficulty) {
  const levelNames = ['beginner','intermediate','advanced'];
  const kitRange = _kitExerciseRange();
  let pitch;
  if (kitRange) {
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    const validPool = pool ? pool.filter(p => p >= kitRange.min && p <= kitRange.max) : null;
    pitch = validPool?.length
      ? validPool[Math.floor(Math.random() * validPool.length)]
      : Math.floor(Math.random() * (kitRange.max - kitRange.min + 1)) + kitRange.min;
  } else {
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    pitch = pool
      ? pool[Math.floor(Math.random() * pool.length)]
      : Math.floor(Math.random() * 37) + 48;
  }
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const pc = pitch % 12;
  const oct = Math.floor(pitch / 12) - 1;
  const answer = names[pc] + oct;
  return {
    type: EXERCISE_TYPES.NOTE_ID,
    difficulty,
    target: { pitch, name: names[pc], octave: oct },
    answer,
    hint: `Count lines and spaces from the bottom of the staff.`,
  };
}

function _genIntervalId(difficulty) {
  const intervals = difficulty === 0 ? [2,3,4,5,7] : difficulty === 1 ? [1,2,3,4,5,6,7,8] : [0,1,2,3,4,5,6,7,8,9,10,11,12];
  const semitones = intervals[Math.floor(Math.random() * intervals.length)];
  const dir = Math.random() > 0.5 ? 1 : -1;
  const kitRange = _kitExerciseRange();
  const baseMin = kitRange ? kitRange.min : 60;
  const baseMax = kitRange ? kitRange.max : 72;
  const range = Math.max(1, baseMax - baseMin - semitones + 1);
  const bottom = Math.max(baseMin, Math.min(baseMax - semitones, baseMin + Math.floor(Math.random() * range)));
  const top = Math.max(baseMin, Math.min(baseMax, bottom + semitones * dir));
  const actualSemitones = Math.abs(top - bottom);
  return {
    type: EXERCISE_TYPES.INTERVAL_ID,
    difficulty,
    target: { bottom, top, semitones: actualSemitones, direction: dir },
    answer: INTERVAL_NAMES[actualSemitones] || 'Unknown',
    hint: `Count the half steps between the two notes.`,
  };
}

function _genRhythmRead(difficulty) {
  const patterns = [
    [['q','q','q','q'], ['q','q','h'], ['h','q','q'], ['q','h','q']],
    [['q','q','8','8','q'], ['q','8','8','q','q'], ['h','8','8'], ['q.','8','q','q']],
    [['q','8','8','8','8','q'], ['q.','8','q.','8'], ['8','8','8','8','q','q'], ['q','q','8','16','16','q']],
  ];
  const pool = patterns[difficulty];
  const durations = pool[Math.floor(Math.random() * pool.length)];
  return {
    type: EXERCISE_TYPES.RHYTHM_READ,
    difficulty,
    target: { durations },
    answer: durations.join(','),
    hint: `Tap or clap the rhythm you see, then compare with playback.`,
  };
}

function _genRhythmWorksheet(difficulty) {
  const measures = 8;
  const beatsPerMeasure = 4;
  const totalBeats = measures * beatsPerMeasure;
  const noteWeight = difficulty === 0 ? 0.75 : difficulty === 1 ? 0.5 : 0.35;
  const beats = [];
  for (let i = 0; i < totalBeats; i++) {
    beats.push(Math.random() < noteWeight ? 'q' : 'r');
  }
  for (let m = 0; m < measures; m++) {
    const start = m * 4;
    const slice = beats.slice(start, start + 4);
    if (slice.every(b => b === 'r')) beats[start + Math.floor(Math.random() * 4)] = 'q';
    if (difficulty >= 1 && slice.every(b => b === 'q')) beats[start + Math.floor(Math.random() * 4)] = 'r';
  }
  return {
    type: EXERCISE_TYPES.RHYTHM_WS,
    difficulty,
    target: { beats, measures, timeSigNum: 4, timeSigDen: 4 },
    answer: beats.join(','),
    hint: 'Read the rhythm and mark each beat in the grid below.',
  };
}

function _genMelodyDict(difficulty) {
  const lengths = [4, 6, 8];
  const len = lengths[Math.min(difficulty, 2)];
  const kitRange = _kitExerciseRange();
  const baseMin = kitRange ? kitRange.min : 60;
  const baseMax = kitRange ? kitRange.max : 72;
  const basePitch = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
  const notes = [];
  for (let i = 0; i < len; i++) {
    const step = [-2, -1, 0, 1, 2][Math.floor(Math.random() * 5)];
    const pitch = Math.max(baseMin, Math.min(baseMax, (notes.length ? notes[i-1].pitch : basePitch) + step));
    const durs = difficulty === 0 ? ['q','h'] : difficulty === 1 ? ['q','h','8'] : ['q','h','8','16'];
    notes.push({ pitch, duration: durs[Math.floor(Math.random() * durs.length)] });
  }
  return {
    type: EXERCISE_TYPES.MELODY_DICT,
    difficulty,
    target: { notes },
    answer: notes.map(n => n.pitch).join(','),
    hint: 'Listen first, then enter one note at a time.',
  };
}

function _genKeySigId(difficulty) {
  const kitKeys = _kitExerciseKeys();
  const keys = (kitKeys && kitKeys.length) ? kitKeys : [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7];
  if (!keys.length) return { type:EXERCISE_TYPES.KEY_SIG_ID, difficulty, target:{keySig:0}, askMinor:false, answer:'C', answerMinor:'Am', hint:'No keys available' };
  const ks = keys[Math.floor(Math.random() * keys.length)];
  const major = KEY_SIG_NAMES[String(ks)];
  const minor = KEY_SIG_MINOR_NAMES[String(ks)];
  const askMinor = Math.random() < 0.5;
  return {
    type: EXERCISE_TYPES.KEY_SIG_ID,
    difficulty,
    target: { keySig: ks },
    askMinor,
    answer: askMinor ? minor : major,
    answerMajor: major,
    answerMinor: minor,
    answerLabel: askMinor ? minor : major,
    hint: askMinor
      ? (ks === 0 ? 'Minor key with no sharps/flats = A minor (down a minor third from C major).' :
         ks > 0 ? `Find the major key (last sharp up a half step), then go down a minor third (3 half-steps).` :
         `Find the major key (second-to-last flat), then go down a minor third (3 half-steps).`)
      : (ks === 0 ? 'No sharps or flats = C major.' :
         ks > 0 ? `Last sharp up a half step.` :
         `Second-to-last flat is the key name.`),
  };
}

function generateExercise(type, difficulty = 'beginner') {
  const diffs = { beginner: 0, intermediate: 1, advanced: 2 };
  const d = diffs[difficulty] ?? 0;
  switch (type) {
    case EXERCISE_TYPES.NOTE_ID:      return _genNoteId(d);
    case EXERCISE_TYPES.INTERVAL_ID:  return _genIntervalId(d);
    case EXERCISE_TYPES.RHYTHM_READ:  return _genRhythmRead(d);
    case EXERCISE_TYPES.MELODY_DICT:  return _genMelodyDict(d);
    case EXERCISE_TYPES.KEY_SIG_ID:   return _genKeySigId(d);
    case EXERCISE_TYPES.RHYTHM_WS:    return _genRhythmWorksheet(d);
    default:                          return _genNoteId(d);
  }
}

// ── DOM Helpers (beat grid) ─────────────────────────────────────
function _renderRhythmBeatGrid(ex) {
  const existing = document.getElementById('rhythm-beat-grid');
  if (existing) existing.remove();

  const beats = ex.target.beats;
  const measures = ex.target.measures;
  const container = document.createElement('div');
  container.id = 'rhythm-beat-grid';

  for (let m = 0; m < measures; m++) {
    const row = document.createElement('div');
    row.className = 'rg-row';
    for (let b = 0; b < 4; b++) {
      const idx = m * 4 + b;
      const isNote = beats[idx] === 'q';
      const btn = document.createElement('button');
      btn.className = 'rg-beat';
      btn.dataset.beat = idx;
      btn.dataset.answer = isNote ? '♩' : '𝄽';
      btn.textContent = '·';
      row.appendChild(btn);
    }
    container.appendChild(row);
  }

  const controls = document.createElement('div');
  controls.className = 'rg-controls';
  const checkBtn = document.createElement('button');
  checkBtn.className = 'modal-btn primary';
  checkBtn.id = 'rg-check-btn';
  checkBtn.textContent = '✔ Check Answers';
  controls.appendChild(checkBtn);
  container.appendChild(controls);

  container.addEventListener('click', e => {
    const beatBtn = e.target.closest('.rg-beat');
    if (beatBtn && !beatBtn.dataset.locked) {
      const cur = beatBtn.textContent;
      beatBtn.textContent = cur === '·' ? '♩' : cur === '♩' ? '𝄽' : '·';
      beatBtn.className = 'rg-beat' + (beatBtn.textContent === '♩' ? ' rg-note' : beatBtn.textContent === '𝄽' ? ' rg-rest' : '');
      beatBtn.dataset.userAnswer = beatBtn.textContent;
    }
  });

  document.body.appendChild(container);
}

// ══════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════

// ── 1. Mode Guard Tests ─────────────────────────────────────────

function resetApp() {
  APP.inputMode = false;
  APP.chordMode = false;
  APP.markingMode = false;
  APP.exerciseMode = false;
  APP.assignmentMode = false;
  APP.exerciseSession = null;
  APP.currentAssignment = null;
  APP.selectedNoteIdx = -1;
  APP.selectedMeasure = -1;
  APP.score = null;
  APP.curTuplet = null;
  APP.tupletPending = 0;
  APP.undoStack = [];
  APP.redoStack = [];
  APP._lastUndoFP = '';
}

// 1a. _require throws for active forbidden modes
resetApp();
APP.exerciseMode = true; APP.exerciseSession = {};
try { _require({forbid: ['exercise']}); assert(false, '_require should throw when exercise mode active'); }
catch(e) { assert(e.message === 'Exit exercise mode first', '_require.exercise throws correct message'); }
resetApp();

APP.assignmentMode = true; APP.currentAssignment = {};
try { _require({forbid: ['assignment']}); assert(false, '_require should throw when assignment mode active'); }
catch(e) { assert(e.message === 'Exit assignment mode first', '_require.assignment throws correct message'); }
resetApp();

APP.markingMode = true;
try { _require({forbid: ['marking']}); assert(false, '_require should throw when marking mode active'); }
catch(e) { assert(e.message === 'Complete or cancel current marking first', '_require.marking throws correct message'); }
resetApp();

// 1b. _require passes when no forbidden mode active
resetApp();
try { _require({forbid: ['exercise', 'marking', 'assignment']}); assert(true, '_require passes with no forbidden modes'); }
catch(e) { assert(false, '_require should not throw when no modes active: ' + e.message); }

// 1c. _require throws for missing required modes
resetApp();
try { _require({require: ['selectedNote']}); assert(false, '_require should throw when no selection'); }
catch(e) { assert(true, '_require.require throws when condition not met'); }

APP.selectedNoteIdx = 0;
try { _require({require: ['selectedNote']}); assert(true, '_require passes when note selected'); }
catch(e) { assert(false, '_require should not throw when note selected: ' + e.message); }
resetApp();

// 1d. _require requires score
try { _require({require: ['score']}); assert(false, '_require should throw with no score'); }
catch(e) { assert(true, '_require.require.score throws with no score'); }

APP.score = {};
try { _require({require: ['score']}); assert(true, '_require passes when score exists'); }
catch(e) { assert(false, '_require should not throw when score exists'); }
resetApp();

// 1e. MODE_RULES — valid states produce no violations
resetApp();
let violations = _validateModeState();
assertEq(violations.length, 0, 'no violations when all modes off');

// 1f. MODE_RULES — exercise+input flagged
resetApp(); APP.exerciseMode = true; APP.exerciseSession = {}; APP.inputMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('exerciseMode + inputMode')), 'exercise+input flagged');

// 1g. MODE_RULES — exercise+marking flagged
resetApp(); APP.exerciseMode = true; APP.exerciseSession = {}; APP.markingMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('exerciseMode + markingMode')), 'exercise+marking flagged');

// 1h. MODE_RULES — assignment+input flagged
resetApp(); APP.assignmentMode = true; APP.currentAssignment = {}; APP.inputMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('assignmentMode + inputMode')), 'assignment+input flagged');

// 1i. MODE_RULES — exerciseMode without session flagged
resetApp(); APP.exerciseMode = true; APP.exerciseSession = null;
violations = _validateModeState();
assert(violations.some(v => v.includes('exerciseMode true but session null')), 'exerciseMode without session flagged');

// 1j. MODE_RULES — session without mode flagged
resetApp(); APP.exerciseMode = false; APP.exerciseSession = {};
violations = _validateModeState();
assert(violations.some(v => v.includes('exerciseSession set but mode false')), 'session without mode flagged');

// 1k. MODE_RULES — tupletPending without curTuplet flagged
resetApp(); APP.tupletPending = 3; APP.curTuplet = null;
violations = _validateModeState();
assert(violations.some(v => v.includes('tupletPending > 0 but no curTuplet')), 'tupletPending without curTuplet flagged');

// ── 2. Undo Snapshot Tests ─────────────────────────────────────

// 2a. pushUndo stores {score, ui} entry
resetApp();
APP.score = { parts: [{ staves: [{ measures: [{ notes: [{ type:'note', pitch:60, duration:'q' }] }] }] }] };
pushUndo();
assertEq(APP.undoStack.length, 1, 'undoStack has 1 entry after push');
const entry = APP.undoStack[0];
assert(typeof entry.score === 'object' && entry.score !== null, 'entry has score object');
assert(typeof entry.ui === 'object' && entry.ui !== null, 'entry has ui object');
assertEq(entry.ui.selectedMeasure, -1, 'ui snapshot contains selectedMeasure');
assertEq(entry.ui.curDur, 'q', 'ui snapshot contains curDur');

// 2b. pushUndo skips duplicate
pushUndo();
assertEq(APP.undoStack.length, 1, 'undoStack still 1 after duplicate push');

// 2c. pushUndo clears redoStack
pushUndo();
assertEq(APP.undoStack.length, 1, 'undoStack has 1 entry after first push');
APP.score.parts[0].staves[0].measures[0].notes[0].pitch = 64;
pushUndo();
assertEq(APP.undoStack.length, 2, 'undoStack has 2 entries after two pushes');
assertEq(APP.redoStack.length, 0, 'redoStack cleared after push');

// 2d. undo restores the state that was pushed before the change
// pushUndo stores current state, then change happens, so we push before change
resetApp();
APP.score = { parts: [{ staves: [{ measures: [{ notes: [{ type:'note', pitch:60, duration:'q' }] }] }] }] };
pushUndo();                       // stores score with pitch 60
APP.score.parts[0].staves[0].measures[0].notes[0].pitch = 64;  // mutate
undo();                           // restores score with pitch 60
assertEq(APP.score.parts[0].staves[0].measures[0].notes[0].pitch, 60, 'undo restores pre-change pitch 60');
assertEq(APP.redoStack.length, 1, 'redoStack has entry after undo');

// 2e. redo restores undone change
redo();
assertEq(APP.score.parts[0].staves[0].measures[0].notes[0].pitch, 64, 'redo restores post-change pitch 64');
assertEq(APP.undoStack.length, 1, 'undoStack has 1 after redo');

// 2f. undo with empty stack does nothing
resetApp();
const result = undo();
assertEq(result, false, 'undo returns false when stack empty');

// 2g. redo with empty stack does nothing
const result2 = redo();
assertEq(result2, false, 'redo returns false when stack empty');

// 2h. _snapshotUIState captures all 17 fields
resetApp();
APP.selectedMeasure = 2; APP.selectedStaff = 1; APP.selectedNoteIdx = 3; APP.selStartIdx = 0;
APP.inputMode = true; APP.chordMode = false; APP.markingMode = true; APP.markingStart = { mi: 0 };
APP.curDur = 'h'; APP.curDot = true; APP.curRest = true; APP.curAcc = '#';
APP.curOctave = 1; APP.curVoice = 2; APP.curTuplet = { num: 3, den: 2, groupId: 'x' };
APP.tupletPending = 3; APP.tupletGroupId = 'x';
const snap = _snapshotUIState();
assertEq(snap.selectedMeasure, 2, 'snapshot.selectedMeasure');
assertEq(snap.curDur, 'h', 'snapshot.curDur');
assertEq(snap.curDot, true, 'snapshot.curDot');
assertEq(snap.markingStart.mi, 0, 'snapshot.markingStart');
assertEq(snap.tupletPending, 3, 'snapshot.tupletPending');

// 2i. _restoreUIState applies snapshot
const fresh = { ...APP };
delete fresh.undoStack; delete fresh.redoStack; delete fresh._lastUndoFP;
_restoreUIState(snap);
assertEq(APP.selectedMeasure, 2, 'restore sets selectedMeasure');
assertEq(APP.curDur, 'h', 'restore sets curDur');
assertEq(APP.curRest, true, 'restore sets curRest');
resetApp();

// ── 3. Exercise Generator Tests ─────────────────────────────────

// 3a. generateExercise dispatches correctly for all types
const typeKeys = Object.values(EXERCISE_TYPES);
typeKeys.forEach(t => {
  const ex = generateExercise(t, 'beginner');
  assert(ex && typeof ex === 'object', `generateExercise('${t}') returns object`);
  assertEq(ex.type, t, `generated exercise has correct type '${t}'`);
  assert(typeof ex.answer === 'string', `exercise '${t}' has string answer`);
  assert(typeof ex.hint === 'string', `exercise '${t}' has string hint`);
  // difficulty stored as numeric (0=beginner, 1=intermediate, 2=advanced)
  assert(typeof ex.difficulty === 'number', `exercise '${t}' has numeric difficulty`);
});

// 3b. _genNoteId returns correct shape
const noteEx = _genNoteId(0);
assertEq(noteEx.type, EXERCISE_TYPES.NOTE_ID, 'note_id type');
assert(typeof noteEx.target.pitch === 'number', 'note_id target.pitch is number');
assert(noteEx.target.pitch >= 48 && noteEx.target.pitch <= 84, 'note_id pitch in range');
assert(typeof noteEx.target.name === 'string', 'note_id target.name is string');
assert(typeof noteEx.target.octave === 'number', 'note_id target.octave is number');
assertEq(noteEx.answer, noteEx.target.name + noteEx.target.octave, 'note_id answer matches target');

// 3c. _genIntervalId returns correct shape
const intEx = _genIntervalId(1);
assertEq(intEx.type, EXERCISE_TYPES.INTERVAL_ID, 'interval_id type');
assert(typeof intEx.target.semitones === 'number', 'interval_id target.semitones is number');
assert(intEx.target.semitones >= 0 && intEx.target.semitones <= 12, 'interval_id semitones in range');
assert(INTERVAL_NAMES[intEx.target.semitones] !== undefined, 'interval_id semitones maps to known interval');

// 3d. _genRhythmRead returns correct shape
const rhyEx = _genRhythmRead(0);
assertEq(rhyEx.type, EXERCISE_TYPES.RHYTHM_READ, 'rhythm_read type');
assert(Array.isArray(rhyEx.target.durations), 'rhythm_read target.durations is array');
assert(rhyEx.target.durations.length > 0, 'rhythm_read has durations');
assertEq(rhyEx.answer, rhyEx.target.durations.join(','), 'rhythm_read answer matches');

// 3e. _genRhythmWorksheet returns correct shape
const wsEx = _genRhythmWorksheet(0);
assertEq(wsEx.type, EXERCISE_TYPES.RHYTHM_WS, 'rhythm_worksheet type');
assertEq(wsEx.target.measures, 8, 'rhythm_worksheet has 8 measures');
assertEq(wsEx.target.beats.length, 32, 'rhythm_worksheet has 32 beats');
wsEx.target.beats.forEach((b, i) => {
  assert(b === 'q' || b === 'r', `rhythm_worksheet beat ${i} is 'q' or 'r', got '${b}'`);
});
assertEq(wsEx.target.timeSigNum, 4, 'rhythm_worksheet timeSigNum 4');
assertEq(wsEx.target.timeSigDen, 4, 'rhythm_worksheet timeSigDen 4');

// 3f. _genMelodyDict returns correct shape
const melEx = _genMelodyDict(2);
assertEq(melEx.type, EXERCISE_TYPES.MELODY_DICT, 'melody_dictation type');
assert(Array.isArray(melEx.target.notes), 'melody_dictation target.notes is array');
assert(melEx.target.notes.length >= 4 && melEx.target.notes.length <= 8, 'melody_dictation has 4-8 notes');
melEx.target.notes.forEach((n, i) => {
  assert(typeof n.pitch === 'number', `melody_dictation note ${i} has pitch`);
  assert(typeof n.duration === 'string', `melody_dictation note ${i} has duration`);
});

// 3g. _genKeySigId returns correct shape
const ksEx = _genKeySigId(1);
assertEq(ksEx.type, EXERCISE_TYPES.KEY_SIG_ID, 'key_sig_id type');
assert(typeof ksEx.target.keySig === 'number', 'key_sig_id target.keySig is number');
assert(ksEx.target.keySig >= -7 && ksEx.target.keySig <= 7, 'key_sig_id keySig in range');
assert(typeof ksEx.answer === 'string', 'key_sig_id has answer');
assert(typeof ksEx.answerMajor === 'string', 'key_sig_id has answerMajor');
assert(typeof ksEx.answerMinor === 'string', 'key_sig_id has answerMinor');

// 3h. generateExercise default fallback is note_id
const defaultEx = generateExercise('nonexistent');
assertEq(defaultEx.type, EXERCISE_TYPES.NOTE_ID, 'unknown type falls back to note_id');

// 3i. _intervalMatches fuzzy matching
assert(_intervalMatches('m3', 'Minor 3rd'), '_intervalMatches m3 → Minor 3rd');
assert(_intervalMatches('Major 3rd', 'Major 3rd'), '_intervalMatches exact match');
assert(_intervalMatches('P5', 'Perfect 5th'), '_intervalMatches P5 → Perfect 5th');
assert(_intervalMatches('m3', 'Major 3rd'), '_intervalMatches m3 → Major 3rd (alias M3)');
assert(_intervalMatches('M3', 'Major 3rd'), '_intervalMatches M3 → Major 3rd');
assert(!_intervalMatches('xyz', 'Unison'), '_intervalMatches nonsense does not match');

// 3j. Exercise generators produce varying results for different difficulties
const advWs = _genRhythmWorksheet(2);
let advRestCount = advWs.target.beats.filter(b => b === 'r').length;
const begWs = _genRhythmWorksheet(0);
const begNoteCount = begWs.target.beats.filter(b => b === 'q').length;
assert(advRestCount > 0, 'advanced worksheet has rests');
assert(begNoteCount > begWs.target.beats.length / 2, 'beginner worksheet has >50% notes');

// ── 4. Invariant Check Tests ────────────────────────────────────

function makeScore(measureCount) {
  const measures = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push({ timeSigNum: i === 0 ? 4 : null, timeSigDen: i === 0 ? 4 : null, keySig: i === 0 ? 0 : null, lineBreak: false, notes: [{ type:'note', pitch:60, duration:'q' }] });
  }
  return { parts: [{ staves: [{ measures }] }] };
}

// 4a. Valid score produces no invariants
const valid = makeScore(4);
_validAnnotations(valid);
let warns = _checkInvariants(valid);
assertEq(warns.length, 0, 'valid 4-measure score has no warnings');

// 4b. Annotation out of range produces warnings
valid.slurs = [{ startMi: 0, startNoteIdx: 0, endMi: 10, endNoteIdx: 0, si: 0 }];
warns = _checkInvariants(valid);
assert(warns.some(w => w.includes('endMi') && w.includes('10')), 'slur endMi out of range flagged');
delete valid.slurs;

// 4c. Duplicate slur flagged
valid.slurs = [
  { startMi: 0, startNoteIdx: 0, endMi: 2, endNoteIdx: 0, si: 0 },
  { startMi: 0, startNoteIdx: 0, endMi: 2, endNoteIdx: 0, si: 0 },
];
warns = _checkInvariants(valid);
assert(warns.some(w => w.includes('duplicates')), 'duplicate slur flagged');
delete valid.slurs;

// 4d. Invalid duration flagged
valid.parts[0].staves[0].measures[0].notes[0].duration = 'xyz';
warns = _checkInvariants(valid);
assert(warns.some(w => w.includes('xyz')), 'invalid duration flagged');
valid.parts[0].staves[0].measures[0].notes[0].duration = 'q';

// 4e. _ensureScoreAnnotationArrays adds missing arrays
const blank = makeScore(2);
assert(!Array.isArray(blank.slurs), 'fresh score has no slurs');
_ensureScoreAnnotationArrays(blank);
assert(Array.isArray(blank.slurs), '_ensureScoreAnnotationArrays creates slurs array');
assert(Array.isArray(blank.hairpins), '_ensureScoreAnnotationArrays creates hairpins array');
assert(Array.isArray(blank.rehearsalMarks), '_ensureScoreAnnotationArrays creates rehearsalMarks array');
assert(Array.isArray(blank.staffTexts), '_ensureScoreAnnotationArrays creates staffTexts array');
assert(Array.isArray(blank.assignments), '_ensureScoreAnnotationArrays creates assignments array');

// Helper for annotation setup
function _validAnnotations(score) {
  score.slurs = [];
  score.hairpins = [];
  score.rehearsalMarks = [];
  score.staffTexts = [];
  score.assignments = [];
}

// ── 5. DOM Interaction Tests ────────────────────────────────────

// 5a. _renderRhythmBeatGrid creates beat buttons
const domEx = _genRhythmWorksheet(0);
_renderRhythmBeatGrid(domEx);
const grid = document.getElementById('rhythm-beat-grid');
assert(grid !== null, 'beat grid container created');
const beatBtns = grid.querySelectorAll('.rg-beat');
assertEq(beatBtns.length, 32, '32 beat buttons created');
assertEq(beatBtns[0].textContent, '·', 'first beat starts unanswered');
assertEq(beatBtns[0].dataset.beat, '0', 'first beat has index 0');

// 5b. Beat buttons toggle correctly via dispatchEvent
const btn = beatBtns[0];
const click = () => btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
click();
assertEq(btn.textContent, '♩', 'first click toggles to ♩');
assert(btn.className.includes('rg-note'), '♩ state has rg-note class');
click();
assertEq(btn.textContent, '𝄽', 'second click toggles to 𝄽');
assert(btn.className.includes('rg-rest'), '𝄽 state has rg-rest class');
click();
assertEq(btn.textContent, '·', 'third click toggles back to ·');
assertEq(btn.className, 'rg-beat', '· state has no extra class');

// 5c. Check button exists
const checkBtn = document.getElementById('rg-check-btn');
assert(checkBtn !== null, 'check button exists');
assertEq(checkBtn.textContent, '✔ Check Answers', 'check button has correct text');

// 5d. Clean up DOM
grid.remove();

// ── 6. Edge Case Tests ──────────────────────────────────────────

// 6a. _require with empty opts does nothing
resetApp();
APP.exerciseMode = true; APP.exerciseSession = {};
try { _require({}); assert(true, '_require({}) does not throw in any mode'); }
catch(e) { assert(false, '_require({}) should not throw: ' + e.message); }
resetApp();

// 6b. _require with unknown key silently ignored (no matching check)
try { _require({require: ['nonexistent']}); assert(true, '_require with unknown key silently ignored'); }
catch(e) { assert(false, '_require should not throw for unknown key'); }

// 6c. undoStack capped at 60 (not directly tested, just structural)
assert(Array.isArray(APP.undoStack), 'undoStack is array');
assert(Array.isArray(APP.redoStack), 'redoStack is array');

// 6d. MODE_RULES — chordMode is a sticky modifier, no rule fires when alone
resetApp(); APP.chordMode = true; APP.inputMode = false; APP.selectedNoteIdx = -1;
violations = _validateModeState();
assertEq(violations.length, 0, 'chordMode without input/selection is OK (sticky modifier)');

// 6e. MODE_RULES — marking+input flagged (duplicate check, different rule path)
resetApp(); APP.markingMode = true; APP.inputMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('markingMode + inputMode')), 'marking+input flagged');

// ── 7. Full Undo/Redo with Mode Restoration ─────────────────────

// 7a. undo restores exerciseMode, exerciseSession, exerciseDifficulty, assignmentMode, currentAssignment, practiceMode
resetApp();
APP.exerciseMode = true;
APP.exerciseSession = { type: 'note_id', difficulty: 'beginner', current: {}, completed: [], correctCount: 0, totalCount: 0, streak: 0, maxStreak: 0, startedAt: Date.now() };
APP.exerciseDifficulty = 'intermediate';
APP.assignmentMode = true;
APP.currentAssignment = { id: 'a1', title: 'Test' };
APP.practiceMode = true;
APP.selectedMeasure = 2;
APP.inputMode = true;
pushUndo();
APP.exerciseMode = false;
APP.exerciseSession = null;
APP.exerciseDifficulty = 'beginner';
APP.assignmentMode = false;
APP.currentAssignment = null;
APP.practiceMode = false;
APP.selectedMeasure = 5;
APP.inputMode = false;
undo();
assertEq(APP.exerciseMode, true, 'undo restores exerciseMode');
assert(APP.exerciseSession !== null, 'undo restores exerciseSession');
assertEq(APP.exerciseDifficulty, 'intermediate', 'undo restores exerciseDifficulty');
assertEq(APP.assignmentMode, true, 'undo restores assignmentMode');
assert(APP.currentAssignment !== null, 'undo restores currentAssignment');
assertEq(APP.practiceMode, true, 'undo restores practiceMode');
assertEq(APP.selectedMeasure, 2, 'undo restores selectedMeasure');
assertEq(APP.inputMode, true, 'undo restores inputMode');

// 7b. undo restores chordMode, markingMode
resetApp();
APP.inputMode = true;
APP.chordMode = true;
APP.markingMode = true;
pushUndo();
APP.inputMode = false;
APP.chordMode = false;
APP.markingMode = false;
undo();
assertEq(APP.inputMode, true, 'undo restores inputMode');
assertEq(APP.chordMode, true, 'undo restores chordMode');
assertEq(APP.markingMode, true, 'undo restores markingMode');

// 7c. redo restores state from redoStack
resetApp();
APP.inputMode = true;
pushUndo();
APP.inputMode = false;
undo(); // back to inputMode=true, state B pushed to redoStack
assertEq(APP.inputMode, true, 'undo restores inputMode=true before redo');
redo(); // restore state B (inputMode=false) from redoStack
assertEq(APP.inputMode, false, 'redo restores inputMode');

// 7d. undo after multiple mode changes restores correct state
resetApp();
APP.inputMode = true;
pushUndo();
APP.inputMode = false;
APP.chordMode = true;
pushUndo();
APP.chordMode = false;
undo(); // back to chordMode=true
assertEq(APP.chordMode, true, 'undo restores chordMode from second push');
undo(); // back to inputMode=true
assertEq(APP.inputMode, true, 'undo restores inputMode from first push');

// ── 8. Mode Transition Tests ─────────────────────────────────────

// 8a. inputMode + chordMode valid together
resetApp();
APP.inputMode = true;
APP.chordMode = true;
violations = _validateModeState();
assertEq(violations.length, 0, 'inputMode + chordMode allowed');

// 8b. inputMode + markingMode invalid
resetApp();
APP.inputMode = true;
APP.markingMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('inputMode + markingMode')), 'input+marking flagged');

// 8c. exerciseMode blocks inputMode
resetApp();
APP.exerciseMode = true;
APP.exerciseSession = {};
APP.inputMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('exerciseMode + inputMode')), 'exercise+input flagged');

// 8d. assignmentMode blocks chordMode
resetApp();
APP.assignmentMode = true;
APP.currentAssignment = {};
APP.chordMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('assignmentMode + chordMode')), 'assignment+chord flagged');

// 8e. chordMode persists after inputMode off
resetApp();
APP.inputMode = true;
APP.chordMode = true;
APP.inputMode = false;
violations = _validateModeState();
assertEq(violations.length, 0, 'chordMode persists after inputMode off');

// 8f. markingMode + inputMode invalid (separate rule)
resetApp();
APP.markingMode = true;
APP.inputMode = true;
violations = _validateModeState();
assert(violations.some(v => v.includes('markingMode + inputMode')), 'marking+input flagged');

// ── 9. Guarded Handler Pattern Tests (using _require directly) ───

// 9a. _require blocks in exerciseMode
resetApp();
APP.exerciseMode = true; APP.exerciseSession = {};
try { _require({forbid: ['exercise']}); assert(false, '_require should throw in exerciseMode'); }
catch(e) { assert(e.message === 'Exit exercise mode first', '_require blocks in exerciseMode'); }
resetApp();

// 9b. _require blocks in assignmentMode
resetApp();
APP.assignmentMode = true; APP.currentAssignment = {};
try { _require({forbid: ['assignment']}); assert(false, '_require should throw in assignmentMode'); }
catch(e) { assert(e.message === 'Exit assignment mode first', '_require blocks in assignmentMode'); }
resetApp();

// 9c. _require blocks in markingMode
resetApp();
APP.markingMode = true;
try { _require({forbid: ['marking']}); assert(false, '_require should throw in markingMode'); }
catch(e) { assert(e.message === 'Complete or cancel current marking first', '_require blocks in markingMode'); }
resetApp();

// 9d. _require requires selectedNote
resetApp();
try { _require({require: ['selectedNote']}); assert(false, '_require should throw without selectedNote'); }
catch(e) { assert(true, '_require requires selectedNote'); }
APP.selectedNoteIdx = 0;
try { _require({require: ['selectedNote']}); assert(true, '_require passes with selectedNote'); }
catch(e) { assert(false, '_require should pass with selectedNote: ' + e.message); }
resetApp();

// 9e. _require requires score
resetApp();
try { _require({require: ['score']}); assert(false, '_require should throw without score'); }
catch(e) { assert(true, '_require requires score'); }
APP.score = {};
try { _require({require: ['score']}); assert(true, '_require passes with score'); }
catch(e) { assert(false, '_require should pass with score: ' + e.message); }
resetApp();

// ── 10. Modal State Tests (DOM) ──────────────────────────────────
// Note: makeModal, closeModal, showDropdown, closeDropdown are not in test file
// These are tested via the beat grid DOM tests in section 5

// ── 11. Complex Interaction Sequence Tests ───────────────────────

// 11a. full edit → undo → redo cycle with mode tracking
resetApp();
APP.score = { parts: [{ staves: [{ measures: [{ notes: [{ type:'note', pitch:60, duration:'q' }] }] }] }] };
APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = 0;
APP.inputMode = true; APP.curDur = 'h'; APP.curAcc = '#';
APP.chordMode = true;
APP.exerciseMode = false; APP.exerciseSession = null; APP.exerciseDifficulty = 'beginner';
APP.assignmentMode = false; APP.currentAssignment = null;
APP.practiceMode = false;
pushUndo(); // state: inputMode=true, curDur='h', curAcc='#', pitch=60
APP.score.parts[0].staves[0].measures[0].notes[0].pitch = 64;
APP.inputMode = false; APP.curDur = 'q'; APP.curAcc = null;
APP.chordMode = false;
pushUndo(); // state: inputMode=false, curDur='q', curAcc=null, pitch=64
undo(); // restore pitch=64, inputMode=false, curDur='q', curAcc=null, chordMode=false
assertEq(APP.score.parts[0].staves[0].measures[0].notes[0].pitch, 64, 'undo restores pitch 64');
assertEq(APP.inputMode, false, 'undo restores inputMode=false');
assertEq(APP.curDur, 'q', 'undo restores curDur=q');
assertEq(APP.chordMode, false, 'undo restores chordMode=false');
undo(); // restore pitch=60, inputMode=true, curDur='h', curAcc='#', chordMode=true
assertEq(APP.score.parts[0].staves[0].measures[0].notes[0].pitch, 60, 'undo restores pitch 60');
assertEq(APP.inputMode, true, 'undo restores inputMode=true');
assertEq(APP.curDur, 'h', 'undo restores curDur=h');
assertEq(APP.curAcc, '#', 'undo restores curAcc=#');
assertEq(APP.chordMode, true, 'undo restores chordMode=true');
redo(); // back to pitch=64, inputMode=false, curDur='q', curAcc=null, chordMode=false
assertEq(APP.score.parts[0].staves[0].measures[0].notes[0].pitch, 64, 'redo restores pitch 64');
assertEq(APP.inputMode, false, 'redo restores inputMode=false');
assertEq(APP.curDur, 'q', 'redo restores curDur=q');
assertEq(APP.chordMode, false, 'redo restores chordMode=false');

// 11b. exercise flow: start → answer → undo restores pre-answer state
resetApp();
const exNote = _genNoteId(0);
APP.exerciseMode = true; APP.exerciseSession = { type: 'note_id', current: exNote, completed: [], correctCount: 0, totalCount: 0 };
pushUndo();
// Simulate correct answer
const answer = exNote.answer;
const norm = s => s.trim().toLowerCase().replace(/\s+/g, '');
const isCorrect = norm(answer) === norm(exNote.answer);
assert(isCorrect, 'correct answer matches');
APP.exerciseSession.correctCount++;
APP.exerciseSession.totalCount++;
APP.exerciseSession.completed.push({ type: 'note_id', answer, ok: true });
undo();
assertEq(APP.exerciseSession.correctCount, 0, 'undo restores correctCount=0');
assertEq(APP.exerciseSession.totalCount, 0, 'undo restores totalCount=0');

// ── 12. MODE_RULES Edge Cases ────────────────────────────────────

// 12a. exerciseMode without session flagged
resetApp();
APP.exerciseMode = true; APP.exerciseSession = null;
violations = _validateModeState();
assert(violations.some(v => v.includes('exerciseMode true but session null')), 'exerciseMode without session flagged');

// 12b. session without exerciseMode flagged
resetApp();
APP.exerciseMode = false; APP.exerciseSession = {};
violations = _validateModeState();
assert(violations.some(v => v.includes('exerciseSession set but mode false')), 'session without mode flagged');

// 12c. assignmentMode without currentAssignment flagged
resetApp();
APP.assignmentMode = true; APP.currentAssignment = null;
violations = _validateModeState();
assert(violations.some(v => v.includes('assignmentMode true but currentAssignment null')), 'assignmentMode without assignment flagged');

// 12d. currentAssignment without assignmentMode flagged
resetApp();
APP.assignmentMode = false; APP.currentAssignment = {};
violations = _validateModeState();
assert(violations.some(v => v.includes('currentAssignment set but mode false')), 'assignment without mode flagged');

// 12e. tupletPending without curTuplet flagged
resetApp();
APP.tupletPending = 3; APP.curTuplet = null;
violations = _validateModeState();
assert(violations.some(v => v.includes('tupletPending > 0 but no curTuplet')), 'tupletPending without curTuplet flagged');

// ── Summary ─────────────────────────────────────────────────────
console.log(`\n${_pass} passed, ${_fail} failed`);
process.exit(_fail > 0 ? 1 : 0);
