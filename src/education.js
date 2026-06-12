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
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Title</div>
      <input id="asgn-title" type="text" value="Exercise ${(APP.score?.assignments?.length || 0) + 1}" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Start measure</div>
        <input id="asgn-start" type="number" min="1" max="${measureCount}" value="${start + 1}" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
      </div>
      <div style="flex:1">
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">End measure</div>
        <input id="asgn-end" type="number" min="1" max="${measureCount}" value="${end + 1}" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
      </div>
    </div>
    <div style="margin-bottom:10px">
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Hide from student</div>
      <select id="asgn-hidden" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
        <option value="pitch">Pitches (student enters note names / MIDI)</option>
        <option value="duration">Rhythm (student enters durations)</option>
        <option value="pitch+duration">Pitches + Rhythm</option>
        <option value="lyric">Lyrics</option>
        <option value="chordSymbol">Chord Symbols</option>
      </select>
    </div>
    <div style="margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--pauta-text-muted);cursor:pointer">
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
    <div style="font-size:13px;color:var(--pauta-text-muted);margin-bottom:12px">
      <b>${results.correct}</b> / ${results.total} correct
      ${results.incorrect > 0 ? `<br><span style="color:var(--pauta-error)">${results.incorrect} incorrect</span>` : ''}
      ${results.partial > 0 ? `<br><span style="color:#d4a017">${results.partial} partial (enharmonic)</span>` : ''}
    </div>
    <div style="flex-shrink:0;max-height:200px;overflow-y:auto;font-size:12px;color:var(--pauta-text-muted);margin-bottom:12px">
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

  makeModal(`
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
  const keySig = _tonicToKeySig(tonic, scaleType);

  return {
    type: EXERCISE_TYPES.SCALE_ID,
    difficulty: DIFF_NAMES[difficulty] || 'beginner',
    target: { scaleType, tonic, notes, keySig },
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
  
  // Show session intro first
  _showSessionIntro(type, difficulty);
}

function _showSessionIntro(type, difficulty) {
  const intros = {
    [EXERCISE_TYPES.NOTE_ID]: {
      title: 'Note Identification',
      goal: 'Build instant recognition of notes on the staff',
      description: 'You\'ll see random notes and name them as fast as you can. This builds the foundation for sight-reading.',
      tips: ['Start with the clef to orient yourself', 'Use landmarks: E-G-B (lines) and F-A-C-E (spaces) in treble clef']
    },
    [EXERCISE_TYPES.INTERVAL_ID]: {
      title: 'Interval Training',
      goal: 'Recognize the distance between two notes',
      description: 'Intervals are the building blocks of melody and harmony. You\'ll learn to identify them by sight and sound.',
      tips: ['Count the letter names (C to G = 5th)', 'Listen for the characteristic sound of each interval']
    },
    [EXERCISE_TYPES.RHYTHM_READ]: {
      title: 'Rhythm Reading',
      goal: 'Read and perform rhythmic patterns accurately',
      description: 'Rhythm is the heartbeat of music. You\'ll practice reading various note values and rests.',
      tips: ['Tap your foot to feel the pulse', 'Subdivide: think "1-and-2-and" for eighth notes']
    },
    [EXERCISE_TYPES.RHYTHM_WORKOUT]: {
      title: 'Rhythm Workout',
      goal: 'Master rhythmic accuracy and consistency',
      description: 'A focused practice session with customizable rhythm patterns. Great for building solid timing.',
      tips: ['Start slow, then gradually increase tempo', 'Use a metronome to stay on beat']
    },
    [EXERCISE_TYPES.MELODY_DICT]: {
      title: 'Melody Dictation',
      goal: 'Transcribe melodies by ear',
      description: 'Listen to a melody and write it down. This develops your musical memory and notation skills.',
      tips: ['Listen for the overall shape first', 'Identify the starting note, then work out intervals']
    },
    [EXERCISE_TYPES.KEY_SIG_ID]: {
      title: 'Key Signature Drills',
      goal: 'Instantly recognize major and minor keys',
      description: 'Key signatures tell you which notes are sharp or flat throughout a piece. You\'ll build automatic recognition.',
      tips: ['Sharps: last sharp is the leading tone (go up a half step)', 'Flats: second-to-last flat is the key name']
    },
    [EXERCISE_TYPES.RHYTHM_WS]: {
      title: 'Rhythm Worksheet',
      goal: 'Analyze and notate rhythmic patterns',
      description: 'Work through structured rhythm exercises that build your understanding of note values and time signatures.',
      tips: ['Count out loud as you work', 'Clap or tap the rhythm before writing it']
    },
    [EXERCISE_TYPES.SCALE_ID]: {
      title: 'Scale Gym',
      goal: 'Identify scales and their characteristics',
      description: 'Scales are the DNA of music. You\'ll learn to recognize major, minor, and modal scales by ear.',
      tips: ['Listen for the mood: major sounds bright, minor sounds dark', 'Identify the tonic (home note) first']
    },
    [EXERCISE_TYPES.NOTE_CONSTRUCT]: {
      title: 'Note Construction',
      goal: 'Build notes on the staff from their names',
      description: 'Reverse of note identification: you\'ll place notes on the staff based on their names. Great for notation fluency.',
      tips: ['Remember the staff lines and spaces', 'Use the grand staff for notes outside the treble/bass range']
    }
  };

  const intro = intros[type] || {
    title: TYPE_LABELS[type] || 'Exercise',
    goal: 'Improve your musical skills',
    description: 'A focused practice session.',
    tips: ['Take your time', 'Focus on accuracy over speed']
  };

  const diffLabel = difficulty === 'beginner' ? 'Beginner' : difficulty === 'intermediate' ? 'Intermediate' : 'Advanced';

  makeModal(`
    <div class="pauta-modal">
      <div class="pauta-modal-header">
        <h2 class="pauta-modal-title">${intro.title}</h2>
        <p class="pauta-modal-subtitle">${diffLabel} level</p>
      </div>

      <div class="pauta-modal-body">
        <div style="background:rgba(192,86,33,0.05);border-left:3px solid var(--pauta-primary);padding:12px;margin-bottom:16px;border-radius:0 6px 6px 0">
          <div style="font-weight:600;color:var(--pauta-primary);margin-bottom:4px">🎯 Learning Goal</div>
          <div style="font-size:13px;color:var(--pauta-text)">${intro.goal}</div>
        </div>

        <p style="font-size:13px;color:var(--pauta-text-muted);line-height:1.6;margin-bottom:16px">${intro.description}</p>

        <div style="margin-bottom:16px">
          <div style="font-weight:600;color:var(--pauta-text);margin-bottom:8px;font-size:12px">💡 Tips</div>
          <ul style="margin:0;padding-left:20px;font-size:12px;color:var(--pauta-text-muted);line-height:1.8">
            ${intro.tips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>

        <div style="background:rgba(34,197,94,0.05);border-left:3px solid var(--pauta-success);padding:12px;border-radius:0 6px 6px 0">
          <div style="font-weight:600;color:var(--pauta-success);margin-bottom:4px">📈 Session Structure</div>
          <div style="font-size:12px;color:var(--pauta-text-muted)">
            • Warm-up: First 2-3 questions are easy to get you started<br>
            • Main: Questions adapt to your performance<br>
            • Milestones: Every 5 correct answers triggers a level-up moment
          </div>
        </div>
      </div>

      <div class="pauta-modal-footer">
        <button class="modal-btn primary" data-action="beginExerciseSession" data-type="${type}" data-diff="${difficulty}" style="flex:1">
          ▶ Start Session
        </button>
        <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
      </div>
    </div>
  `);
}

function _beginExerciseSession(type, difficulty) {
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
    warmupCount: 0, // Track warm-up questions
    lastLevelUp: 0, // Track when we last showed a level-up message
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
      <div style="font-weight:600;color:var(--pauta-success);font-size:13px">📈 Ready to advance!</div>
      <div style="font-size:11px;color:rgba(74,85,104,0.7)">${recommendation.reason}</div>
    </div>`;
  } else if (recommendation.action === 'review') {
    nextActionHtml = `<div style="background:rgba(230,168,23,0.1);border:1px solid rgba(230,168,23,0.2);border-radius:6px;padding:8px;margin-bottom:12px;text-align:center">
      <div style="font-weight:600;color:var(--pauta-warning);font-size:13px">🔄 Review recommended</div>
      <div style="font-size:11px;color:rgba(74,85,104,0.7)">${recommendation.reason}</div>
    </div>`;
  }

  makeModal(`
    <h2>Session Complete</h2>
    <div style="font-size:14px;color:var(--pauta-text-muted);margin-bottom:12px;text-align:center">
      <div style="font-size:32px;font-weight:700;color:var(--pauta-primary);margin-bottom:4px">${pct}%</div>
      <div>${correct} / ${total} correct</div>
      <div style="font-size:12px;color:rgba(74,85,104,0.6);margin-top:4px">Best streak: ${s.maxStreak} · Time: ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}</div>
    </div>
    ${nextActionHtml}
    <div style="flex-shrink:0;margin-bottom:12px;max-height:200px;overflow-y:auto;font-size:12px;color:var(--pauta-text-muted)">
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
  ['dictation-bar','dictation-check-bar','exercise-input-bar','exercise-feedback-bar','rhythm-beat-grid','note-id-choices','note-id-exercise'].forEach(id => {
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
        <div style="text-align:center;color:var(--pauta-text-muted)">MIDI ${pitch} · ${noteName}</div>`;
    } else if (c.type === EXERCISE_TYPES.INTERVAL_ID) {
      const bottom = c.target?.bottom;
      const top = c.target?.top;
      const semitones = c.target?.semitones;
      const dir = c.target?.direction;
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const bName = noteNames[bottom % 12] + (Math.floor(bottom / 12) - 1);
      const tName = noteNames[top % 12] + (Math.floor(top / 12) - 1);
      questionHtml = `<div style="font-size:18px;text-align:center;margin:8px 0">${bName} → ${tName}</div>
        <div style="text-align:center;color:var(--pauta-text-muted)">${semitones} semitones ${dir > 0 ? '↑' : '↓'}</div>`;
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
        <div style="text-align:center;color:var(--pauta-text-muted)">Major: ${names[String(ks)]} · Minor: ${minorNames[String(ks)]}</div>`;
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
        <div style="padding:8px 16px;background:${isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(255,96,96,0.1)'};border-radius:8px;border:1px solid ${isCorrect ? 'var(--pauta-success)' : '#ff6060'}">
          <div style="font-size:11px;color:rgba(74,85,104,0.6);font-weight:600">${isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}</div>
          <div style="font-size:16px;font-weight:700;color:${isCorrect ? 'var(--pauta-success)' : '#c05421'}">${escHtml(userAns)}</div>
        </div>
        ${!isCorrect ? `
        <div style="padding:8px 16px;background:rgba(34,197,94,0.1);border-radius:8px;border:1px solid var(--pauta-success)">
          <div style="font-size:11px;color:rgba(74,85,104,0.6);font-weight:600">Correct Answer</div>
          <div style="font-size:16px;font-weight:700;color:var(--pauta-success)">${escHtml(correctAns)}</div>
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
    case EXERCISE_TYPES.RHYTHM_WORKOUT:
      _presentRhythmWorkout(ex);
      break;
    case EXERCISE_TYPES.NOTE_CONSTRUCT:
      _presentNoteConstruct(ex);
      break;
  }
}

function _showMCGrid(options, correctAnswer, handler, promptText) {
  const existing = document.getElementById('exercise-mc-container');
  if (existing) existing.remove();
  const container = document.createElement('div');
  container.id = 'exercise-mc-container';
  container.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;background:rgba(247,243,237,0.98);border:1px solid rgba(192,86,33,0.2);border-radius:12px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);display:flex;flex-direction:column;align-items:center;gap:12px;min-width:360px';
  if (promptText) {
    const prompt = document.createElement('div');
    prompt.style.cssText = 'font-weight:600;font-size:14px;color:var(--pauta-text);margin-bottom:4px';
    prompt.textContent = promptText;
    container.appendChild(prompt);
  }
  const choicesDiv = document.createElement('div');
  choicesDiv.style.cssText = 'display:grid;grid-template-columns:repeat(2, 1fr);gap:8px;width:100%';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'mc-choice-btn';
    btn.dataset.answer = opt;
    btn.textContent = opt;
    btn.style.cssText = 'padding:12px 20px;font-size:15px;font-weight:600;background:#f7f3ed;border:2px solid rgba(192,86,33,0.2);border-radius:8px;cursor:pointer;transition:all 0.15s;color:var(--pauta-text);font-family:inherit';
    btn.addEventListener('click', () => handler(opt, correctAnswer, container));
    btn.addEventListener('mouseover', () => {
      if (!btn.dataset.answered) {
        btn.style.background = 'rgba(192,86,33,0.1)';
        btn.style.borderColor = 'rgba(192,86,33,0.4)';
      }
    });
    btn.addEventListener('mouseout', () => {
      if (!btn.dataset.answered) {
        btn.style.background = '#f7f3ed';
        btn.style.borderColor = 'rgba(192,86,33,0.2)';
      }
    });
    choicesDiv.appendChild(btn);
  });
  container.appendChild(choicesDiv);
  document.body.appendChild(container);
}

function _handleMCAnswer(answer, correctAnswer, container, checkFn) {
  const isCorrect = answer === correctAnswer;
  const buttons = container.querySelectorAll('.mc-choice-btn');
  buttons.forEach(btn => {
    btn.dataset.answered = 'true';
    btn.style.cursor = 'default';
    if (btn.dataset.answer === correctAnswer) {
      btn.style.background = 'var(--pauta-success)';
      btn.style.borderColor = '#16a34a';
      btn.style.color = '#fff';
    } else if (btn.dataset.answer === answer && !isCorrect) {
      btn.style.background = 'var(--pauta-primary-light)';
      btn.style.borderColor = 'var(--pauta-primary)';
      btn.style.color = '#fff';
    } else {
      btn.style.opacity = '0.4';
    }
  });
  checkFn();
  setTimeout(() => {
    if (container.parentNode) container.remove();
  }, 1500);
}

function _presentNoteId(ex) {
  // Clean, focused note recognition UI
  const existing = document.getElementById('note-id-exercise');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'note-id-exercise';
  container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:150;background:#fff;border-radius:12px;padding:32px;box-shadow:0 8px 32px rgba(0,0,0,0.12);display:flex;flex-direction:column;align-items:center;gap:24px;min-width:400px';

  // Create clean staff SVG
  const staffSvg = _createNoteStaff(ex.target.pitch);
  container.appendChild(staffSvg);

  // Create choice buttons
  const choicesDiv = document.createElement('div');
  choicesDiv.style.cssText = 'display:grid;grid-template-columns:repeat(2, 1fr);gap:12px;width:100%';
  
  const options = _generateNoteOptions(ex.target.pitch);
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'note-choice-btn';
    btn.dataset.answer = opt;
    btn.textContent = opt;
    btn.style.cssText = 'padding:16px 24px;font-size:18px;font-weight:600;background:#f7f3ed;border:2px solid rgba(192,86,33,0.2);border-radius:8px;cursor:pointer;transition:all 0.15s;color:var(--pauta-text);font-family:inherit';
    btn.addEventListener('click', () => _handleNoteChoice(opt, ex.target.pitch, container));
    btn.addEventListener('mouseover', () => {
      if (!btn.dataset.answered) {
        btn.style.background = 'rgba(192,86,33,0.1)';
        btn.style.borderColor = 'rgba(192,86,33,0.4)';
      }
    });
    btn.addEventListener('mouseout', () => {
      if (!btn.dataset.answered) {
        btn.style.background = '#f7f3ed';
        btn.style.borderColor = 'rgba(192,86,33,0.2)';
      }
    });
    choicesDiv.appendChild(btn);
  });
  
  container.appendChild(choicesDiv);
  document.body.appendChild(container);
}

function _createNoteStaff(pitch) {
  const STAFF_TOP = 25, STAFF_BOTTOM = 85, LINE_SPACING = 15;
  const svgH = 140;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '300');
  svg.setAttribute('height', String(svgH));
  svg.setAttribute('viewBox', `0 0 300 ${svgH}`);
  
  // Draw 5 staff lines
  for (let i = 0; i < 5; i++) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const y = STAFF_TOP + i * LINE_SPACING;
    line.setAttribute('x1', '20');
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', '280');
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', 'var(--pauta-text-muted)');
    line.setAttribute('stroke-width', '1.5');
    svg.appendChild(line);
  }
  
  const notePos = _pitchToStaffPosition(pitch);
  const bottomLineY = STAFF_BOTTOM;
  
  // Draw ledger lines
  if (notePos.position < 0) {
    // Below staff: ledger lines at even negative positions
    const count = notePos.ledgerLines;
    for (let i = 0; i < count; i++) {
      const linePos = -2 * (i + 1);
      const y = bottomLineY - linePos * 7.5;
      const ledger = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ledger.setAttribute('x1', '140');
      ledger.setAttribute('y1', String(y));
      ledger.setAttribute('x2', '160');
      ledger.setAttribute('y2', String(y));
      ledger.setAttribute('stroke', 'var(--pauta-text-muted)');
      ledger.setAttribute('stroke-width', '1.5');
      svg.appendChild(ledger);
    }
  } else if (notePos.position > 8) {
    // Above staff: ledger lines at even positions > 8
    const count = notePos.ledgerLines;
    for (let i = 0; i < count; i++) {
      const linePos = 8 + 2 * (i + 1);
      const y = bottomLineY - linePos * 7.5;
      const ledger = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ledger.setAttribute('x1', '140');
      ledger.setAttribute('y1', String(y));
      ledger.setAttribute('x2', '160');
      ledger.setAttribute('y2', String(y));
      ledger.setAttribute('stroke', 'var(--pauta-text-muted)');
      ledger.setAttribute('stroke-width', '1.5');
      svg.appendChild(ledger);
    }
  }
  
  // Draw note head
  const note = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  note.setAttribute('cx', '150');
  note.setAttribute('cy', String(notePos.y));
  note.setAttribute('rx', '8');
  note.setAttribute('ry', '6');
  note.setAttribute('fill', 'var(--pauta-text)');
  note.setAttribute('transform', `rotate(-15, 150, ${notePos.y})`);
  svg.appendChild(note);
  
  // Draw stem
  const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  stem.setAttribute('x1', notePos.stemUp ? '158' : '142');
  stem.setAttribute('y1', String(notePos.y));
  stem.setAttribute('x2', notePos.stemUp ? '158' : '142');
  stem.setAttribute('y2', notePos.stemUp ? String(notePos.y - 40) : String(notePos.y + 40));
  stem.setAttribute('stroke', 'var(--pauta-text)');
  stem.setAttribute('stroke-width', '2');
  svg.appendChild(stem);
  
  // Draw accidental if needed
  if (notePos.accidental) {
    const acc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    acc.setAttribute('x', '130');
    acc.setAttribute('y', String(notePos.y + 5));
    acc.setAttribute('font-size', '20');
    acc.setAttribute('font-weight', 'bold');
    acc.setAttribute('fill', 'var(--pauta-text)');
    acc.textContent = notePos.accidental;
    svg.appendChild(acc);
  }
  
  return svg;
}

function _pitchToStaffPosition(pitch) {
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const pc = pitch % 12;
  const oct = Math.floor(pitch / 12) - 1;
  const noteName = noteNames[pc];
  
  const diatonicMap = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
  const baseNote = noteName.replace('#', '').replace('b', '');
  const baseDiatonic = diatonicMap[baseNote];
  
  const octavesFromE4 = oct - 4;
  const position = octavesFromE4 * 7 + baseDiatonic - 2;
  
  const bottomLineY = 85;
  const y = bottomLineY - position * 7.5;
  
  const stemUp = position < 4;
  
  let ledgerLines = 0;
  if (position < 0) {
    ledgerLines = Math.ceil(Math.abs(position) / 2);
  } else if (position > 8) {
    ledgerLines = Math.ceil((position - 8) / 2);
  }
  
  let accidental = null;
  if (noteName.includes('#')) accidental = '♯';
  else if (noteName.includes('b')) accidental = '♭';
  
  return { y, stemUp, ledgerLines, accidental, position };
}

function _generateNoteOptions(correctPitch) {
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const correctPc = correctPitch % 12;
  const correctOct = Math.floor(correctPitch / 12) - 1;
  const correctName = noteNames[correctPc] + correctOct;

  const options = [correctName];
  const usedNames = new Set([correctName]);
  
  // Add nearby notes, adjusting octave when pitch class wraps
  for (let pcOffset of [-1, 1, -2, 2]) {
    const rawPc = correctPc + pcOffset;
    const pc = (rawPc + 12) % 12;
    let octOffset = 0;
    if (rawPc < 0) octOffset = -1;
    else if (rawPc > 11) octOffset = 1;
    const oct = correctOct + octOffset;
    const name = noteNames[pc] + oct;
    if (!usedNames.has(name) && options.length < 4) {
      options.push(name);
      usedNames.add(name);
    }
  }
  
  // Add octave variations if still needed
  if (options.length < 4) {
    for (let octOffset of [-1, 1]) {
      const oct = correctOct + octOffset;
      if (oct >= 3 && oct <= 6) {
        const name = noteNames[correctPc] + oct;
        if (!usedNames.has(name) && options.length < 4) {
          options.push(name);
          usedNames.add(name);
        }
      }
    }
  }

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}

function _handleNoteChoice(answer, correctPitch, container) {
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const correctPc = correctPitch % 12;
  const correctOct = Math.floor(correctPitch / 12) - 1;
  const correctName = noteNames[correctPc] + correctOct;
  
  const isCorrect = answer === correctName;
  
  // Mark all buttons as answered
  const buttons = container.querySelectorAll('.note-choice-btn');
  buttons.forEach(btn => {
    btn.dataset.answered = 'true';
    btn.style.cursor = 'default';
    
    if (btn.dataset.answer === correctName) {
      btn.style.background = 'var(--pauta-success)';
      btn.style.borderColor = '#16a34a';
      btn.style.color = '#fff';
    } else if (btn.dataset.answer === answer && !isCorrect) {
      btn.style.background = 'var(--pauta-primary-light)';
      btn.style.borderColor = 'var(--pauta-primary)';
      btn.style.color = '#fff';
    } else {
      btn.style.opacity = '0.4';
    }
  });
  
  // Check answer and advance
  checkExerciseAnswer(answer);
  
  // Auto-advance after feedback
  setTimeout(() => {
    if (container.parentNode) container.remove();
  }, 1500);
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
      const flashColor = isCorrect ? 'var(--pauta-success)' : isClose ? 'var(--pauta-warning)' : '#ef4444';
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
  const score = createScore({title: 'Interval Training', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  score.parts[0].staves[0].measures[0].notes = [
    mkNote(ex.target.bottom, 'q', 0, midiAutoAcc(ex.target.bottom)),
    mkNote(ex.target.top, 'q', 0, midiAutoAcc(ex.target.top)),
  ];
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  _showMCGrid(_generateIntervalOptions(ex.answer), ex.answer, _handleIntervalChoice, 'Name this interval');
}

function _generateIntervalOptions(correctAnswer) {
  const allLabels = Object.values(INTERVAL_NAMES); // 13 intervals 0-12
  const options = [correctAnswer];
  const used = new Set([correctAnswer]);
  // Pick ~3 plausible wrong answers from nearby semitones
  const correctIdx = Object.values(INTERVAL_NAMES).indexOf(correctAnswer);
  for (let offset of [-1, 1, -2, 2]) {
    const idx = correctIdx + offset;
    if (idx >= 0 && idx < allLabels.length && !used.has(allLabels[idx])) {
      options.push(allLabels[idx]);
      used.add(allLabels[idx]);
    }
    if (options.length >= 4) break;
  }
  // Fallback: add any unused intervals
  if (options.length < 4) {
    for (const label of allLabels) {
      if (!used.has(label)) { options.push(label); used.add(label); if (options.length >= 4) break; }
    }
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

function _handleIntervalChoice(answer, correctAnswer, container) {
  _handleMCAnswer(answer, correctAnswer, container, () => checkExerciseAnswer(answer));
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
  // Phase 1: blank score with key signature — student hears but does NOT see the melody
  const instr = _kitDefaultInstrument();
  const ks = ex.target.keySig || 0;
  const blankScore = createScore({title: 'Melody Dictation', instruments: [instr], ts: {num:4,den:4}, ks: ks});
  
  // Fill with whole-measure rests so the score has structure but no pitches
  const totalBeats = ex.target.notes.reduce((s, n) => s + durBeats(n.duration, 0, null), 0);
  const measureCount = Math.max(1, Math.ceil(totalBeats / 4));
  blankScore.parts[0].staves[0].measures = [];
  for (let i = 0; i < measureCount; i++) {
    blankScore.parts[0].staves[0].measures.push({
      timeSigNum: i === 0 ? 4 : null, timeSigDen: i === 0 ? 4 : null,
      keySig: i === 0 ? ks : null, lineBreak: false, notes: [mkRest('w')]
    });
  }
  adoptScore(blankScore, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();

  // Store target for playback-only (not rendered)
  const s = APP.exerciseSession;
  if (s) {
    s._dictationTarget = ex.target.notes;
    s._dictationPhase = 'listen';
    s._dictationKey = ex.keyName;
    s._dictationFirstName = ex.firstName;
  }
  _showDictationListenBar(ex);
}

function _createFeedbackBar(id, extraCss) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = id;
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;background:rgba(247,243,237,0.98);border:1px solid rgba(192,86,33,0.2);border-radius:8px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.08);font-size:13px;color:var(--pauta-text-muted);' + (extraCss || '');
  document.body.appendChild(bar);
  return bar;
}

function _showDictationListenBar(ex) {
  const bar = _createFeedbackBar('dictation-bar', 'gap:10px;flex-wrap:wrap');
  const currentTempo = APP.tempo || 120;
  
  const keyName = ex?.keyName || 'C major';
  const firstName = ex?.firstName || 'C4';
  
  bar.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px;margin-right:12px">
      <div style="font-size:11px;color:rgba(74,85,104,0.6)">Key</div>
      <div style="font-size:14px;font-weight:700;color:var(--pauta-primary)">${keyName}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-right:12px">
      <div style="font-size:11px;color:rgba(74,85,104,0.6)">First note</div>
      <div style="font-size:14px;font-weight:700;color:var(--pauta-text)">${firstName}</div>
    </div>
    <button class="modal-btn primary" id="dictation-play" style="padding:6px 16px;font-size:13px">▶ Play Melody</button>
    <button class="modal-btn secondary" id="dictation-ready" style="padding:6px 12px;font-size:12px">📝 I'm Ready</button>
    <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
      <label style="font-size:11px;color:var(--pauta-text-muted);font-weight:600">♩</label>
      <input type="range" id="dictation-tempo" min="40" max="200" value="${currentTempo}" style="width:100px" aria-label="Tempo">
      <span id="dictation-tempo-val" style="font-size:12px;font-weight:700;color:var(--pauta-primary);min-width:36px;text-align:right">${currentTempo}</span> BPM
    </div>`;
  document.body.appendChild(bar);
  
  // Use event delegation on the bar to avoid DOM race
  bar.addEventListener('click', e => {
    const id = e.target?.id;
    if (id === 'dictation-play') _playDictationMelodyWithCountdown();
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

function _playDictationMelodyWithCountdown() {
  // Show visual countdown before playing
  const existing = document.getElementById('dictation-countdown');
  if (existing) existing.remove();
  
  const countdown = document.createElement('div');
  countdown.id = 'dictation-countdown';
  countdown.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:2001;font-size:72px;font-weight:700;color:var(--pauta-primary);text-shadow:0 4px 20px rgba(192,86,33,0.3);opacity:0;transition:all 0.3s ease;pointer-events:none';
  document.body.appendChild(countdown);
  
  let count = 3;
  
  function showCount() {
    if (count > 0) {
      countdown.textContent = count;
      countdown.style.opacity = '1';
      countdown.style.transform = 'translate(-50%, -50%) scale(1.2)';
      
      setTimeout(() => {
        countdown.style.transform = 'translate(-50%, -50%) scale(1)';
      }, 100);
      
      setTimeout(() => {
        countdown.style.opacity = '0';
        count--;
        setTimeout(showCount, 300);
      }, 700);
    } else {
      // Show "GO!" briefly
      countdown.textContent = 'GO!';
      countdown.style.color = 'var(--pauta-success)';
      countdown.style.opacity = '1';
      countdown.style.transform = 'translate(-50%, -50%) scale(1.3)';
      
      setTimeout(() => {
        countdown.style.opacity = '0';
        setTimeout(() => {
          if (countdown.parentNode) countdown.remove();
          _playDictationMelody();
        }, 300);
      }, 500);
    }
  }
  
  showCount();
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
  const bar = _createFeedbackBar('dictation-check-bar', 'gap:10px;flex-wrap:wrap');
  const currentTempo = APP.tempo || 120;
  bar.innerHTML = `<span style="font-weight:600;white-space:nowrap">✍️ Done notating?</span>
    <button class="modal-btn primary" id="dictation-check" style="padding:4px 12px;font-size:12px">✔ Check Melody</button>
    <button class="modal-btn secondary" id="dictation-play-again" style="padding:4px 12px;font-size:12px">▶ Play Again</button>
    <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
      <label style="font-size:11px;color:var(--pauta-text-muted);font-weight:600">♩</label>
      <input type="range" id="dictation-tempo" min="40" max="200" value="${currentTempo}" style="width:100px" aria-label="Tempo">
      <span id="dictation-tempo-val" style="font-size:12px;font-weight:700;color:var(--pauta-primary);min-width:36px;text-align:right">${currentTempo}</span> BPM
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
    `<span style="color:var(--pauta-primary-light)">✗ Note ${c.idx+1}: got ${c.placed}, expected ${c.expected}</span>`
  )).join('<br>');

  makeModal(`
    <h2>${pct === 100 ? '✓ Perfect!' : 'Not quite'}</h2>
    <div style="font-size:14px;color:var(--pauta-text-muted);margin-bottom:12px;text-align:center">
      <div style="font-size:28px;font-weight:700;color:var(--pauta-primary)">${pct}%</div>
      <div>${correct} / ${total} notes correct</div>
    </div>
    <div style="flex-shrink:0;margin-bottom:12px;max-height:180px;overflow-y:auto;font-size:12px;color:var(--pauta-text-muted);line-height:1.6">${detailHtml}</div>
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
  _showMCGrid(_generateKeySigOptions(ex), ex.answer, _handleKeySigChoice, ex.askMinor ? 'Name this minor key' : 'Name this major key');
}

function _generateKeySigOptions(ex) {
  const correct = ex.answer;
  const pool = ex.askMinor ? Object.values(KEY_SIG_MINOR_NAMES) : Object.values(KEY_SIG_NAMES);
  const options = [correct];
  const used = new Set([correct]);
  const ksKeys = Object.keys(ex.askMinor ? KEY_SIG_MINOR_NAMES : KEY_SIG_NAMES).map(Number);
  const correctKs = ex.target.keySig;
  // Pick nearby keys in circle of fifths
  for (let offset of [1, -1, 2, -2]) {
    const nearby = correctKs + offset;
    const name = ex.askMinor ? KEY_SIG_MINOR_NAMES[String(nearby)] : KEY_SIG_NAMES[String(nearby)];
    if (name && !used.has(name)) {
      options.push(name);
      used.add(name);
    }
    if (options.length >= 4) break;
  }
  // Fallback: add any unused key names
  if (options.length < 4) {
    for (const name of pool) {
      if (!used.has(name)) { options.push(name); used.add(name); if (options.length >= 4) break; }
    }
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

function _handleKeySigChoice(answer, correctAnswer, container) {
  _handleMCAnswer(answer, correctAnswer, container, () => checkExerciseAnswer(answer));
}

function _presentScaleId(ex) {
  const { tonic, notes, scaleType, keySig } = ex.target;
  const instr = _kitDefaultInstrument();
  const ks = keySig ?? _tonicToKeySig(tonic, scaleType);
  const score = createScore({title: 'Scale Gym', instruments: [instr], ts: {num:4,den:4}, ks});
  const stave = score.parts[0].staves[0];
  stave.measures = [];
  const notesPerMeasure = 4;
  for (let m = 0; m < Math.ceil(notes.length / notesPerMeasure); m++) {
    const slice = notes.slice(m * notesPerMeasure, m * notesPerMeasure + notesPerMeasure);
    stave.measures.push({
      timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
      keySig: m === 0 ? ks : null, lineBreak: m > 0 && m % 4 === 0,
      notes: slice.map(p => mkNote(p, 'q', 0, midiAutoAcc(p, ks))),
    });
  }
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  renderScore();
  _showMCGrid(_generateScaleOptions(ex), ex.answer, _handleScaleChoice, 'Name this scale');
  setTimeout(() => {
    showToast('🎧 Listen to the scale, then name it!');
    startPlayback();
  }, 300);
}

function _generateScaleOptions(ex) {
  const correct = ex.answer;
  const tonic = ex.target.tonic;
  const scaleType = ex.target.scaleType;
  const options = [correct];
  const used = new Set([correct]);
  const tonicName = _scaleNoteName(tonic);
  // Pick wrong scale types with same tonic
  const otherTypes = Object.keys(SCALE_PATTERNS).filter(t => t !== scaleType);
  for (let i = 0; i < otherTypes.length && options.length < 4; i++) {
    const name = tonicName + ' ' + SCALE_LABELS[otherTypes[i]];
    if (!used.has(name)) {
      options.push(name);
      used.add(name);
    }
  }
  // Fallback: vary tonic with same scale type
  if (options.length < 4) {
    for (let octOffset of [-1, 1]) {
      const t = tonic + octOffset * 2;
      const name = _scaleNoteName(t) + ' ' + SCALE_LABELS[scaleType];
      if (!used.has(name) && name !== correct) {
        options.push(name);
        used.add(name);
      }
      if (options.length >= 4) break;
    }
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

function _handleScaleChoice(answer, correctAnswer, container) {
  _handleMCAnswer(answer, correctAnswer, container, () => checkExerciseAnswer(answer));
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
    
    // Track warm-up phase
    if (s.warmupCount < 3) {
      s.warmupCount++;
    }
  } else {
    s.streak = 0;
  }

  // ── Level-up moments (every 5 correct answers) ──────────────────
  const levelUpThresholds = [5, 10, 15, 20, 25, 30];
  if (isCorrect && levelUpThresholds.includes(s.correctCount) && s.correctCount !== s.lastLevelUp) {
    s.lastLevelUp = s.correctCount;
    const pct = Math.round((s.correctCount / s.totalCount) * 100);
    setTimeout(() => {
      _showLevelUpMoment(s.correctCount, pct);
    }, 1500); // Show after success banner fades
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
  el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-12px);z-index:2000;background:linear-gradient(135deg,var(--pauta-success),#16a34a);color:#fff;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:700;box-shadow:0 4px 20px rgba(34,197,94,0.35);opacity:0;transition:opacity 0.25s ease, transform 0.25s ease;pointer-events:none;white-space:nowrap;font-family:var(--pauta-font-sans);text-align:center';
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

function _showLevelUpMoment(correctCount, pct) {
  const existing = document.getElementById('level-up-moment');
  if (existing) existing.remove();

  const s = APP.exerciseSession;
  if (!s) return;

  const messages = [
    { threshold: 5, title: 'Warming Up!', desc: 'You\'re getting the hang of it.', emoji: '🔥' },
    { threshold: 10, title: 'Halfway There!', desc: 'Great consistency. Keep going!', emoji: '⭐' },
    { threshold: 15, title: 'Solid Progress!', desc: 'Your accuracy is improving.', emoji: '💪' },
    { threshold: 20, title: 'Building Mastery!', desc: 'This skill is becoming automatic.', emoji: '🎯' },
    { threshold: 25, title: 'Almost There!', desc: 'You\'re approaching mastery.', emoji: '🏆' },
    { threshold: 30, title: 'Mastery Zone!', desc: 'Excellent work. You\'ve got this!', emoji: '👑' },
  ];

  const msg = messages.find(m => m.threshold === correctCount) || messages[0];

  const el = document.createElement('div');
  el.id = 'level-up-moment';
  el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%) scale(0.9);z-index:2001;background:linear-gradient(135deg,var(--pauta-primary),var(--pauta-primary-light));color:#fff;padding:32px 48px;border-radius:16px;box-shadow:0 12px 40px rgba(192,86,33,0.4);opacity:0;transition:all 0.3s ease;pointer-events:none;text-align:center;min-width:280px';
  el.innerHTML = `
    <div style="font-size:48px;margin-bottom:8px">${msg.emoji}</div>
    <div style="font-size:24px;font-weight:700;margin-bottom:8px">${msg.title}</div>
    <div style="font-size:14px;opacity:0.9;margin-bottom:12px">${msg.desc}</div>
    <div style="font-size:13px;opacity:0.8">${correctCount} correct · ${pct}% accuracy</div>
  `;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
  }, 2500);
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
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%) translateY(20px);z-index:200;display:flex;align-items:flex-start;gap:10px;background:rgba(255,251,235,0.98);border:1px solid rgba(217,160,60,0.3);border-radius:10px;padding:12px 16px;box-shadow:0 3px 16px rgba(0,0,0,0.09);font-size:13px;color:var(--pauta-text-muted);flex-wrap:wrap;max-width:92vw;opacity:0;transition:opacity 0.3s ease, transform 0.3s ease;font-family:var(--pauta-font-sans)';
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
      <button class="modal-btn" data-action="skipExercise" style="padding:4px 10px;font-size:12px;background:transparent;border:1px solid rgba(192,86,33,0.2);color:var(--pauta-text-muted);border-radius:5px">Skip</button>
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

  // Exit button (separate from score pill)
  let exitEl = document.getElementById('exercise-exit-btn');
  if (enabled && !exitEl) {
    exitEl = document.createElement('button');
    exitEl.id = 'exercise-exit-btn';
    exitEl.textContent = '✕ Exit';
    exitEl.style.cssText = 'position:fixed;top:48px;right:140px;z-index:201;padding:8px 16px;font-size:13px;background:rgba(224,104,80,0.1);border:1.5px solid rgba(224,104,80,0.3);color:var(--pauta-primary-light);border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.15s;font-family:var(--pauta-font-sans);';
    exitEl.addEventListener('mouseover', () => {
      exitEl.style.background = 'rgba(224,104,80,0.2)';
      exitEl.style.borderColor = 'rgba(224,104,80,0.5)';
    });
    exitEl.addEventListener('mouseout', () => {
      exitEl.style.background = 'rgba(224,104,80,0.1)';
      exitEl.style.borderColor = 'rgba(224,104,80,0.3)';
    });
    exitEl.addEventListener('click', endExerciseSession);
    document.body.appendChild(exitEl);
  }
  if (!enabled && exitEl) exitEl.remove();
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
    <label style="font-size:12px;color:var(--pauta-text-muted);font-weight:600">♩ Tempo:</label>
    <input type="range" id="rg-tempo" min="40" max="200" value="${currentTempo}" style="width:120px" aria-label="Tempo">
    <span id="rg-tempo-val" style="font-size:13px;font-weight:700;color:var(--pauta-primary);min-width:40px;text-align:right">${currentTempo}</span> BPM
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
    checkBtn.style.background = pct === 100 ? 'var(--pauta-success)' : pct >= 80 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)';
    checkBtn.style.color = '#fff';
    checkBtn.style.borderColor = 'transparent';
    checkBtn.disabled = true;
  }

  const resultHtml = results.map(r =>
    `<span style="color:${r.isCorrect ? 'var(--pauta-success)' : 'var(--pauta-primary-light)'};font-size:12px">
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
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:6px">Difficulty</div>
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

  const results = _loadResults();
  const byType = {};
  results.forEach(r => { if (!byType[r.type]) byType[r.type] = []; byType[r.type].push(r); });

  const currentDiff = APP.exerciseDifficulty || 'beginner';

  // Categories with exercises
  const categories = [
    {
      name: 'Rhythm',
      color: '#e06850',
      exercises: [
        {key: EXERCISE_TYPES.RHYTHM_WORKOUT, icon:'🥁', label:'Rhythm Workout', desc:'Random rhythms — customize time sig, tempo, note values'},
        {key: EXERCISE_TYPES.RHYTHM_READ,  icon:'𝅘𝅥𝅮', label:'Rhythm Reading', desc:'Read and clap patterns'},
        {key: EXERCISE_TYPES.RHYTHM_WS,    icon:'🔊', label:'Rhythm Dictation', desc:'Hear it, mark each beat'},
      ]
    },
    {
      name: 'Pitch & Theory',
      color: 'var(--pauta-primary)',
      exercises: [
        {key: EXERCISE_TYPES.NOTE_ID,      icon:'🎵', label:'Note Drills', desc:'Name notes on the staff'},
        {key: EXERCISE_TYPES.INTERVAL_ID,  icon:'↔',  label:'Interval Training', desc:'Identify intervals'},
        {key: EXERCISE_TYPES.KEY_SIG_ID,   icon:'♭♯', label:'Key Sig Drills', desc:'Name keys from signatures'},
        {key: EXERCISE_TYPES.SCALE_ID,     icon:'🎹', label:'Scale Gym', desc:'Hear scales and modes'},
      ]
    },
    {
      name: 'Ear Training',
      color: 'var(--pauta-success)',
      exercises: [
        {key: EXERCISE_TYPES.MELODY_DICT,  icon:'🎼', label:'Melody Dictation', desc:'Hear it, notate it'},
      ]
    },
  ];

  // Quick stats
  const totalSessions = results.length;
  const overallPct = results.length > 0 ? Math.round(results.reduce((s,r) => s + r.pct, 0) / results.length) : 0;

  makeModal(`
    <div class="pauta-modal">
      <div class="pauta-modal-header">
        <h2 class="pauta-modal-title">Practice Gym</h2>
        <p class="pauta-modal-subtitle">Daily exercises for musicians</p>

        ${totalSessions > 0 ? `
        <div class="pauta-stats">
          <span><span class="pauta-stat-num">${totalSessions}</span> sessions</span>
          <span><span class="pauta-stat-num">${overallPct}%</span> avg</span>
        </div>` : ''}

        <div class="pauta-pills">
          ${['beginner','intermediate','advanced','auto'].map(d =>
            `<button class="pauta-pill ${d===currentDiff?'active':''}" data-action="selectExerciseDifficulty" data-diff="${d}">${d}</button>`
          ).join('')}
        </div>
      </div>

      <div class="pauta-modal-body">
        <div class="pauta-hero" data-action="showRhythmWorkoutDialog">
          <div class="pauta-hero-badge">⚡ Most Popular</div>
          <div class="pauta-hero-title">🥁 Rhythm Workout</div>
          <div class="pauta-hero-desc">Random rhythms with custom time signatures, tempo, and note values</div>
        </div>

        ${categories.map(cat => `
          <div class="pauta-category">
            <div class="pauta-category-title" style="color:${cat.color}">${cat.name}</div>
            <div class="pauta-grid">
              ${cat.exercises.map(ex => {
                const typeResults = byType[ex.key] || [];
                const sessions = typeResults.length;
                let scoreColor = 'rgba(74,85,104,0.3)';
                let scoreText = '';
                if (sessions > 0) {
                  const lastPct = typeResults[typeResults.length - 1].pct;
                  scoreColor = lastPct >= 80 ? 'var(--pauta-success)' : lastPct >= 60 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)';
                  scoreText = lastPct + '%';
                }
                return `
                  <div class="pauta-card" style="--pauta-card-color:${cat.color}" data-action="startExerciseSession" data-type="${ex.key}" data-diff="${currentDiff}">
                    ${scoreText ? `<span class="pauta-card-badge" style="background:${scoreColor}18;color:${scoreColor}">${scoreText}</span>` : ''}
                    <div class="pauta-card-title"><span style="font-size:15px">${ex.icon}</span>${ex.label}</div>
                    <div class="pauta-card-desc">${ex.desc}</div>
                    <div class="pauta-card-meta">${sessions > 0 ? `${sessions} session${sessions>1?'s':''}` : '○ Not started'}</div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="pauta-modal-footer">
        <button class="modal-btn secondary" data-action="showCurriculumDialog">📚 Curriculum</button>
        <button class="modal-btn secondary" data-action="showStudentProgress">📊 Progress</button>
        <button class="modal-btn secondary" data-action="closeModal">✕ Close</button>
      </div>
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
  note_id: 'Note Drills', interval_id: 'Interval Training', rhythm_read: 'Rhythm Reading',
  melody_dictation: 'Ear Training', key_sig_id: 'Key Sig Drills', rhythm_worksheet: 'Rhythm Dictation',
  scale_id: 'Scale Gym', rhythm_workout: 'Rhythm Workout',
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

// ═══════════════════════════════════════════════════════════════════
// Random Rhythm Workout — inspired by rhythmrandomizer.com
// ═══════════════════════════════════════════════════════════════════

const RHYTHM_WORKOUT_DEFAULTS = {
  timeSig: { num: 4, den: 4 },
  measures: 4,
  tempo: 100,
  // Note value groups that can appear (each entry = one "slot" in a beat)
  // dur: VexFlow duration string, group: how many per beat
  noteGroups: [
    { dur: 'q', count: 1, label: '♩' },
    { dur: '8', count: 2, label: '♪♪' },
    { dur: '8', count: 1, label: '♪', rest: true },
    { dur: '16', count: 4, label: '♬♬' },
    { dur: '8', count: 1, label: '♪.', dots: 1 },
    { dur: '16', count: 1, label: '♪', rest: true },
  ],
};

function _rwGetSettings() {
  try { return JSON.parse(localStorage.getItem('pauta_rhythm_workout')) || structuredClone(RHYTHM_WORKOUT_DEFAULTS); }
  catch(e) { return structuredClone(RHYTHM_WORKOUT_DEFAULTS); }
}

function _rwSaveSettings(s) {
  try { localStorage.setItem('pauta_rhythm_workout', JSON.stringify(s)); } catch(e) {}
}

function _rwBeatsPerMeasure(ts) {
  const unit = ts.den === 2 ? 2 : ts.den === 4 ? 1 : ts.den === 8 ? 0.5 : 1;
  return (ts.num * unit) / unit; // just ts.num beats in the beat unit
}

function _rwGenRhythm(settings) {
  const { timeSig: ts, measures, noteGroups } = settings;
  const beatsPerMeasure = ts.num * (4 / ts.den); // normalize to quarter-note beats
  const totalBeats = beatsPerMeasure * measures;
  const allNotes = [];

  let beatsRemaining = totalBeats;
  while (beatsRemaining > 0.001) {
    const grp = noteGroups[Math.floor(Math.random() * noteGroups.length)];
    const beatCost = grp.count * (4 / ts.den) * (grp.dur === 'w' ? 4 : grp.dur === 'h' ? 2 : grp.dur === 'q' ? 1 : grp.dur === '8' ? 0.5 : grp.dur === '16' ? 0.25 : 1);

    if (beatCost > beatsRemaining + 0.001) continue; // doesn't fit

    for (let i = 0; i < grp.count; i++) {
      if (grp.rest) {
        allNotes.push({ type: 'rest', duration: grp.dur, dots: grp.dots || 0 });
      } else {
        allNotes.push({ type: 'note', duration: grp.dur, dots: grp.dots || 0 });
      }
      beatsRemaining -= (4 / ts.den) * (grp.dur === 'w' ? 4 : grp.dur === 'h' ? 2 : grp.dur === 'q' ? 1 : grp.dur === '8' ? 0.5 : grp.dur === '16' ? 0.25 : 1);
    }
  }

  // Split into measures
  const measureBeats = [];
  let idx = 0;
  for (let m = 0; m < measures; m++) {
    const mNotes = [];
    let usedBeats = 0;
    const targetBeats = beatsPerMeasure;
    while (idx < allNotes.length && usedBeats < targetBeats - 0.001) {
      const n = allNotes[idx];
      const dur = n.duration;
      const nb = (dur === 'w' ? 4 : dur === 'h' ? 2 : dur === 'q' ? 1 : dur === '8' ? 0.5 : dur === '16' ? 0.25 : 1);
      if (usedBeats + nb > targetBeats + 0.001) break;
      mNotes.push(n);
      usedBeats += nb;
      idx++;
    }
    measureBeats.push(mNotes);
  }

  return { timeSig: ts, measures: measureBeats };
}

function showRhythmWorkoutDialog() {
  const s = _rwGetSettings();
  const tsOptions = [
    { num: 2, den: 4, label: '2/4' }, { num: 3, den: 4, label: '3/4' },
    { num: 4, den: 4, label: '4/4' }, { num: 2, den: 2, label: '2/2' },
    { num: 6, den: 8, label: '6/8' }, { num: 9, den: 8, label: '9/8' },
    { num: 12, den: 8, label: '12/8' },
  ];
  const measureOptions = [1, 2, 4, 8];
  const allGroups = [
    { dur: 'q', count: 1, label: '♩ Quarter' },
    { dur: 'h', count: 1, label: '𝅗𝅥 Half' },
    { dur: '8', count: 2, label: '♪♪ Two 8ths' },
    { dur: '16', count: 4, label: '♬♬ Four 16ths' },
    { dur: '8', count: 1, label: '♪ Quarter rest', rest: true },
    { dur: '8', count: 1, label: '♪. Dotted 8th + 16th', dots: 1 },
    { dur: '16', count: 1, label: '♪ 8th rest', rest: true },
    { dur: '8', count: 1, label: '♪ 8th note' },
    { dur: '8', count: 1, label: '♩. Dotted quarter', dots: 1 },
  ];

  const activeSet = new Set(s.noteGroups.map(g => g.dur + (g.rest ? 'r' : '') + (g.dots || 0)));

  makeModal(`
    <h2>🥁 Rhythm Workout</h2>
    <div style="display:flex;flex-direction:column;gap:12px;flex-shrink:0;max-height:60vh;overflow-y:auto">
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--pauta-text-muted);margin-bottom:6px">Time Signature</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${tsOptions.map(ts => {
            const active = s.timeSig.num === ts.num && s.timeSig.den === ts.den;
            return `<button class="modal-btn ${active ? 'primary' : 'secondary'}" data-action="rwSetTs" data-num="${ts.num}" data-den="${ts.den}" style="padding:6px 10px;font-size:12px;min-width:48px">${ts.label}</button>`;
          }).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--pauta-text-muted);margin-bottom:6px">Measures: <span id="rw-measures">${s.measures}</span></div>
        <div style="display:flex;gap:4px">
          ${measureOptions.map(m => `<button class="modal-btn ${s.measures === m ? 'primary' : 'secondary'}" data-action="rwSetMeasures" data-val="${m}" style="padding:6px 12px;font-size:12px">${m}</button>`).join('')}
        </div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--pauta-text-muted);margin-bottom:6px">Tempo: <span id="rw-tempo">${s.tempo}</span> BPM</div>
        <input type="range" id="rw-tempo-slider" min="40" max="200" value="${s.tempo}" style="width:100%" data-action="rwSetTempo">
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--pauta-text-muted);margin-bottom:6px">Note Values (tap to toggle)</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${allGroups.map((g, i) => {
            const key = g.dur + (g.rest ? 'r' : '') + (g.dots || 0);
            const active = activeSet.has(key);
            return `<button class="modal-btn ${active ? 'primary' : 'secondary'}" data-action="rwToggleGroup" data-idx="${i}" style="padding:6px 10px;font-size:11px">${g.label}</button>`;
          }).join('')}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="modal-btn primary" data-action="rwStart" style="flex:1">▶ Start Workout</button>
      <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
    </div>
  `);

  // Tempo slider live update
  setTimeout(() => {
    const slider = document.getElementById('rw-tempo-slider');
    if (slider) slider.addEventListener('input', e => {
      document.getElementById('rw-tempo').textContent = e.target.value;
    });
  }, 0);
}

function _rwHandleAction(action, el) {
  const s = _rwGetSettings();

  if (action === 'rwSetTs') {
    s.timeSig = { num: parseInt(el.dataset.num), den: parseInt(el.dataset.den) };
    _rwSaveSettings(s);
    showRhythmWorkoutDialog();
    return true;
  }
  if (action === 'rwSetMeasures') {
    s.measures = parseInt(el.dataset.val);
    _rwSaveSettings(s);
    showRhythmWorkoutDialog();
    return true;
  }
  if (action === 'rwSetTempo') {
    s.tempo = parseInt(el.target?.value || el.dataset.val || 100);
    _rwSaveSettings(s);
    const el2 = document.getElementById('rw-tempo');
    if (el2) el2.textContent = s.tempo;
    return true;
  }
  if (action === 'rwToggleGroup') {
    const idx = parseInt(el.dataset.idx);
    const allGroups = [
      { dur: 'q', count: 1 }, { dur: 'h', count: 1 },
      { dur: '8', count: 2 }, { dur: '16', count: 4 },
      { dur: '8', count: 1, rest: true }, { dur: '8', count: 1, dots: 1 },
      { dur: '16', count: 1, rest: true }, { dur: '8', count: 1 },
      { dur: '8', count: 1, dots: 1, rest: false },
    ];
    const g = allGroups[idx];
    const key = g.dur + (g.rest ? 'r' : '') + (g.dots || 0);
    const existing = s.noteGroups.findIndex(ng => ng.dur === g.dur && !!ng.rest === !!g.rest && (ng.dots||0) === (g.dots||0));
    if (existing >= 0) {
      if (s.noteGroups.length > 1) s.noteGroups.splice(existing, 1);
    } else {
      const labels = ['♩','𝅗𝅥','♪♪','♬♬','♪','♪.','♪','♪','♩.'];
      s.noteGroups.push({ dur: g.dur, count: g.count, label: labels[idx] || '♪', rest: g.rest, dots: g.dots });
    }
    _rwSaveSettings(s);
    showRhythmWorkoutDialog();
    return true;
  }
  if (action === 'rwStart') {
    closeModal();
    startExerciseSession(EXERCISE_TYPES.RHYTHM_WORKOUT, 'beginner');
    return true;
  }
  return false;
}

function _genRhythmWorkout() {
  const s = _rwGetSettings();
  const rhythm = _rwGenRhythm(s);

  // Build flat note list with durations
  const notes = [];
  rhythm.measures.forEach(m => m.forEach(n => notes.push(n)));

  return {
    type: EXERCISE_TYPES.RHYTHM_WORKOUT,
    difficulty: 0,
    target: { timeSig: s.timeSig, notes, tempo: s.tempo },
    answer: notes.map(n => n.rest ? 'r' : 'n').join(','),
    hint: `Listen to the rhythm, then clap it back.`,
  };
}

function _presentRhythmWorkout(ex) {
  const { timeSig: ts, notes, tempo } = ex.target;
  const score = createScore({
    title: 'Rhythm Workout',
    instruments: ['Percussion'],
    ts: { num: ts.num, den: ts.den },
    ks: 0,
  });

  // Build notes array
  const vfNotes = notes.map(n => {
    if (n.rest) return mkRest(n.duration, n.dots);
    return mkNote(60, n.duration, n.dots);
  });

  score.parts[0].staves[0].measures[0].notes = vfNotes;
  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  renderScore();
  showToast(`🥁 ${ts.num}/${ts.den} — ${notes.length} notes — ${tempo} BPM`);
}

function _checkRhythmWorkoutAnswer(userAnswer) {
  const s = APP.exerciseSession;
  if (!s || !s.current) return;

  // For rhythm workout, "checking" just means the user played it back
  // Mark as complete and advance
  s.totalCount++;
  s.correctCount++; // Always count as correct for practice mode
  s.streak++;
  if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  s.completed.push({ type: EXERCISE_TYPES.RHYTHM_WORKOUT, answer: 'played', ok: true, hint: '' });
  _updateScoreDisplay();

  _showSuccessBanner(`✓ Rhythm played! · Streak: ${s.streak}`);
  setTimeout(() => {
    s.current = _genRhythmWorkout();
    _presentRhythmWorkout(s.current);
  }, 1500);
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
        fill = count >= 4 ? 'var(--pauta-success)' : count >= 2 ? '#4ade80' : count >= 1 ? '#86efac' : '#ebedf0';
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
      svg += `<text x="${lx}" y="${ly + 3}" text-anchor="${anchor}" font-size="8" fill="#666" font-family="var(--pauta-font-sans)">${labels[i]}</text>`;
    }

    // Data polygon
    const pts = data.map((v, i) => {
      const angle = (360 / n) * i;
      return polarToCart(angle, maxR * (v / 100));
    });
    svg += `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="rgba(192,86,33,0.15)" stroke="var(--pauta-primary)" stroke-width="1.5"/>`;

    // Data points
    pts.forEach((p, i) => {
      svg += `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${data[i] >= 80 ? 'var(--pauta-success)' : data[i] >= 60 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)'}" stroke="#fff" stroke-width="1"/>`;
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
        return `<circle cx="${x}" cy="${y}" r="3" fill="${v >= 80 ? 'var(--pauta-success)' : v >= 60 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)'}" stroke="#fff" stroke-width="1.5"/>`;
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
    const avgColor = avg >= 80 ? 'var(--pauta-success)' : avg >= 60 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)';
    return `<div style="margin-bottom:10px;padding:8px;background:rgba(192,86,33,0.03);border-radius:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-weight:600;font-size:13px;color:var(--pauta-text)">${label}</span>
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
  if (overallPct >= 90) badges.push({ emoji: '🏆', label: '90%+ Overall', color: 'var(--pauta-primary)' });
  if (bestStreak >= 10) badges.push({ emoji: '🔥', label: '10+ Streak', color: 'var(--pauta-primary-light)' });
  if (totalSessions >= 50) badges.push({ emoji: '⭐', label: '50+ Sessions', color: 'var(--pauta-warning)' });
  if (totalSessions >= 100) badges.push({ emoji: '🌟', label: '100+ Sessions', color: 'var(--pauta-success)' });
  Object.keys(byType).forEach(type => {
    const avg = Math.round(byType[type].reduce((s, x) => s + x.pct, 0) / byType[type].length);
    if (avg >= 85 && byType[type].length >= 5) {
      badges.push({ emoji: '🎯', label: `${TYPE_LABELS[type]} Master`, color: 'var(--pauta-success)' });
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
          <div style="font-size:42px;font-weight:700;color:var(--pauta-primary);line-height:1">${overallPct}%</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.6)">Overall</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:42px;font-weight:700;color:var(--pauta-success);line-height:1">${totalCorrect}</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.6)">Correct</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:42px;font-weight:700;color:var(--pauta-text-muted);line-height:1">${totalSessions}</div>
          <div style="font-size:11px;color:rgba(74,85,104,0.6)">Sessions</div>
        </div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;font-size:12px;color:var(--pauta-text-muted);margin-bottom:8px">
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
      ${sparkline(recentPcts, 200, 40, 'var(--pauta-primary)')}
    </div>` : ''}
    <div style="flex-shrink:0;max-height:220px;overflow-y:auto;margin-bottom:12px">
      ${typeHtml}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="modal-btn primary" data-action="exportProgress">📤 Export Report</button>
      <button class="modal-btn secondary" data-action="importProgress">📥 Import Report</button>
      <button class="modal-btn secondary" data-action="clearProgress" style="color:var(--pauta-primary-light)">🗑 Clear All</button>
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
      <p style="color:var(--pauta-text-muted);font-size:13px;text-align:center;margin:12px 0">
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
        <span style="font-weight:600;color:var(--pauta-text);font-size:13px">${escHtml(name)}</span>
        <span style="font-size:13px;color:var(--pauta-primary);font-weight:700">${avg}%</span>
      </div>
      <div style="font-size:11px;color:rgba(74,85,104,0.6)">
        ${n} sessions · best ${best}% · ${total}/${all} correct
      </div>
      <div style="font-size:10px;color:rgba(74,85,104,0.5);margin-top:2px">${typeSummary}</div>
    </div>`;
  }).join('');

  makeModal(`
    <h2>👩‍🏫 Teacher Dashboard</h2>
    <div style="font-size:12px;color:var(--pauta-text-muted);margin-bottom:8px">
      ${studentNames.length} student(s) · ${imported[studentNames[0]]?.length || 0} total submissions
    </div>
    <div style="flex-shrink:0;max-height:300px;overflow-y:auto;margin-bottom:8px">${rows}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="modal-btn primary" data-action="importProgress">📥 Import Report</button>
      <button class="modal-btn secondary" data-action="clearAllImported" style="color:var(--pauta-primary-light)">🗑 Clear All</button>
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
    <p style="color:var(--pauta-text-muted);font-size:13px;margin-bottom:10px">
      Download ready-made exercise files (.mscx) for your students.
      Each file includes an answer key where applicable —
      students open it in Pauta or any MusicXML app.
    </p>
    <div style="flex-shrink:0;max-height:300px;overflow-y:auto">
      ${STARTER_TEMPLATES.map((t, i) => `
        <button class="panel-btn-wide" style="margin-bottom:6px;text-align:left" data-action="downloadStarterAssignment" data-idx="${i}">
          <div style="font-weight:600;font-size:13px;color:var(--pauta-text)">${t.label}</div>
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
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:6px;font-weight:600">Your Custom Exercise Sets</div>
      <div style="flex-shrink:0;max-height:150px;overflow-y:auto">
        ${existing.map((ex, idx) => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(192,86,33,0.03);border-radius:6px;margin-bottom:4px">
            <div style="flex:1">
              <div style="font-weight:600;font-size:12px;color:var(--pauta-text)">${escHtml(ex.name)}</div>
              <div style="font-size:10px;color:rgba(74,85,104,0.6)">${ex.exercises.length} exercises · ${ex.difficulty}</div>
            </div>
            <button class="modal-btn secondary" data-action="exportCustomExercise" data-idx="${idx}" style="padding:3px 8px;font-size:10px">📤</button>
            <button class="modal-btn secondary" data-action="deleteCustomExercise" data-idx="${idx}" style="padding:3px 8px;font-size:10px;color:var(--pauta-primary-light)">🗑</button>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  makeModal(`
    <h2>🛠 Exercise Builder</h2>
    ${existingHtml}
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Exercise Set Name</div>
      <input id="exb-name" type="text" placeholder="e.g. Week 1: Treble Clef Basics" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Difficulty</div>
        <select id="exb-diff" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
          ${diffOptions.map(d => `<option value="${d.value}">${d.label}</option>`).join('')}
        </select>
      </div>
      <div style="flex:1">
        <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:4px">Exercises per set</div>
        <select id="exb-count" style="width:100%;padding:6px 8px;border:1px solid rgba(192,86,33,0.2);border-radius:5px;font-size:13px;background:transparent;color:#111">
          <option value="5">5</option>
          <option value="10" selected>10</option>
          <option value="15">15</option>
          <option value="20">20</option>
        </select>
      </div>
    </div>
    <div id="exb-types" style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--pauta-text-muted);margin-bottom:6px">Exercise Types (check to include)</div>
      ${typeOptions.map((t, idx) => `
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--pauta-text-muted);cursor:pointer">
          <input type="checkbox" class="exb-type-check" value="${t.value}" ${idx < 2 ? 'checked' : ''} style="accent-color:var(--pauta-primary)">
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
  const allKeys = [];
  for (let ks = -7; ks <= 7; ks++) {
    allKeys.push({ key: keySigName(ks), ks });
  }
  const exercises = [];
  allKeys.forEach(({key, ks}) => {
    const isMinorType = type === 'natural-minor' || type === 'harmonic-minor' || type === 'melodic-minor' || type === 'minor-arpeggio';
    const scale = generateScale(ks, type, octaves, 4);
    if (!scale.length) return;
    const tonic = scaleTonicName(ks, type);
    const score = createScore({ title: `${tonic} ${SCALE_TYPES.find(s => s.id === type)?.label || type}`, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks });
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
      const notes = slice.map((b, bi) => b === 'q' ? mkNote(48, 'q', bi === 0 ? 0 : null) : mkRest('q'));
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? 0 : null, lineBreak: m > 0 && m % 4 === 0, notes
      });
    }
    exercises.push({ title: `Rhythm ${i+1}`, score, answerKey: ws.target.beats.join(' ') });
  }
  return exercises;
}

function _genMelodyDictLow(difficulty) {
  const lengths = [4, 6, 8];
  const len = lengths[Math.min(difficulty, 2)];
  const keyProgression = [
    { ks: 0, name: 'C major' },
    { ks: 0, name: 'C major' },
    { ks: 1, name: 'G major' },
    { ks: -1, name: 'F major' },
    { ks: 2, name: 'D major' },
    { ks: -2, name: 'Bb major' },
    { ks: 3, name: 'A major' },
    { ks: -3, name: 'Eb major' },
  ];
  const maxKeyIdx = Math.min(difficulty * 2 + 1, keyProgression.length - 1);
  const keyIdx = Math.floor(Math.random() * (maxKeyIdx + 1));
  const key = keyProgression[keyIdx];
  const ks = key.ks;
  const baseMin = 60;  // C4
  const baseMax = 72;  // C5
  const basePitch = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
  const notes = [];
  for (let i = 0; i < len; i++) {
    const step = [-2, -1, 0, 1, 2][Math.floor(Math.random() * 5)];
    let pitch = Math.max(baseMin, Math.min(baseMax, (notes.length ? notes[i-1].pitch : basePitch) + step));
    pitch = _snapToKey(pitch, ks);
    const durs = difficulty === 0 ? ['q','h'] : difficulty === 1 ? ['q','h','8'] : ['q','h','8','16'];
    notes.push({ pitch, duration: durs[Math.floor(Math.random() * durs.length)] });
  }
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

function _genMelodyDictAssignment() {
  const exercises = [];
  for (let i = 0; i < 5; i++) {
    const md = _genMelodyDictLow(1);
    const targetKeySig = md.target.keySig;
    const score = createScore({ title: `Melody Dictation ${i+1}`, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks: targetKeySig });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    const totalBeats = md.target.notes.reduce((s, n) => s + durBeats(n.duration, 0, null), 0);
    const measureCount = Math.max(1, Math.ceil(totalBeats / 4));
    for (let m = 0; m < measureCount; m++) {
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? targetKeySig : null, lineBreak: m > 0 && m % 4 === 0, notes: [mkRest('w')]
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
    const ks = _tonicToKeySig(tonic, scaleType);
    const score = createScore({ title: `Scale ID ${i+1}: ${_scaleNoteName(tonic)} ${SCALE_LABELS[scaleType]}`, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    const notesPerMeasure = 4;
    for (let m = 0; m < Math.ceil(notes.length / notesPerMeasure); m++) {
      const slice = notes.slice(m * notesPerMeasure, m * notesPerMeasure + notesPerMeasure);
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? ks : null, lineBreak: m > 0 && m % 4 === 0,
        notes: slice.map(p => mkNote(p, 'q', 0, midiAutoAcc(p, ks))),
      });
    }
    exercises.push({ title: `Scale ID ${i+1}`, score, answerKey: _scaleNoteName(tonic) + ' ' + SCALE_LABELS[scaleType] });
  }
  return exercises;
}

function _applyClefToScore(score, clef) {
  score.parts.forEach(part => {
    part.staves.forEach(stave => {
      // Skip percussion staves — they use their own clef
      if (stave.clef === 'percussion') return;
      stave.clef = clef;
      if (stave.measures.length > 0) {
        stave.measures[0].clef = clef;
      }
    });
  });
  return score;
}

function showClefSelectionDialog(templateId) {
  closeModal();
  const tpl = STARTER_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) { showToast('Template not found'); return; }
  window._pendingStarterTemplate = templateId;
  makeModal(`
    <h2>Choose Clef</h2>
    <p style="color:var(--pauta-text-muted);font-size:13px;margin-bottom:16px">
      Select the clef for this assignment:
    </p>
    <div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">
      <button data-action="selectAssignmentClef" data-clef="treble"
        style="flex:1;padding:16px 12px;border-radius:12px;border:2px solid rgba(192,86,33,0.2);background:rgba(192,86,33,0.04);cursor:pointer;text-align:center;font-family:inherit">
        <div style="font-size:48px;line-height:1;margin-bottom:8px">𝄞</div>
        <div style="font-size:13px;font-weight:600;color:var(--pauta-text)">Treble Clef</div>
        <div style="font-size:11px;color:rgba(74,85,104,0.7)">G clef · Most common</div>
      </button>
      <button data-action="selectAssignmentClef" data-clef="alto"
        style="flex:1;padding:16px 12px;border-radius:12px;border:2px solid rgba(192,86,33,0.2);background:rgba(192,86,33,0.04);cursor:pointer;text-align:center;font-family:inherit">
        <div style="font-size:48px;line-height:1;margin-bottom:8px">𝄡</div>
        <div style="font-size:13px;font-weight:600;color:var(--pauta-text)">Alto Clef</div>
        <div style="font-size:11px;color:rgba(74,85,104,0.7)">C clef · Viola</div>
      </button>
      <button data-action="selectAssignmentClef" data-clef="bass"
        style="flex:1;padding:16px 12px;border-radius:12px;border:2px solid rgba(192,86,33,0.2);background:rgba(192,86,33,0.04);cursor:pointer;text-align:center;font-family:inherit">
        <div style="font-size:48px;line-height:1;margin-bottom:8px">𝄢</div>
        <div style="font-size:13px;font-weight:600;color:var(--pauta-text)">Bass Clef</div>
        <div style="font-size:11px;color:rgba(74,85,104,0.7)">F clef · Low instruments</div>
      </button>
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function generateStarterAssignmentWithClef(templateId, clef) {
  closeModal();
  const tpl = STARTER_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) { showToast('Template not found'); return; }
  try {
    showToast('Generating: ' + tpl.label);
    const exercises = tpl.fn();
    if (!exercises || !exercises.length) { showToast('No exercises generated'); return; }
    // Apply clef to all generated scores
    exercises.forEach(ex => {
      if (ex.score) _applyClefToScore(ex.score, clef);
    });
    // Show preview dialog instead of auto-downloading
    showStarterPreviewDialog(exercises, tpl.label);
  } catch(e) {
    showToast('Error: ' + e.message);
    console.error('generateStarterAssignmentWithClef error:', e);
  }
}

function showStarterPreviewDialog(exercises, label) {
  const count = exercises.length;
  const fileLabel = count === 1 ? exercises[0].title : label;
  makeModal(`
    <h2>📋 ${escHtml(label)}</h2>
    <p style="color:var(--pauta-text-muted);font-size:13px;margin-bottom:12px">
      ${count} exercise${count > 1 ? 's' : ''} generated with the selected clef.
    </p>
    <div style="flex-shrink:0;max-height:200px;overflow-y:auto;margin-bottom:16px;font-size:12px;color:var(--pauta-text-muted)">
      ${exercises.map((ex, i) => `
        <div style="padding:6px 8px;background:rgba(192,86,33,0.03);border-radius:6px;margin-bottom:4px">
          <div style="font-weight:600;color:var(--pauta-text)">${escHtml(ex.title)}</div>
          ${ex.answerKey ? `<div style="font-size:10px;color:rgba(74,85,104,0.6)">Answer key included</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="modal-btn primary" data-action="confirmStarterDownload" style="flex:1">📥 Download .mscx</button>
      <button class="modal-btn secondary" data-action="previewStarterScore">Preview in Pauta</button>
      <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
    </div>
  `);
  // Store exercises for download/preview actions
  window._pendingStarterExercises = exercises;
  window._pendingStarterLabel = label;
}

function confirmStarterDownload() {
  closeModal();
  const exercises = window._pendingStarterExercises;
  const label = window._pendingStarterLabel;
  if (!exercises || !exercises.length) return;
  if (exercises.length === 1) {
    const { score, answerKey } = exercises[0];
    _exportMSCZ(score, answerKey, exercises[0].title);
  } else {
    _exportMSCZBatch(exercises, label);
  }
}

function previewStarterScore() {
  closeModal();
  const exercises = window._pendingStarterExercises;
  if (!exercises || !exercises.length) return;
  if (exercises.length === 1) {
    const { score } = exercises[0];
    adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
    renderScore();
    showToast('Previewing: ' + exercises[0].title);
  } else {
    const combined = createScore({ title: window._pendingStarterLabel, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks: 0 });
    combined.parts[0].staves[0].measures = [];
    exercises.forEach((ex, idx) => {
      ex.score.parts[0].staves[0].measures.forEach((m, mi) => {
        const newM = { ...m };
        if (mi === 0 && idx === 0) newM.timeSigNum = 4;
        combined.parts[0].staves[0].measures.push(newM);
      });
      if (idx < exercises.length - 1) combined.parts[0].staves[0].measures.push({ lineBreak: true, notes: [mkRest('w')] });
    });
    // Apply the clef from the first exercise to the combined score
    const firstClef = exercises[0].score.parts[0].staves[0].clef || 'treble';
    _applyClefToScore(combined, firstClef);
    adoptScore(combined, { clearHistory: true, skipAssignmentPrompt: true });
    renderScore();
    showToast('Previewing: ' + window._pendingStarterLabel);
  }
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
  const combined = createScore({ title: label, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks: 0 });
  combined.parts[0].staves[0].measures = [];
  exercises.forEach((ex, idx) => {
    ex.score.parts[0].staves[0].measures.forEach((m, mi) => {
      const newM = { ...m };
      if (mi === 0 && idx === 0) newM.timeSigNum = 4;
      combined.parts[0].staves[0].measures.push(newM);
    });
    if (idx < exercises.length - 1) combined.parts[0].staves[0].measures.push({ lineBreak: true, notes: [mkRest('w')] });
  });
  const firstClef = exercises[0].score.parts[0].staves[0].clef || 'treble';
  _applyClefToScore(combined, firstClef);
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
    <p style="color:var(--pauta-text-muted);font-size:13px;text-align:center;line-height:1.6;margin:8px 0">
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
  ['dictation-bar','dictation-check-bar','exercise-input-bar','exercise-feedback-bar','rhythm-beat-grid','diagnostic-bar','note-id-choices','note-id-exercise'].forEach(id => {
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
    const barColor = catPct >= 80 ? 'var(--pauta-success)' : catPct >= 50 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)';
    return `<div style="margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--pauta-text-muted);margin-bottom:2px">
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
      <div style="font-size:38px;font-weight:700;color:var(--pauta-primary)">${pct}%</div>
      <div style="font-size:13px;color:var(--pauta-text-muted)">${totalCorrect}/${totalQs} correct · ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}</div>
    </div>
    <div style="background:rgba(192,86,33,0.08);border-radius:8px;padding:8px 12px;text-align:center;margin-bottom:10px">
      <div style="font-size:11px;color:rgba(74,85,104,0.6)">Recommended level</div>
      <div style="font-size:20px;font-weight:700;color:var(--pauta-primary);margin-top:2px">${placement.label}</div>
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
  const bar = _createFeedbackBar('diagnostic-bar', 'gap:8px');
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
   showStarterAssignmentsDialog, showClefSelectionDialog, generateStarterAssignmentWithClef,
   showStarterPreviewDialog, confirmStarterDownload, previewStarterScore,
   _genScaleAssignment, _genRhythmAssignment,
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

// ═══════════════════════════════════════════════════════════════════
// MODULE 6: Composition Tools — inline palette
// ═══════════════════════════════════════════════════════════════════

const MC_NOTES = ['C','D','E','F','G','A','B'];

let _savedPalette = null; // saved innerHTML of #palette-body rows

// ── helpers ──────────────────────────────────────────────────────

function _ensureAccMap(ks) {
  const acc = Array(7).fill('');
  if (ks > 0) {
    const sharpOrder = [3,0,4,1,5,2,6];
    for (let i = 0; i < Math.min(ks, 7); i++) acc[sharpOrder[i]] = '#';
  } else if (ks < 0) {
    const flatOrder = [3,6,2,5,1,4,0];
    for (let i = 0; i < Math.min(-ks, 7); i++) acc[flatOrder[i]] = 'b';
  }
  return acc;
}

function _savePalette() {
  if (_savedPalette) return;
  const body = document.getElementById('palette-body');
  if (!body) return;
  _savedPalette = body.innerHTML;
}

function _restorePalette() {
  if (!_savedPalette) return;
  const body = document.getElementById('palette-body');
  if (body) body.innerHTML = _savedPalette;
  _savedPalette = null;
  delete APP.compositionMode;
  // Re-highlight active duration
  const activeDur = document.querySelector(`.pal-btn[data-dur="${APP.curDur}"]`);
  if (activeDur) activeDur.classList.add('active');
}

// ── Rhythm Composer ──────────────────────────────────────────────

function showRhythmComposer() {
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }
  makeModal(`
    <h2 style="font-size:15px;margin-bottom:6px">🥁 Rhythm Composer</h2>
    <div style="margin-bottom:6px">
      <span style="font-size:11px;color:var(--pauta-text-muted)">Time:</span>
      <select id="rc-ts" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(192,86,33,0.2);font-size:12px;background:transparent;color:var(--pauta-text);margin-left:6px">
        ${['2/4','3/4','4/4','6/8'].map(v => `<option value="${v}" ${v==='4/4'?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
    <div style="margin-bottom:10px">
      <span style="font-size:11px;color:var(--pauta-text-muted)">Measures:</span>
      <input type="number" id="rc-meas" value="4" min="1" max="16" style="width:50px;padding:4px 6px;border-radius:6px;border:1px solid rgba(192,86,33,0.2);font-size:12px;background:transparent;color:var(--pauta-text);margin-left:6px">
    </div>
    <button class="modal-btn primary" data-action="startRhythmComposer">Start Composing</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function startRhythmComposer() {
  const tsEl = document.getElementById('rc-ts');
  const msEl = document.getElementById('rc-meas');
  if (!tsEl) return;
  const [num, den] = tsEl.value.split('/').map(Number);
  const measures = msEl ? Math.max(1, parseInt(msEl.value) || 4) : 4;

  const score = createScore({ title: 'Rhythm Composition', instruments: ['Piano'], ts: {num,den}, ks: 0 });
  score.parts[0].name = 'Rhythm';
  score.parts[0].instrument = 'Rhythm';
  score.parts[0].osc = 'noise';
  score.parts[0].percussion = true;
  const stave = score.parts[0].staves[0];
  score.parts[0].staves = [stave]; // one stave only
  stave.clef = 'percussion';
  stave.singleLine = true;
  // Grow to required measures
  while (stave.measures.length < measures) {
    const ref = stave.measures[0];
    stave.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [mkRest('w')] });
  }

  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  APP.inputMode = true;
  APP.curOctave = 5;
  document.getElementById('btn-input')?.classList.add('active');
  renderScore();

  closeModal();
  _enterRhythmMode();
  showToast('Tap note durations & click staff to add notes. 𝄽 to exit.');
}

function _enterRhythmMode() {
  APP.compositionMode = 'rhythm';
  _savePalette();

  const body = document.getElementById('palette-body');
  if (!body) return;

  body.innerHTML = `
    <!-- Rhythm row: durations -->
    <div class="palette-row" id="rc-dur-row">
      <button class="pal-btn" data-action="selectDur" data-dur="w">
        <span class="pal-sym">
          <svg width="20" height="11" viewBox="0 0 20 11">
            <g transform="rotate(-15 10 5.5)">
              <path fill-rule="evenodd" fill="currentColor"
                d="M10,0.5 a8.5,4.5 0 1,0 0.01,0 Z M10,2.5 a4.5,2 0 1,1 -0.01,0 Z"/>
            </g>
          </svg>
        </span>
        <span class="pal-lbl">Whole</span>
      </button>
      <button class="pal-btn" data-action="selectDur" data-dur="h">
        <span class="pal-sym">
          <svg width="15" height="30" viewBox="0 0 15 30">
            <g transform="rotate(-15 6 24)">
              <path fill-rule="evenodd" fill="currentColor"
                d="M6,19 a5.5,3.5 0 1,0 0.01,0 Z M6,21 a2.8,1.5 0 1,1 -0.01,0 Z"/>
            </g>
            <line x1="11.5" y1="23" x2="11.5" y2="1" stroke="currentColor" stroke-width="1.4"/>
          </svg>
        </span>
        <span class="pal-lbl">Half</span>
      </button>
      <button class="pal-btn active" data-action="selectDur" data-dur="q">
        <span class="pal-sym">
          <svg width="15" height="30" viewBox="0 0 15 30">
            <ellipse cx="6" cy="23" rx="5.5" ry="3.5" fill="currentColor" transform="rotate(-15 6 23)"/>
            <line x1="11.5" y1="23" x2="11.5" y2="1" stroke="currentColor" stroke-width="1.4"/>
          </svg>
        </span>
        <span class="pal-lbl">Quarter</span>
      </button>
      <button class="pal-btn" data-action="selectDur" data-dur="8">
        <span class="pal-sym">
          <svg width="18" height="30" viewBox="0 0 18 30">
            <ellipse cx="6" cy="23" rx="5.5" ry="3.5" fill="currentColor" transform="rotate(-15 6 23)"/>
            <line x1="11.5" y1="23" x2="11.5" y2="1" stroke="currentColor" stroke-width="1.4"/>
            <path d="M11.5 1 C16 3, 17.5 8, 12.5 13" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="pal-lbl">8th</span>
      </button>
      <button class="pal-btn" data-action="toggleDot">
        <span class="pal-sym pal-sym-0">
          <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="3.5"/></svg>
        </span>
        <span class="pal-lbl">Dot</span>
      </button>
      <button class="pal-btn" data-action="insertRest">
        <span class="pal-sym pal-sym-0">
          <svg viewBox="0 0 10 18" width="13" height="23" fill="currentColor">
            <g transform="translate(-482.02112,-143.61753)">
              <g transform="matrix(1.8,0,0,1.8,-471.40868,9.4615275)" stroke="none">
                <path d="M 531.098,74.847 C 530.578,74.945 530.18,75.304 530,75.8 C 529.961,75.96 529.961,75.999 529.961,76.218 C 529.961,76.519 529.98,76.679 530.121,76.917 C 530.32,77.316 530.738,77.636 531.215,77.753 C 531.715,77.894 532.551,77.773 533.508,77.456 L 533.746,77.374 L 532.57,80.624 L 531.414,83.87 C 531.414,83.87 531.453,83.89 531.516,83.933 C 531.633,84.011 531.832,84.07 531.973,84.07 C 532.211,84.07 532.512,83.933 532.551,83.812 C 532.551,83.773 533.109,81.878 533.785,79.628 L 534.98,75.503 L 534.941,75.445 C 534.844,75.324 534.645,75.285 534.523,75.382 C 534.484,75.421 534.422,75.503 534.383,75.562 C 534.203,75.863 533.746,76.398 533.508,76.597 C 533.289,76.777 533.168,76.796 532.969,76.718 C 532.789,76.62 532.73,76.519 532.609,75.98 C 532.492,75.445 532.352,75.202 532.051,75.003 C 531.773,74.824 531.414,74.765 531.098,74.847 z"/>
              </g>
            </g>
          </svg>
        </span>
        <span class="pal-lbl">Rest</span>
      </button>
      <button class="pal-btn" style="background:rgba(192,86,33,0.1)" data-action="exitCompositionMode">
        <span class="pal-sym" style="font-size:12px">✕</span>
        <span class="pal-lbl">Exit</span>
      </button>
    </div>
    <!-- Rhythm note row -->
    <div class="palette-row" style="gap:6px">
      <button class="pal-btn note-key" data-action="insertNoteByName" data-name="C"><span class="pal-sym pal-sym-key" style="font-size:13px">＋ Note</span></button>
      <span style="font-size:10px;color:rgba(74,85,104,0.5)">Add note to staff</span>
    </div>
  `;
  const d = document.querySelector('#rc-dur-row [data-dur="q"]');
  if (d) d.classList.add('active');
}

// ── Melody Composer ──────────────────────────────────────────────

function showMelodyComposer() {
  if (APP.exerciseMode) { showToast('Finish your current exercise first'); return; }
  const KEY_NAMES = ['C♭','G♭','D♭','A♭','E♭','B♭','F','C','G','D','A','E','B','F♯','C♯'];
  const ksOpts = [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7].map(v =>
    `<option value="${v}" ${v===0?'selected':''}>${KEY_NAMES[v+7]||'C'}</option>`
  ).join('');

  makeModal(`
    <h2 style="font-size:15px;margin-bottom:6px">🎵 Melody Composer</h2>
    <div style="margin-bottom:6px">
      <span style="font-size:11px;color:var(--pauta-text-muted)">Key:</span>
      <select id="mc-ks" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(192,86,33,0.2);font-size:12px;background:transparent;color:var(--pauta-text);margin-left:6px">${ksOpts}</select>
    </div>
    <div style="margin-bottom:6px">
      <span style="font-size:11px;color:var(--pauta-text-muted)">Time:</span>
      <select id="mc-ts" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(192,86,33,0.2);font-size:12px;background:transparent;color:var(--pauta-text);margin-left:6px">
        ${['2/4','3/4','4/4','6/8'].map(v => `<option value="${v}" ${v==='4/4'?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
    <div style="margin-bottom:10px">
      <span style="font-size:11px;color:var(--pauta-text-muted)">Measures:</span>
      <input type="number" id="mc-meas" value="4" min="1" max="16" style="width:50px;padding:4px 6px;border-radius:6px;border:1px solid rgba(192,86,33,0.2);font-size:12px;background:transparent;color:var(--pauta-text);margin-left:6px">
    </div>
    <button class="modal-btn primary" data-action="startMelodyComposer">Start Composing</button>
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}

function startMelodyComposer() {
  const ksEl = document.getElementById('mc-ks');
  const tsEl = document.getElementById('mc-ts');
  const msEl = document.getElementById('mc-meas');
  if (!tsEl) return;
  const ks = ksEl ? parseInt(ksEl.value) : 0;
  const [num, den] = tsEl.value.split('/').map(Number);
  const measures = msEl ? Math.max(1, parseInt(msEl.value) || 4) : 4;

  const score = createScore({ title: 'Melody Composition', instruments: ['Piano'], ts: {num,den}, ks });
  const stave = score.parts[0].staves[0];
  while (stave.measures.length < measures) {
    stave.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [mkRest('w')] });
  }

  adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  APP.inputMode = true;
  APP.curOctave = 4;
  document.getElementById('btn-input')?.classList.add('active');
  renderScore();

  closeModal();
  _enterMelodyMode(ks);
  showToast('🎵 Tap a scale degree, then click staff to place notes. ✕ to exit.');
}

function _enterMelodyMode(ks) {
  APP.compositionMode = 'melody';
  _savePalette();

  const body = document.getElementById('palette-body');
  if (!body) return;

  const accMap = _ensureAccMap(ks);
  const noteNames = MC_NOTES.map((n, i) => {
    let name = n;
    if (accMap[i] === '#') name += '#';
    else if (accMap[i] === 'b') name += 'b';
    return name;
  });

  // Scale-degree note buttons — display accidental but send plain letter name
  const noteBtns = noteNames.map((nm, i) =>
    `<button class="pal-btn note-key" data-action="insertNoteByName" data-name="${MC_NOTES[i]}"><span class="pal-sym pal-sym-key">${nm}</span></button>`
  ).join('');

  body.innerHTML = `
    <!-- Melody duration row -->
    <div class="palette-row">
      <button class="pal-btn" data-action="selectDur" data-dur="q"><span class="pal-sym" style="font-size:16px;font-family:var(--pauta-font-sans)">♩</span><span class="pal-lbl">Quarter</span></button>
      <button class="pal-btn" data-action="selectDur" data-dur="h"><span class="pal-sym" style="font-size:16px;font-family:var(--pauta-font-sans)">𝅘𝅥</span><span class="pal-lbl">Half</span></button>
      <button class="pal-btn" data-action="selectDur" data-dur="w"><span class="pal-sym" style="font-size:16px;font-family:var(--pauta-font-sans)">𝅝</span><span class="pal-lbl">Whole</span></button>
      <button class="pal-btn" data-action="selectDur" data-dur="8"><span class="pal-sym" style="font-size:16px;font-family:var(--pauta-font-sans)">♪</span><span class="pal-lbl">8th</span></button>
      <button class="pal-btn" data-action="selectDur" data-dur="16"><span class="pal-sym" style="font-size:16px;font-family:var(--pauta-font-sans)">♬</span><span class="pal-lbl">16th</span></button>
      <button class="pal-btn" data-action="toggleDot"><span class="pal-sym" style="font-size:12px">·</span><span class="pal-lbl">Dot</span></button>
      <button class="pal-btn" data-action="changeOctave" data-delta="-1"><span class="pal-sym" style="font-size:10px">−8</span><span class="pal-lbl">Oct ↓</span></button>
      <button class="pal-btn" data-action="changeOctave" data-delta="1"><span class="pal-sym" style="font-size:10px">+8</span><span class="pal-lbl">Oct ↑</span></button>
      <button class="pal-btn" data-action="insertRest"><span class="pal-sym" style="font-size:14px;font-family:var(--pauta-font-sans)">𝄽</span><span class="pal-lbl">Rest</span></button>
      <button class="pal-btn" style="background:rgba(192,86,33,0.1)" data-action="exitCompositionMode"><span class="pal-sym" style="font-size:12px">✕</span><span class="pal-lbl">Exit</span></button>
    </div>
    <!-- Scale-degree note names -->
    <div class="palette-row">${noteBtns}</div>
    <div style="display:flex;align-items:center;padding:2px 6px 4px;gap:8px">
      <span id="oct-display" class="oct-display">Octave ${APP.curOctave}</span>
      <span style="font-size:9px;color:rgba(74,85,104,0.4)">— select pitch &amp; click staff</span>
    </div>
  `;
  const d = document.querySelector('.palette-row [data-dur="q"]');
  if (d) d.classList.add('active');
}

// ── Exit Composition Mode ────────────────────────────────────────

function exitCompositionMode() {
  _restorePalette();
  APP.inputMode = false;
  document.getElementById('btn-input')?.classList.remove('active');
  showToast('Composition mode exited');
}

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

    makeModal(`
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

// ═══════════════════════════════════════════════════════════════════
// RECORDER EXERCISES — moved from notation.js (belongs with education)
// ═══════════════════════════════════════════════════════════════════

const RECORDER_EXERCISES = {
  'hot-cross-buns': {
    title: 'Hot Cross Buns', ts: {num:4,den:4}, tempoName: 'Moderato', tempoBpm: 80,
    notes: [
      {pitch:71,dur:'q'},{pitch:69,dur:'q'},{pitch:67,dur:'h'},
      {pitch:71,dur:'q'},{pitch:69,dur:'q'},{pitch:67,dur:'h'},
      {pitch:67,dur:'8'},{pitch:67,dur:'8'},{pitch:67,dur:'8'},{pitch:67,dur:'8'},
      {pitch:69,dur:'8'},{pitch:69,dur:'8'},{pitch:69,dur:'8'},{pitch:69,dur:'8'},
      {pitch:71,dur:'q'},{pitch:69,dur:'q'},{pitch:67,dur:'h'},
    ]
  },
  'mary-lamb': {
    title: 'Mary Had a Little Lamb', ts: {num:4,den:4}, tempoName: 'Moderato', tempoBpm: 80,
    notes: [
      {pitch:69,dur:'q'},{pitch:71,dur:'q'},{pitch:72,dur:'q'},{pitch:71,dur:'q'},
      {pitch:69,dur:'q'},{pitch:69,dur:'q'},{pitch:69,dur:'h'},
      {pitch:71,dur:'q'},{pitch:71,dur:'q'},{pitch:71,dur:'h'},
      {pitch:69,dur:'q'},{pitch:67,dur:'q'},{pitch:67,dur:'h'},
      {pitch:69,dur:'q'},{pitch:71,dur:'q'},{pitch:72,dur:'q'},{pitch:71,dur:'q'},
      {pitch:69,dur:'q'},{pitch:69,dur:'q'},{pitch:69,dur:'q'},{pitch:69,dur:'q'},
      {pitch:71,dur:'q'},{pitch:71,dur:'q'},{pitch:69,dur:'q'},{pitch:71,dur:'q'},{pitch:72,dur:'h'},
    ]
  },
  'twinkle': {
    title: 'Twinkle Twinkle Little Star', ts: {num:4,den:4}, tempoName: 'Andante', tempoBpm: 72,
    notes: [
      {pitch:60,dur:'q'},{pitch:60,dur:'q'},{pitch:67,dur:'q'},{pitch:67,dur:'q'},
      {pitch:69,dur:'q'},{pitch:69,dur:'q'},{pitch:67,dur:'h'},
      {pitch:65,dur:'q'},{pitch:65,dur:'q'},{pitch:64,dur:'q'},{pitch:64,dur:'q'},
      {pitch:62,dur:'q'},{pitch:62,dur:'q'},{pitch:60,dur:'h'},
    ]
  },
  'ode-to-joy': {
    title: 'Ode to Joy (Beethoven)', ts: {num:4,den:4}, tempoName: 'Moderato', tempoBpm: 90,
    notes: [
      {pitch:64,dur:'q'},{pitch:64,dur:'q'},{pitch:65,dur:'q'},{pitch:67,dur:'q'},
      {pitch:67,dur:'q'},{pitch:65,dur:'q'},{pitch:64,dur:'q'},{pitch:62,dur:'q'},
      {pitch:60,dur:'q'},{pitch:60,dur:'q'},{pitch:62,dur:'q'},{pitch:64,dur:'q'},
      {pitch:64,dur:'q'},{pitch:62,dur:'q'},{pitch:62,dur:'h'},
    ]
  },
  'jingle-bells': {
    title: 'Jingle Bells', ts: {num:4,den:4}, tempoName: 'Allegro', tempoBpm: 110,
    notes: [
      {pitch:64,dur:'q'},{pitch:64,dur:'q'},{pitch:64,dur:'h'},
      {pitch:64,dur:'q'},{pitch:64,dur:'q'},{pitch:64,dur:'h'},
      {pitch:64,dur:'q'},{pitch:67,dur:'q'},{pitch:60,dur:'q'},{pitch:62,dur:'q'},{pitch:64,dur:'h'},
    ]
  },
};

function loadRecorderExercise(key) {
  const ex = RECORDER_EXERCISES[key];
  if (!ex) { showToast('Exercise not found'); return; }
  const score = createScore({title: ex.title, instruments: ['Soprano Recorder'], ts: ex.ts, ks: 0});
  const stave = score.parts[0].staves[0];
  stave.measures = [];

  const beatsPerMeasure = ex.ts.num * (4 / ex.ts.den);
  let measureNotes = [], beats = 0;

  for (const n of ex.notes) {
    measureNotes.push(mkNote(n.pitch, n.dur));
    beats += durBeats(n.dur, 0, null);
    if (beats >= beatsPerMeasure - 0.001) {
      stave.measures.push({
        timeSigNum: stave.measures.length === 0 ? ex.ts.num : null,
        timeSigDen: stave.measures.length === 0 ? ex.ts.den : null,
        keySig: stave.measures.length === 0 ? 0 : null,
        lineBreak: false, notes: measureNotes
      });
      measureNotes = []; beats = 0;
    }
  }
  if (measureNotes.length) {
    stave.measures.push({
      timeSigNum: null, timeSigDen: null, keySig: null,
      lineBreak: false, notes: measureNotes
    });
  }

  adoptScore(score, { clearHistory: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  renderScore();
  showToast('Loaded: ' + ex.title);
}

function showRecorderExercises() {
  const exercises = Object.entries(RECORDER_EXERCISES).map(([key, ex]) => `
    <button class="panel-btn-wide" style="margin-bottom:4px;text-align:left"
      data-action="loadRecorderExercise" data-key="${key}">
      <span style="font-weight:700">${ex.title}</span>
      <span style="float:right;opacity:0.6;font-size:11px">${ex.tempoName} · ♩=${ex.tempoBpm}</span>
    </button>
  `).join('');

  makeModal(`
    <h2>Recorder Exercises</h2>
    <p class="dialog-hint">Built-in songs with automatic fingerings. Great for classroom practice.</p>
    ${exercises}
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}


