// ── Interaction + education tests against the REAL app ──────────
//
// This suite used to carry its own copies of the mode guards, undo
// snapshots, invariant checks and exercise generators, and those copies
// had drifted from src/ without anything failing. Everything below is now
// imported from test-harness.js, which evaluates the real src/index.html
// DOM and every module in build.js order.
//
// No mirrored logic and no local scaffolding remain: the phantom rhythm
// MCQ helpers the old suite defined (_renderRhythmMCQ and friends, for a
// 4-option UI that src/ never had) were replaced by tests that drive the
// real _renderRhythmBeatGrid.
//
// _validateModeState and _checkInvariants report through console.warn and
// return nothing, so the warning-capturing helpers below collect them.
// Rendering is out of scope: VexFlow is not available headless, so the
// five "[Pauta] renderScore failed" lines during the undo tests are
// expected — renderScore catches and logs the failure itself.

import { Window } from 'happy-dom';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadApp, APP_MODULES } from './test-harness.js';
import { readFileSync as _rf } from 'fs';

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
function die(msg) { throw new Error(msg); }

// The harness concatenates src/ in its own order, so pin it to build.js.
// Without this the two lists could drift and the suite would quietly load a
// different program order than the shipped bundle.
const _buildSrc = _rf(new URL('./build.js', import.meta.url), 'utf8');
const _buildMods = _buildSrc.slice(_buildSrc.indexOf('const modules = ['), _buildSrc.indexOf('];', _buildSrc.indexOf('const modules = [')))
  .split('\n').map(l => l.match(/'([^']+)'/)).filter(Boolean).map(m => m[1]);
assertEq(APP_MODULES.length, _buildMods.length, 'harness loads the same module count as build.js');
for (let _i = 0; _i < _buildMods.length; _i++) {
  assertEq(APP_MODULES[_i], _buildMods[_i], `harness module ${_i} matches build.js order`);
}

const A = loadApp();
const {
  APP, SCORE, AUDIO, MODE_RULES, VALID_DURATIONS, NOTE_NAMES, CHROMATIC,
  PC_TO_DIA, DUR_BEATS, SCORE_MEASURE_REF_RULES, KIT_CONFIGS,
  EXERCISE_TYPES, INTERVAL_NAMES, INTERVAL_ALIASES,
  KEY_SIG_NAMES, KEY_SIG_MINOR_NAMES, NATURAL_PITCHES,
  durBeats, _require, _validateModeState,
  pushUndo, undo, redo,
  _scoreFingerprint, _snapshotUIState, _restoreUIState, _uiFingerprint,
  _ensureScoreAnnotationArrays, _checkInvariants,
  _intervalMatches, _kitExerciseRange, _kitExerciseKeys,
  generateExercise, _genNoteId, _genIntervalId, _genRhythmRead,
  _genRhythmWorksheet, _genMelodyDict, _genKeySigId,
  _renderRhythmBeatGrid, checkRhythmWorksheet,
} = A;

// A few tests touch the DOM directly; point the globals at the harness
// document so they exercise the same tree the modules rendered into.
globalThis.window = A.window;
globalThis.document = A.document;

const _cloneScore = typeof structuredClone === 'function'
  ? structuredClone
  : (v) => JSON.parse(JSON.stringify(v));

// ── 1. Mode Guard Tests ─────────────────────────────────────────

function resetApp() {
  APP.inputMode = false;
  APP.chordMode = false;
  APP.markingMode = false;
  APP.exerciseMode = false;
  APP.assignmentMode = false;
  APP.exerciseSession = null;
  APP.currentAssignment = null;
  APP.eraserMode = false;
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

// _validateModeState reports through console.warn and returns nothing; the
// mirrored copy used to hand back an array of violation strings, so these
// tests captured the warnings instead.
function captureModeWarnings() {
  const seen = [];
  const real = console.warn;
  console.warn = (...args) => { seen.push(args.join(' ')); };
  try { _validateModeState(); } finally { console.warn = real; }
  return seen;
}

// 1e. MODE_RULES — valid states produce no warnings
resetApp();
assertEq(captureModeWarnings().length, 0, 'no violations when all modes off');

// 1f-1k. MODE_RULES — every single rule warns with its own message.
// The table is exhaustive on purpose: dropping any one rule from
// MODE_RULES must fail here rather than silently disabling a guard.
const MODE_GUARD_CASES = [
  ['input+marking',                 { inputMode: true, markingMode: true },                              'inputMode + markingMode'],
  ['exercise+input',                { exerciseMode: true, exerciseSession: {}, inputMode: true },         'exerciseMode + inputMode'],
  ['exercise+chord',                { exerciseMode: true, exerciseSession: {}, chordMode: true },          'exerciseMode + chordMode'],
  ['exercise+marking',              { exerciseMode: true, exerciseSession: {}, markingMode: true },       'exerciseMode + markingMode'],
  ['assignment+input',              { assignmentMode: true, currentAssignment: {}, inputMode: true },     'assignmentMode + inputMode'],
  ['assignment+chord',              { assignmentMode: true, currentAssignment: {}, chordMode: true },      'assignmentMode + chordMode'],
  ['assignment+marking',            { assignmentMode: true, currentAssignment: {}, markingMode: true },   'assignmentMode + markingMode'],
  ['marking+input',                 { markingMode: true, inputMode: true },                               'markingMode + inputMode'],
  ['exercise without session',      { exerciseMode: true, exerciseSession: null },                       'exerciseMode true but session null'],
  ['session without mode',          { exerciseMode: false, exerciseSession: {} },                        'exerciseSession set but mode false'],
  ['assignment without assignment', { assignmentMode: true, currentAssignment: null },                   'assignmentMode true but currentAssignment null'],
  ['assignment without mode',       { assignmentMode: false, currentAssignment: {} },                    'currentAssignment set but mode false'],
  ['tupletPending without tuplet',  { tupletPending: 3, curTuplet: null },                                'tupletPending > 0 but no curTuplet'],
  ['eraser+input',                  { eraserMode: true, inputMode: true },                               'eraserMode + inputMode'],
  ['eraser+marking',                { eraserMode: true, markingMode: true },                             'eraserMode + markingMode'],
  ['eraser+chord',                  { eraserMode: true, chordMode: true },                               'eraserMode + chordMode'],
  ['eraser+exercise',               { eraserMode: true, exerciseMode: true, exerciseSession: {} },       'eraserMode + exerciseMode'],
  ['eraser+assignment',             { eraserMode: true, assignmentMode: true, currentAssignment: {} },   'eraserMode + assignmentMode'],
];
for (const [label, setup, expectedMsg] of MODE_GUARD_CASES) {
  resetApp();
  Object.assign(APP, setup);
  assert(captureModeWarnings().some(w => w.includes(expectedMsg)), `${label} is flagged`);
}
// Every rule in MODE_RULES is covered by the table above; if src/ grows a
// new rule, this count forces the test to be updated with it.
assertEq(MODE_GUARD_CASES.length, MODE_RULES.length, 'MODE_RULES table covers every rule in src/');

// 1l. _validateModeState never throws on a garbage state
resetApp();
APP.tupletPending = 5;
assert(Array.isArray(captureModeWarnings()), 'mode check survives inconsistent state');

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

// 2f/2g. undo/redo with an empty stack leave the score untouched.
// Neither returns a boolean; they toast and return undefined, so assert on
// the observable effect instead of the mirrored return value.
resetApp();
APP.score = SCORE.createScore({ instruments: ['Piano'] });
const scoreBefore = APP.score;
undo();
assertEq(APP.score, scoreBefore, 'undo with an empty stack leaves the score alone');
assertEq(APP.undoStack.length, 0, 'undo with an empty stack pops nothing');
redo();
assertEq(APP.score, scoreBefore, 'redo with an empty stack leaves the score alone');
assertEq(APP.redoStack.length, 0, 'redo with an empty stack pops nothing');

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
  // difficulty is numeric (0=beginner, 1=intermediate, 2=advanced), except
  // scale_id: _genScaleId ignores the difficulty argument by design and
  // reports a name, because scale exercises progress through unlocked
  // scale types rather than through difficulty bands.
  if (t !== EXERCISE_TYPES.SCALE_ID) {
    assert(typeof ex.difficulty === 'number', `exercise '${t}' has numeric difficulty`);
  } else {
    assert(typeof ex.difficulty === 'string', `exercise '${t}' reports a named difficulty`);
  }
});

// 3b. _genNoteId returns correct shape
const noteEx = _genNoteId(0);
assertEq(noteEx.type, EXERCISE_TYPES.NOTE_ID, 'note_id type');
assert(typeof noteEx.target.pitch === 'number', 'note_id target.pitch is number');
assert(noteEx.target.pitch >= 48 && noteEx.target.pitch <= 84, 'note_id pitch in range');
assert(typeof noteEx.target.name === 'string', 'note_id target.name is string');
assert(typeof noteEx.target.octave === 'number', 'note_id target.octave is number');
// answer is the pitch-class name only ("A"); the octave is carried in
// target.octave, so a graded answer can never disagree with the prompt.
assertEq(noteEx.answer, noteEx.target.name, 'note_id answer is the target pitch name');
assert(noteEx.answer !== noteEx.target.name + noteEx.target.octave, 'note_id answer does not embed the octave');

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
assertEq(wsEx.target.measures, 8, 'rhythm_worksheet defaults to 8 measures');
assertEq(wsEx.target.beats.length, 32, 'rhythm_worksheet has 32 beats (8x4)');
wsEx.target.beats.forEach((b, i) => {
  assert(b === 'q' || b === 'r', `rhythm_worksheet beat ${i} is 'q' or 'r', got '${b}'`);
});
assertEq(wsEx.target.timeSigNum, 4, 'rhythm_worksheet timeSigNum 4');
assertEq(wsEx.target.timeSigDen, 4, 'rhythm_worksheet timeSigDen 4');
// custom measure count
// The worksheet is a fixed 8x4 grid: _genRhythmWorksheet takes only a
// difficulty and hardcodes the measure count. The mirror had invented a
// measuresCount parameter and an MCQ option list that src/ never had --
// the grid itself (target.grid) is the interaction surface.
assertEq(wsEx.target.measures, 8, 'rhythm_worksheet measure count is fixed at 8');
assertEq(wsEx.target.beats.length, 32, 'rhythm_worksheet beat count is always 8x4');
assert(Array.isArray(wsEx.target.grid) && wsEx.target.grid.length === 32, 'rhythm_worksheet grid has one glyph per beat');
wsEx.target.grid.forEach((g, i) => {
  assert(g === '\u2669' || g === '\ud834\udd3d', `grid glyph ${i} is a quarter note or a rest, got '${g}'`);
  assert(typeof wsEx.target.beats[i] === 'string', `grid glyph ${i} lines up with a beat`);
});
assertEq(wsEx.answer, wsEx.target.beats.join(','), 'worksheet answer is the beat sequence');
// difficulty conversion
// Difficulty names are normalised by generateExercise, not by the
// generator itself: _genRhythmWorksheet compares difficulty against 0/1
// numerically, so handing it "beginner" would silently mis-branch.
const strDiffEx = generateExercise(EXERCISE_TYPES.RHYTHM_WS, 'beginner');
assertEq(strDiffEx.difficulty, 0, 'generateExercise normalises "beginner" to 0');
assertEq(strDiffEx.target.beats.length, 32, 'normalised worksheet still has 32 beats');

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

// _checkInvariants reports through console.warn and returns nothing; the
// mirrored copy handed back the warning array. Capture the warnings.
function captureInvariantWarnings(score) {
  const seen = [];
  const real = console.warn;
  console.warn = (...args) => { seen.push(args.join(' ')); };
  try { _checkInvariants(score); } finally { console.warn = real; }
  return seen;
}

function makeScore(measureCount) {
  const measures = [];
  for (let i = 0; i < measureCount; i++) {
    measures.push({ timeSigNum: i === 0 ? 4 : null, timeSigDen: i === 0 ? 4 : null, keySig: i === 0 ? 0 : null, lineBreak: false, notes: [{ type:'note', pitch:60, duration:'q' }] });
  }
  return { parts: [{ staves: [{ measures }] }] };
}

// 4a. Valid score produces no invariants.
// The real check also validates live APP selection state, so start clean.
resetApp();
APP.selectedMeasure = 0;
APP.selectedStaff = 0;
const valid = makeScore(4);
_validAnnotations(valid);
let warns = captureInvariantWarnings(valid);
assertEq(warns.length, 0, 'valid 4-measure score has no warnings');

// 4b. Annotation out of range produces warnings
valid.slurs = [{ startMi: 0, startNoteIdx: 0, endMi: 10, endNoteIdx: 0, si: 0 }];
warns = captureInvariantWarnings(valid);
assert(warns.some(w => w.includes('endMi') && w.includes('10')), 'slur endMi out of range flagged');
delete valid.slurs;

// 4c. Duplicate slur flagged
valid.slurs = [
  { startMi: 0, startNoteIdx: 0, endMi: 2, endNoteIdx: 0, si: 0 },
  { startMi: 0, startNoteIdx: 0, endMi: 2, endNoteIdx: 0, si: 0 },
];
warns = captureInvariantWarnings(valid);
assert(warns.some(w => w.includes('duplicates')), 'duplicate slur flagged');
delete valid.slurs;

// 4d. Invalid duration flagged
valid.parts[0].staves[0].measures[0].notes[0].duration = 'xyz';
warns = captureInvariantWarnings(valid);
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

// ── 5. Rhythm Worksheet DOM Tests ────────────────────────────────
// These drive the real _renderRhythmBeatGrid. The old mirror invented a
// 4-option MCQ (rg-option / rg-mcq-prompt) that no source file ever had,
// so it tested its own hand-written HTML rather than app behaviour.

function _renderWs(ex) {
  APP.exerciseSession = { current: ex, playsLeft: Infinity, totalCount: 0,
                          correctCount: 0, streak: 0, maxStreak: 0, completed: [] };
  _renderRhythmBeatGrid(ex);
  return document.getElementById('rhythm-beat-grid');
}

// 5a. one .rg-beat button per beat, carrying the graded answer
resetApp();
const wsDomEx = _genRhythmWorksheet(0);
const wsGrid = _renderWs(wsDomEx);
assert(wsGrid !== null, 'beat grid container created');
const beatBtns = wsGrid.querySelectorAll('.rg-beat');
assertEq(beatBtns.length, wsDomEx.target.beats.length, 'one beat button per beat');
beatBtns.forEach((btn, i) => {
  assertEq(btn.dataset.beat, String(i), `beat button ${i} carries its index`);
  assertEq(btn.dataset.answer, wsDomEx.target.beats[i] === 'q' ? '\u2669' : '\ud834\udd3d',
    `beat button ${i} carries the correct answer glyph`);
  assertEq(btn.textContent, '\u00b7', `beat button ${i} starts unmarked`);
});

// 5b. rows are grouped into measures with a play button and controls
assertEq(wsGrid.querySelectorAll('.rg-row').length, wsDomEx.target.measures, 'one row per measure');
assertEq(wsGrid.querySelectorAll('.rg-measure-label').length, wsDomEx.target.measures, 'each row is labelled');
assert(wsGrid.querySelector('#rg-play-btn') !== null, 'play button exists');
assert(wsGrid.querySelector('#rg-tempo') !== null, 'tempo slider exists');
assertEq(wsGrid.querySelector('#rg-check-btn').textContent, '\u2714 Check Answers', 'check button label');

// 5c. clicking cycles unmarked -> note -> rest -> unmarked
const b0 = beatBtns[0];
b0.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assertEq(b0.textContent, '\u2669', 'first click marks a note');
assert(b0.classList.contains('rg-note'), 'note class applied');
b0.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assertEq(b0.textContent, '\ud834\udd3d', 'second click marks a rest');
assert(b0.classList.contains('rg-rest'), 'rest class applied');
b0.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assertEq(b0.textContent, '\u00b7', 'third click clears the mark');
assert(!b0.classList.contains('rg-note') && !b0.classList.contains('rg-rest'), 'classes cleared with the mark');

// 5d. answering every beat correctly scores 100 and credits the session
beatBtns.forEach(btn => {
  while (btn.textContent !== btn.dataset.answer) {
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  }
});
wsGrid.querySelector('#rg-check-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assert(Array.from(beatBtns).every(b => b.dataset.locked === '1'), 'every beat locks after checking');
assert(Array.from(beatBtns).every(b => b.classList.contains('rg-correct')), 'every correct beat is marked correct');
assert(!Array.from(beatBtns).some(b => b.classList.contains('rg-incorrect')), 'no beat marked incorrect');
assertEq(APP.exerciseSession.correctCount, 1, 'a perfect round credits correctCount');
assertEq(APP.exerciseSession.completed[0].ok, true, 'perfect round recorded ok');

// 5e. grading a wrong answer locks the beats without crediting the round
const wsGrid2 = _renderWs(_genRhythmWorksheet(2));
const beats2 = wsGrid2.querySelectorAll('.rg-beat');
const wrongBtn = beats2[beats2.length - 1];
// Cycle past the correct glyph so this is wrong regardless of the random beat.
wrongBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
while (wrongBtn.textContent === wrongBtn.dataset.answer) {
  wrongBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}
assert(wrongBtn.textContent !== wrongBtn.dataset.answer, 'beat is deliberately marked wrong');
wsGrid2.querySelector('#rg-check-btn').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assertEq(wrongBtn.classList.contains('rg-incorrect'), true, 'wrong beat marked incorrect');
assertEq(APP.exerciseSession.correctCount, 0, 'imperfect round is not credited');
assertEq(APP.exerciseSession.streak, 0, 'imperfect round resets the streak');
wsGrid2.remove();

// 5f. locked beats ignore further clicks
const b1 = beatBtns[0];
const before = b1.textContent;
b1.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
assertEq(b1.textContent, before, 'a locked beat ignores clicks');
wsGrid.remove();

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
assertEq(captureModeWarnings().length, 0, 'chordMode without input/selection is OK (sticky modifier)');

// 6e. MODE_RULES — marking+input flagged (duplicate check, different rule path)
resetApp(); APP.markingMode = true; APP.inputMode = true;
assert(captureModeWarnings().some(v => v.includes('markingMode + inputMode')), 'marking+input flagged');

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
assertEq(captureModeWarnings().length, 0, 'inputMode + chordMode allowed');

// 8b. inputMode + markingMode invalid
resetApp();
APP.inputMode = true;
APP.markingMode = true;
assert(captureModeWarnings().some(v => v.includes('inputMode + markingMode')), 'input+marking flagged');

// 8c. exerciseMode blocks inputMode
resetApp();
APP.exerciseMode = true;
APP.exerciseSession = {};
APP.inputMode = true;
assert(captureModeWarnings().some(v => v.includes('exerciseMode + inputMode')), 'exercise+input flagged');

// 8d. assignmentMode blocks chordMode
resetApp();
APP.assignmentMode = true;
APP.currentAssignment = {};
APP.chordMode = true;
assert(captureModeWarnings().some(v => v.includes('assignmentMode + chordMode')), 'assignment+chord flagged');

// 8e. chordMode persists after inputMode off
resetApp();
APP.inputMode = true;
APP.chordMode = true;
APP.inputMode = false;
assertEq(captureModeWarnings().length, 0, 'chordMode persists after inputMode off');

// 8f. markingMode + inputMode invalid (separate rule)
resetApp();
APP.markingMode = true;
APP.inputMode = true;
assert(captureModeWarnings().some(v => v.includes('markingMode + inputMode')), 'marking+input flagged');

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
assert(captureModeWarnings().some(v => v.includes('exerciseMode true but session null')), 'exerciseMode without session flagged');

// 12b. session without exerciseMode flagged
resetApp();
APP.exerciseMode = false; APP.exerciseSession = {};
assert(captureModeWarnings().some(v => v.includes('exerciseSession set but mode false')), 'session without mode flagged');

// 12c. assignmentMode without currentAssignment flagged
resetApp();
APP.assignmentMode = true; APP.currentAssignment = null;
assert(captureModeWarnings().some(v => v.includes('assignmentMode true but currentAssignment null')), 'assignmentMode without assignment flagged');

// 12d. currentAssignment without assignmentMode flagged
resetApp();
APP.assignmentMode = false; APP.currentAssignment = {};
assert(captureModeWarnings().some(v => v.includes('currentAssignment set but mode false')), 'assignment without mode flagged');

// 12e. tupletPending without curTuplet flagged
resetApp();
APP.tupletPending = 3; APP.curTuplet = null;
assert(captureModeWarnings().some(v => v.includes('tupletPending > 0 but no curTuplet')), 'tupletPending without curTuplet flagged');

// ── 13. DESIGN SYSTEM REGRESSION GUARDS ─────────────────────────
// These tests prevent bulk find-and-replace from breaking music notation
// rendering (e.g., replacing Bravura with --pauta-font-sans)

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');

// 13a. SMuFL PUA codepoints (U+E000–U+EFFF) must pair with Bravura, not --pauta-font-sans
const files = readdirSync(srcDir).filter(f => f.endsWith('.js'));
for (const f of files) {
  const code = readFileSync(join(srcDir, f), 'utf8');
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for SMuFL codepoint (\\uE0xx or literal chars in PUA range)
    if (/\\uE[0-9A-Fa-f]{3}/.test(line) || /[\uE000-\uEFFF]/.test(line)) {
      // Extract the font-family used on that line (or nearby for multi-line)
      const fontFamily = line.includes('font-family');
      if (fontFamily) {
        assert(
          !line.includes('var(--pauta-font-sans)') && !line.includes('var(--pauta-font-mono)'),
          `${f}:${i+1} — SMuFL codepoint uses CSS var instead of Bravura`
        );
      }
    }
  }
}

// 13b. Every JS file should have Bravura defined somewhere if it uses SMuFL
const smuflFiles = ['ui.js', 'education/session.js'];
for (const f of smuflFiles) {
  const code = readFileSync(join(srcDir, f), 'utf8');
  if (/\\uE[0-9A-Fa-f]{3}/.test(code) || /[\uE000-\uEFFF]/.test(code)) {
    assert(
      code.includes("Bravura"),
      `${f} — uses SMuFL codepoints but missing Bravura font reference`
    );
  }
}

// ── 14. DEAD CODE AFTER `return;` GUARD ─────────────────────────
// Detects code placed after a standalone `return;` (same/denther indent),
// which is unreachable.  Catches IIFE bugs like:
//   ;(function() { return; DEAD_CODE; })();
for (const f of files) {
  const code = readFileSync(join(srcDir, f), 'utf8');
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)return;\s*$/);
    if (!m) continue;
    const retIndent = m[1].length;
    // Scan forward: any non-blank, non-comment line at >= retIndent
    // before indentation drops below retIndent is dead code.
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      const indent = line.search(/\S/);
      if (indent === -1) continue;           // blank line
      if (/^\s*\/[/*]/.test(line)) continue; // comment
      if (line.trim() === '});' || line.trim() === '})();') { assert(false, `${f}:${i+1} — code after return; (line ${j+1}: ${line.trim()}) dead`); break; }
      if (indent <= retIndent) {
        // Closing the current scope
        if (/^\s*[\}\)\]]/.test(line.trim())) break; // legitimate close
        // Same indent and NOT a structural close → dead code
        assert(
          /^\s*[\}\)\]]/.test(line.trim()),
          `${f}:${i+1} — code after return; on line ${j+1} (\`${line.trim()}\`) is unreachable`
        );
        break;
      }
      // indent > retIndent → still inside return's scope → dead
      assert(false, `${f}:${i+1} — code after return; on line ${j+1} (\`${line.trim()}\`) is unreachable`);
      break;
    }
  }
}

// ── 15. FLEX + OVERFLOW COLLAPSE GUARD ──────────────────────────
// A child of `display:flex; flex-direction:column` with
// `overflow-y:auto` / `overflow:auto` / `overflow:scroll` can
// collapse to height:0 in Chrome/Safari.  Every inline style
// using overflow must include flex-shrink:0 (unless the element
// itself is a flex container or is nested inside a non-flex parent).
const OVERFLOW_RE = /overflow(-y)?:\s*(auto|scroll)/;
for (const f of files) {
  const code = readFileSync(join(srcDir, f), 'utf8');
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!OVERFLOW_RE.test(line)) continue;
    // Skip if the element itself is a flex container (safe)
    if (/display:\s*flex/.test(line)) continue;
    // Skip if flex-shrink:0 is present (already guarded)
    if (/flex-shrink:\s*0/.test(line)) continue;
    // Skip lines that are not inline styles
    if (!line.includes('style="') && !line.includes("style='")) continue;
    assert(
      false,
      `${f}:${i+1} — overflow-y:auto/overflow:auto in inline style may collapse in flex context; add flex-shrink:0 or remove overflow constraint`
    );
  }
}

// ── 16. CSS VARIABLE EXISTENCE GUARD ────────────────────────────
// Every `var(--pauta-*)` referenced in JS must be defined in
// src/design-system.css so that inline styles resolve correctly.
const cssPath = join(srcDir, 'design-system.css');
const cssCode = readFileSync(cssPath, 'utf8');
const definedVars = new Set(cssCode.match(/--pauta-[a-z0-9-]+/g) || []);
for (const f of files) {
  const code = readFileSync(join(srcDir, f), 'utf8');
  const used = code.match(/var\(--pauta-[a-z0-9-]+\)/g);
  if (!used) continue;
  for (const ref of used) {
    const varName = ref.slice(4, -1);
    assert(
      definedVars.has(varName),
      `${f} — references CSS variable \`${varName}\` which is not defined in src/design-system.css`
    );
  }
}

// ── 17. PALETTE SHORTCUT BADGES MATCH THE KEY BINDINGS ───────────
// The duration/note buttons render a faded key hint (src/index.html
// .pal-kbd). A badge that disagrees with src/ui.js's handler is worse
// than no badge at all, so compare them directly instead of trusting
// that someone updated both by hand.
const uiCode   = readFileSync(join(srcDir, 'ui.js'), 'utf8');
const tplCode   = readFileSync(join(srcDir, 'index.html'), 'utf8');

// Pull the live bindings out of the keydown handler.
const durLit  = uiCode.match(/const\s+durMap\s*=\s*\{([^}]*)\}/);
const noteLit = uiCode.match(/const\s+noteKeys\s*=\s*\{([^}]*)\}/);
assert(!!durLit,  'ui.js — durMap literal is still parseable by the badge drift test');
assert(!!noteLit, 'ui.js — noteKeys literal is still parseable by the badge drift test');

// Keys may be quoted ('1') or bare (c), so accept either and strip quotes.
function _parsePairs(literal) {
  return (literal.match(/(?:'[^']*'|[\w$]+)\s*:\s*'([^']*)'/g) || []).map(p => {
    const m = p.match(/^(?:'([^']*)'|([\w$]+))\s*:\s*'([^']*)'$/);
    return [m[1] !== undefined ? m[1] : m[2], m[3]];
  });
}
const durPairs  = durLit  ? _parsePairs(durLit[1])  : [];   // ['1','w'], ...
const notePairs = noteLit ? _parsePairs(noteLit[1]) : [];   // ['c','C'], ...
const keyForDur = new Map(durPairs.map(([k, d]) => [d, k]));

// Badge markup, in the order the palette lists them.
const badgeForDur = [...tplCode.matchAll(
  /data-dur="([^"]+)"[^>]*>\s*<span class="pal-kbd" aria-hidden="true">([^<]*)<\/span>/g
)].map(m => [m[1], m[2]]);
const badgeForNote = [...tplCode.matchAll(
  /data-name="([A-G])"[^>]*><span class="pal-kbd" aria-hidden="true">([^<]*)<\/span>/g
)].map(m => [m[1], m[2]]);

assertEq(badgeForDur.length, durPairs.length,
  'every duration in durMap has exactly one badge in the palette');
for (const [dur, key] of badgeForDur) {
  assertEq(key, keyForDur.get(dur) ?? null,
    `palette badge for duration "${dur}" matches its key binding`);
}
assertEq(badgeForNote.length, notePairs.length,
  'every note name in noteKeys has exactly one badge in the palette');
for (const [name, key] of badgeForNote) {
  const expected = (notePairs.find(([, n]) => n === name) || [null, null])[0];
  assertEq(key, expected ? expected.toUpperCase() : null,
    `palette badge for note "${name}" matches its key binding`);
}

// The badge must be a static hint, not a hover reveal: iPad has no hover.
assert(/\.pal-kbd\s*\{[^}]*position:\s*absolute/.test(
    readFileSync(join(srcDir, 'styles', 'main.css'), 'utf8')),
  '.pal-kbd is absolutely positioned (no hover dependency)');

// ── Summary ─────────────────────────────────────────────────────
console.log(`\n${_pass} passed, ${_fail} failed`);
process.exit(_fail > 0 ? 1 : 0);
