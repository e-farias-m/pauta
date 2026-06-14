// ═══════════════════════════════════════════════════════════════════
// exercises.js — Exercise types, generators, curriculum, scales,
//                 EVALUATOR, SESSION_MANAGER
// ═══════════════════════════════════════════════════════════════════

// ── Transposition ─────────────────────────────────────────────────
// ── Transposition ─────────────────────────────────────────────────
// Chromatic semitones for each diatonic step (ascending) in a major scale:
// Used to figure out how many semitones correspond to a diatonic interval.
const DIA_SEMITONES = [0,2,4,5,7,9,11]; // C D E F G A B

// Transpose the entire score (all parts, all staves) by a number of semitones.
// diaSteps is the diatonic shift (for accidental book-keeping, +/- integer).
function transposeScore(semitones) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { UI.showToast(e.message); return; }
  if (!semitones) return;
  SCORE.commitChange(score => {
    score.parts.forEach(part => {
      part.staves.forEach(stave => {
        stave.measures.forEach(m => {
          if (m.keySig !== null && m.keySig !== undefined) {
            const KS_PC = [0,7,2,9,4,11,6,1,5,10,3,8,1,6,11];
            const oldPC = KS_PC[m.keySig + 7] ?? 0;
            const newPC = ((oldPC + semitones) % 12 + 12) % 12;
            let newKS = 0;
            for (let k = -7; k <= 7; k++) { if (KS_PC[k+7] === newPC) { newKS = k; break; } }
            m.keySig = newKS;
          }
          m.notes.forEach(n => {
            if (n.type !== 'note') return;
            n.pitch = Math.max(12, Math.min(120, n.pitch + semitones));
            if (n.extraPitches) n.extraPitches.forEach(ep => {
              ep.pitch = Math.max(12, Math.min(120, ep.pitch + semitones));
            });
            const pc2 = n.pitch % 12;
            n.accidental = DIATONIC_PCS.has(pc2) ? null : (m.keySig < 0 ? 'b' : '#');
          });
        });
      });
    });
  }, { toast: `Transposed ${semitones > 0 ? '+' : ''}${semitones} semitone${Math.abs(semitones)===1?'':'s'}` });
  _auditAnnotationsAfterEdit(APP.score, 'transpose', semitones);
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 5c: Exercise Engine
/**
 * @namespace EXERCISE
 * Exercise engine: generators, session management, scoring, and UI.
 * Provides: generateExercise, startExerciseSession, endExerciseSession,
 * nextExercise, retryExercise, skipExercise, checkExerciseAnswer,
 * showExerciseDialog, selectExerciseDifficulty, and all _present* / _gen*
 * generator functions.
 */
const EXERCISE = {};
// ══════════════════════════════════════════════════════════════════
// A self-contained practice system with generated exercises,
// real-time feedback, hints, and progress tracking.

const EXERCISE_TYPES = {
  NOTE_ID:       'note_id',
  INTERVAL_ID:   'interval_id',
  RHYTHM_READ:   'rhythm_read',
  MELODY_DICT:   'melody_dictation',
  KEY_SIG_ID:    'key_sig_id',
  RHYTHM_WS:     'rhythm_worksheet',
  SCALE_ID:      'scale_id',
  NOTE_CONSTRUCT:'note_construct',
  RHYTHM_WORKOUT:'rhythm_workout',
};

const INTERVAL_NAMES = {
  0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd',
  4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th',
  8: 'Minor 6th', 9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave'
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

function _intervalMatches(userInput, targetName) {
  const norm = s => s.toLowerCase().replace(/[\s\-_]/g,'');
  const n = norm(userInput);
  const aliases = INTERVAL_ALIASES[targetName.toLowerCase()] || [];
  return n === norm(targetName) || aliases.some(a => norm(a) === n);
}

// ── Structured Curriculum Paths ────────────────────────────────
const CURRICULUM = [
  {
    id: 'grade-1-rhythm',
    title: 'Grade 1: Rhythm Basics',
    description: 'Quarter notes, half notes, and whole notes in 4/4 time',
    icon: '🥁',
    exercises: [
      { type: 'rhythm_read', difficulty: 'beginner', label: 'Quarter & Half Notes', count: 5 },
      { type: 'rhythm_read', difficulty: 'beginner', label: 'Whole Notes & Rests', count: 5 },
      { type: 'rhythm_worksheet', difficulty: 'beginner', label: 'Dictation: Simple Beats', count: 3 },
    ],
    unlockCondition: null, // always available
  },
  {
    id: 'grade-2-notes',
    title: 'Grade 2: Note Reading',
    description: 'Identify notes on treble clef (C4–C5 naturals)',
    icon: '🎵',
    exercises: [
      { type: 'note_id', difficulty: 'beginner', label: 'Treble Clef: C–C', count: 10 },
      { type: 'note_id', difficulty: 'beginner', label: 'Treble Clef: Extend Range', count: 10 },
    ],
    unlockCondition: { type: 'sessions', count: 5, exerciseType: 'rhythm_read' },
  },
  {
    id: 'grade-3-intervals',
    title: 'Grade 3: Intervals',
    description: 'Major and minor 2nds, 3rds, and perfect 4ths',
    icon: '↔',
    exercises: [
      { type: 'interval_id', difficulty: 'beginner', label: '2nds & 3rds', count: 8 },
      { type: 'interval_id', difficulty: 'beginner', label: '4ths & 5ths', count: 8 },
      { type: 'interval_id', difficulty: 'intermediate', label: 'All Intervals', count: 8 },
    ],
    unlockCondition: { type: 'sessions', count: 5, exerciseType: 'note_id' },
  },
  {
    id: 'grade-3b-scales',
    title: 'Grade 3b: Scale Identification',
    description: 'Identify major, minor, and pentatonic scales by ear',
    icon: '🎹',
    exercises: [
      { type: 'scale_id', difficulty: 'beginner', label: 'Major & Minor', count: 8 },
      { type: 'scale_id', difficulty: 'intermediate', label: 'Modes & Pentatonic', count: 8 },
      { type: 'scale_id', difficulty: 'advanced', label: 'All Scales', count: 8 },
    ],
    unlockCondition: { type: 'sessions', count: 3, exerciseType: 'note_id' },
  },
  {
    id: 'grade-4-keysigs',
    title: 'Grade 4: Key Signatures',
    description: 'Major and minor keys with up to 2 sharps/flats',
    icon: '🔑',
    exercises: [
      { type: 'key_sig_id', difficulty: 'beginner', label: 'Major Keys: 0–2 sharps', count: 8 },
      { type: 'key_sig_id', difficulty: 'beginner', label: 'Minor Keys: 0–2 flats', count: 8 },
      { type: 'key_sig_id', difficulty: 'intermediate', label: 'All Keys', count: 8 },
    ],
    unlockCondition: { type: 'sessions', count: 5, exerciseType: 'interval_id' },
  },
  {
    id: 'grade-5-rhythm-2',
    title: 'Grade 5: Rhythm Reading',
    description: 'Eighth notes, dotted rhythms, and syncopation',
    icon: '🎶',
    exercises: [
      { type: 'rhythm_read', difficulty: 'intermediate', label: 'Eighth Notes', count: 5 },
      { type: 'rhythm_read', difficulty: 'intermediate', label: 'Dotted Rhythms', count: 5 },
      { type: 'rhythm_worksheet', difficulty: 'intermediate', label: 'Dictation: Mixed', count: 3 },
    ],
    unlockCondition: { type: 'sessions', count: 8, exerciseType: 'key_sig_id' },
  },
  {
    id: 'grade-6-melody',
    title: 'Grade 6: Melody Dictation',
    description: 'Hear and notate short melodies',
    icon: '🎼',
    exercises: [
      { type: 'melody_dictation', difficulty: 'beginner', label: '4-note Melodies', count: 5 },
      { type: 'melody_dictation', difficulty: 'intermediate', label: '6-note Melodies', count: 5 },
      { type: 'melody_dictation', difficulty: 'advanced', label: '8-note Melodies', count: 5 },
    ],
    unlockCondition: { type: 'sessions', count: 8, exerciseType: 'rhythm_read' },
  },
  {
    id: 'advanced-comprehensive',
    title: 'Advanced: Comprehensive',
    description: 'All exercise types at advanced difficulty',
    icon: '🏆',
    exercises: [
      { type: 'note_id', difficulty: 'advanced', label: 'Chromatic Note ID', count: 8 },
      { type: 'interval_id', difficulty: 'advanced', label: 'All Intervals', count: 8 },
      { type: 'rhythm_read', difficulty: 'advanced', label: 'Complex Rhythms', count: 5 },
      { type: 'key_sig_id', difficulty: 'advanced', label: 'All Key Signatures', count: 8 },
      { type: 'melody_dictation', difficulty: 'advanced', label: 'Long Melodies', count: 5 },
    ],
    unlockCondition: { type: 'sessions', count: 15, exerciseType: null }, // any 15 sessions
  },
];

const CURRICULUM_KEY = 'pauta_curriculum_progress';

function _loadCurriculumProgress() {
  try { return JSON.parse(localStorage.getItem(CURRICULUM_KEY)) || {}; }
  catch(e) { return {}; }
}

function _saveCurriculumProgress(progress) {
  localStorage.setItem(CURRICULUM_KEY, JSON.stringify(progress));
}

function _getCurriculumProgress(gradeId) {
  const progress = _loadCurriculumProgress();
  return progress[gradeId] || { completed: 0, bestScore: 0 };
}

function _isCurriculumUnlocked(grade) {
  if (!grade.unlockCondition) return true;
  const results = _loadResults();
  const { type, count, exerciseType } = grade.unlockCondition;
  if (type === 'sessions') {
    if (exerciseType) {
      return results.filter(r => r.type === exerciseType).length >= count;
    }
    return results.length >= count;
  }
  return true;
}

function _recordCurriculumExercise(gradeId, exerciseIdx, pct) {
  const progress = _loadCurriculumProgress();
  if (!progress[gradeId]) progress[gradeId] = { completed: 0, bestScore: 0, exercises: {} };
  const g = progress[gradeId];
  g.exercises[exerciseIdx] = { lastScore: pct, bestScore: Math.max(g.exercises[exerciseIdx]?.bestScore || 0, pct) };
  g.completed = Object.keys(g.exercises).length;
  g.bestScore = Math.round(Object.values(g.exercises).reduce((s, e) => s + e.bestScore, 0) / Object.values(g.exercises).length);
  _saveCurriculumProgress(progress);
}

function showCurriculumDialog() {
  if (APP.exerciseMode) { UI.showToast('Finish your current exercise first'); return; }

  const progress = _loadCurriculumProgress();
  const results = _loadResults();
  const totalSessions = results.length;

  const gradeHtml = CURRICULUM.map((grade, idx) => {
    const unlocked = _isCurriculumUnlocked(grade);
    const p = _getCurriculumProgress(grade.id);
    const totalExercises = grade.exercises.reduce((s, e) => s + e.count, 0);
    const completedExercises = p.completed || 0;
    const pct = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    return `<div style="margin-bottom:10px;padding:10px;background:${unlocked ? 'rgba(192,86,33,0.04)' : 'rgba(0,0,0,0.03)'};border-radius:8px;border:1px solid ${unlocked ? 'rgba(192,86,33,0.15)' : 'rgba(0,0,0,0.06)'};${!unlocked ? 'opacity:0.5' : ''}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:24px">${grade.icon}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;color:var(--pauta-text)">${grade.title}</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.7)">${grade.description}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:${pct >= 80 ? 'var(--pauta-success)' : pct >= 50 ? 'var(--pauta-warning)' : 'var(--pauta-primary)'}">${pct}%</div>
          <div style="font-size:10px;color:rgba(74,85,104,0.5)">${completedExercises}/${totalExercises}</div>
        </div>
      </div>
      ${unlocked ? `<div style="display:flex;gap:4px;flex-wrap:wrap">
        ${grade.exercises.map((ex, exIdx) => {
          const ep = p.exercises?.[exIdx];
          const done = ep?.lastScore !== undefined;
          const score = ep?.bestScore || 0;
          return `<button class="modal-btn ${done ? 'secondary' : 'primary'}" 
            data-action="startCurriculumGrade" data-grade="${grade.id}" data-exercise="${exIdx}"
            style="flex:1;min-width:120px;padding:6px 8px;font-size:11px;text-align:left">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span>${done ? '✓' : '▶'} ${ex.label}</span>
              ${done ? `<span style="font-size:10px;color:${score >= 80 ? 'var(--pauta-success)' : 'var(--pauta-warning)'}">${score}%</span>` : ''}
            </div>
          </button>`;
        }).join('')}
      </div>` : `<div style="font-size:11px;color:rgba(74,85,104,0.5);text-align:center;margin-top:4px">
        🔒 Complete ${grade.unlockCondition.count} ${grade.unlockCondition.exerciseType ? TYPE_LABELS[grade.unlockCondition.exerciseType] : 'total'} sessions to unlock
      </div>`}
    </div>`;
  }).join('');

  UI.makeModal(`
    <h2>📚 Curriculum</h2>
    <div style="font-size:12px;color:var(--pauta-text-muted);margin-bottom:12px;text-align:center">
      Structured learning path · ${totalSessions} total sessions completed
    </div>
    <div style="flex-shrink:0;max-height:340px;overflow-y:auto">
      ${gradeHtml}
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function startCurriculumGrade(gradeId, exerciseIdx) {
  const grade = CURRICULUM.find(g => g.id === gradeId);
  if (!grade || !_isCurriculumUnlocked(grade)) { UI.showToast('Grade not yet unlocked'); return; }
  const exercise = grade.exercises[exerciseIdx];
  if (!exercise) return;

  // Map curriculum exercise type/difficulty to session
  const typeMap = {
    'note_id': EXERCISE_TYPES.NOTE_ID,
    'interval_id': EXERCISE_TYPES.INTERVAL_ID,
    'rhythm_read': EXERCISE_TYPES.RHYTHM_READ,
    'melody_dictation': EXERCISE_TYPES.MELODY_DICT,
    'key_sig_id': EXERCISE_TYPES.KEY_SIG_ID,
    'rhythm_worksheet': EXERCISE_TYPES.RHYTHM_WS,
  };
  const diffMap = { 'beginner': 0, 'intermediate': 1, 'advanced': 2 };
  const sessionType = typeMap[exercise.type] || EXERCISE_TYPES.NOTE_ID;
  const difficulty = exercise.difficulty || 'beginner';

  // Store curriculum context for recording results
  APP._curriculumGrade = gradeId;
  APP._curriculumExerciseIdx = exerciseIdx;

  startExerciseSession(sessionType, difficulty);
}

const KEY_SIG_NAMES = {
  '-7':'Cb', '-6':'Gb', '-5':'Db', '-4':'Ab', '-3':'Eb', '-2':'Bb', '-1':'F',
  '0':'C', '1':'G', '2':'D', '3':'A', '4':'E', '5':'B', '6':'F#', '7':'C#'
};
const KEY_SIG_MINOR_NAMES = {
  '-7':'Abm', '-6':'Ebm', '-5':'Bbm', '-4':'Fm', '-3':'Cm', '-2':'Gm', '-1':'Dm',
  '0':'Am', '1':'Em', '2':'Bm', '3':'F#m', '4':'C#m', '5':'G#m', '6':'D#m', '7':'A#m'
};

// ── Adaptive Difficulty ────────────────────────────────────────
// Analyzes recent performance to recommend the best difficulty level.
const DIFF_NAMES = ['beginner', 'intermediate', 'advanced'];

function recommendDifficulty(exerciseType) {
  const results = _loadResults();
  if (!results.length) return APP.exerciseDifficulty || 'beginner';

  // Get recent 10 sessions of this type (or all types if none specific)
  const relevant = exerciseType
    ? results.filter(r => r.type === exerciseType).slice(-10)
    : results.slice(-10);

  if (!relevant.length) return APP.exerciseDifficulty || 'beginner';

  const avgPct = relevant.reduce((s, r) => s + r.pct, 0) / relevant.length;
  const recentPct = relevant[relevant.length - 1].pct;
  const lastThree = relevant.slice(-3);
  const lastThreeAvg = lastThree.reduce((s, r) => s + r.pct, 0) / lastThree.length;

  const currentDiff = DIFF_NAMES.indexOf(APP.exerciseDifficulty || 'beginner');

  // Upgrade: 3 consecutive sessions > 85%
  if (lastThreeAvg >= 85 && currentDiff < 2) {
    const newDiff = DIFF_NAMES[currentDiff + 1];
    UI.showToast(`📈 Great performance! Moving to ${newDiff}`);
    APP.exerciseDifficulty = newDiff;
    return newDiff;
  }

  // Downgrade: 3 consecutive sessions < 50%
  if (lastThreeAvg < 50 && currentDiff > 0) {
    const newDiff = DIFF_NAMES[currentDiff - 1];
    UI.showToast(`📉 Let's try ${newDiff} for now`);
    APP.exerciseDifficulty = newDiff;
    return newDiff;
  }

  return DIFF_NAMES[currentDiff];
}

function generateExercise(type, difficulty = 'beginner') {
  const s = APP.exerciseSession;
  
  // Warm-up phase: first 3 questions always beginner difficulty
  const effectiveDifficulty = (s && s.warmupCount < 3) ? 'beginner' : difficulty;
  
  const diffs = { beginner: 0, intermediate: 1, advanced: 2 };
  const d = diffs[effectiveDifficulty] ?? 0;

  switch (type) {
    case EXERCISE_TYPES.NOTE_ID:
      return _genNoteId(d);
    case EXERCISE_TYPES.INTERVAL_ID:
      return _genIntervalId(d);
    case EXERCISE_TYPES.RHYTHM_READ:
      return _genRhythmRead(d);
    case EXERCISE_TYPES.MELODY_DICT:
      return _genMelodyDict(d);
    case EXERCISE_TYPES.KEY_SIG_ID:
      return _genKeySigId(d);
    case EXERCISE_TYPES.RHYTHM_WS:
      return _genRhythmWorksheet(d);
    case EXERCISE_TYPES.SCALE_ID:
      return _genScaleId(d);
    case EXERCISE_TYPES.NOTE_CONSTRUCT:
      return _genNoteConstruct(d);
    case EXERCISE_TYPES.RHYTHM_WORKOUT:
      return _genRhythmWorkout();
    default:
      return _genNoteId(d);
  }
}

const NATURAL_PITCHES = {
  beginner:     [60,62,64,65,67,69,71,72],     // C4–C5, naturals only
  intermediate: [57,59,60,62,64,65,67,69,71,72,74,76], // A3–E5, naturals
  advanced:     null,  // full chromatic range
};

const CLEF_DEFAULT_RANGES = {
  treble: { min: 60, max: 79 },  // C4–G5
  alto:   { min: 55, max: 72 },  // G3–C5
  bass:   { min: 48, max: 67 },  // C3–A4
};

function _instrumentClef(instrName) {
  const instr = INSTRUMENTS.find(i => i.name === instrName);
  return instr?.staves?.[0] || 'treble';
}

function _defaultRange() {
  const kitRange = _kitExerciseRange();
  if (kitRange) return kitRange;
  const clef = _instrumentClef(_kitDefaultInstrument());
  return CLEF_DEFAULT_RANGES[clef] || CLEF_DEFAULT_RANGES.treble;
}

function _snapToKey(pitch, ks) {
  const tonicPC = ({0:0,1:7,2:2,3:9,4:4,5:11,6:6,7:1,"-1":5,"-2":10,"-3":3,"-4":8,"-5":1,"-6":6,"-7":11}[ks] ?? 0);
  const diatonic = new Set([0,2,4,5,7,9,11].map(i => (tonicPC + i) % 12));
  const pc = pitch % 12;
  if (diatonic.has(pc)) return pitch;
  // Snap to nearest diatonic pitch class
  let up = pitch, down = pitch;
  while (true) {
    up = up + 1;
    down = down - 1;
    if (diatonic.has(up % 12)) return up;
    if (diatonic.has(down % 12)) return down;
    if (up - pitch > 6) return pitch; // safety
  }
}

function _genNoteId(difficulty) {
  const levelNames = ['beginner','intermediate','advanced'];
  const range = _defaultRange();
  let pitch;
  if (_kitExerciseRange()) {
    // Kit-aware: use kit range, still naturals-only for beginner
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    const validPool = pool ? pool.filter(p => p >= range.min && p <= range.max) : null;
    pitch = validPool?.length
      ? validPool[Math.floor(Math.random() * validPool.length)]
      : Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  } else {
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    pitch = pool
      ? pool[Math.floor(Math.random() * pool.length)]
      : Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
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

function _genNoteConstruct(difficulty) {
  const levelNames = ['beginner','intermediate','advanced'];
  const range = _defaultRange();
  let pitch;
  if (_kitExerciseRange()) {
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    const validPool = pool ? pool.filter(p => p >= range.min && p <= range.max) : null;
    pitch = validPool?.length
      ? validPool[Math.floor(Math.random() * validPool.length)]
      : Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  } else {
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    pitch = pool
      ? pool[Math.floor(Math.random() * pool.length)]
      : Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const pc = pitch % 12;
  const oct = Math.floor(pitch / 12) - 1;
  const answer = names[pc] + oct;
  return {
    type: EXERCISE_TYPES.NOTE_CONSTRUCT,
    difficulty,
    target: { pitch, name: names[pc], octave: oct },
    answer,
    hint: `Click on the correct line or space on the staff.`,
  };
}

function _genIntervalId(difficulty) {
  const intervals = difficulty === 0 ? [2,3,4,5,7] : difficulty === 1 ? [1,2,3,4,5,6,7,8] : [0,1,2,3,4,5,6,7,8,9,10,11,12];
  const semitones = intervals[Math.floor(Math.random() * intervals.length)];
  const dir = Math.random() > 0.5 ? 1 : -1;
  const range = _defaultRange();
  const baseMin = range.min;
  const baseMax = range.max;
  const rangeSize = Math.max(1, baseMax - baseMin - semitones + 1);
  const bottom = Math.max(baseMin, Math.min(baseMax - semitones, baseMin + Math.floor(Math.random() * rangeSize)));
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
    // beginner
    [['q','q','q','q'], ['q','q','h'], ['h','q','q'], ['q','h','q']],
    // intermediate
    [['q','q','8','8','q'], ['q','8','8','q','q'], ['h','8','8'], ['q.','8','q','q']],
    // advanced
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
  // Ensure no measure is all rests (boring) and no measure is all notes (too easy for advanced)
  for (let m = 0; m < measures; m++) {
    const start = m * 4;
    const slice = beats.slice(start, start + 4);
    if (slice.every(b => b === 'r')) beats[start + Math.floor(Math.random() * 4)] = 'q';
    if (difficulty >= 1 && slice.every(b => b === 'q')) beats[start + Math.floor(Math.random() * 4)] = 'r';
  }
  const grid = beats.map(b => b === 'q' ? '♩' : '𝄽');
  return {
    type: EXERCISE_TYPES.RHYTHM_WS,
    difficulty,
    target: { beats, measures, timeSigNum: 4, timeSigDen: 4, grid },
    answer: beats.join(','),
    hint: `Read the rhythm and mark each beat in the grid below.`,
  };
}

function _genMelodyDict(difficulty) {
  const lengths = [4, 6, 8];
  const len = lengths[Math.min(difficulty, 2)];
  
  // Leveling: start with C major, progress to other keys
  const keyProgression = [
    { ks: 0, name: 'C major' },           // Beginner
    { ks: 0, name: 'C major' },           // Still C major
    { ks: 1, name: 'G major' },           // One sharp
    { ks: -1, name: 'F major' },          // One flat
    { ks: 2, name: 'D major' },           // Two sharps
    { ks: -2, name: 'Bb major' },         // Two flats
    { ks: 3, name: 'A major' },           // Three sharps
    { ks: -3, name: 'Eb major' },         // Three flats
  ];
  
  // Use difficulty to determine which keys are available
  const maxKeyIdx = Math.min(difficulty * 2 + 1, keyProgression.length - 1);
  const keyIdx = Math.floor(Math.random() * (maxKeyIdx + 1));
  const key = keyProgression[keyIdx];
  const ks = key.ks;
  
  const kitRange = _kitExerciseRange();
  const baseMin = kitRange ? kitRange.min : 60;
  const baseMax = kitRange ? kitRange.max : 72;
  const basePitch = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
  
  const notes = [];
  for (let i = 0; i < len; i++) {
    const step = [-2, -1, 0, 1, 2][Math.floor(Math.random() * 5)];
    let pitch = Math.max(baseMin, Math.min(baseMax, (notes.length ? notes[i-1].pitch : basePitch) + step));
    pitch = _snapToKey(pitch, ks);
    const durs = difficulty === 0 ? ['q','h'] : difficulty === 1 ? ['q','h','8'] : ['q','h','8','16'];
    notes.push({ pitch, duration: durs[Math.floor(Math.random() * durs.length)] });
  }
  
  // Get first note name for display
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const firstPc = notes[0].pitch % 12;
  const firstOct = Math.floor(notes[0].pitch / 12) - 1;
  const firstName = noteNames[firstPc] + firstOct;
  
  return {
    type: EXERCISE_TYPES.MELODY_DICT,
    difficulty,
    target: { notes, keySig: ks, keyName: key.name },
    answer: notes.map(n => n.pitch).join(','),
    hint: `Key: ${key.name}. First note: ${firstName}. Listen carefully, then enter the notes.`,
    keyName: key.name,
    firstName: firstName,
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

// ── Scale Identification Exercise ──────────────────────────────
const SCALE_PATTERNS = {
  major:            [0,2,4,5,7,9,11],
  natural_minor:    [0,2,3,5,7,8,10],
  harmonic_minor:   [0,2,3,5,7,8,11],
  melodic_minor_up: [0,2,3,5,7,9,11],
  dorian:           [0,2,3,5,7,9,10],
  mixolydian:       [0,2,4,5,7,9,10],
  lydian:           [0,2,4,6,7,9,11],
  phrygian:         [0,1,3,5,7,8,10],
  pentatonic_major: [0,2,4,7,9],
  pentatonic_minor: [0,3,5,7,10],
  blues:            [0,3,5,6,7,10],
  whole_tone:       [0,2,4,6,8,10],
};

const SCALE_LABELS = {
  major: 'Major', natural_minor: 'Natural Minor', harmonic_minor: 'Harmonic Minor',
  melodic_minor_up: 'Melodic Minor (asc)', dorian: 'Dorian', mixolydian: 'Mixolydian',
  lydian: 'Lydian', phrygian: 'Phrygian',
  pentatonic_major: 'Major Pentatonic', pentatonic_minor: 'Minor Pentatonic',
  blues: 'Blues', whole_tone: 'Whole Tone',
};

const SCALE_KEYS = Object.keys(SCALE_PATTERNS);

// Progressive scale curriculum - defines unlock order
const SCALE_CURRICULUM = [
  // Stage 1: Foundations (beginner)
  { stage: 1, name: 'Foundations', scales: ['major', 'natural_minor'], tonics: [60, 65, 67, 72] }, // C, F, G, C
  // Stage 2: Pentatonics
  { stage: 2, name: 'Pentatonic Scales', scales: ['pentatonic_major', 'pentatonic_minor'], tonics: [60, 62, 64, 65, 67, 69, 72] },
  // Stage 3: Minor variations
  { stage: 3, name: 'Minor Variations', scales: ['harmonic_minor', 'melodic_minor_up'], tonics: [60, 62, 64, 65, 67, 69, 72] },
  // Stage 4: Modes (major modes)
  { stage: 4, name: 'Major Modes', scales: ['dorian', 'mixolydian', 'lydian'], tonics: [60, 62, 64, 65, 67, 69, 72] },
  // Stage 5: Minor modes & exotic
  { stage: 5, name: 'Minor Modes & Exotic', scales: ['phrygian', 'pentatonic_major', 'pentatonic_minor'], tonics: [60, 62, 64, 65, 67, 69, 72] },
  // Stage 6: Advanced scales
  { stage: 6, name: 'Advanced Scales', scales: ['blues', 'whole_tone'], tonics: [60, 62, 64, 65, 67, 69, 72] },
];

// Scale mastery tracking
const SCALE_MASTERY_KEY = 'pauta_scale_mastery';
function _loadScaleMastery() {
  try { return JSON.parse(localStorage.getItem(SCALE_MASTERY_KEY)) || {}; }
  catch(e) { return {}; }
}
function _saveScaleMastery(mastery) {
  localStorage.setItem(SCALE_MASTERY_KEY, JSON.stringify(mastery));
}
function _getScaleMastery(scaleType, tonic) {
  const mastery = _loadScaleMastery();
  const key = `${scaleType}:${tonic}`;
  return mastery[key] || { correct: 0, total: 0, streak: 0, mastered: false };
}
function _recordScaleResult(scaleType, tonic, correct) {
  const mastery = _loadScaleMastery();
  const key = `${scaleType}:${tonic}`;
  if (!mastery[key]) mastery[key] = { correct: 0, total: 0, streak: 0, mastered: false };
  mastery[key].total++;
  if (correct) {
    mastery[key].correct++;
    mastery[key].streak++;
    if (mastery[key].streak >= 3 && mastery[key].correct >= 5) mastery[key].mastered = true;
  } else {
    mastery[key].streak = 0;
  }
  _saveScaleMastery(mastery);
}

function _getUnlockedScales() {
  const mastery = _loadScaleMastery();
  const unlocked = new Set(['major', 'natural_minor']); // Always unlocked
  
  // Check each curriculum stage
  for (const stage of SCALE_CURRICULUM) {
    const stageMastered = stage.scales.every(scaleType => 
      stage.tonics.every(tonic => {
        const key = `${scaleType}:${tonic}`;
        return mastery[key]?.mastered === true;
      })
    );
    if (stageMastered) {
      stage.scales.forEach(s => unlocked.add(s));
    } else {
      break; // Stop at first unmastered stage
    }
  }
  return unlocked;
}

function _getAvailableScaleTypes() {
  return _getUnlockedScales();
}

function _getAvailableTonicsForScale(scaleType) {
  const mastery = _loadScaleMastery();
  const available = [];
  // All standard tonics C4-C5
  for (let tonic = 60; tonic <= 72; tonic++) {
    const key = `${scaleType}:${tonic}`;
    const m = mastery[key] || { correct: 0, total: 0 };
    if (m.total < 3 || !m.mastered) available.push(tonic);
  }
  return available.length > 0 ? available : [60, 65, 67, 72];
}
const CHROMATIC_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

function _scaleNoteName(midi) {
  const pc = midi % 12;
  const oct = Math.floor(midi / 12) - 1;
  const useFlat = [1,3,6,8,10].includes(pc);
  return (useFlat ? FLAT_NAMES : CHROMATIC_NOTE_NAMES)[pc] + oct;
}

// Pitch class → key signature for major keys (prefers sharps for enharmonic)
const PC_TO_KS = {0:0, 7:1, 2:2, 9:3, 4:4, 11:5, 6:6, 1:7, 5:-1, 10:-2, 3:-3, 8:-4};

function _tonicToKeySig(tonicMidi, scaleType) {
  const pc = tonicMidi % 12;
  // Scale types that start on a tonic whose KS is the relative major's key
  const minorLike = { natural_minor: true, harmonic_minor: true, melodic_minor_up: true,
    pentatonic_minor: true, blues: true };
  const modeMap = { dorian: 10, phrygian: 8, lydian: 7, mixolydian: 5 };
  if (scaleType === 'major' || scaleType === 'pentatonic_major') {
    return PC_TO_KS[pc] ?? 0;
  }
  if (minorLike[scaleType]) {
    return PC_TO_KS[(pc + 3) % 12] ?? 0;  // relative major
  }
  if (modeMap[scaleType] !== undefined) {
    return PC_TO_KS[(pc + modeMap[scaleType]) % 12] ?? 0;
  }
  if (scaleType === 'whole_tone') return 0;
  // Fallback: assume major-ish
  return PC_TO_KS[pc] ?? 0;
}

function _genScaleId(difficulty) {
  const kitRange = _kitExerciseRange();
  const minTonic = kitRange ? Math.max(kitRange.min, 60) : 60;
  const maxTonic = kitRange ? Math.min(kitRange.max, 72) : 72;

  // Use progressive unlocked scales instead of difficulty-based pools
  const unlockedScales = Array.from(_getAvailableScaleTypes());
  const scaleType = unlockedScales[Math.floor(Math.random() * unlockedScales.length)];
  
  // Get tonics that need practice for this scale type
  const availableTonics = _getAvailableTonicsForScale(scaleType);
  // Filter to kit range
  const validTonics = availableTonics.filter(t => t >= 60 && t <= 72);
  const tonicPool = validTonics.length > 0 ? validTonics : [60, 65, 67, 72];
  const tonic = tonicPool[Math.floor(Math.random() * tonicPool.length)];

  const intervals = SCALE_PATTERNS[scaleType];
  // Include the octave tonic (interval 12) as the final note of the scale
  const notes = intervals.map(i => tonic + i).concat(tonic + 12);
  const keySig = _tonicToKeySig(tonic, scaleType);

  return {
    type: EXERCISE_TYPES.SCALE_ID,
    difficulty: DIFF_NAMES[0] || 'beginner',
    target: { scaleType, tonic, notes, keySig },
    answer: _scaleNoteName(tonic) + ' ' + SCALE_LABELS[scaleType],
    answerMajor: _scaleNoteName(tonic) + ' ' + SCALE_LABELS[scaleType],
    hint: `Starts on ${_scaleNoteName(tonic)}. Pattern: ${SCALE_LABELS[scaleType]}`,
  };
}


// ═══════════════════════════════════════════════════════════════════
// EVALUATOR — moved from playback.js (belongs with exercise logic)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// EVALUATOR — moved from playback.js (belongs with exercise logic)
// ═══════════════════════════════════════════════════════════════════

const EVALUATOR = {
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

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGER — moved from playback.js (belongs with exercise logic)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGER — moved from playback.js (belongs with exercise logic)
// ═══════════════════════════════════════════════════════════════════

const SESSION_MANAGER = {
  _SESSION_KEY: 'pauta_session_history',
  _MAX_HISTORY: 50,

  _loadHistory() {
    try { return JSON.parse(localStorage.getItem(this._SESSION_KEY)) || []; }
    catch(e) { return []; }
  },

  _saveHistory(history) {
    localStorage.setItem(this._SESSION_KEY, JSON.stringify(history.slice(-this._MAX_HISTORY)));
  },

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

  adjustDifficulty(currentDifficulty, sessionPct) {
    const levels = ['beginner', 'intermediate', 'advanced'];
    const idx = levels.indexOf(currentDifficulty);

    if (sessionPct >= 85 && idx < 2) {
      return { difficulty: levels[idx + 1], reason: 'Upgrading difficulty' };
    }
    if (sessionPct < 50 && idx > 0) {
      return { difficulty: levels[idx - 1], reason: 'Reviewing at easier level' };
    }
    return { difficulty: currentDifficulty, reason: 'Maintaining level' };
  },

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

  _getCurrentStreak(history) {
    if (history.length < 2) return 0;
    let streak = 0;
    for (let i = history.length - 1; i > 0; i--) {
      if (history[i].pct >= history[i - 1].pct) streak++;
      else break;
    }
    return streak;
  },

  _PROGRESS_KEY: 'pauta_level_progress',

  _loadProgress() {
    try { return JSON.parse(localStorage.getItem(this._PROGRESS_KEY)) || { level: 1, completionHistory: {}, bestScores: {} }; }
    catch(e) { return { level: 1, completionHistory: {}, bestScores: {} }; }
  },

  _saveProgress(progress) {
    localStorage.setItem(this._PROGRESS_KEY, JSON.stringify(progress));
  },

  getLevel() {
    return this._loadProgress().level || 1;
  },

  setLevel(level) {
    const progress = this._loadProgress();
    progress.level = level;
    this._saveProgress(progress);
  },

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

    if (!progress.bestScores[exerciseType] || pct > progress.bestScores[exerciseType]) {
      progress.bestScores[exerciseType] = pct;
    }

    this._saveProgress(progress);
    return progress;
  },

  getCompletionHistory(exerciseType) {
    const progress = this._loadProgress();
    return progress.completionHistory[exerciseType] || [];
  },

  getBestScore(exerciseType) {
    const progress = this._loadProgress();
    return progress.bestScores[exerciseType] || 0;
  },

  getAllBestScores() {
    return this._loadProgress().bestScores || {};
  },

  hasMastered(exerciseType) {
    const history = this.getCompletionHistory(exerciseType);
    if (history.length < 3) return false;
    const recent = history.slice(-3);
    return recent.every(h => h.pct >= 80);
  },

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

  _LATENCY_KEY: 'pauta_latency_offset',
  _latencySamples: [],
  _calibrationActive: false,

  getLatencyOffset() {
    try { return parseInt(localStorage.getItem(this._LATENCY_KEY)) || 0; }
    catch(e) { return 0; }
  },

  _saveLatencyOffset(offset) {
    localStorage.setItem(this._LATENCY_KEY, String(Math.round(offset)));
  },

  startCalibration() {
    this._latencySamples = [];
    this._calibrationActive = true;
    return {
      message: 'Tap the button in sync with the metronome beat',
      beatsNeeded: 8,
    };
  },

  recordCalibrationTap(expectedTime, actualTime) {
    if (!this._calibrationActive) return null;

    const offset = (actualTime - expectedTime) * 1000;
    this._latencySamples.push(offset);

    if (this._latencySamples.length < 4) {
      return { samples: this._latencySamples.length, needed: 4 };
    }

    const sorted = [...this._latencySamples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    if (Math.abs(median) <= 200) {
      this._saveLatencyOffset(median);
      this._calibrationActive = false;
      return {
        complete: true,
        offset: Math.round(median),
        message: `Calibrated: ${Math.round(median)}ms offset`,
      };
    }

    this._calibrationActive = false;
    return {
      complete: true,
      offset: 0,
      message: 'Calibration failed — offset too large. Using 0ms.',
    };
  },

  applyOffset(time) {
    const offset = this.getLatencyOffset();
    return time + (offset / 1000);
  },

  showCalibrationDialog() {
    const result = this.startCalibration();
    let tapCount = 0;
    const totalBeats = result.beatsNeeded;

    UI.makeModal(`
      <h2>Audio Latency Calibration</h2>
      <p style="color:var(--pauta-text-muted);font-size:13px;margin-bottom:12px;text-align:center">
        ${result.message}
      </p>
      <div style="text-align:center;margin-bottom:12px">
        <div id="cal-beat-display" style="font-size:48px;font-weight:700;color:var(--pauta-primary);margin-bottom:8px">0/${totalBeats}</div>
        <div id="cal-tap-btn" style="width:80px;height:80px;border-radius:50%;background:var(--pauta-primary);color:#fff;font-size:16px;font-weight:700;border:none;cursor:pointer;margin:0 auto;display:flex;align-items:center;justify-content:center">TAP</div>
      </div>
      <div id="cal-result" style="text-align:center;font-size:12px;color:var(--pauta-text-muted);min-height:20px"></div>
      <button class="modal-btn secondary" data-action="closeModal" style="margin-top:8px">Cancel</button>
    `);

    let beatInterval = setInterval(() => {
      const display = document.getElementById('cal-beat-display');
      const btn = document.getElementById('cal-tap-btn');
      if (!display || !btn) { clearInterval(beatInterval); return; }

      tapCount++;
      display.textContent = `${tapCount}/${totalBeats}`;
      btn.style.background = 'var(--pauta-success)';

      setTimeout(() => { btn.style.background = 'var(--pauta-primary)'; }, 100);

      if (tapCount >= totalBeats) {
        clearInterval(beatInterval);
        const finalResult = this.recordCalibrationTap(0, 0);
        const resultEl = document.getElementById('cal-result');
        if (resultEl) {
          resultEl.textContent = finalResult?.message || 'Calibration complete';
          resultEl.style.color = 'var(--pauta-success)';
        }
      }
    }, 1000);

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
