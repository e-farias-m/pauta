const DEBUG = false;
function debugLog(...args) { if (DEBUG) console.log(...args); }
(function(){
// ================================================================
//  Pauta — MuseScore-compatible notation editor for iPadOS
//  Supports: .mscz / .mscx open + save, note input, playback
//  v0.19.0 — Invariant checks, annotation audit, mode guards,
//            debug overlay, JSDoc types, scale generator
// ================================================================
//
//  ARCHITECTURE MAP (single-file, top → bottom)
//  ─────────────────────────────────────────────────────
//  1. APP state            — global UI + session state (line 1618)
//  2. Score model          — createScore, repair, validate, MSCX I/O (~line 1694)
//     └> THEORY namespace  — pitch/duration/key helpers
//  3. Rendering            — VexFlow layout, SVG overlays (~line 3560)
//     └> RENDER namespace  — drawing helpers, layout constants
//  4. Input / controls     — touch, keyboard, palette, panels (~line 6664)
//  5. Audio / playback     — MIDI, mic, practice mode (~line 9241)
//     └> AUDIO namespace   — Web Audio helpers
//  6. Exercise engine      — generators, session, scoring (~line 8564)
//     └> EXERCISE namespace
//  7. File / boot          — load, save, autosave, boot (~line 11816)
//
//  Rule: mutate score only through commitChange() so undo, repair,
//  validate, render, and autosave stay in sync.
//
//  Namespace pattern: each module defines a const (THEORY, RENDER,
//  AUDIO, EXERCISE) and assigns its functions to it after declaration.
//  Existing global call sites continue to work via window references.
// ================================================================
// ================================================================

let VF; // assigned in bootApp() after VexFlow loads dynamically

// ═══════════════════════════════════════════════════════════════════
// MODULE 1: APP State & Configuration
// ═══════════════════════════════════════════════════════════════════
/** @type {{
  score: Score|null,
  selectedMeasure: number, selectedStaff: number, selectedNoteIdx: number,
  selStartIdx: number,
  inputMode: boolean, chordMode: boolean, markingMode: string|null,
  markingStart: ({mi:number, si:number, ni:number}|null),
  curDur: string, curDot: boolean, curRest: boolean, curAcc: string|null,
  curOctave: number, curVoice: number,
  lyricBold: boolean, lyricItalic: boolean, showTempoOnScore: boolean,
  curTuplet: ({num:number, den:number}|null), tupletPending: number, tupletGroupId: number,
  showNoteLabels: boolean, noteLabelMode: string,
  playing: boolean, tempo: number, pauseVolumeRatio: number,
  undoStack: Array<{score:Score, ui:object}>, redoStack: Array<{score:Score, ui:object}>, _lastUndoFP: string,
  audioCtx: (AudioContext|null), staveLayout: Array, noteLayout: Array,
  playTimers: Array, playStartTime: number,
  countIn: boolean, metronome: boolean, metronomeSubdivision: string,
  practiceMode: boolean,
  assignmentMode: boolean, currentAssignment: object|null,
  exerciseMode: boolean, exerciseSession: object|null, exerciseDifficulty: string,
  uiProfile: string, teachingKit: string|null, teachingKitLevel: string,
  clipboard: object|null,
  showMeasureNumbers: boolean, showMultiMeasureRests: boolean,
  showTheoryOverlay: boolean, showRhythmCounting: boolean,
  zoom: number, continuousView: boolean,
  masterVolume: number, metronomeVolume: number
}} */
const APP = {
  score: null,
  selectedMeasure: 0,
  selectedStaff: 0,
  selectedNoteIdx: -1,
  selStartIdx: -1,
  inputMode: false,
  curDur: 'q',
  curDot: false,
  curRest: false,
  curAcc: null,
  curOctave: 4,
  markingMode: null,
  markingStart: null,
  lyricBold: false,
  lyricItalic: false,
  showTempoOnScore: true,
  chordMode: false,    // when true, next note adds to current note as a chord
  curVoice: 1,         // 1 or 2
  // ── Tuplet state ──────────────────────────────────────────────
  curTuplet: null,     // null | {num:3,den:2} — currently active tuplet ratio
  tupletPending: 0,    // how many more notes remain in the current tuplet group
  tupletGroupId: 0,    // increments each time a tuplet bracket is completed
  // ── Educational labels ────────────────────────────────────────
  showNoteLabels: false,   // toggle solfege labels on all notes
  noteLabelMode: 'solfege',

  playing: false,
  tempo: 120,
  undoStack: [],
  redoStack: [],
  _lastUndoFP: '',
  audioCtx: null,
  staveLayout: [],
  noteLayout: [],   // per-note hit regions for individual selection
  playTimers: [],
  playStartTime: 0,
  countIn: false,
  metronome: false,
  metronomeSubdivision: 'quarter', // 'quarter' | 'eighth' | 'triplet' | 'sixteenth'
  practiceMode: false,
  assignmentMode: false,
  currentAssignment: null,
  exerciseMode: false,
  exerciseSession: null,
  exerciseDifficulty: 'beginner',
  uiProfile: 'advanced',
  teachingKit: null,        // null | 'recorder'
  teachingKitLevel: 'advanced', // 'beginner' | 'intermediate' | 'advanced'
  clipboard: null,
  showMeasureNumbers: false,
  showMultiMeasureRests: false,
  showTheoryOverlay: false,
  showRhythmCounting: false,
  zoom: 1,
  continuousView: false,
  // ── Mixer (volume) settings ────────────────────────────────────
  masterVolume: 0.65,
  metronomeVolume: 1.0,
  pauseVolumeRatio: 0.3,
};

// ── Mode Validation ────────────────────────────────────────────────
/** Mode constraint rules — each returns { ok, msg } or null to skip. */
const MODE_RULES = [
  // Input mode and marking mode are mutually exclusive
  () => APP.inputMode && APP.markingMode ? { ok: false, msg: 'inputMode + markingMode' } : null,
  // Exercise mode should suppress editing modes
  () => APP.exerciseMode && APP.inputMode ? { ok: false, msg: 'exerciseMode + inputMode' } : null,
  () => APP.exerciseMode && APP.chordMode ? { ok: false, msg: 'exerciseMode + chordMode' } : null,
  () => APP.exerciseMode && APP.markingMode ? { ok: false, msg: 'exerciseMode + markingMode' } : null,
  // Assignment mode should suppress editing modes
  () => APP.assignmentMode && APP.inputMode ? { ok: false, msg: 'assignmentMode + inputMode' } : null,
  () => APP.assignmentMode && APP.chordMode ? { ok: false, msg: 'assignmentMode + chordMode' } : null,
  () => APP.assignmentMode && APP.markingMode ? { ok: false, msg: 'assignmentMode + markingMode' } : null,
  // Pending states are mutually exclusive (only markingMode can be pending)
  () => APP.markingMode && APP.inputMode ? { ok: false, msg: 'markingMode + inputMode' } : null,
  // Exercise session should match exercise mode
  () => APP.exerciseMode && !APP.exerciseSession ? { ok: false, msg: 'exerciseMode true but session null' } : null,
  () => !APP.exerciseMode && APP.exerciseSession ? { ok: false, msg: 'exerciseSession set but mode false' } : null,
  // Current assignment should match assignment mode
  () => APP.assignmentMode && !APP.currentAssignment ? { ok: false, msg: 'assignmentMode true but currentAssignment null' } : null,
  () => !APP.assignmentMode && APP.currentAssignment ? { ok: false, msg: 'currentAssignment set but mode false' } : null,
  // Tuplet pending should have active tuplet
  () => APP.tupletPending > 0 && !APP.curTuplet ? { ok: false, msg: 'tupletPending > 0 but no curTuplet' } : null,
];

/** Check all mode rules and log warnings for violations. */
function _validateModeState() {
  for (const rule of MODE_RULES) {
    const result = rule();
    if (result && !result.ok) {
      console.warn('[Pauta Mode]', result.msg);
    }
  }
}

/**
 * Entry-point guard. Throws if any forbidden mode is active or any required mode is missing.
 * Use at the top of UI handlers that depend on specific mode state.
 *   _require({ require: ['selectedNote'], forbid: ['inputMode', 'markingMode'] });
 * @param {{require?:string[], forbid?:string[]}} opts
 */
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
  function die(msg) { throw new Error(msg); }
  for (const key of require) {
    if (checks[key]) checks[key]();
  }
  for (const key of forbid) {
    const negKey = 'no' + key.charAt(0).toUpperCase() + key.slice(1);
    if (checks[negKey]) checks[negKey]();
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 2: Score Foundation & Model
// ═══════════════════════════════════════════════════════════════════
// ── Score Foundation (Phase 1) ───────────────────────────────────
// Data contract version — bump when the score JSON shape changes.
const SCORE_FORMAT_VERSION = 1;

/**
 * @typedef {{startMi:number, startNi:number, endMi:number, endNi:number, si:number}} SlurEntry
 * @typedef {{type:string, startMi:number, startNi:number, endMi:number, endNi:number, si:number}} HairpinEntry
 * @typedef {{mi:number, text:string}} StaffTextEntry
 * @typedef {{mi:number, label:string}} RehearsalMarkEntry
 * @typedef {{pitch:number, accidental:string|null}} ExtraPitch

 * @typedef {Object} Note
 * @property {'note'|'rest'} type
 * @property {string} duration  - 'w'|'h'|'q'|'8'|'16'|'32'|'64'
 * @property {number} [pitch]   - MIDI note number (12–120), required for notes
 * @property {number} dots
 * @property {number} voice     - 1 or 2
 * @property {string|null} [accidental]
 * @property {Array<{pitch:number, accidental:string|null}>} [extraPitches] - chord tones
 * @property {boolean} [tieToNext]
 * @property {string|null} [articulation]
 * @property {string|null} [fingering]
 * @property {string|null} [dynamic]
 * @property {string|null} [lyric]
 * @property {string|null} [chordSymbol]
 * @property {string|null} [woodwindFingering]
 * @property {number|null} [stringNum]
 * @property {string|null} [notehead]
 *
 * @typedef {Object} Measure
 * @property {number|null} timeSigNum
 * @property {number|null} timeSigDen
 * @property {number|null} keySig
 * @property {boolean} lineBreak
 * @property {Note[]} notes
 * @property {string} [barline]
 * @property {boolean} [pickup]
 *
 * @typedef {Object} Stave
 * @property {string} clef
 * @property {Measure[]} measures
 *
 * @typedef {Object} Part
 * @property {string} name
 * @property {string} instrument
 * @property {string} osc
 * @property {Stave[]} staves
 * @property {number} [volume]
 * @property {boolean} [muted]
 *
 * @typedef {Object} Score
 * @property {string} title
 * @property {string} composer
 * @property {number} scoreVersion
 * @property {Part[]} parts
 * @property {Array<{si:number, startMi:number, startNi:number, endMi:number, endNi:number}>} slurs
 * @property {Array<{type:string, si:number, startMi:number, startNi:number, endMi:number, endNi:number}>} hairpins
 * @property {Array<{mi:number, label:string}>} rehearsalMarks
 * @property {Array<{mi:number, text:string}>} staffTexts
 * @property {Array<{id:string, title:string, range:{startMi:number, endMi:number}, hidden:string[], hints:{showFirstNote:boolean}}>} assignments
 * @property {Object<string, {answers:Array, submitted:boolean}>} studentAnswers
 * @property {boolean} [showMeasureNumbers]
 * @property {boolean} [showMultiMeasureRests]
 */

const VALID_DURATIONS = new Set(['w', 'h', 'q', '8', '16', '32', '64']);

// Score-level lists whose items reference measure indices (mi / startMi / endMi).
const SCORE_MEASURE_REF_RULES = [
  { key: 'slurs',          range: true,  start: 'startMi', end: 'endMi' },
  { key: 'hairpins',       range: true,  start: 'startMi', end: 'endMi' },
  { key: 'rehearsalMarks', range: false, field: 'mi' },
  { key: 'staffTexts',     range: false, field: 'mi' },
];

// ── UI Difficulty Profiles ────────────────────────────────────────
const UI_PROFILES = {
  beginner: {
    hideDurations: ['32', '64'],
    hidePanels:    ['artic', 'lines', 'bars', 'tempo', 'clef', 'text'],
    hideButtons:   ['btn-triplet', 'btn-voice2', 'btn-chord'],
    maxMeasures:   8,
    description:   'Beginner — simplified palette, limited measures',
  },
  intermediate: {
    hideDurations: ['64'],
    hidePanels:    ['bars'],
    hideButtons:   ['btn-voice2'],
    maxMeasures:   32,
    description:   'Intermediate — most features, fewer limits',
  },
  advanced: {
    hideDurations: [],
    hidePanels:    [],
    hideButtons:   [],
    maxMeasures:   Infinity,
    description:   'Advanced — full notation toolkit',
  },
};

// ── Teaching Kits ─────────────────────────────────────────────────
// Contextual presets that reconfigure the app for a specific
// classroom use-case.  Manual composition remains unlimited;
// kits only filter generated exercises and the Add-Instrument list.
const FAMILY_KIT_MAP = { Recorder: 'recorder', Keyboard: 'keyboard' };

const KIT_CONFIGS = {
  recorder: {
    name: 'Recorder Classroom',
    description: 'Soprano recorder pedagogy with optional alto and full consort',
    instruments: {
      beginner:     ['Soprano Recorder'],
      intermediate: ['Soprano Recorder', 'Alto Recorder'],
      advanced:     ['Sopranino Recorder','Soprano Recorder','Alto Recorder','Tenor Recorder','Bass Recorder','Great Bass Recorder'],
    },
    defaultInstrument: 'Soprano Recorder',
    exerciseRanges: {
      beginner:     { min: 72, max: 84 },
      intermediate: { min: 67, max: 84 },
      advanced:     { min: 60, max: 86 },
    },
    exerciseKeys: {
      beginner:     [0, -1, 1],
      intermediate: [-3,-2,-1,0,1,2,3],
      advanced:     [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7],
    },
    suggestedProfile: {
      beginner:     'beginner',
      intermediate: 'intermediate',
      advanced:     'advanced',
    },
  },
  keyboard: {
    name: 'Keyboard Classroom',
    description: 'Piano and keyboard fundamentals',
    instruments: {
      beginner:     ['Piano'],
      intermediate: ['Piano', 'Celesta'],
      advanced:     ['Piano', 'Organ', 'Harpsichord', 'Celesta'],
    },
    defaultInstrument: 'Piano',
    exerciseRanges: {
      beginner:     { min: 60, max: 79 },
      intermediate: { min: 55, max: 84 },
      advanced:     { min: 48, max: 96 },
    },
    exerciseKeys: {
      beginner:     [0, -1, 1],
      intermediate: [-3,-2,-1,0,1,2,3],
      advanced:     [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7],
    },
    suggestedProfile: {
      beginner:     'beginner',
      intermediate: 'intermediate',
      advanced:     'advanced',
    },
  },
};

function applyKit(kitName, level) {
  const kit = KIT_CONFIGS[kitName];
  if (!kit) { showToast('Unknown teaching kit: ' + kitName); return; }
  if (!kit.instruments[level]) { showToast('Unknown level: ' + level); return; }
  APP.teachingKit = kitName;
  APP.teachingKitLevel = level;
  // Optionally sync the UI profile to the kit's suggestion
  const suggested = kit.suggestedProfile[level];
  if (suggested && UI_PROFILES[suggested]) applyUIProfile(suggested);
  try { localStorage.setItem('pauta_kit', kitName); localStorage.setItem('pauta_kit_level', level); } catch(e) { console.warn('[Pauta]', e.message); }
  showToast(`${kit.name} — ${level}`);
}

function clearKit() {
  APP.teachingKit = null;
  APP.teachingKitLevel = 'advanced';
  try { localStorage.removeItem('pauta_kit'); localStorage.removeItem('pauta_kit_level'); } catch(e) { console.warn('[Pauta]', e.message); }
  showToast('General Music mode');
}

function _kitInstrumentList(level) {
  const kit = APP.teachingKit ? KIT_CONFIGS[APP.teachingKit] : null;
  if (!kit) return INSTRUMENTS.map(i => i.name);
  return kit.instruments[level || APP.teachingKitLevel] || INSTRUMENTS.map(i => i.name);
}

function _kitDefaultInstrument() {
  const kit = APP.teachingKit ? KIT_CONFIGS[APP.teachingKit] : null;
  return kit?.defaultInstrument || 'Piano';
}

function _kitExerciseRange() {
  const kit = APP.teachingKit ? KIT_CONFIGS[APP.teachingKit] : null;
  if (!kit) return null; // no restriction
  return kit.exerciseRanges[APP.teachingKitLevel] || null;
}

function _kitExerciseKeys() {
  const kit = APP.teachingKit ? KIT_CONFIGS[APP.teachingKit] : null;
  if (!kit) return null;
  return kit.exerciseKeys[APP.teachingKitLevel] || null;
}

function applyUIProfile(profileName) {
  const profile = UI_PROFILES[profileName] || UI_PROFILES.advanced;
  const prev = UI_PROFILES[APP.uiProfile] || UI_PROFILES.advanced;
  APP.uiProfile = profileName;

  // Durations
  document.querySelectorAll('.pal-btn[data-dur]').forEach(btn => {
    btn.hidden = profile.hideDurations.includes(btn.dataset.dur);
  });
  // Specific buttons
  profile.hideButtons.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  // Unhide buttons not in the list
  Object.keys(UI_PROFILES).forEach(k => {
    if (k === profileName) return;
    UI_PROFILES[k].hideButtons.forEach(id => {
      if (!profile.hideButtons.includes(id)) {
        const el = document.getElementById(id);
        if (el) el.hidden = false;
      }
    });
  });
  // Side tabs (panels)
  document.querySelectorAll('.side-tab').forEach(tab => {
    const panel = tab.dataset.panel;
    if (panel) {
      tab.hidden = profile.hidePanels.includes(panel);
    }
  });
  // If the currently open side panel is now hidden, close it
  if (_activePanel && profile.hidePanels.includes(_activePanel)) {
    togglePanel(_activePanel);
  }

  // Build explicit change summary for toast
  const changes = [];
  const durLabels = {w:'whole', h:'half', q:'quarter', '8':'eighth', '16':'16th', '32':'32nd', '64':'64th'};
  const newlyHiddenDurs = profile.hideDurations.filter(d => !prev.hideDurations.includes(d));
  const newlyShownDurs  = prev.hideDurations.filter(d => !profile.hideDurations.includes(d));
  if (newlyHiddenDurs.length) changes.push('hiding ' + newlyHiddenDurs.map(d => durLabels[d] || d).join(', ') + ' notes');
  if (newlyShownDurs.length)  changes.push('showing ' + newlyShownDurs.map(d => durLabels[d] || d).join(', ') + ' notes');
  const newlyHiddenPanels = profile.hidePanels.filter(p => !prev.hidePanels.includes(p));
  const newlyShownPanels  = prev.hidePanels.filter(p => !profile.hidePanels.includes(p));
  if (newlyHiddenPanels.length) changes.push('hiding ' + newlyHiddenPanels.length + ' panel' + (newlyHiddenPanels.length > 1 ? 's' : ''));
  if (newlyShownPanels.length)  changes.push('showing ' + newlyShownPanels.length + ' panel' + (newlyShownPanels.length > 1 ? 's' : ''));

  let msg;
  if (changes.length) {
    msg = profileName.charAt(0).toUpperCase() + profileName.slice(1) + ' profile: ' + changes.join('; ');
  } else {
    msg = profileName.charAt(0).toUpperCase() + profileName.slice(1) + ' profile (no change)';
  }
  showToast(msg, changes.length ? 2500 : 1200);

  // Store preference
  try { localStorage.setItem('pauta_ui_profile', profileName); } catch(e) { console.warn('[Pauta]', e.message); }
}

function togglePalette() {
  const pal = document.getElementById('palette');
  if (!pal) return;
  const collapsed = pal.classList.toggle('collapsed');
  const lbl = document.getElementById('palette-toggle-label');
  if (lbl) lbl.textContent = collapsed ? 'Show Palette' : 'Hide Palette';
  try { localStorage.setItem('pauta_palette_collapsed', collapsed ? '1' : ''); } catch(e) { console.warn('[Pauta]', e.message); }
}
