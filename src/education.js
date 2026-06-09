// ── Transposition ─────────────────────────────────────────────────
// Chromatic semitones for each diatonic step (ascending) in a major scale:
// Used to figure out how many semitones correspond to a diatonic interval.
const DIA_SEMITONES = [0,2,4,5,7,9,11]; // C D E F G A B

// Transpose the entire score (all parts, all staves) by a number of semitones.
// diaSteps is the diatonic shift (for accidental book-keeping, +/- integer).
function transposeScore(semitones) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (!semitones) return;
  commitChange(score => {
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
// MODULE 5b: Assignments
// ═══════════════════════════════════════════════════════════════════

function showAssignmentDialog() {
  const measureCount = APP.score?.parts?.[0]?.staves?.[0]?.measures?.length || 1;
  const selected = APP.selectedMeasure;
  const start = Math.max(0, Math.min(selected, measureCount - 1));
  const end = Math.min(measureCount - 1, start + 3);
  makeModal(`
    <h2>Create Assignment</h2>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Title</div>
      <input id="asgn-title" type="text" value="Exercise ${(APP.score?.assignments?.length || 0) + 1}" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div style="flex:1">
        <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Start measure</div>
        <input id="asgn-start" type="number" min="1" max="${measureCount}" value="${start + 1}" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
      </div>
      <div style="flex:1">
        <div style="font-size:11px;color:#4a5568;margin-bottom:4px">End measure</div>
        <input id="asgn-end" type="number" min="1" max="${measureCount}" value="${end + 1}" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Hide from student</div>
      <select id="asgn-hidden" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
        <option value="pitch">Pitches (student enters note names / MIDI)</option>
        <option value="duration">Rhythm (student enters durations)</option>
        <option value="pitch+duration">Pitches + Rhythm</option>
        <option value="lyric">Lyrics</option>
        <option value="chordSymbol">Chord Symbols</option>
      </select>
    </div>
    <div style="margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#4a5568;cursor:pointer">
        <input type="checkbox" id="asgn-hint-first" checked> Show first note as hint
      </label>
    </div>
    <div style="margin-bottom:12px;font-size:11px;color:rgba(74,85,104,0.7)">
      The assignment is saved inside the score file. Share the .mscz with students.
    </div>
    <button class="modal-btn primary" data-action="confirmCreateAssignment">Create</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function confirmCreateAssignment() {
  const title = document.getElementById('asgn-title')?.value?.trim() || 'Untitled';
  const startMi = parseInt(document.getElementById('asgn-start')?.value) - 1;
  const endMi   = parseInt(document.getElementById('asgn-end')?.value) - 1;
  const hidden  = document.getElementById('asgn-hidden')?.value || 'pitch';
  const hintFirst = document.getElementById('asgn-hint-first')?.checked ?? true;
  const maxM = APP.score?.parts?.[0]?.staves?.[0]?.measures?.length || 1;
  if (isNaN(startMi) || isNaN(endMi) || startMi < 0 || endMi < startMi || endMi >= maxM) {
    showToast('Invalid measure range'); return;
  }
  commitChange(score => {
    if (!score.assignments) score.assignments = [];
    const id = 'a' + (Date.now() % 1000000);
    score.assignments.push({
      id, title,
      range: { startMi, endMi },
      hidden: hidden.split('+'),
      hints: { showFirstNote: hintFirst },
      createdAt: Date.now()
    });
  }, { toast: 'Assignment created: ' + title });
  closeModal();
}

function startAssignment(id) {
  const asgn = APP.score?.assignments?.find(a => a.id === id);
  if (!asgn) { showToast('Assignment not found'); return; }
  APP.assignmentMode = true;
  APP.currentAssignment = asgn;
  _validateModeState();
  // Try to restore unsaved answers from localStorage
  try {
    const saved = localStorage.getItem(`pauta_answers_${id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!APP.score.studentAnswers) APP.score.studentAnswers = {};
      // Only restore if not already submitted in the score file
      if (!APP.score.studentAnswers[id]?.submitted) {
        APP.score.studentAnswers[id] = parsed;
      }
    }
  } catch(e) { console.warn('[Pauta]', e.message); }
  // Hide palettes that aren't needed in student mode
  _setAssignmentUI(true);
  showToast('Assignment started: ' + asgn.title);
  renderScore();
}

function exitAssignmentMode() {
  APP.assignmentMode = false;
  APP.currentAssignment = null;
  _validateModeState();
  _setAssignmentUI(false);
  showToast('Exited assignment mode');
  renderScore();
}

function _setAssignmentUI(enabled) {
  document.body.classList.toggle('assignment-mode', enabled);
  // Disable/enable tool palettes
  const panels = ['panel-notes','panel-accidentals','panel-durations','panel-dynamics','panel-lines'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.pointerEvents = enabled ? 'none' : '';
  });
}

function submitAssignment() {
  const asgn = APP.currentAssignment;
  if (!asgn) return;
  const results = _evaluateAssignment(asgn);
  commitChange(score => {
    if (!score.studentAnswers) score.studentAnswers = {};
    score.studentAnswers[asgn.id] = {
      submitted: true,
      timestamp: Date.now(),
      results
    };
  }, { toast: `Submitted! Score: ${results.correct}/${results.total}` });
  exitAssignmentMode();
}

function checkAssignmentAnswers() {
  const asgn = APP.currentAssignment;
  if (!asgn) return;
  const results = _evaluateAssignment(asgn);
  makeModal(`
    <h2>Check Answers — ${asgn.title}</h2>
    <div style="font-size:13px;color:#4a5568;margin-bottom:12px">
      <b>${results.correct}</b> / ${results.total} correct
      ${results.incorrect > 0 ? `<br><span style="color:#e07060">${results.incorrect} incorrect</span>` : ''}
      ${results.partial > 0 ? `<br><span style="color:#d4a017">${results.partial} partial (enharmonic)</span>` : ''}
    </div>
    <div style="max-height:200px;overflow-y:auto;font-size:12px;color:#4a5568;margin-bottom:12px">
      ${results.details.map(d => `<div style="margin-bottom:4px;display:flex;align-items:center;gap:6px">
        <span style="width:16px;text-align:center;font-size:14px">${d.ok?'🟢':'🔴'}</span>
        Measure ${d.mi+1}, note ${d.ni+1}: ${d.msg}
      </div>`).join('')}
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function _evaluateAssignment(asgn) {
  const answers = APP.score?.studentAnswers?.[asgn.id];
  const hiddenSet = new Set(asgn.hidden || ['pitch']);
  const details = [];
  let correct = 0, incorrect = 0, partial = 0, total = 0;

  for (let mi = asgn.range.startMi; mi <= asgn.range.endMi; mi++) {
    const measures = APP.score.parts.map(p => p.staves[0].measures[mi]).filter(Boolean);
    measures.forEach(m => {
      m.notes.forEach((note, ni) => {
        if (note.type !== 'note') return;
        total++;
        const answer = answers?.notes?.[mi]?.[ni];
        let ok = true, msg = '';

        if (hiddenSet.has('pitch') || hiddenSet.has('duration')) {
          // Check pitch
          if (hiddenSet.has('pitch')) {
            if (!answer || answer.pitch == null) {
              ok = false; msg = 'No pitch entered';
            } else if (answer.pitch === note.pitch) {
              msg = 'Pitch correct';
            } else if ((answer.pitch % 12) === (note.pitch % 12)) {
              ok = false; partial++; msg = `Pitch enharmonic (${answer.pitch} vs ${note.pitch})`; return;
            } else {
              ok = false; msg = `Pitch wrong (${answer.pitch} vs ${note.pitch})`;
            }
          }
          // Check duration
          if (ok && hiddenSet.has('duration')) {
            const targetDur = durBeats(note.duration, note.dots, note.tuplet);
            const ansDur = answer ? durBeats(answer.duration, answer.dots, answer.tuplet) : 0;
            if (!answer || Math.abs(ansDur - targetDur) > 0.001) {
              ok = false; msg = msg ? msg + ', duration wrong' : 'Duration wrong';
            } else {
              msg = msg ? msg + ', duration correct' : 'Duration correct';
            }
          }
        }

        if (hiddenSet.has('lyric') && note.lyric?.text) {
          if (!answer || !answer.lyric) {
            ok = false; msg = 'No lyric entered';
          } else if (answer.lyric.trim().toLowerCase() !== note.lyric.text.trim().toLowerCase()) {
            ok = false; msg = `Lyric wrong (${answer.lyric} vs ${note.lyric.text})`;
          } else {
            msg = 'Lyric correct';
          }
        }

        if (hiddenSet.has('chordSymbol') && note.chordSymbol) {
          if (!answer || !answer.chordSymbol) {
            ok = false; msg = 'No chord symbol entered';
          } else if (answer.chordSymbol.trim().toLowerCase() !== note.chordSymbol.trim().toLowerCase()) {
            ok = false; msg = `Chord symbol wrong`;
          } else {
            msg = 'Chord symbol correct';
          }
        }

        if (ok) correct++;
        else if (!msg.includes('enharmonic')) incorrect++;
        details.push({ mi, ni, ok, msg });
      });
    });
  }
  return { correct, incorrect, partial, total, details };
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 5c: Exercise Engine
const EXERCISE = {};
// ═══════════════════════════════════════════════════════════════════
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
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }

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
          <div style="font-weight:600;font-size:13px;color:#2d3748">${grade.title}</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.7)">${grade.description}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:${pct >= 80 ? '#22c55e' : pct >= 50 ? '#e6a817' : '#c05621'}">${pct}%</div>
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
              ${done ? `<span style="font-size:10px;color:${score >= 80 ? '#22c55e' : '#e6a817'}">${score}%</span>` : ''}
            </div>
          </button>`;
        }).join('')}
      </div>` : `<div style="font-size:11px;color:rgba(74,85,104,0.5);text-align:center;margin-top:4px">
        🔒 Complete ${grade.unlockCondition.count} ${grade.unlockCondition.exerciseType ? TYPE_LABELS[grade.unlockCondition.exerciseType] : 'total'} sessions to unlock
      </div>`}
    </div>`;
  }).join('');

  makeModal(`
    <h2>📚 Curriculum</h2>
    <div style="font-size:12px;color:#4a5568;margin-bottom:12px;text-align:center">
      Structured learning path · ${totalSessions} total sessions completed
    </div>
    <div style="max-height:340px;overflow-y:auto">
      ${gradeHtml}
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function startCurriculumGrade(gradeId, exerciseIdx) {
  const grade = CURRICULUM.find(g => g.id === gradeId);
  if (!grade || !_isCurriculumUnlocked(grade)) { showToast('Grade not yet unlocked'); return; }
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
    showToast(`📈 Great performance! Moving to ${newDiff}`);
    APP.exerciseDifficulty = newDiff;
    return newDiff;
  }

  // Downgrade: 3 consecutive sessions < 50%
  if (lastThreeAvg < 50 && currentDiff > 0) {
    const newDiff = DIFF_NAMES[currentDiff - 1];
    showToast(`📉 Let's try ${newDiff} for now`);
    APP.exerciseDifficulty = newDiff;
    return newDiff;
  }

  return DIFF_NAMES[currentDiff];
}

function generateExercise(type, difficulty = 'beginner') {
  const diffs = { beginner: 0, intermediate: 1, advanced: 2 };
  const d = diffs[difficulty] ?? 0;

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
    default:
      return _genNoteId(d);
  }
}

const NATURAL_PITCHES = {
  beginner:     [60,62,64,65,67,69,71,72],     // C4–C5, naturals only
  intermediate: [57,59,60,62,64,65,67,69,71,72,74,76], // A3–E5, naturals
  advanced:     null,  // full chromatic range
};

function _genNoteId(difficulty) {
  const levelNames = ['beginner','intermediate','advanced'];
  const kitRange = _kitExerciseRange();
  let pitch;
  if (kitRange) {
    // Kit-aware: use kit range, still naturals-only for beginner
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    const validPool = pool ? pool.filter(p => p >= kitRange.min && p <= kitRange.max) : null;
    pitch = validPool?.length
      ? validPool[Math.floor(Math.random() * validPool.length)]
      : Math.floor(Math.random() * (kitRange.max - kitRange.min + 1)) + kitRange.min;
  } else {
    const pool = NATURAL_PITCHES[levelNames[difficulty]];
    pitch = pool
      ? pool[Math.floor(Math.random() * pool.length)]
      : Math.floor(Math.random() * 37) + 48; // C3–C6 chromatic
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
    hint: `Listen first, then enter one note at a time.`,
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
const CHROMATIC_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

function _scaleNoteName(midi) {
  const pc = midi % 12;
  const oct = Math.floor(midi / 12) - 1;
  const useFlat = [1,3,6,8,10].includes(pc);
  return (useFlat ? FLAT_NAMES : CHROMATIC_NOTE_NAMES)[pc] + oct;
}

function _genScaleId(difficulty) {
  const kitRange = _kitExerciseRange();
  const minTonic = kitRange ? Math.max(kitRange.min, 60) : 60;  // C4
  const maxTonic = kitRange ? Math.min(kitRange.max, 72) : 72;  // C5

  let pool;
  if (difficulty === 0) {
    pool = ['major', 'natural_minor', 'pentatonic_major', 'pentatonic_minor'];
  } else if (difficulty === 1) {
    pool = ['major', 'natural_minor', 'harmonic_minor', 'melodic_minor_up', 'dorian', 'mixolydian', 'pentatonic_major', 'pentatonic_minor'];
  } else {
    pool = SCALE_KEYS;
  }

  const scaleType = pool[Math.floor(Math.random() * pool.length)];
  const tonic = minTonic + Math.floor(Math.random() * (maxTonic - minTonic + 1));
  const intervals = SCALE_PATTERNS[scaleType];
  const notes = intervals.map(i => tonic + i);

  return {
    type: EXERCISE_TYPES.SCALE_ID,
    difficulty: DIFF_NAMES[difficulty] || 'beginner',
    target: { scaleType, tonic, notes },
    answer: _scaleNoteName(tonic) + ' ' + SCALE_LABELS[scaleType],
    answerMajor: _scaleNoteName(tonic) + ' ' + SCALE_LABELS[scaleType],
    hint: `Starts on ${_scaleNoteName(tonic)}. Pattern: ${SCALE_LABELS[scaleType]}`,
  };
}

// ── Exercise Session Manager ────────────────────────────────────
function startExerciseSession(type, difficulty) {
  // Adaptive difficulty: if 'auto', start at beginner and let the adaptive engine handle it
  if (!difficulty || difficulty === 'auto') {
    difficulty = 'beginner';
  }
  const ex = generateExercise(type, difficulty);
  APP.exerciseSession = {
    type, difficulty,
    current: ex,
    completed: [],
    correctCount: 0,
    totalCount: 0,
    streak: 0,
    maxStreak: 0,
    startedAt: Date.now(),
  };
  APP.exerciseMode = true;
  _setExerciseUI(true);
  _presentExercise(ex);
  _validateModeState();
}

function endExerciseSession() {
  const s = APP.exerciseSession;
  if (!s) return;
  const total = s.totalCount;
  const correct = s.correctCount;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const time = Math.floor((Date.now() - s.startedAt) / 1000);

  // Record session and get recommendation
  const recommendation = SESSION_MANAGER.recordSession(s.type, s.difficulty, correct, total, Date.now() - s.startedAt);

  // Record completion for level progress tracking
  SESSION_MANAGER.recordCompletion(s.type, correct, total);

  // Determine next action based on recommendation
  let nextActionHtml = '';
  if (recommendation.action === 'advance') {
    nextActionHtml = `<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:8px;margin-bottom:12px;text-align:center">
      <div style="font-weight:600;color:#22c55e;font-size:13px">📈 Ready to advance!</div>
      <div style="font-size:11px;color:rgba(74,85,104,0.7)">${recommendation.reason}</div>
    </div>`;
  } else if (recommendation.action === 'review') {
    nextActionHtml = `<div style="background:rgba(230,168,23,0.1);border:1px solid rgba(230,168,23,0.2);border-radius:6px;padding:8px;margin-bottom:12px;text-align:center">
      <div style="font-weight:600;color:#e6a817;font-size:13px">🔄 Review recommended</div>
      <div style="font-size:11px;color:rgba(74,85,104,0.7)">${recommendation.reason}</div>
    </div>`;
  }

  makeModal(`
    <h2>Session Complete</h2>
    <div style="font-size:14px;color:#4a5568;margin-bottom:12px;text-align:center">
      <div style="font-size:32px;font-weight:700;color:#c05621;margin-bottom:4px">${pct}%</div>
      <div>${correct} / ${total} correct</div>
      <div style="font-size:12px;color:rgba(74,85,104,0.6);margin-top:4px">Best streak: ${s.maxStreak} · Time: ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}</div>
    </div>
    ${nextActionHtml}
    <div style="margin-bottom:12px;max-height:200px;overflow-y:auto;font-size:12px;color:#4a5568">
      ${s.completed.map((c,i) => {
        if (c.type === 'difficulty_change') {
          return `<div style="margin-bottom:4px;display:flex;align-items:center;gap:6px">
            <span style="width:16px;text-align:center;font-size:14px">🔄</span>
            <span>#${i+1}: Difficulty ${c.difficultyChange === 'up' ? '↑' : '↓'} to ${c.answer}</span>
          </div>`;
        }
        const icon = c.ok ? '🟢' : (c.nearMiss ? '🟡' : '🔴');
        const label = c.type === EXERCISE_TYPES.NOTE_ID ? 'Note ' + c.answer
          : c.type === EXERCISE_TYPES.INTERVAL_ID ? 'Interval ' + c.answer
          : c.type === EXERCISE_TYPES.KEY_SIG_ID ? 'Key ' + c.answer
          : c.type === EXERCISE_TYPES.MELODY_DICT ? 'Melody'
          : c.type === EXERCISE_TYPES.RHYTHM_WS ? 'Rhythm Dict'
          : c.type === EXERCISE_TYPES.SCALE_ID ? 'Scale ' + c.answer
          : c.type === EXERCISE_TYPES.NOTE_CONSTRUCT ? 'Construct ' + c.answer
          : 'Rhythm';
        return `<div style="margin-bottom:4px;display:flex;align-items:center;gap:6px">
          <span style="width:16px;text-align:center;font-size:14px">${icon}</span>
          <span>#${i+1}: ${label}${c.nearMiss && !c.ok ? ' (off by 1)' : ''}</span>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button class="modal-btn primary" data-action="reviewExerciseSession">📝 Review Answers</button>
      <button class="modal-btn secondary" data-action="restartExerciseSession">Try Again</button>
      <button class="modal-btn secondary" data-action="closeModalExercise">Close</button>
    </div>
  `);

  // Save results for progress tracking
  _saveExerciseResult(s);

  // Clean up floating bars
  ['dictation-bar','dictation-check-bar','exercise-input-bar','exercise-feedback-bar','rhythm-beat-grid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  // Clean up note construct click handler
  if (APP._noteConstructClickHandler) {
    const svgEl = document.getElementById('score-svg');
    if (svgEl) svgEl.removeEventListener('click', APP._noteConstructClickHandler);
    APP._noteConstructClickHandler = null;
  }
  _hideSuccessBanner();
  APP.exerciseMode = false;
  APP.exerciseSession = null;
  _setExerciseUI(false);
  _validateModeState();
}

function closeModalExercise() {
  closeModal();
  renderScore();
}

function restartExerciseSession() {
  closeModal();
  const s = APP.exerciseSession;
  const savedType = s?.type;
  const savedDiff = s?.difficulty;
  // s is nulled by endExerciseSession if the modal triggered it, so save first
  if (savedType) startExerciseSession(savedType, savedDiff);
}

function reviewExerciseSession() {
  closeModal();
  const s = APP.exerciseSession;
  if (!s || !s.completed.length) { showToast('No exercises to review'); return; }

  let reviewIndex = 0;
  const completed = s.completed;

  function showReview(idx) {
    const c = completed[idx];
    if (!c) return;

    const typeLabel = TYPE_LABELS[c.type] || c.type;
    let questionHtml = '';

    if (c.type === EXERCISE_TYPES.NOTE_ID) {
      const pitch = c.target?.pitch;
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const pc = pitch % 12;
      const oct = Math.floor(pitch / 12) - 1;
      const noteName = noteNames[pc] + oct;
      questionHtml = `<div style="font-size:20px;text-align:center;margin:12px 0;font-family:'Bravura',serif">${noteName}</div>
        <div style="text-align:center;color:#4a5568">MIDI ${pitch} · ${noteName}</div>`;
    } else if (c.type === EXERCISE_TYPES.INTERVAL_ID) {
      const bottom = c.target?.bottom;
      const top = c.target?.top;
      const semitones = c.target?.semitones;
      const dir = c.target?.direction;
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const bName = noteNames[bottom % 12] + (Math.floor(bottom / 12) - 1);
      const tName = noteNames[top % 12] + (Math.floor(top / 12) - 1);
      questionHtml = `<div style="font-size:18px;text-align:center;margin:8px 0">${bName} → ${tName}</div>
        <div style="text-align:center;color:#4a5568">${semitones} semitones ${dir > 0 ? '↑' : '↓'}</div>`;
    } else if (c.type === EXERCISE_TYPES.RHYTHM_READ || c.type === EXERCISE_TYPES.RHYTHM_WS) {
      const beats = c.target?.beats || c.target?.durations;
      if (beats) {
        const symbols = beats.map(d => d === 'q' ? '♩' : d === 'h' ? '𝅗𝅥' : d === '8' ? '♪' : d === '16' ? '𝅘𝅥𝅮' : d === 'r' ? '𝄽' : '·');
        questionHtml = `<div style="font-size:20px;text-align:center;letter-spacing:8px;margin:12px 0;font-family:'Bravura',serif">${symbols.join(' ')}</div>`;
      }
    } else if (c.type === EXERCISE_TYPES.MELODY_DICT) {
      const notes = c.target?.notes;
      if (notes) {
        const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const names = notes.map(n => noteNames[n.pitch % 12] + (Math.floor(n.pitch / 12) - 1));
        questionHtml = `<div style="font-size:18px;text-align:center;margin:8px 0;letter-spacing:4px">${names.join(' ')}</div>`;
      }
    } else if (c.type === EXERCISE_TYPES.KEY_SIG_ID) {
      const ks = c.target?.keySig;
      const names = { '-7':'Cb','-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F','0':'C','1':'G','2':'D','3':'A','4':'E','5':'B','6':'F#','7':'C#' };
      const minorNames = { '-7':'Abm','-6':'Ebm','-5':'Bbm','-4':'Fm','-3':'Cm','-2':'Gm','-1':'Dm','0':'Am','1':'Em','2':'Bm','3':'F#m','4':'C#m','5':'G#m','6':'D#m','7':'A#m' };
      questionHtml = `<div style="font-size:18px;text-align:center;margin:8px 0">Key Signature: ${ks > 0 ? '♯'.repeat(ks) : ks < 0 ? '♭'.repeat(-ks) : '(none)'}</div>
        <div style="text-align:center;color:#4a5568">Major: ${names[String(ks)]} · Minor: ${minorNames[String(ks)]}</div>`;
    }

    const isCorrect = c.ok;
    const userAns = c.answer;
    const correctAns = c.correctAnswer || c.questionLabel;
    const hint = c.hint;

    makeModal(`
      <h2>Review: ${typeLabel} (${idx + 1}/${completed.length})</h2>
      <div style="margin-bottom:12px;padding:12px;background:rgba(192,86,33,0.05);border-radius:8px">
        <div style="font-weight:600;margin-bottom:6px">Question</div>
        ${questionHtml}
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px;flex-wrap:wrap">
        <div style="padding:8px 16px;background:${isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(255,96,96,0.1)'};border-radius:8px;border:1px solid ${isCorrect ? '#22c55e' : '#ff6060'}">
          <div style="font-size:11px;color:rgba(74,85,104,0.6);font-weight:600">${isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}</div>
          <div style="font-size:16px;font-weight:700;color:${isCorrect ? '#22c55e' : '#c05421'}">${escHtml(userAns)}</div>
        </div>
        ${!isCorrect ? `
        <div style="padding:8px 16px;background:rgba(34,197,94,0.1);border-radius:8px;border:1px solid #22c55e">
          <div style="font-size:11px;color:rgba(74,85,104,0.6);font-weight:600">Correct Answer</div>
          <div style="font-size:16px;font-weight:700;color:#22c55e">${escHtml(correctAns)}</div>
        </div>` : ''}
      </div>
      ${hint ? `<div style="font-size:12px;color:rgba(74,85,104,0.7);background:rgba(192,86,33,0.06);padding:8px 12px;border-radius:6px;margin-bottom:12px">💡 ${escHtml(hint)}</div>` : ''}
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${idx > 0 ? `<button class="modal-btn secondary" data-action="reviewPrev">← Previous</button>` : ''}
        ${idx < completed.length - 1 ? `<button class="modal-btn primary" data-action="reviewNext">Next →</button>` : `<button class="modal-btn primary" data-action="closeModal">Done</button>`}
        ${completed.length > 1 ? `<button class="modal-btn secondary" data-action="closeModal" style="margin-left:auto">Close Review</button>` : ''}
      </div>
    `);
  }

  // Register one-time handlers for review navigation
  const origRegister = window._registerAction;
  window._registerAction('reviewPrev', () => { closeModal(); showReview(reviewIndex - 1); });
  window._registerAction('reviewNext', () => { closeModal(); showReview(reviewIndex + 1); });

  showReview(0);
}

function _presentExercise(ex) {
  switch (ex.type) {
    case EXERCISE_TYPES.NOTE_ID:
      _presentNoteId(ex);
      break;
    case EXERCISE_TYPES.INTERVAL_ID:
      _presentIntervalId(ex);
      break;
    case EXERCISE_TYPES.RHYTHM_READ:
      _presentRhythmRead(ex);
      break;
    case EXERCISE_TYPES.MELODY_DICT:
      _presentMelodyDict(ex);
      break;
    case EXERCISE_TYPES.KEY_SIG_ID:
      _presentKeySigId(ex);
      break;
    case EXERCISE_TYPES.RHYTHM_WS:
      _presentRhythmWorksheet(ex);
      break;
    case EXERCISE_TYPES.SCALE_ID:
      _presentScaleId(ex);
      break;
    case EXERCISE_TYPES.NOTE_CONSTRUCT:
      _presentNoteConstruct(ex);
      break;
  }
  _updateExerciseInputBar();
}

function _presentNoteId(ex) {
  // Build a minimal score with one note — include accidental so chromatic
  // pitches render correctly on the staff (e.g. F# not F natural)
  const acc = midiAutoAcc(ex.target.pitch);
  const instr = _kitDefaultInstrument();
  const score = createScore({title: 'Note Identification', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  score.parts[0].staves[0].measures[0].notes = [mkNote(ex.target.pitch, 'q', 0, acc)];
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = 0;
  renderScore();
  showToast('Name this note! (tap palette or type letter)');
}

function _presentNoteConstruct(ex) {
  const instr = _kitDefaultInstrument();
  const score = createScore({title: 'Note Construction', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  score.parts[0].staves[0].measures[0].notes = [mkRest('w')];
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  showToast('Click on the staff to place the note!');
  setTimeout(() => _attachNoteConstructClickHandler(), 100);
}

function _attachNoteConstructClickHandler() {
  const svgEl = document.getElementById('score-svg');
  if (!svgEl) return;
  const existing = svgEl.querySelector('.note-construct-overlay');
  if (existing) existing.remove();
  const handler = function(e) {
    if (!APP.exerciseSession || APP.exerciseSession.current?.type !== EXERCISE_TYPES.NOTE_CONSTRUCT) {
      svgEl.removeEventListener('click', handler);
      return;
    }
    const pos = getEventXY(e);
    if (!pos) return;
    const sl = APP.staveLayout[0];
    if (!sl) return;
    const margin = 40;
    const xOk = pos.x >= sl.x && pos.x <= sl.x + sl.w;
    const yOk = pos.y >= sl.topLineY - margin && pos.y <= sl.bottomY + margin;
    if (!xOk || !yOk) return;
    const pitch = yToPitchAccurate(pos.y, sl);
    _checkNoteConstructAnswer(pitch);
  };
  svgEl.addEventListener('click', handler);
  APP._noteConstructClickHandler = handler;
}

function _checkNoteConstructAnswer(pitch) {
  const s = APP.exerciseSession;
  if (!s || !s.current) return;
  const ex = s.current;
  const targetPitch = ex.target.pitch;
  const semitoneDiff = Math.abs(pitch - targetPitch);
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const pc = pitch % 12;
  const oct = Math.floor(pitch / 12) - 1;
  const userAnswer = names[pc] + oct;
  const isCorrect = pitch === targetPitch;
  const isClose = semitoneDiff === 1;

  const svgEl = document.getElementById('score-svg');
  if (svgEl && APP._noteConstructClickHandler) {
    svgEl.removeEventListener('click', APP._noteConstructClickHandler);
    APP._noteConstructClickHandler = null;
  }

  const sl = APP.staveLayout[0];
  if (sl && svgEl) {
    const svg = svgEl.querySelector('svg');
    if (svg) {
      const noteG = document.createElementNS('http://www.w3.org/2000/svg','g');
      const cx = sl.x + sl.w / 2;
      const flashColor = isCorrect ? '#22c55e' : isClose ? '#e6a817' : '#ef4444';
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg','rect');
      bgRect.setAttribute('x', cx - 40);
      bgRect.setAttribute('y', sl.topLineY - 6);
      bgRect.setAttribute('width', 80);
      bgRect.setAttribute('height', sl.bottomY - sl.topLineY + 12);
      bgRect.setAttribute('rx', 6);
      bgRect.setAttribute('fill', flashColor);
      bgRect.setAttribute('opacity', '0.3');
      bgRect.setAttribute('class', 'note-construct-flash');
      noteG.appendChild(bgRect);
      const acc = midiAutoAcc(pitch);
      const clef = 'treble';
      const keyStr = names[pc] + (acc === '#' ? '#' : acc === 'b' ? 'b' : '') + '/' + oct;
      const vfNote = new VF.StaveNote({keys:[keyStr], duration:'q', clef, stem_direction: VF.Stem.UP});
      if (acc) vfNote.addAccidental(0, new VF.Accidental(acc === '#' ? '#' : acc === 'b' ? 'b' : 'n'));
      const voice = new VF.Voice({num_beats:4, beat_value:4});
      voice.setStrict(false);
      voice.addTickable(vfNote);
      new VF.Formatter().joinVoices([voice]).format([voice], sl.w - 40);
      const tempRenderer = new VF.Renderer(document.createElement('div'), VF.Renderer.Backends.SVG);
      tempRenderer.resize(sl.w, sl.bottomY - sl.topLineY + 40);
      const tempCtx = tempRenderer.getContext();
      const tempStave = new VF.Stave(20, 15, sl.w - 40, {space_above_staff_ln:4, num_lines:5});
      tempStave.setContext(tempCtx).draw();
      voice.draw(tempCtx, tempStave);
      const tempSvgEl = tempRenderer.getContext().svg;
      if (tempSvgEl) {
        const noteEls = tempSvgEl.querySelectorAll('g.vf-stavenote');
        noteEls.forEach(el => {
          const translated = el.cloneNode(true);
          translated.setAttribute('transform', `translate(${cx - (sl.w - 40)/2 - 20},${sl.topLineY - 15 - 15})`);
          translated.setAttribute('class', 'note-construct-placed');
          noteG.appendChild(translated);
        });
      }
      svg.appendChild(noteG);
      setTimeout(() => {
        const flash = svg.querySelector('.note-construct-flash');
        if (flash) flash.remove();
        const placed = svg.querySelector('.note-construct-placed');
        if (placed) placed.remove();
      }, 1200);
    }
  }

  s.totalCount++;
  if (isCorrect) {
    s.correctCount++;
    s.streak++;
    if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  } else {
    s.streak = 0;
  }

  // ── Within-session adaptive difficulty ──────────────────────────
  const diffIdx = DIFF_NAMES.indexOf(s.difficulty);
  if (s.streak === 3 && diffIdx >= 0 && diffIdx < 2) {
    const newDiff = DIFF_NAMES[diffIdx + 1];
    s.difficulty = newDiff;
    showToast(`📈 Leveling up to ${newDiff}!`);
    s.completed.push({
      type: 'difficulty_change',
      answer: newDiff,
      ok: true,
      hint: `Difficulty bumped from ${DIFF_NAMES[diffIdx]} to ${newDiff} after 3 correct streak`,
      correctAnswer: newDiff,
      difficultyChange: 'up',
      fromDifficulty: DIFF_NAMES[diffIdx],
    });
  } else if (s.streak === 0 && !isCorrect && diffIdx > 0) {
    const last2 = s.completed.slice(-2);
    if (last2.length >= 2 && !last2[0].ok && !last2[1].ok) {
      const newDiff = DIFF_NAMES[diffIdx - 1];
      s.difficulty = newDiff;
      showToast(`📉 Easing to ${newDiff}`);
      s.completed.push({
        type: 'difficulty_change',
        answer: newDiff,
        ok: true,
        hint: `Difficulty dropped from ${DIFF_NAMES[diffIdx]} to ${newDiff} after 2 wrong`,
        correctAnswer: newDiff,
        difficultyChange: 'down',
        fromDifficulty: DIFF_NAMES[diffIdx],
      });
    }
  }

  s.completed.push({
    type: ex.type,
    answer: userAnswer,
    ok: isCorrect,
    hint: ex.hint,
    correctAnswer: ex.answer,
    target: ex.target,
    questionLabel: ex.answerLabel || ex.answer,
    nearMiss: isClose,
  });
  _updateScoreDisplay();

  if (isCorrect) {
    _showSuccessBanner(`✓ ${userAnswer} — correct!`, { correctAnswer: ex.answer, streak: s.streak });
  } else if (isClose) {
    _showSuccessBanner(`~ ${userAnswer} — off by 1 semitone!`, { correctAnswer: ex.answer, streak: s.streak });
  } else {
    _showExerciseFeedback(ex, userAnswer);
    return;
  }
  const session = s;
  const exType = ex.type;
  setTimeout(() => {
    if (!APP.exerciseSession || APP.exerciseSession !== session) return;
    _hideSuccessBanner();
    let fb = document.getElementById('exercise-feedback-bar');
    if (fb) fb.remove();
    session.current = generateExercise(exType, session.difficulty);
    _presentExercise(session.current);
  }, 1500);
}

function _presentIntervalId(ex) {
  const instr = _kitDefaultInstrument();
  const score = createScore({title: 'Interval Identification', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  score.parts[0].staves[0].measures[0].notes = [
    mkNote(ex.target.bottom, 'q', 0, midiAutoAcc(ex.target.bottom)),
    mkNote(ex.target.top, 'q', 0, midiAutoAcc(ex.target.top)),
  ];
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  showToast('Name the interval! (e.g. Major 3rd, Perfect 5th)');
}

function _presentRhythmRead(ex) {
  const score = createScore({title: 'Rhythm Reading', instruments: ['Percussion'], ts: {num:4,den:4}, ks: 0});
  const notes = ex.target.durations.map(d => mkNote(60, d));
  score.parts[0].staves[0].measures[0].notes = notes;
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  showToast('Tap ▶ to hear, then clap/tap it back');
}

function _presentRhythmWorksheet(ex) {
  const mx = ex.target.measures;
  const score = createScore({title: 'Rhythm Dictation', instruments: ['Percussion'], ts: {num:4,den:4}, ks: 0});
  const stave = score.parts[0].staves[0];
  stave.measures = [];
  for (let m = 0; m < mx; m++) {
    stave.measures.push({
      timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
      keySig: m === 0 ? 0 : null, lineBreak: (m > 0 && m % 4 === 0),
      notes: [mkRest('w')],
    });
  }
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  _renderRhythmBeatGrid(ex);
}

function _presentMelodyDict(ex) {
  // Phase 1: blank score — student hears but does NOT see the melody
  const instr = _kitDefaultInstrument();
  const blankScore = createScore({title: 'Melody Dictation', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  // Fill with whole-measure rests so the score has structure but no pitches
  const totalBeats = ex.target.notes.reduce((s, n) => s + durBeats(n.duration, 0, null), 0);
  const measureCount = Math.max(1, Math.ceil(totalBeats / 4));
  blankScore.parts[0].staves[0].measures = [];
  for (let i = 0; i < measureCount; i++) {
    blankScore.parts[0].staves[0].measures.push({
      timeSigNum: i === 0 ? 4 : null, timeSigDen: i === 0 ? 4 : null,
      keySig: i === 0 ? 0 : null, lineBreak: false, notes: [mkRest('w')]
    });
  }
  adoptScore(blankScore, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();

  // Store target for playback-only (not rendered)
  const s = APP.exerciseSession;
  if (s) {
    s._dictationTarget = ex.target.notes;
    s._dictationPhase = 'listen';
  }
  _showDictationListenBar();
}

function _showDictationListenBar() {
  const existing = document.getElementById('dictation-bar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'dictation-bar';
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:10px;background:rgba(247,243,237,0.98);border:1px solid rgba(192,86,33,0.2);border-radius:8px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.08);font-size:13px;color:#4a5568;flex-wrap:wrap';
  const currentTempo = APP.tempo || 120;
  bar.innerHTML = `<span style="font-weight:600;white-space:nowrap">🎧 Listen</span>
    <button class="modal-btn primary" id="dictation-play" style="padding:4px 12px;font-size:12px">▶ Play Melody</button>
    <button class="modal-btn secondary" id="dictation-ready" style="padding:4px 12px;font-size:12px">📝 I'm Ready</button>
    <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
      <label style="font-size:11px;color:#4a5568;font-weight:600">♩</label>
      <input type="range" id="dictation-tempo" min="40" max="200" value="${currentTempo}" style="width:100px" aria-label="Tempo">
      <span id="dictation-tempo-val" style="font-size:12px;font-weight:700;color:#c05621;min-width:36px;text-align:right">${currentTempo}</span> BPM
    </div>`;
  document.body.appendChild(bar);
  // Use event delegation on the bar to avoid DOM race
  bar.addEventListener('click', e => {
    const id = e.target?.id;
    if (id === 'dictation-play') _playDictationMelody();
    if (id === 'dictation-ready') _startDictationNotate();
  });
  // Tempo slider handler
  const tempoSlider = bar.querySelector('#dictation-tempo');
  const tempoVal = bar.querySelector('#dictation-tempo-val');
  if (tempoSlider && tempoVal) {
    tempoSlider.addEventListener('input', e => {
      const val = parseInt(e.target.value);
      tempoVal.textContent = val;
      APP.tempo = val;
    });
    tempoSlider.addEventListener('change', e => {
      const val = parseInt(e.target.value);
      APP.tempo = val;
    });
  }
}

function _playDictationMelody() {
  const s = APP.exerciseSession;
  if (!s || !s._dictationTarget) return;
  // Quick playback using the kit instrument sound
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  if (APP.masterGain) APP.masterGain.gain.value = APP.masterVolume;
  if (APP.metronomeGain) APP.metronomeGain.gain.value = APP.metronomeVolume;
  const bpm = (APP.tempo > 0) ? APP.tempo : 120;
  const beatDur = 60 / bpm;
  let t = ctx.currentTime + 0.05;
  const instr = _kitDefaultInstrument();
  const instrDef = INSTRUMENTS.find(i => i.name === instr);
  const oscType = instrDef?.osc || 'triangle';
  for (const n of s._dictationTarget) {
    const dur = durBeats(n.duration, 0, null) * beatDur;
    scheduleNote(ctx, n.pitch, t, dur * 0.88, oscType, 1);
    t += dur;
  }
  showToast('Playing melody…');
}

function _startDictationNotate() {
  const bar = document.getElementById('dictation-bar');
  if (bar) bar.remove();
  const s = APP.exerciseSession;
  if (s) s._dictationPhase = 'notate';
  // Show a floating submit bar
  _showDictationCheckBar();
  showToast('Enter the notes you heard (tap palette or use MIDI/mic)');
}

function _showDictationCheckBar() {
  const existing = document.getElementById('dictation-check-bar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'dictation-check-bar';
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:10px;background:rgba(247,243,237,0.98);border:1px solid rgba(192,86,33,0.2);border-radius:8px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.08);font-size:13px;color:#4a5568;flex-wrap:wrap';
  const currentTempo = APP.tempo || 120;
  bar.innerHTML = `<span style="font-weight:600;white-space:nowrap">✍️ Done notating?</span>
    <button class="modal-btn primary" id="dictation-check" style="padding:4px 12px;font-size:12px">✔ Check Melody</button>
    <button class="modal-btn secondary" id="dictation-play-again" style="padding:4px 12px;font-size:12px">▶ Play Again</button>
    <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
      <label style="font-size:11px;color:#4a5568;font-weight:600">♩</label>
      <input type="range" id="dictation-tempo" min="40" max="200" value="${currentTempo}" style="width:100px" aria-label="Tempo">
      <span id="dictation-tempo-val" style="font-size:12px;font-weight:700;color:#c05621;min-width:36px;text-align:right">${currentTempo}</span> BPM
    </div>`;
  document.body.appendChild(bar);
  bar.addEventListener('click', e => {
    const id = e.target?.id;
    if (id === 'dictation-check') _checkDictationAnswer();
    if (id === 'dictation-play-again') _playDictationMelody();
  });
}

function _checkDictationAnswer() {
  const s = APP.exerciseSession;
  if (!s || !s._dictationTarget) return;
  const target = s._dictationTarget;
  if (!APP.score) return;

  // Collect all non-rest note pitches from the score in order
  const placedPitches = [];
  for (const stave of APP.score.parts[0]?.staves || []) {
    for (const m of stave.measures || []) {
      for (const n of m.notes || []) {
        if (n.type === 'note') placedPitches.push(n.pitch);
      }
    }
  }

  // Compare to target
  const targetPitches = target.map(n => n.pitch);
  const correctPitches = [];
  const incorrectPitches = [];
  const maxLen = Math.max(placedPitches.length, targetPitches.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= placedPitches.length) {
      incorrectPitches.push({ idx: i, placed: '(missing)', expected: targetPitches[i] });
    } else if (i >= targetPitches.length) {
      incorrectPitches.push({ idx: i, placed: placedPitches[i], expected: '(extra)' });
    } else if (placedPitches[i] === targetPitches[i]) {
      correctPitches.push({ idx: i, pitch: placedPitches[i] });
    } else {
      incorrectPitches.push({ idx: i, placed: placedPitches[i], expected: targetPitches[i] });
    }
  }

  const total = maxLen;
  const correct = correctPitches.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Record in session
  s.totalCount++;
  if (pct === 100) { s.correctCount++; s.streak++; if (s.streak > s.maxStreak) s.maxStreak = s.streak; }
  else { s.streak = 0; }
  s.completed.push({ type:'melody_dictation', answer:pct+'%', ok:pct===100, hint:'Compare pitch by pitch' });
  _updateScoreDisplay();

  // Show results
  const detailHtml = correctPitches.map(c =>
    `<span style="color:#2f855a">✓ Note ${c.idx+1}: correct</span>`
  ).concat(incorrectPitches.map(c =>
    `<span style="color:#e06850">✗ Note ${c.idx+1}: got ${c.placed}, expected ${c.expected}</span>`
  )).join('<br>');

  makeModal(`
    <h2>${pct === 100 ? '✓ Perfect!' : 'Not quite'}</h2>
    <div style="font-size:14px;color:#4a5568;margin-bottom:12px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:#c05621">${pct}%</div>
      <div>${correct} / ${total} notes correct</div>
    </div>
    <div style="margin-bottom:12px;max-height:180px;overflow-y:auto;font-size:12px;color:#4a5568;line-height:1.6">${detailHtml}</div>
    <button class="modal-btn primary" data-action="nextExercise">Next Exercise</button>
    ${pct < 100 ? '<button class="modal-btn secondary" data-action="retryDictation">Try Again</button>' : ''}
    <button class="modal-btn secondary" data-action="endExerciseSession">End Session</button>
  `);
}

function retryDictation() {
  closeModal();
  const s = APP.exerciseSession;
  if (!s) return;
  // Reset the dictation to listen phase
  const ex = s.current;
  if (ex?.type === EXERCISE_TYPES.MELODY_DICT) {
    // Remove the check bar
    const bar = document.getElementById('dictation-check-bar');
    if (bar) bar.remove();
    _presentMelodyDict(ex);
  }
} 

function _presentKeySigId(ex) {
  const instr = _kitDefaultInstrument();
  const score = createScore({title: 'Key Signature ID', instruments: [instr], ts: {num:4,den:4}, ks: ex.target.keySig});
  score.parts[0].staves[0].measures[0].notes = [mkRest('w')];
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  showToast(ex.askMinor ? 'Name the minor key! (e.g. Am, Dm, F#m)' : 'Name the major key! (e.g. C, G, F#, Bb)');
}

function _presentScaleId(ex) {
  const { tonic, notes } = ex.target;
  const instr = _kitDefaultInstrument();
  const score = createScore({title: 'Scale Identification', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  const stave = score.parts[0].staves[0];
  stave.measures = [];
  const notesPerMeasure = 4;
  for (let m = 0; m < Math.ceil(notes.length / notesPerMeasure); m++) {
    const slice = notes.slice(m * notesPerMeasure, m * notesPerMeasure + notesPerMeasure);
    stave.measures.push({
      timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
      keySig: m === 0 ? 0 : null, lineBreak: m > 0 && m % 4 === 0,
      notes: slice.map(p => mkNote(p, 'q', 0, midiAutoAcc(p))),
    });
  }
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  // Auto-play the scale
  setTimeout(() => {
    showToast('🎧 Listen to the scale, then name it!');
    startPlayback();
  }, 300);
}

// ── Answer Checking ──────────────────────────────────────────────
function checkExerciseAnswer(userAnswer) {
  const s = APP.exerciseSession;
  if (!s || !s.current) return;
  const ex = s.current;

  // Interval exercises use fuzzy alias matching; others use exact string match
  let isCorrect;
  if (ex.type === EXERCISE_TYPES.INTERVAL_ID) {
    isCorrect = _intervalMatches(userAnswer, ex.answer);
  } else if (ex.type === EXERCISE_TYPES.KEY_SIG_ID) {
    // Key sig: accept the expected answer with abbreviations
    const normKey = s => {
      let v = String(s).trim().toLowerCase().replace(/\s+/g, '');
      v = v.replace(/^(.*?)(?:minor|min)$/, '$1m');
      v = v.replace(/^(.*?)major$/, '$1');
      return v;
    };
    isCorrect = normKey(userAnswer) === normKey(ex.answer);
  } else if (ex.type === EXERCISE_TYPES.SCALE_ID) {
    // Scale ID: accept scale name with various formats
    const normScale = s => {
      let v = String(s).trim().toLowerCase().replace(/[\s\-_]/g, '');
      // Normalize common abbreviations
      v = v.replace(/natmin$/, 'natural_minor').replace(/harmin$/, 'harmonic_minor').replace(/melmin$/, 'melodic_minor_up');
      v = v.replace(/majpent$/, 'pentatonic_major').replace(/minpent$/, 'pentatonic_minor');
      return v;
    };
    const normalizedAnswer = normScale(ex.answer.split(' ').slice(0, -1).join(' ') + ' ' + ex.answer.split(' ').slice(-1));
    isCorrect = normScale(userAnswer) === normalizedAnswer;
  } else {
    const normalizedUser = String(userAnswer).trim().toLowerCase().replace(/\s+/g, '');
    const normalizedTarget = String(ex.answer).trim().toLowerCase().replace(/\s+/g, '');
    isCorrect = normalizedUser === normalizedTarget;
  }

  s.totalCount++;
  if (isCorrect) {
    s.correctCount++;
    s.streak++;
    if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  } else {
    s.streak = 0;
  }

  // ── Within-session adaptive difficulty ──────────────────────────
  const diffIdx = DIFF_NAMES.indexOf(s.difficulty);
  if (s.streak === 3 && diffIdx >= 0 && diffIdx < 2) {
    const newDiff = DIFF_NAMES[diffIdx + 1];
    s.difficulty = newDiff;
    showToast(`📈 Leveling up to ${newDiff}!`);
    s.completed.push({
      type: 'difficulty_change',
      answer: newDiff,
      ok: true,
      hint: `Difficulty bumped from ${DIFF_NAMES[diffIdx]} to ${newDiff} after 3 correct streak`,
      correctAnswer: newDiff,
      difficultyChange: 'up',
      fromDifficulty: DIFF_NAMES[diffIdx],
    });
  } else if (s.streak === 0 && !isCorrect && diffIdx > 0) {
    const last2 = s.completed.slice(-2);
    if (last2.length >= 2 && !last2[0].ok && !last2[1].ok) {
      const newDiff = DIFF_NAMES[diffIdx - 1];
      s.difficulty = newDiff;
      showToast(`📉 Easing to ${newDiff}`);
      s.completed.push({
        type: 'difficulty_change',
        answer: newDiff,
        ok: true,
        hint: `Difficulty dropped from ${DIFF_NAMES[diffIdx]} to ${newDiff} after 2 wrong`,
        correctAnswer: newDiff,
        difficultyChange: 'down',
        fromDifficulty: DIFF_NAMES[diffIdx],
      });
    }
  }

  s.completed.push({
    type: ex.type,
    answer: userAnswer,
    ok: isCorrect,
    hint: ex.hint,
    correctAnswer: ex.answer,
    target: ex.target,
    questionLabel: ex.answerLabel || ex.answer,
    askMinor: ex.askMinor,
    answerMajor: ex.answerMajor,
    answerMinor: ex.answerMinor,
  });
  _updateScoreDisplay();

  if (isCorrect) {
    _showSuccessBanner(`✓ ${userAnswer} — correct!`, { correctAnswer: ex.answerLabel || ex.answer, streak: s.streak });
    const session = s;
    const exType = ex.type;
    setTimeout(() => {
      if (!APP.exerciseSession || APP.exerciseSession !== session) return;
      _hideSuccessBanner();
      let fb = document.getElementById('exercise-feedback-bar');
      if (fb) fb.remove();
      session.current = generateExercise(exType, session.difficulty);
      _presentExercise(session.current);
    }, 1200);
  } else {
    _showExerciseFeedback(ex, userAnswer);
  }
}

function _showSuccessBanner(msg, opts = {}) {
  const existing = document.getElementById('exercise-success-banner');
  if (existing) existing.remove();

  const streak = opts.streak || 0;
  const correctAnswer = opts.correctAnswer || '';
  let milestone = '';
  if (streak === 3) milestone = 'Nice streak!';
  else if (streak === 5) milestone = 'On fire!';
  else if (streak >= 10) milestone = 'Unstoppable!';

  const el = document.createElement('div');
  el.id = 'exercise-success-banner';
  el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-12px);z-index:2000;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 20px rgba(34,197,94,0.35);opacity:0;transition:opacity 0.25s ease, transform 0.25s ease;pointer-events:none;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center';
  el.innerHTML = `<div>${escHtml(msg)}</div>${correctAnswer ? `<div style="font-size:11px;opacity:0.85;margin-top:2px">Answer: ${escHtml(correctAnswer)}</div>` : ''}${milestone ? `<div style="font-size:13px;margin-top:3px;color:#bbf7d0">${milestone}</div>` : ''}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)'; });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-12px)';
    setTimeout(() => { if (el.parentNode) el.remove(); }, 250);
  }, 1000);
}

function _hideSuccessBanner() {
  const el = document.getElementById('exercise-success-banner');
  if (el) el.style.opacity = '0';
}

function _showExerciseFeedback(ex, userAnswer) {
  const existing = document.getElementById('exercise-feedback-bar');
  if (existing) existing.remove();

  const correctLabel = ex.answerLabel || ex.answer;
  const hintText = escHtml(ex.hint || '');

  const extraNote = (ex.type === EXERCISE_TYPES.KEY_SIG_ID)
    ? (ex.askMinor ? ` (also ${escHtml(ex.answerMajor)})`
                  : ` (also ${escHtml(ex.answerMinor)})`)
    : '';

  const bar = document.createElement('div');
  bar.id = 'exercise-feedback-bar';
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%) translateY(20px);z-index:200;display:flex;align-items:flex-start;gap:10px;background:rgba(255,251,235,0.98);border:1px solid rgba(217,160,60,0.3);border-radius:10px;padding:12px 16px;box-shadow:0 3px 16px rgba(0,0,0,0.09);font-size:13px;color:#4a5568;flex-wrap:wrap;max-width:92vw;opacity:0;transition:opacity 0.3s ease, transform 0.3s ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
  bar.innerHTML = `
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-weight:700;color:#b45309;font-size:14px">Not quite</span>
        <div style="display:flex;gap:6px;align-items:center;font-size:12px">
          <span style="background:rgba(239,68,68,0.1);padding:2px 8px;border-radius:4px;color:#dc2626">You: <b>${escHtml(userAnswer)}</b></span>
          <span style="color:rgba(74,85,104,0.4)">→</span>
          <span style="background:rgba(34,197,94,0.1);padding:2px 8px;border-radius:4px;color:#16a34a">Correct: <b>${escHtml(correctLabel)}</b>${extraNote}</span>
        </div>
      </div>
      ${hintText ? `
        <details open style="margin-top:2px">
          <summary style="cursor:pointer;font-size:11px;color:rgba(74,85,104,0.6);font-weight:600;user-select:none">Why? ▸</summary>
          <div style="margin-top:4px;font-size:11px;color:rgba(74,85,104,0.7);line-height:1.5">💡 ${hintText}</div>
        </details>` : ''}
    </div>
    <div style="display:flex;gap:6px;flex-shrink:0;align-self:center">
      <button class="modal-btn" data-action="skipExercise" style="padding:4px 10px;font-size:12px;background:transparent;border:1px solid rgba(192,86,33,0.2);color:#4a5568;border-radius:5px">Skip</button>
      <button class="modal-btn primary" data-action="retryExercise" style="padding:4px 12px;font-size:12px">Try Again</button>
      <button class="modal-btn secondary" data-action="endExerciseSession" style="padding:4px 10px;font-size:12px">End Session</button>
    </div>
  `;
  document.body.appendChild(bar);

  requestAnimationFrame(() => { bar.style.opacity = '1'; bar.style.transform = 'translateX(-50%) translateY(0)'; });

  setTimeout(() => {
    const fb = document.getElementById('exercise-feedback-bar');
    if (fb && fb.parentNode) fb.remove();
  }, 15000);
}

function nextExercise() {
  closeModal();
  _hideExerciseFeedback();
  const s = APP.exerciseSession;
  if (!s) return;
  s.current = generateExercise(s.type, s.difficulty);
  _presentExercise(s.current);
}

function skipExercise() {
  _hideExerciseFeedback();
  const s = APP.exerciseSession;
  if (!s) return;
  s.current = generateExercise(s.type, s.difficulty);
  _presentExercise(s.current);
}

function retryExercise() {
  closeModal();
  _hideExerciseFeedback();
  const s = APP.exerciseSession;
  if (!s || !s.current) return;
  _presentExercise(s.current);
}

function _hideExerciseFeedback() {
  const fb = document.getElementById('exercise-feedback-bar');
  if (fb) fb.remove();
}

// ── Exercise UI ─────────────────────────────────────────────────
function _updateScoreDisplay() {
  const el = document.getElementById('exercise-score');
  if (!el) return;
  const s = APP.exerciseSession;
  if (!s) { el.style.display = 'none'; return; }
  el.style.display = 'flex';

  const pct = s.totalCount > 0 ? Math.round((s.correctCount / s.totalCount) * 100) : 100;
  const accColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626';
  const prevCount = parseInt(el.dataset.prevCount || '0', 10);
  const countChanged = s.totalCount !== prevCount;
  el.dataset.prevCount = s.totalCount;

  const streakHtml = s.streak >= 2
    ? `<span class="score-streak">🔥 ${s.streak}</span>`
    : '';

  const diffLabel = s.difficulty ? `<span style="font-size:10px;opacity:0.7;margin-left:4px">${s.difficulty}</span>` : '';

  el.innerHTML = `
    <div class="score-row">
      <span style="font-weight:700;font-size:13px">${s.correctCount}/${s.totalCount}</span>
      <span class="score-accuracy" style="color:${accColor}">${pct}%</span>
      ${streakHtml}${diffLabel}
    </div>
    <div class="score-progress-bar"><div class="score-progress-fill" style="width:${s.totalCount > 0 ? pct : 0}%"></div></div>
  `;

  if (countChanged) {
    el.classList.remove('exercise-score-pulse');
    void el.offsetWidth;
    el.classList.add('exercise-score-pulse');
  }
}

function _setExerciseUI(enabled) {
  document.body.classList.toggle('exercise-mode', enabled);
  const transport = document.getElementById('transport-bar');
  if (transport) transport.style.opacity = enabled ? '0.5' : '';
  // Hide entire palette during exercises to reduce distraction
  const pal = document.getElementById('palette');
  if (pal) pal.style.display = enabled ? 'none' : '';
  // Score display
  let scoreEl = document.getElementById('exercise-score');
  if (enabled && !scoreEl) {
    scoreEl = document.createElement('div');
    scoreEl.id = 'exercise-score';
    scoreEl.style.cssText = 'position:fixed;top:48px;right:12px;z-index:200;';
    document.body.appendChild(scoreEl);
  }
  if (!enabled && scoreEl) scoreEl.remove();
  _updateScoreDisplay();
  _updateExerciseInputBar();
}

function _updateExerciseInputBar() {
  const existing = document.getElementById('exercise-input-bar');
  if (existing) existing.remove();
  const s = APP.exerciseSession;
  if (!APP.exerciseMode || !s) return;
  const ex = s.current;
  if (!ex) return;
  // Show text input bar for note ID, interval ID, key-sig, and scale ID exercises
  const supportsTextInput = [
    EXERCISE_TYPES.NOTE_ID,
    EXERCISE_TYPES.INTERVAL_ID,
    EXERCISE_TYPES.KEY_SIG_ID,
    EXERCISE_TYPES.SCALE_ID,
  ].includes(ex.type);
  if (!supportsTextInput) return;

  const bar = document.createElement('div');
  bar.id = 'exercise-input-bar';
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:8px;background:rgba(247,243,237,0.98);border:1px solid rgba(192,86,33,0.2);border-radius:8px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.08);font-size:13px;color:#4a5568;';
  const label = ex.type === EXERCISE_TYPES.NOTE_ID ? 'Note name:'
    : ex.type === EXERCISE_TYPES.INTERVAL_ID ? 'Interval name:'
    : ex.type === EXERCISE_TYPES.SCALE_ID ? 'Scale name:'
    : ex.askMinor ? 'Minor key:' : 'Major key:';
  const placeholder = ex.type === EXERCISE_TYPES.NOTE_ID ? 'e.g. C4, F#5'
    : ex.type === EXERCISE_TYPES.INTERVAL_ID ? 'e.g. Major 3rd, P5'
    : ex.type === EXERCISE_TYPES.SCALE_ID ? 'e.g. C Major, A Natural Minor'
    : 'e.g. C, Gm';
  bar.innerHTML = `<span style="font-weight:600;white-space:nowrap">${label}</span>
    <input id="exercise-answer-input" type="text" placeholder="${placeholder}" style="width:180px;padding:4px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
    <button class="modal-btn primary" id="exercise-submit-btn" style="padding:4px 12px;font-size:12px">Submit</button>`;
  document.body.appendChild(bar);

  setTimeout(() => {
    const inp = document.getElementById('exercise-answer-input');
    const btn = document.getElementById('exercise-submit-btn');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') _submitTextExercise(); });
    }
    if (btn) btn.addEventListener('click', _submitTextExercise);
  }, 50);
}

function _submitTextExercise() {
  const inp = document.getElementById('exercise-answer-input');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) { showToast('Type your answer first'); return; }
  checkExerciseAnswer(val);
  inp.value = '';
}

// ── Rhythm Worksheet ──────────────────────────────────────────
function _renderRhythmBeatGrid(ex) {
  const existing = document.getElementById('rhythm-beat-grid');
  if (existing) existing.remove();

  const beats = ex.target.beats;
  const measures = ex.target.measures;
  const container = document.createElement('div');
  container.id = 'rhythm-beat-grid';

  const maxPlays = ex.difficulty === 0 ? Infinity : ex.difficulty === 1 ? 3 : 1;
  const playsLeft = APP.exerciseSession?.playsLeft ?? maxPlays;
  const currentTempo = APP.tempo || 100;

  let html = '<div class="rg-play-row" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;margin-bottom:8px">';
  html += `<button class="modal-btn primary" id="rg-play-btn" style="flex:1;min-width:140px">${playsLeft === Infinity ? '▶ Play Rhythm' : '▶ Play (' + playsLeft + ' left)'}</button>`;
  html += `<div style="display:flex;align-items:center;gap:8px;white-space:nowrap">
    <label style="font-size:12px;color:#4a5568;font-weight:600">♩ Tempo:</label>
    <input type="range" id="rg-tempo" min="40" max="200" value="${currentTempo}" style="width:120px" aria-label="Tempo">
    <span id="rg-tempo-val" style="font-size:13px;font-weight:700;color:#c05621;min-width:40px;text-align:right">${currentTempo}</span> BPM
  </div>`;
  html += '</div>';

  for (let m = 0; m < measures; m++) {
    html += '<div class="rg-row">';
    html += `<span class="rg-measure-label">${m + 1}</span>`;
    for (let b = 0; b < 4; b++) {
      const idx = m * 4 + b;
      html += `<button class="rg-beat" data-beat="${idx}" data-answer="${beats[idx] === 'q' ? '♩' : '𝄽'}">·</button>`;
    }
    html += '</div>';
  }
  html += '<div class="rg-controls">';
  html += '<button class="modal-btn primary" id="rg-check-btn">✔ Check Answers</button>';
  html += '<button class="modal-btn secondary" id="rg-end-btn">End Session</button>';
  html += '</div>';

  container.innerHTML = html;

  container.addEventListener('click', e => {
    if (e.target.id === 'rg-play-btn') {
      _playRhythmDictation(ex);
      return;
    }
    const beatBtn = e.target.closest('.rg-beat');
    if (beatBtn && !beatBtn.dataset.locked) {
      const cur = beatBtn.textContent;
      beatBtn.textContent = cur === '·' ? '♩' : cur === '♩' ? '𝄽' : '·';
      beatBtn.className = 'rg-beat' + (beatBtn.textContent === '♩' ? ' rg-note' : beatBtn.textContent === '𝄽' ? ' rg-rest' : '');
      beatBtn.dataset.userAnswer = beatBtn.textContent;
    }
    if (e.target.id === 'rg-check-btn') checkRhythmWorksheet();
    if (e.target.id === 'rg-end-btn') endExerciseSession();
  });

  // Tempo slider handler
  const tempoSlider = container.querySelector('#rg-tempo');
  const tempoVal = container.querySelector('#rg-tempo-val');
  if (tempoSlider && tempoVal) {
    tempoSlider.addEventListener('input', e => {
      const val = parseInt(e.target.value);
      tempoVal.textContent = val;
      APP.tempo = val;
    });
    tempoSlider.addEventListener('change', e => {
      const val = parseInt(e.target.value);
      APP.tempo = val;
    });
  }

  document.body.appendChild(container);
}

function _playRhythmDictation(ex) {
  const s = APP.exerciseSession;
  if (!s) return;
  const maxPlays = ex.difficulty === 0 ? Infinity : ex.difficulty === 1 ? 3 : 1;
  if (s.playsLeft !== undefined && s.playsLeft <= 0) { showToast('No plays remaining'); return; }

  const ctx = getAudioCtx();
  const bpm = APP.tempo || 100;
  const beatDur = 60 / bpm;
  const t0 = ctx.currentTime + 0.15;
  const beats = ex.target.beats;

  for (let i = 0; i < beats.length; i++) {
    const t = t0 + i * beatDur;
    if (beats[i] === 'q') {
      scheduleNote(ctx, 42, t, beatDur * 0.8, 'noise', 0.6);
    }
  }

  if (s.playsLeft !== undefined && s.playsLeft !== Infinity) {
    s.playsLeft--;
    const playBtn = document.getElementById('rg-play-btn');
    if (playBtn) {
      if (s.playsLeft <= 0) { playBtn.disabled = true; playBtn.textContent = '▶ No plays left'; }
      else playBtn.textContent = '▶ Play (' + s.playsLeft + ' left)';
    }
  }
}

function checkRhythmWorksheet() {
  const s = APP.exerciseSession;
  if (!s || !s.current || s.current.type !== EXERCISE_TYPES.RHYTHM_WS) return;

  const beatBtns = document.querySelectorAll('#rhythm-beat-grid .rg-beat');
  let correct = 0;
  const total = beatBtns.length;
  const results = [];

  beatBtns.forEach(btn => {
    const userAns = btn.dataset.userAnswer || '·';
    const correctAns = btn.dataset.answer;
    const isCorrect = userAns === correctAns;
    if (isCorrect) correct++;
    results.push({ idx: parseInt(btn.dataset.beat), userAns, correctAns, isCorrect });
    btn.className = 'rg-beat' + (userAns === '♩' ? ' rg-note' : userAns === '𝄽' ? ' rg-rest' : '') + (isCorrect ? ' rg-correct' : ' rg-incorrect');
    btn.dataset.locked = '1';
  });

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  s.totalCount++;
  if (pct === 100) { s.correctCount++; s.streak++; if (s.streak > s.maxStreak) s.maxStreak = s.streak; }
  else { s.streak = 0; }
  s.completed.push({ type: 'rhythm_worksheet', answer: correct + '/' + total, ok: pct === 100, hint: 'Compare each beat carefully.' });
  _updateScoreDisplay();

  const checkBtn = document.getElementById('rg-check-btn');
  if (checkBtn) {
    checkBtn.textContent = `${pct}% — ${correct}/${total}`;
    checkBtn.style.background = pct === 100 ? '#22c55e' : pct >= 80 ? '#e6a817' : '#e06850';
    checkBtn.style.color = '#fff';
    checkBtn.style.borderColor = 'transparent';
    checkBtn.disabled = true;
  }

  const resultHtml = results.map(r =>
    `<span style="color:${r.isCorrect ? '#22c55e' : '#e06850'};font-size:12px">
      ${r.isCorrect ? '✓' : '✗'} Beat ${r.idx + 1}: ${r.userAns} ${r.isCorrect ? '' : '(expected ' + r.correctAns + ')'}
    </span>`
  ).join('<br>');

  const gridEl = document.getElementById('rhythm-beat-grid');
  let scoreEl = gridEl?.querySelector('.rg-score');
  if (!scoreEl && gridEl) {
    scoreEl = document.createElement('div');
    scoreEl.className = 'rg-score';
    gridEl.insertBefore(scoreEl, gridEl.querySelector('.rg-controls'));
  }
  if (scoreEl) {
    scoreEl.textContent = pct === 100 ? '✓ Perfect!' : `${pct}% correct`;
  }
}

function showRhythmWorksheetDialog() {
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }
  const diffs = ['beginner', 'intermediate', 'advanced'];
  const currentDiff = APP.exerciseDifficulty || 'beginner';

  makeModal(`
    <h2>Rhythm Dictation</h2>
    <p class="dialog-hint">8 measures of 4/4 — quarter notes and rests only.
    Press Play to hear the rhythm, then mark each beat in the grid.</p>
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:6px">Difficulty</div>
      <div style="display:flex;gap:6px">
        ${diffs.map(d => `<button class="modal-btn ${d===currentDiff?'primary':'secondary'}" id="rg-diff-${d}" data-diff="${d}" style="flex:1;padding:8px 4px;font-size:12px">${d}</button>`).join('')}
      </div>
    </div>
    <button class="modal-btn primary" id="rg-generate-btn">Generate Worksheet</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);

  setTimeout(() => {
    diffs.forEach(d => {
      const btn = document.getElementById('rg-diff-' + d);
      if (btn) btn.addEventListener('click', () => {
        APP.exerciseDifficulty = d;
        showRhythmWorksheetDialog();
      });
    });
    const genBtn = document.getElementById('rg-generate-btn');
    if (genBtn) genBtn.addEventListener('click', () => {
      const diff = APP.exerciseDifficulty || 'beginner';
      closeModal();
      _startRhythmWorksheet(diff);
    });
  }, 50);
}

function _startRhythmWorksheet(difficulty) {
  const ex = _genRhythmWorksheet(difficulty);
  const maxPlays = difficulty === 0 ? Infinity : difficulty === 1 ? 3 : 1;
  APP.exerciseSession = {
    type: EXERCISE_TYPES.RHYTHM_WS, difficulty,
    current: ex, completed: [], correctCount: 0, totalCount: 0,
    streak: 0, maxStreak: 0, startedAt: Date.now(), playsLeft: maxPlays,
  };
  APP.exerciseMode = true;
  _setExerciseUI(true);
  _presentRhythmWorksheet(ex);
  _validateModeState();
}

function showExerciseDialog() {
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }
  const types = [
    {key: EXERCISE_TYPES.NOTE_ID,      icon:'🎵', label:'Note Identification', desc:'Name the note on the staff'},
    {key: EXERCISE_TYPES.INTERVAL_ID,  icon:'↔',  label:'Interval Identification', desc:'Name the interval between two notes'},
    {key: EXERCISE_TYPES.RHYTHM_READ,  icon:'𝅘𝅥𝅮', label:'Rhythm Reading', desc:'Read and clap rhythm patterns'},
    {key: EXERCISE_TYPES.MELODY_DICT,  icon:'🎼', label:'Melody Dictation', desc:'Hear a melody, then notate it'},
    {key: EXERCISE_TYPES.KEY_SIG_ID,   icon:'♭♯', label:'Key Signature', desc:'Name the key from the signature'},
    {key: EXERCISE_TYPES.RHYTHM_WS,    icon:'🔊', label:'Rhythm Dictation', desc:'Hear a rhythm, then mark each beat'},
    {key: EXERCISE_TYPES.SCALE_ID,     icon:'🎹', label:'Scale Identification', desc:'Hear a scale, then name it'},
  ];
  const diffs = ['beginner', 'intermediate', 'advanced', 'auto'];
  const currentDiff = APP.exerciseDifficulty || 'beginner';
  const results = _loadResults();

  const byType = {};
  results.forEach(r => { if (!byType[r.type]) byType[r.type] = []; byType[r.type].push(r); });

  let weakestType = null, weakestAvg = 101;
  let mostPracticed = null, mostCount = 0;
  Object.keys(byType).forEach(t => {
    const avg = Math.round(byType[t].reduce((s, x) => s + x.pct, 0) / byType[t].length);
    const cnt = byType[t].length;
    if (cnt >= 2 && avg < weakestAvg) { weakestAvg = avg; weakestType = t; }
    if (cnt > mostCount) { mostCount = cnt; mostPracticed = t; }
  });
  const quickStartType = weakestType || mostPracticed || EXERCISE_TYPES.NOTE_ID;
  const quickStartLabel = weakestType ? `Weakest: ${types.find(t=>t.key===weakestType)?.label||weakestType}` : mostPracticed ? `Most practiced: ${types.find(t=>t.key===mostPracticed)?.label||mostPracticed}` : 'Start with Note Identification';

  makeModal(`
    <style>
      .exercise-card{background:var(--bg-score-area,#f0ebe3);border:1.5px solid rgba(192,86,33,0.15);border-radius:10px;padding:12px;cursor:pointer;transition:all .15s ease;position:relative;display:flex;flex-direction:column;gap:4px}
      .exercise-card:hover{border-color:#c05621;box-shadow:0 2px 8px rgba(192,86,33,0.15);transform:translateY(-1px)}
      .exercise-card:active{transform:scale(0.97);box-shadow:none}
      .exercise-card .ec-title{font-weight:700;font-size:13px;color:#2d3748;display:flex;align-items:center;gap:6px}
      .exercise-card .ec-desc{font-size:11px;color:rgba(74,85,104,0.6);line-height:1.3}
      .exercise-card .ec-meta{font-size:10px;color:rgba(74,85,104,0.5);margin-top:2px}
      .exercise-card .ec-score{position:absolute;top:10px;right:10px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px}
      .diff-pill{border:1.5px solid rgba(192,86,33,0.15);background:transparent;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:600;color:#4a5568;cursor:pointer;transition:all .15s}
      .diff-pill.active{background:#c05621;color:#fff;border-color:#c05621}
      .diff-pill:hover:not(.active){border-color:#c05621;color:#c05621}
    </style>
    <h2>Exercise Browser</h2>

    <div style="display:flex;gap:6px;margin-bottom:14px;justify-content:center">
      ${diffs.map(d => `<button class="diff-pill ${d===currentDiff?'active':''}" data-action="selectExerciseDifficulty" data-diff="${d}">${d}</button>`).join('')}
    </div>

    <button class="modal-btn primary" style="width:100%;margin-bottom:14px;padding:12px;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px"
      data-action="startExerciseSession" data-type="${quickStartType}" data-diff="${currentDiff}">
      ▶ Quick Start — ${quickStartLabel}
    </button>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;max-height:300px;overflow-y:auto">
      ${types.map(t => {
        const typeResults = byType[t.key] || [];
        const sessionCount = typeResults.length;
        let scoreColor = 'rgba(74,85,104,0.3)';
        let scoreText = '';
        if (sessionCount > 0) {
          const lastPct = typeResults[typeResults.length - 1].pct;
          scoreColor = lastPct >= 80 ? '#22c55e' : lastPct >= 60 ? '#e6a817' : '#e06850';
          scoreText = lastPct + '%';
        }
        return `
          <div class="exercise-card" data-action="startExerciseSession" data-type="${t.key}" data-diff="${currentDiff}">
            ${scoreText ? `<span class="ec-score" style="background:${scoreColor}18;color:${scoreColor}">${scoreText}</span>` : ''}
            <div class="ec-title"><span style="font-size:16px">${t.icon}</span>${t.label}</div>
            <div class="ec-desc">${t.desc}</div>
            <div class="ec-meta">${sessionCount > 0 ? `● ${sessionCount} session${sessionCount>1?'s':''}` : '○ Not started'}</div>
          </div>`;
      }).join('')}
    </div>

    <div style="display:flex;gap:8px">
      <button class="modal-btn secondary" data-action="showCurriculumDialog" style="flex:1">📚 Curriculum</button>
      <button class="modal-btn secondary" data-action="closeModal" style="flex:1">✕ Cancel</button>
    </div>
  `);
}

function selectExerciseDifficulty(diff) {
  APP.exerciseDifficulty = diff;
  // Re-render dialog with new difficulty highlighted
  showExerciseDialog();
}

// ── Student Progress Analytics ─────────────────────────────────
const RESULTS_KEY = 'pauta_exercise_results';
const IMPORTED_KEY = 'pauta_imported_reports';
const TYPE_LABELS = {
  note_id: 'Note ID', interval_id: 'Interval ID', rhythm_read: 'Rhythm Read',
  melody_dictation: 'Melody Dict', key_sig_id: 'Key Sig ID', rhythm_worksheet: 'Rhythm Dict',
  scale_id: 'Scale ID',
};

function _saveExerciseResult(session) {
  if (!session || session.totalCount === 0) return;
  const results = _loadResults();
  results.push({
    type: session.type,
    difficulty: session.difficulty,
    date: Date.now(),
    correct: session.correctCount,
    total: session.totalCount,
    pct: Math.round((session.correctCount / session.totalCount) * 100),
    streak: session.streak,
    maxStreak: session.maxStreak,
    time: Math.floor((Date.now() - session.startedAt) / 1000),
  });
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

function _loadResults() {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY)) || []; }
  catch(e) { return []; }
}

function showStudentProgress() {
  const results = _loadResults();
  if (!results.length) { showToast('No exercise results yet. Complete an exercise first!'); return; }

  // Group by type
  const byType = {};
  results.forEach(r => {
    if (!byType[r.type]) byType[r.type] = [];
    byType[r.type].push(r);
  });

  let totalSessions = results.length;
  let totalCorrect = results.reduce((s, r) => s + r.correct, 0);
  let totalAll = results.reduce((s, r) => s + r.total, 0);
  let overallPct = totalAll > 0 ? Math.round((totalCorrect / totalAll) * 100) : 0;
  let bestStreak = results.reduce((s, r) => Math.max(s, r.maxStreak || 0), 0);
  let totalTime = results.reduce((s, r) => s + (r.time || 0), 0);

  // ── Streak Calendar (last 12 weeks) ────────────────────────────
  const today = new Date();
  today.setHours(0,0,0,0);
  const dayMs = 86400000;
  const daysToShow = 84; // 12 weeks
  const startDate = new Date(today.getTime() - (daysToShow - 1) * dayMs);

  // Count sessions per day
  const sessionsByDay = {};
  results.forEach(r => {
    const d = new Date(r.date);
    d.setHours(0,0,0,0);
    const key = d.getTime();
    sessionsByDay[key] = (sessionsByDay[key] || 0) + 1;
  });

  // Build calendar grid (7 rows × 12 columns)
  const calSize = 11;
  const calGap = 2;
  const calCols = 12;
  let calSvg = `<svg width="${calCols * (calSize + calGap)}" height="${7 * (calSize + calGap)}" style="display:block;margin:0 auto">`;
  for (let week = 0; week < calCols; week++) {
    for (let day = 0; day < 7; day++) {
      const dayIdx = week * 7 + day;
      const date = new Date(startDate.getTime() + dayIdx * dayMs);
      const key = date.getTime();
      const count = sessionsByDay[key] || 0;
      const isFuture = date > today;
      let fill = '#ebedf0';
      if (!isFuture && count > 0) {
        fill = count >= 4 ? '#22c55e' : count >= 2 ? '#4ade80' : count >= 1 ? '#86efac' : '#ebedf0';
      }
      const x = week * (calSize + calGap);
      const y = day * (calSize + calGap);
      calSvg += `<rect x="${x}" y="${y}" width="${calSize}" height="${calSize}" rx="2" fill="${fill}" stroke="none"/>`;
    }
  }
  calSvg += `</svg>`;

  // ── Skill Radar Chart ───────────────────────────────────────────
  const types = Object.keys(TYPE_LABELS);
  const radarData = types.map(type => {
    const r = byType[type];
    return r ? Math.round(r.reduce((s, x) => s + x.pct, 0) / r.length) : 0;
  });
  const radarLabels = types.map(t => TYPE_LABELS[t] || t);

  function radarChart(data, labels, size) {
    const cx = size / 2, cy = size / 2;
    const maxR = size / 2 - 20;
    const n = data.length;
    if (n < 3) return ''; // Need at least 3 axes

    function polarToCart(angle, r) {
      const rad = (angle - 90) * Math.PI / 180;
      return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    }

    let svg = `<svg width="${size}" height="${size}" style="display:block;margin:0 auto">`;

    // Grid circles
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      const r = maxR * frac;
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ddd" stroke-width="0.5"/>`;
    });

    // Axes and labels
    for (let i = 0; i < n; i++) {
      const angle = (360 / n) * i;
      const [ex, ey] = polarToCart(angle, maxR);
      svg += `<line x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="#ddd" stroke-width="0.5"/>`;
      const [lx, ly] = polarToCart(angle, maxR + 14);
      const anchor = Math.abs(lx - cx) < 2 ? 'middle' : lx > cx ? 'start' : 'end';
      svg += `<text x="${lx}" y="${ly + 3}" text-anchor="${anchor}" font-size="8" fill="#666" font-family="Helvetica Neue,sans-serif">${labels[i]}</text>`;
    }

    // Data polygon
    const pts = data.map((v, i) => {
      const angle = (360 / n) * i;
      return polarToCart(angle, maxR * (v / 100));
    });
    svg += `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="rgba(192,86,33,0.15)" stroke="#c05621" stroke-width="1.5"/>`;

    // Data points
    pts.forEach((p, i) => {
      svg += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${data[i] >= 80 ? '#22c55e' : data[i] >= 60 ? '#e6a817' : '#e06850'}" stroke="#fff" stroke-width="1"/>`;
    });

    svg += `</svg>`;
    return svg;
  }

  // Recent 10 sessions for sparkline
  const recent = results.slice(-10);
  const recentPcts = recent.map(r => r.pct);

  // Sparkline SVG
  function sparkline(data, w, h, color) {
    if (data.length < 2) return '';
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / 100) * h;
      return `${x},${y}`;
    });
    return `<svg width="${w}" height="${h}" style="display:block;margin:0 auto">
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (v / 100) * h;
        return `<circle cx="${x}" cy="${y}" r="3" fill="${v >= 80 ? '#22c55e' : v >= 60 ? '#e6a817' : '#e06850'}" stroke="#fff" stroke-width="1.5"/>`;
      }).join('')}
    </svg>`;
  }

  // Per-type breakdown with mini bar chart
  const maxSessions = Math.max(...Object.values(byType).map(r => r.length));
  let typeHtml = Object.keys(byType).sort().map(type => {
    const r = byType[type];
    const n = r.length;
    const avg = Math.round(r.reduce((s, x) => s + x.pct, 0) / n);
    const best = Math.max(...r.map(x => x.pct));
    const worst = Math.min(...r.map(x => x.pct));
    const latest = r[r.length - 1].pct;
    const label = TYPE_LABELS[type] || type;
    const barW = Math.round((n / maxSessions) * 100);
    const avgColor = avg >= 80 ? '#22c55e' : avg >= 60 ? '#e6a817' : '#e06850';
    return `<div style="margin-bottom:10px;padding:8px;background:rgba(192,86,33,0.03);border-radius:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:600;font-size:13px;color:#2d3748">${label}</span>
        <span style="font-size:11px;color:${avgColor};font-weight:700">${avg}% avg</span>
      </div>
      <div style="height:6px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden;margin-bottom:4px">
        <div style="width:${barW}%;height:100%;background:${avgColor};border-radius:3px;transition:width 0.3s"></div>
      </div>
      <div style="display:flex;gap:12px;font-size:10px;color:rgba(74,85,104,0.7)">
        <span>${n} session${n>1?'s':''}</span>
        <span>best ${best}%</span>
        <span>worst ${worst}%</span>
        <span>latest ${latest}%</span>
      </div>
    </div>`;
  }).join('');

  // Mastery badges
  const badges = [];
  if (overallPct >= 90) badges.push({ emoji: '🏆', label: '90%+ Overall', color: '#c05621' });
  if (bestStreak >= 10) badges.push({ emoji: '🔥', label: '10+ Streak', color: '#e06850' });
  if (totalSessions >= 50) badges.push({ emoji: '⭐', label: '50+ Sessions', color: '#e6a817' });
  if (totalSessions >= 100) badges.push({ emoji: '🌟', label: '100+ Sessions', color: '#22c55e' });
  Object.keys(byType).forEach(type => {
    const avg = Math.round(byType[type].reduce((s, x) => s + x.pct, 0) / byType[type].length);
    if (avg >= 85 && byType[type].length >= 5) {
      badges.push({ emoji: '🎯', label: `${TYPE_LABELS[type]} Master`, color: '#22c55e' });
    }
  });

  // Calculate current streak (consecutive days with sessions)
  let currentStreak = 0;
  let checkDate = new Date(today);
  while (true) {
    const key = checkDate.getTime();
    if (sessionsByDay[key]) {
      currentStreak++;
      checkDate = new Date(checkDate.getTime() - dayMs);
    } else break;
  }

  const timeStr = totalTime >= 3600 ? `${Math.floor(totalTime/3600)}h ${Math.floor((totalTime%3600)/60)}m`
    : totalTime >= 60 ? `${Math.floor(totalTime/60)}m ${totalTime%60}s` : `${totalTime}s`;

  makeModal(`
    <h2>📊 My Progress</h2>
    <div style="text-align:center;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px">
        <div style="text-align:center">
          <div style="font-size:42px;font-weight:700;color:#c05621;line-height:1">${overallPct}%</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.6)">Overall</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:42px;font-weight:700;color:#22c55e;line-height:1">${totalCorrect}</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.6)">Correct</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:42px;font-weight:700;color:#4a5568;line-height:1">${totalSessions}</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.6)">Sessions</div>
        </div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;font-size:12px;color:#4a5568;margin-bottom:8px">
        <span>🔥 Current streak: ${currentStreak} day${currentStreak !== 1 ? 's' : ''}</span>
        <span>🔥 Best streak: ${bestStreak}</span>
        <span>⏱ Total time: ${timeStr}</span>
      </div>
    </div>
    ${badges.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:12px">
      ${badges.map(b => `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:${b.color}15;border:1px solid ${b.color}30;border-radius:20px;font-size:11px;font-weight:600;color:${b.color}">
        <span style="font-size:14px">${b.emoji}</span>${b.label}
      </span>`).join('')}
    </div>` : ''}
    <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;justify-content:center">
      <div style="flex:1;min-width:200px">
        <div style="font-size:11px;color:rgba(74,85,104,0.6);margin-bottom:4px;text-align:center">Practice Streak (12 weeks)</div>
        <div style="padding:8px;background:rgba(192,86,33,0.03);border-radius:8px;overflow-x:auto">${calSvg}</div>
      </div>
      ${radarData.length >= 3 ? `<div style="flex:0 0 180px">
        <div style="font-size:11px;color:rgba(74,85,104,0.6);margin-bottom:4px;text-align:center">Skill Profile</div>
        <div style="padding:8px;background:rgba(192,86,33,0.03);border-radius:8px">${radarChart(radarData, radarLabels, 160)}</div>
      </div>` : ''}
    </div>
    ${recentPcts.length >= 2 ? `<div style="margin-bottom:12px;padding:8px;background:rgba(192,86,33,0.03);border-radius:8px">
      <div style="font-size:11px;color:rgba(74,85,104,0.6);margin-bottom:4px">Recent ${recent.length} sessions</div>
      ${sparkline(recentPcts, 200, 40, '#c05621')}
    </div>` : ''}
    <div style="max-height:220px;overflow-y:auto;margin-bottom:12px">
      ${typeHtml}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="modal-btn primary" data-action="exportProgress">📤 Export Report</button>
      <button class="modal-btn secondary" data-action="importProgress">📥 Import Report</button>
      <button class="modal-btn secondary" data-action="clearProgress" style="color:#e06850">🗑 Clear All</button>
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function exportProgress() {
  const results = _loadResults();
  if (!results.length) { showToast('Nothing to export'); closeModal(); return; }
  const data = { version: 1, exportedAt: new Date().toISOString(), results };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pauta-progress-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('Report exported');
}

function importProgress() {
  closeModal();
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.results)) { showToast('Invalid report format'); return; }
        const imported = _loadImported();
        const name = prompt('Student name for this report:', 'Student');
        if (!name) { showToast('Import cancelled'); return; }
        imported[name] = (imported[name] || []).concat(data.results);
        localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported));
        showToast(`Imported ${data.results.length} results for ${name}`);
        showTeacherDashboard();
      } catch(e) { showToast('Could not read file: ' + e.message); }
    };
    reader.readAsText(file);
  });
  input.click();
}

function _loadImported() {
  try { return JSON.parse(localStorage.getItem(IMPORTED_KEY)) || {}; }
  catch(e) { return {}; }
}

function clearProgress() {
  if (!confirm('Delete all your exercise results?')) return;
  localStorage.removeItem(RESULTS_KEY);
  closeModal();
  showToast('Results cleared');
}

function showTeacherDashboard() {
  const imported = _loadImported();
  const studentNames = Object.keys(imported);
  if (!studentNames.length) {
    makeModal(`
      <h2>👩‍🏫 Teacher Dashboard</h2>
      <p style="color:#4a5568;font-size:13px;text-align:center;margin:12px 0">
        No imported reports yet.<br>
        Ask students to export their progress from <b>Exercises → My Progress → Export Report</b>,<br>
        then use <b>Import Report</b> here.
      </p>
      <button class="modal-btn primary" data-action="importProgress">📥 Import Report</button>
      <button class="modal-btn secondary" data-action="closeModal">Close</button>
    `);
    return;
  }

  let rows = studentNames.map(name => {
    const r = imported[name];
    const n = r.length;
    const avg = Math.round(r.reduce((s, x) => s + x.pct, 0) / n);
    const best = Math.max(...r.map(x => x.pct));
    const total = r.reduce((s, x) => s + x.correct, 0);
    const all = r.reduce((s, x) => s + x.total, 0);

    // Per-type breakdown
    const byType = {};
    r.forEach(x => { if (!byType[x.type]) byType[x.type] = []; byType[x.type].push(x); });
    const typeSummary = Object.keys(byType).sort().map(t => {
      const arr = byType[t];
      return `${TYPE_LABELS[t] || t}: ${Math.round(arr.reduce((s,x) => s+x.pct,0)/arr.length)}%`;
    }).join(' · ');

    return `<div style="border:1px solid rgba(192,86,33,0.15);border-radius:6px;padding:8px 10px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:600;color:#2d3748;font-size:13px">${escHtml(name)}</span>
        <span style="font-size:13px;color:#c05621;font-weight:700">${avg}%</span>
      </div>
      <div style="font-size:11px;color:rgba(74,85,104,0.6)">
        ${n} sessions · best ${best}% · ${total}/${all} correct
      </div>
      <div style="font-size:10px;color:rgba(74,85,104,0.5);margin-top:2px">${typeSummary}</div>
    </div>`;
  }).join('');

  makeModal(`
    <h2>👩‍🏫 Teacher Dashboard</h2>
    <div style="font-size:12px;color:#4a5568;margin-bottom:8px">
      ${studentNames.length} student(s) · ${imported[studentNames[0]]?.length || 0} total submissions
    </div>
    <div style="max-height:300px;overflow-y:auto;margin-bottom:8px">${rows}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="modal-btn primary" data-action="importProgress">📥 Import Report</button>
      <button class="modal-btn secondary" data-action="clearAllImported" style="color:#e06850">🗑 Clear All</button>
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function clearAllImported() {
  if (!confirm('Delete all imported student reports?')) return;
  localStorage.removeItem(IMPORTED_KEY);
  closeModal();
  showToast('Imported data cleared');
}

// ── Starter Assignments ─────────────────────────────────────────
const STARTER_TEMPLATES = [
  { id: 'scale-major',      label: 'Major Scale (1 octave)',    desc: 'C, G, D, A, E, B, F',     fn: () => _genScaleAssignment('major', 1) },
  { id: 'scale-minor-nat',  label: 'Natural Minor Scale',       desc: 'A, E, B, F#, C#, G#, D#', fn: () => _genScaleAssignment('natural-minor', 1) },
  { id: 'scale-minor-har',  label: 'Harmonic Minor Scale',      desc: 'A, E, B, F#, C#, G#, D#', fn: () => _genScaleAssignment('harmonic-minor', 1) },
  { id: 'scale-minor-mel',  label: 'Melodic Minor Scale',       desc: 'A, E, B, F#, C#, G#, D#', fn: () => _genScaleAssignment('melodic-minor', 1) },
  { id: 'arpeggio-major',   label: 'Major Arpeggio',            desc: 'All 15 keys',             fn: () => _genScaleAssignment('major-arpeggio', 1) },
  { id: 'arpeggio-minor',   label: 'Minor Arpeggio',            desc: 'All 15 keys',             fn: () => _genScaleAssignment('minor-arpeggio', 1) },
  { id: 'rhythm-beginner',  label: 'Rhythm Dictation (Beginner)', desc: '8 measures, 75% notes',  fn: () => _genRhythmAssignment('beginner') },
  { id: 'rhythm-inter',     label: 'Rhythm Dictation (Intermed.)', desc: '8 measures, 50% notes',  fn: () => _genRhythmAssignment('intermediate') },
  { id: 'rhythm-adv',       label: 'Rhythm Dictation (Advanced)', desc: '8 measures, 35% notes',   fn: () => _genRhythmAssignment('advanced') },
  { id: 'melody-dict',      label: 'Melody Dictation Template', desc: '4-8 note melodies',       fn: () => _genMelodyDictAssignment() },
  { id: 'scale-id-ear',     label: 'Scale ID by Ear (12 types)', desc: 'Major, minor, modes, blues', fn: () => _genScaleIdAssignment() },
];

function showStarterAssignmentsDialog() {
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }
  makeModal(`
    <h2>📋 Starter Assignments</h2>
    <p style="color:#4a5568;font-size:13px;margin-bottom:10px">
      Quick-generate common assignment templates as .mscz files.
      Each includes answer key where applicable.
    </p>
    <div style="max-height:300px;overflow-y:auto">
      ${STARTER_TEMPLATES.map(t => `
        <button class="panel-btn-wide" style="margin-bottom:6px;text-align:left" onclick="event.stopPropagation(); downloadStarterAssignment('${t.id}')">
          <div style="font-weight:600;font-size:13px;color:#2d3748">${t.label}</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.7)">${t.desc}</div>
        </button>
      `).join('')}
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

// ── Custom Exercise Builder ─────────────────────────────────────
// Teachers can create custom exercise sets and export them for students.

const CUSTOM_EXERCISES_KEY = 'pauta_custom_exercises';

function _loadCustomExercises() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_EXERCISES_KEY)) || []; }
  catch(e) { return []; }
}

function _saveCustomExercises(exercises) {
  localStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(exercises));
}

function showExerciseBuilderDialog() {
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }

  const existing = _loadCustomExercises();

  const typeOptions = [
    { value: 'note_id', label: 'Note Identification' },
    { value: 'interval_id', label: 'Interval Identification' },
    { value: 'rhythm_read', label: 'Rhythm Reading' },
    { value: 'rhythm_worksheet', label: 'Rhythm Dictation' },
    { value: 'key_sig_id', label: 'Key Signature ID' },
    { value: 'melody_dictation', label: 'Melody Dictation' },
    { value: 'scale_id', label: 'Scale Identification' },
  ];

  const diffOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
  ];

  const existingHtml = existing.length ? `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:6px;font-weight:600">Your Custom Exercise Sets</div>
      <div style="max-height:150px;overflow-y:auto">
        ${existing.map((ex, idx) => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(192,86,33,0.03);border-radius:6px;margin-bottom:4px">
            <div style="flex:1">
              <div style="font-weight:600;font-size:12px;color:#2d3748">${escHtml(ex.name)}</div>
              <div style="font-size:10px;color:rgba(74,85,104,0.6)">${ex.exercises.length} exercises · ${ex.difficulty}</div>
            </div>
            <button class="modal-btn secondary" data-action="exportCustomExercise" data-idx="${idx}" style="padding:3px 8px;font-size:10px">📤</button>
            <button class="modal-btn secondary" data-action="deleteCustomExercise" data-idx="${idx}" style="padding:3px 8px;font-size:10px;color:#e06850">🗑</button>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  makeModal(`
    <h2>🛠 Exercise Builder</h2>
    ${existingHtml}
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Exercise Set Name</div>
      <input id="exb-name" type="text" placeholder="e.g. Week 1: Treble Clef Basics" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <div style="flex:1">
        <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Difficulty</div>
        <select id="exb-diff" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
          ${diffOptions.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1">
        <div style="font-size:11px;color:#4a5568;margin-bottom:4px">Exercises per set</div>
        <select id="exb-count" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
          <option value="5">5</option>
          <option value="10" selected>10</option>
          <option value="15">15</option>
          <option value="20">20</option>
        </select>
      </div>
    </div>
    <div id="exb-types" style="margin-bottom:12px">
      <div style="font-size:11px;color:#4a5568;margin-bottom:6px">Exercise Types (check to include)</div>
      ${typeOptions.map((t, idx) => `
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:#4a5568;cursor:pointer">
          <input type="checkbox" class="exb-type-check" value="${t.value}" ${idx < 2 ? 'checked' : ''} style="accent-color:#c05621">
          ${t.label}
        </label>
      `).join('')}
    </div>
    <div style="display:flex;gap:6px">
      <button class="modal-btn primary" id="exb-save">💾 Save Set</button>
      <button class="modal-btn secondary" id="exb-export">📤 Export JSON</button>
      <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
    </div>
  `);

  setTimeout(() => {
    const saveBtn = document.getElementById('exb-save');
    const exportBtn = document.getElementById('exb-export');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const name = document.getElementById('exb-name')?.value?.trim();
      if (!name) { showToast('Enter a name for the set'); return; }
      const difficulty = document.getElementById('exb-diff')?.value || 'beginner';
      const count = parseInt(document.getElementById('exb-count')?.value || '10');
      const types = Array.from(document.querySelectorAll('.exb-type-check:checked')).map(cb => cb.value);
      if (!types.length) { showToast('Select at least one exercise type'); return; }
      const customEx = { name, difficulty, count, types, exercises: types.map(t => ({ type: t, count: Math.ceil(count / types.length) })) };
      const all = _loadCustomExercises();
      all.push(customEx);
      _saveCustomExercises(all);
      showToast(`"${name}" saved`);
      closeModal();
    });
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const name = document.getElementById('exb-name')?.value?.trim() || 'Custom Exercise Set';
      const difficulty = document.getElementById('exb-diff')?.value || 'beginner';
      const count = parseInt(document.getElementById('exb-count')?.value || '10');
      const types = Array.from(document.querySelectorAll('.exb-type-check:checked')).map(cb => cb.value);
      if (!types.length) { showToast('Select at least one exercise type'); return; }
      const data = { version: 1, name, difficulty, count, types, exercises: types.map(t => ({ type: t, count: Math.ceil(count / types.length) })) };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `pauta-exercise-set-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      showToast('Exercise set exported');
    });
  }, 50);
}

function deleteCustomExercise(idx) {
  const all = _loadCustomExercises();
  if (!confirm(`Delete "${all[idx]?.name}"?`)) return;
  all.splice(idx, 1);
  _saveCustomExercises(all);
  closeModal();
  showExerciseBuilderDialog();
}

function exportCustomExercise(idx) {
  const all = _loadCustomExercises();
  const ex = all[idx];
  if (!ex) return;
  const blob = new Blob([JSON.stringify(ex, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pauta-exercise-${ex.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('Exercise set exported');
}

function importCustomExercise() {
  closeModal();
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.name || !data.exercises) { showToast('Invalid exercise set format'); return; }
        const all = _loadCustomExercises();
        all.push(data);
        _saveCustomExercises(all);
        showToast(`Imported "${data.name}"`);
        showExerciseBuilderDialog();
      } catch(e) { showToast('Could not read file: ' + e.message); }
    };
    reader.readAsText(file);
  });
  input.click();
}

function _genScaleAssignment(type, octaves) {
  const keys = ['C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab','Db','Gb','Cb'];
  const allKeys = keys.map(k => {
    const idx = keys.indexOf(k);
    const ks = idx <= 7 ? idx : 7 - idx;
    return { key: k, ks };
  });
  const exercises = [];
  allKeys.forEach(({key, ks}) => {
    const isMinorType = type === 'natural-minor' || type === 'harmonic-minor' || type === 'melodic-minor' || type === 'minor-arpeggio';
    const scale = generateScale(ks, type, octaves, isMinorType ? 5 : 3);
    if (!scale.length) return;
    const instr = _kitDefaultInstrument() || 'Piano';
    const tonic = scaleTonicName(ks, type);
    const score = createScore({ title: `${tonic} ${SCALE_TYPES.find(s => s.id === type)?.label || type}`, instruments: [instr], ts: {num:4,den:4}, ks });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    const notes = scale.map((n, i) => mkNote(n.pitch, 'q', i === 0 ? 0 : null, n.accidental));
    const measuresNeeded = Math.ceil(notes.length / 4);
    for (let m = 0; m < measuresNeeded; m++) {
      const slice = notes.slice(m*4, m*4+4);
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? ks : null, lineBreak: m > 0 && m % 4 === 0, notes: slice
      });
    }
    exercises.push({ title: `${tonic} ${type}`, score });
  });
  return exercises;
}

function _genRhythmAssignment(difficulty) {
  const exercises = [];
  for (let i = 0; i < 5; i++) {
    const ws = _genRhythmWorksheet({ beginner:0, intermediate:1, advanced:2 }[difficulty]);
    const score = createScore({ title: `Rhythm Dictation ${i+1}`, instruments: ['Percussion'], ts: {num:4,den:4}, ks: 0 });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    for (let m = 0; m < 8; m++) {
      const slice = ws.target.beats.slice(m*4, m*4+4);
      const notes = slice.map((b, bi) => b === 'q' ? mkNote(60, 'q', bi === 0 ? 0 : null) : mkRest('q'));
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? 0 : null, lineBreak: m > 0 && m % 4 === 0, notes
      });
    }
    exercises.push({ title: `Rhythm ${i+1}`, score, answerKey: ws.target.beats.join(' ') });
  }
  return exercises;
}

function _genMelodyDictAssignment() {
  const exercises = [];
  for (let i = 0; i < 5; i++) {
    const md = _genMelodyDict(1);
    const score = createScore({ title: `Melody Dictation ${i+1}`, instruments: ['Piano'], ts: {num:4,den:4}, ks: 0 });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    const totalBeats = md.target.notes.reduce((s, n) => s + durBeats(n.duration, 0, null), 0);
    const measureCount = Math.max(1, Math.ceil(totalBeats / 4));
    for (let m = 0; m < measureCount; m++) {
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? 0 : null, lineBreak: m > 0 && m % 4 === 0, notes: [mkRest('w')]
      });
    }
    exercises.push({ title: `Melody Dictation ${i+1}`, score, answerKey: md.target.notes.map(n => n.pitch).join(',') });
  }
  return exercises;
}

function _genScaleIdAssignment() {
  const exercises = [];
  const scaleTypes = Object.keys(SCALE_PATTERNS);
  for (let i = 0; i < 12; i++) {
    const scaleType = scaleTypes[i % scaleTypes.length];
    const tonic = 60 + Math.floor(Math.random() * 13);  // C4–C5
    const intervals = SCALE_PATTERNS[scaleType];
    const notes = intervals.map(idx => tonic + idx);
    const score = createScore({ title: `Scale ID ${i+1}: ${_scaleNoteName(tonic)} ${SCALE_LABELS[scaleType]}`, instruments: ['Piano'], ts: {num:4,den:4}, ks: 0 });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    const notesPerMeasure = 4;
    for (let m = 0; m < Math.ceil(notes.length / notesPerMeasure); m++) {
      const slice = notes.slice(m * notesPerMeasure, m * notesPerMeasure + notesPerMeasure);
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? 0 : null, lineBreak: m > 0 && m % 4 === 0,
        notes: slice.map(p => mkNote(p, 'q', 0, midiAutoAcc(p))),
      });
    }
    exercises.push({ title: `Scale ID ${i+1}`, score, answerKey: _scaleNoteName(tonic) + ' ' + SCALE_LABELS[scaleType] });
  }
  return exercises;
}

function downloadStarterAssignment(templateId) {
  closeModal();
  const tpl = STARTER_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) return;
  showToast('Generating…');
  setTimeout(() => {
    const exercises = tpl.fn();
    if (!exercises.length) { showToast('No exercises generated'); return; }
    if (exercises.length === 1) {
      const { score, answerKey } = exercises[0];
      adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
      renderScore();
      _exportMSCZ(score, answerKey, exercises[0].title);
    } else {
      // Multiple exercises: zip them as a multi-file .mscz
      _exportMSCZBatch(exercises, tpl.label);
    }
  }, 50);
}

function _exportMSCZ(score, answerKey, filename) {
  const mscx = exportMSCXFromScore(score);
  if (answerKey) {
    score.answerKey = answerKey;
    const mscxWithKey = exportMSCXFromScore(score);
    _downloadBlob(new Blob([mscxWithKey], { type: 'application/vnd.recordare.musicxml' }), filename + '.mscx');
  } else {
    _downloadBlob(new Blob([mscx], { type: 'application/vnd.recordare.musicxml' }), filename + '.mscx');
  }
  showToast('Downloaded: ' + filename + '.mscx');
}

function _exportMSCZBatch(exercises, label) {
  // Create a simple combined score with all exercises sequentially
  const combined = createScore({ title: label, instruments: ['Piano'], ts: {num:4,den:4}, ks: 0 });
  combined.parts[0].staves[0].measures = [];
  exercises.forEach((ex, idx) => {
    ex.score.parts[0].staves[0].measures.forEach((m, mi) => {
      const newM = { ...m };
      if (mi === 0 && idx === 0) newM.timeSigNum = 4;
      combined.parts[0].staves[0].measures.push(newM);
    });
    if (idx < exercises.length - 1) combined.parts[0].staves[0].measures.push({ lineBreak: true, notes: [mkRest('w')] });
  });
  adoptScore(combined, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  const mscx = exportMSCXFromScore(combined);
  _downloadBlob(new Blob([mscx], { type: 'application/vnd.recordare.musicxml' }), label + '.mscx');
  showToast('Downloaded: ' + label + '.mscx');
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Diagnostic Assessment ──────────────────────────────────────
const DIAG_CONFIG = {
  note:     { count: 5, difficulty: 0, label: 'Note ID' },
  interval: { count: 5, difficulty: 1, label: 'Intervals' },
  keysig:   { count: 3, difficulty: 1, label: 'Key Signatures' },
  rhythm:   { count: 1, difficulty: 1, label: 'Rhythm' },
};
const DIAG_PLACEMENTS = [
  { minPct: 0,  label: 'Beginner',      profile: 'beginner',     desc: 'Keep practicing with the basics!' },
  { minPct: 50, label: 'Intermediate',  profile: 'intermediate', desc: 'Good foundation! Ready for more.' },
  { minPct: 80, label: 'Advanced',      profile: 'advanced',     desc: 'Strong skills! Challenge yourself.' },
];

function showDiagnosticDialog() {
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }
  makeModal(`
    <h2>🧪 Diagnostic Assessment</h2>
    <p style="color:#4a5568;font-size:13px;text-align:center;line-height:1.6;margin:8px 0">
      A quick 5-minute placement test covering<Br>
      <b>notes</b> · <b>intervals</b> · <b>key signatures</b> · <b>rhythm</b>
    </p>
    <div style="background:rgba(192,86,33,0.06);border-radius:6px;padding:8px 12px;font-size:11px;color:rgba(74,85,104,0.7);margin-bottom:12px;line-height:1.5">
      You'll get a recommended difficulty profile at the end based on your scores.
    </div>
    <button class="modal-btn primary" id="diag-start-btn">▶ Start Assessment</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
  setTimeout(() => {
    const btn = document.getElementById('diag-start-btn');
    if (btn) btn.addEventListener('click', () => { closeModal(); _startDiagnostic(); });
  }, 50);
}

function _startDiagnostic() {
  const questions = [];
  const cats = ['note', 'interval', 'keysig', 'rhythm'];
  for (const cat of cats) {
    const cfg = DIAG_CONFIG[cat];
    for (let i = 0; i < cfg.count; i++) {
      let ex;
      if (cat === 'note')     ex = _genNoteId(cfg.difficulty);
      else if (cat === 'interval') ex = _genIntervalId(cfg.difficulty);
      else if (cat === 'keysig')   ex = _genKeySigId(cfg.difficulty);
      else if (cat === 'rhythm')   ex = _genRhythmWorksheet(cfg.difficulty);
      questions.push({ type: cat, ex });
    }
  }
  APP.diagnostic = {
    questions, idx: 0, results: [],
    correct: { note: 0, interval: 0, keysig: 0, rhythm: 0 },
    total:   { note: 5, interval: 5, keysig: 3, rhythm: 1 },
    startedAt: Date.now(),
  };
  APP.exerciseMode = true;
  _setExerciseUI(true);
  _showDiagBar();
  _presentDiagQuestion();
}

function _presentDiagQuestion() {
  const d = APP.diagnostic;
  if (!d || d.idx >= d.questions.length) { _finishDiagnostic(); return; }
  const q = d.questions[d.idx];
  // Present using existing functions
  if (q.type === 'note')     _presentNoteId(q.ex);
  else if (q.type === 'interval') _presentIntervalId(q.ex);
  else if (q.type === 'keysig')   _presentKeySigId(q.ex);
  else if (q.type === 'rhythm')   _presentRhythmWorksheet(q.ex);
  _updateDiagBar();
  // For rhythm, wire the check button to auto-advance
  if (q.type === 'rhythm') {
    const checkBtn = document.getElementById('rg-check-btn');
    if (checkBtn) {
      const origClick = checkBtn.onclick;
      checkBtn.onclick = null;
      checkBtn.addEventListener('click', () => {
        const s = APP.exerciseSession;
        if (s && s.current.type === EXERCISE_TYPES.RHYTHM_WS) {
          const beforeTotal = s.totalCount;
          checkRhythmWorksheet();
          // After check, record the result for diagnostic
          if (s.totalCount > beforeTotal) {
            const last = s.completed[s.completed.length - 1];
            d.results.push({ type: 'rhythm', correct: last.ok, pct: s.correctCount / s.totalCount * 100 });
            if (last.ok) d.correct.rhythm++;
            d.idx++;
            setTimeout(() => _presentDiagQuestion(), 1000);
          }
        }
      });
    }
  }
}

function _answerDiag(userAnswer) {
  const d = APP.diagnostic;
  if (!d) return;
  const q = d.questions[d.idx];
  if (!q || q.type === 'rhythm') return;

  let isCorrect = false;
  if (q.type === 'note') {
    const norm = s => String(s).trim().toLowerCase().replace(/\s+/g, '');
    isCorrect = norm(userAnswer) === norm(q.ex.answer);
  } else if (q.type === 'interval') {
    isCorrect = _intervalMatches(userAnswer, q.ex.answer);
  } else if (q.type === 'keysig') {
    const normKey = s => {
      let v = String(s).trim().toLowerCase().replace(/\s+/g, '');
      v = v.replace(/^(.*?)(?:minor|min)$/, '$1m');
      v = v.replace(/^(.*?)major$/, '$1');
      return v;
    };
    isCorrect = normKey(userAnswer) === normKey(q.ex.answer);
  }

  if (isCorrect) d.correct[q.type]++;
  d.results.push({ type: q.type, correct: isCorrect, answer: userAnswer, expected: q.ex.answer });
  d.idx++;

  // Brief feedback
  if (isCorrect) {
    _showSuccessBanner('✓ Correct!');
    setTimeout(() => { _hideSuccessBanner(); _presentDiagQuestion(); }, 800);
  } else {
    showToast('Not quite — answer: ' + q.ex.answer);
    setTimeout(() => _presentDiagQuestion(), 1000);
  }
}

function _finishDiagnostic() {
  _hideDiagBar();
  _hideSuccessBanner();
  // Cleanup
  ['dictation-bar','dictation-check-bar','exercise-input-bar','exercise-feedback-bar','rhythm-beat-grid','diagnostic-bar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  const d = APP.diagnostic;
  if (!d) return;

  const totalQs = d.questions.length;
  const totalCorrect = d.correct.note + d.correct.interval + d.correct.keysig + d.correct.rhythm;
  const pct = totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
  const time = Math.floor((Date.now() - d.startedAt) / 1000);

  // Placement
  let placement = DIAG_PLACEMENTS[0];
  for (const p of DIAG_PLACEMENTS) {
    if (pct >= p.minPct) placement = p;
  }

  const catResults = ['note', 'interval', 'keysig', 'rhythm'].map(cat => {
    const tot = DIAG_CONFIG[cat].count;
    const corr = d.correct[cat] || 0;
    const catPct = tot > 0 ? Math.round((corr / tot) * 100) : 0;
    const barW = Math.max(4, catPct);
    const barColor = catPct >= 80 ? '#22c55e' : catPct >= 50 ? '#e6a817' : '#e06850';
    return `<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#4a5568;margin-bottom:2px">
        <span style="font-weight:600">${DIAG_CONFIG[cat].label}</span>
        <span>${corr}/${tot} (${catPct}%)</span>
      </div>
      <div style="height:6px;background:rgba(0,0,0,0.06);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${barW}%;background:${barColor};border-radius:3px;transition:width 0.6s"></div>
      </div>
    </div>`;
  }).join('');

  APP.exerciseMode = false;
  APP.diagnostic = null;
  _setExerciseUI(false);
  _validateModeState();

  makeModal(`
    <h2>🧪 Assessment Complete</h2>
    <div style="text-align:center;margin-bottom:10px">
      <div style="font-size:38px;font-weight:700;color:#c05621">${pct}%</div>
      <div style="font-size:13px;color:#4a5568">${totalCorrect}/${totalQs} correct · ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}</div>
    </div>
    <div style="background:rgba(192,86,33,0.08);border-radius:8px;padding:8px 12px;text-align:center;margin-bottom:10px">
      <div style="font-size:11px;color:rgba(74,85,104,0.6)">Recommended level</div>
      <div style="font-size:20px;font-weight:700;color:#c05621;margin-top:2px">${placement.label}</div>
      <div style="font-size:11px;color:rgba(74,85,104,0.6);margin-top:2px">${placement.desc}</div>
    </div>
    <div style="margin-bottom:10px">${catResults}</div>
    <button class="modal-btn primary" id="diag-apply-profile">Apply ${placement.label} Profile</button>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);

  setTimeout(() => {
    const applyBtn = document.getElementById('diag-apply-profile');
    if (applyBtn) applyBtn.addEventListener('click', () => {
      closeModal();
      const kitLevel = placement.label.toLowerCase();
      applyKit(APP.teachingKit || 'recorder', kitLevel);
      applyUIProfile(placement.profile);
      showToast('Profile set to: ' + placement.label);
      renderScore();
    });
  }, 50);

  // Save diagnostic result
  const results = _loadResults();
  results.push({
    type: 'diagnostic', difficulty: placement.label,
    date: Date.now(), correct: totalCorrect, total: totalQs, pct,
    streak: 0, maxStreak: 0, time,
  });
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
}

function _showDiagBar() {
  const existing = document.getElementById('diagnostic-bar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'diagnostic-bar';
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:8px;background:rgba(247,243,237,0.98);border:1px solid rgba(192,86,33,0.2);border-radius:8px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.08);font-size:13px;color:#4a5568;';
  bar.innerHTML = `
    <span id="diag-progress" style="font-weight:600;white-space:nowrap;min-width:80px">Question 1/14</span>
    <span id="diag-cat" style="font-size:11px;color:rgba(74,85,104,0.6);min-width:60px">Note ID</span>
    <input id="diag-answer" type="text" placeholder="Type answer…" style="width:160px;padding:4px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
    <button class="modal-btn primary" id="diag-submit" style="padding:4px 12px;font-size:12px">Submit</button>
  `;
  document.body.appendChild(bar);
  setTimeout(() => {
    const inp = document.getElementById('diag-answer');
    const btn = document.getElementById('diag-submit');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') _diagSubmit(); });
    }
    if (btn) btn.addEventListener('click', _diagSubmit);
  }, 50);
}

function _diagSubmit() {
  const inp = document.getElementById('diag-answer');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) { showToast('Type your answer first'); return; }
  inp.value = '';
  _answerDiag(val);
}

function _updateDiagBar() {
  const d = APP.diagnostic;
  if (!d) return;
  const q = d.questions[d.idx];
  const progressEl = document.getElementById('diag-progress');
  const catEl = document.getElementById('diag-cat');
  const inputEl = document.getElementById('diag-answer');
  if (progressEl) progressEl.textContent = `Q ${d.idx + 1}/${d.questions.length}`;
  if (catEl) catEl.textContent = q ? DIAG_CONFIG[q.type]?.label || q.type : '';
  // Hide input bar for rhythm (uses beat grid)
  if (inputEl) {
    inputEl.style.display = q?.type === 'rhythm' ? 'none' : '';
    const submitBtn = document.getElementById('diag-submit');
    if (submitBtn) submitBtn.style.display = q?.type === 'rhythm' ? 'none' : '';
  }
}

function _hideDiagBar() {
  const bar = document.getElementById('diagnostic-bar');
  if (bar) bar.remove();
}

// ── Assign exercise functions to EXERCISE namespace ────────────
[generateExercise, startExerciseSession, endExerciseSession, nextExercise, retryExercise, skipExercise,
 checkExerciseAnswer, showExerciseDialog, selectExerciseDifficulty,
 _presentNoteId, _presentIntervalId, _presentRhythmRead, _presentMelodyDict, _presentKeySigId,
 _presentRhythmWorksheet, _renderRhythmBeatGrid,
 _showDictationListenBar, _startDictationNotate, _checkDictationAnswer, retryDictation,
 _intervalMatches, _setExerciseUI, _updateScoreDisplay,
 _genNoteId, _genIntervalId, _genRhythmRead, _genMelodyDict, _genKeySigId, _genRhythmWorksheet,
 showRhythmWorksheetDialog, _startRhythmWorksheet, checkRhythmWorksheet,
 _saveExerciseResult, _loadResults, showStudentProgress, exportProgress, importProgress,
 clearProgress, showTeacherDashboard, clearAllImported,
  showDiagnosticDialog, _startDiagnostic, _presentDiagQuestion, _answerDiag, _finishDiagnostic,
  _showDiagBar, _diagSubmit, _updateDiagBar, _hideDiagBar,
  showStarterAssignmentsDialog, downloadStarterAssignment, _genScaleAssignment, _genRhythmAssignment,
  _genMelodyDictAssignment, _exportMSCZ, _exportMSCZBatch, _downloadBlob
].forEach(fn => { EXERCISE[fn.name] = fn; });

function showTransposeDialog() {
  makeModal(`
    <h2>Transpose</h2>
    <p class="dialog-hint">Shifts the entire score chromatically</p>
    <div class="panel-section-label" style="margin:0 0 6px">Semitones</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">
      ${[-12,-7,-5,-4,-3,-2,-1,1,2,3,4,5,7,12].map(n =>
        `<button class="modal-btn secondary" style="padding:8px 4px;font-size:13px"
          data-action="transposeScore" data-semitones="${n}">
          ${n>0?'+':''}${n}
        </button>`).join('')}
    </div>
    <div class="panel-section-label" style="margin:0 0 6px">Common intervals</div>
    ${[
      [2,'Up a tone'],[-2,'Down a tone'],
      [7,'Up a 5th'],[-7,'Down a 5th'],
      [12,'Up an octave'],[-12,'Down an octave'],
    ].map(([n,lbl]) => `<button class="modal-btn secondary" style="margin-bottom:4px"
        data-action="transposeScore" data-semitones="${n}">${lbl} (${n>0?'+':''}${n})</button>`).join('')}
    <div class="modal-sep"></div>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

