function createScore(opts={}) {
  const ts         = opts.ts          || {num:4,den:4};
  const ks         = opts.ks          || 0;
  const instrNames = opts.instruments || ['Piano'];

  const parts = instrNames.map(instrName => {
    const instr = instrByName(instrName);
    return {
      name: instr.name, instrument: instr.name, osc: instr.osc,
      staves: instr.staves.map(clef => ({
        clef,
        measures: [{timeSigNum:ts.num, timeSigDen:ts.den, keySig:ks, lineBreak:false, notes:[mkRest('w')]}]
      }))
    };
  });
  return {title: opts.title||'Untitled Score', composer: opts.composer||'',
          scoreVersion: SCORE_FORMAT_VERSION,
          slurs:[], hairpins:[], rehearsalMarks:[], staffTexts:[],
          assignments: [], studentAnswers: {}, parts};
}

// Add a new instrument part to the current score
// ── Recorder Exercises ───────────────────────────────────────────
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

function addInstrumentToScore(score, instrName) {
  const instr  = instrByName(instrName);
  if (!instr) return;
  const nM     = score.parts[0].staves[0].measures.length;
  const refS   = score.parts[0].staves[0];
  score.parts.push({
    name: instr.name, instrument: instr.name, osc: instr.osc,
    staves: instr.staves.map(clef => ({
      clef,
      measures: Array.from({length: nM}, (_, mi) => {
        const ref = refS.measures[mi] || {};
        return {
          timeSigNum: mi===0 ? (ref.timeSigNum||4) : null,
          timeSigDen: mi===0 ? (ref.timeSigDen||4) : null,
          keySig:     mi===0 ? (ref.keySig    ||0) : null,
          lineBreak:  false,
          notes: [mkRest('w')]
        };
      })
    }))
  });
}
/** @param {number} pitch @param {string} dur @param {number} [dots] @param {string|null} [acc] @param {number} [voice] @returns {Note} */
function mkNote(pitch, dur, dots=0, acc=null, voice=1) {
  return {type:'note', pitch, duration:dur, dots, accidental:acc, voice, extraPitches:[]};
}
/** @param {string} dur @param {number} [dots] @param {number} [voice] @returns {Note} */
function mkRest(dur, dots=0, voice=1) {
  return {type:'rest', duration:dur, dots, voice};
}
/** @returns {Measure} */
function emptyMeasure() {
  return {timeSigNum:null, timeSigDen:null, keySig:null, lineBreak:false, notes:[mkRest('w')]};
}

/** @param {Score} score @returns {Score} */
function _ensureScoreAnnotationArrays(score) {
  for (const rule of SCORE_MEASURE_REF_RULES) {
    if (!Array.isArray(score[rule.key])) score[rule.key] = [];
  }
  if (!Array.isArray(score.assignments)) score.assignments = [];
  if (!score.studentAnswers || typeof score.studentAnswers !== 'object') score.studentAnswers = {};
  return score;
}

/** @param {*} n @param {number} [voiceDefault] @returns {Note} */
function _repairNote(n, voiceDefault = 1) {
  if (!n || typeof n !== 'object') return mkRest('q', 0, voiceDefault);
  const voice = n.voice === 2 ? 2 : 1;
  if (n.type !== 'note' && n.type !== 'rest') n.type = (n.pitch != null) ? 'note' : 'rest';
  if (!VALID_DURATIONS.has(n.duration)) n.duration = 'q';
  if (typeof n.dots !== 'number' || n.dots < 0) n.dots = n.dots ? 1 : 0;
  n.voice = voice;
  if (n.type === 'note') {
    if (typeof n.pitch !== 'number') n.pitch = 60;
    n.pitch = Math.max(12, Math.min(120, n.pitch));
    if (!Array.isArray(n.extraPitches)) n.extraPitches = [];
    n.extraPitches = n.extraPitches.filter(ep => ep && typeof ep.pitch === 'number').map(ep => ({
      pitch: Math.max(12, Math.min(120, ep.pitch)),
      accidental: ep.accidental ?? null,
    }));
  } else {
    delete n.pitch;
    delete n.accidental;
    delete n.extraPitches;
  }
  return n;
}

/** @param {*} m @returns {Measure} */
function _repairMeasure(m) {
  if (!m || typeof m !== 'object') return emptyMeasure();
  if (!Array.isArray(m.notes) || !m.notes.length) m.notes = [mkRest('w')];
  else m.notes = m.notes.map(n => _repairNote(n, n?.voice || 1));
  if (m.lineBreak !== true) m.lineBreak = false;
  return m;
}

/** @param {Score} score @returns {number} */
function _syncMeasureCounts(score) {
  let maxM = 1;
  score.parts.forEach(part => {
    (part.staves || []).forEach(stave => {
      maxM = Math.max(maxM, stave.measures?.length || 0);
    });
  });
  score.parts.forEach(part => {
    if (!Array.isArray(part.staves) || !part.staves.length) {
      const fallback = instrByName(part.instrument || part.name || 'Piano');
      part.staves = fallback.staves.map(clef => ({ clef, measures: [emptyMeasure()] }));
    }
    if (!part.name) part.name = part.instrument || 'Part';
    if (!part.instrument) part.instrument = part.name;
    if (!part.osc) { const fi = instrByName(part.instrument); part.osc = fi ? fi.osc : 'triangle'; }
    part.staves.forEach(stave => {
      if (!stave.clef) stave.clef = 'treble';
      if (!Array.isArray(stave.measures)) stave.measures = [];
      while (stave.measures.length < maxM) stave.measures.push(emptyMeasure());
      stave.measures = stave.measures.map(_repairMeasure);
    });
  });
  return maxM;
}

/** Normalize imported, autosaved, or legacy score data to the current contract. @param {*} raw @returns {Score} */
function repairScore(raw) {
  if (!raw || typeof raw !== 'object') return createScore();
  const score = raw;
  score.scoreVersion = SCORE_FORMAT_VERSION;
  if (!score.title) score.title = 'Untitled Score';
  if (score.composer == null) score.composer = '';
  if (!Array.isArray(score.parts) || !score.parts.length) score.parts = createScore().parts;
  _ensureScoreAnnotationArrays(score);
  _syncMeasureCounts(score);
  return score;
}

/** Lightweight validation — repairScore fixes most issues; this catches hard failures. @param {Score} score @returns {{ok:boolean, fatal:string|null, issues:Array}} */
function validateScore(score) {
  const issues = [];
  if (!score || typeof score !== 'object') {
    return { ok: false, fatal: 'Score data is missing', issues };
  }
  if (!Array.isArray(score.parts) || !score.parts.length) {
    issues.push({ level: 'fatal', msg: 'Score has no parts' });
  } else {
    score.parts.forEach((part, pi) => {
      if (!part.staves?.length) {
        issues.push({ level: 'fatal', msg: `Part ${pi + 1} has no staves` });
      }
      part.staves?.forEach((stave, si) => {
        if (!stave.measures?.length) {
          issues.push({ level: 'fatal', msg: `Part ${pi + 1} stave ${si + 1} has no measures` });
        }
        stave.measures?.forEach((m, mi) => {
          if (!m.notes?.length) {
            issues.push({ level: 'warn', msg: `Empty measure at part ${pi + 1}, measure ${mi + 1}` });
          }
        });
      });
    });
  }
  const fatal = issues.find(i => i.level === 'fatal');
  return { ok: !fatal, fatal: fatal?.msg || null, issues };
}

/** Install a score into APP after repair + validation (load, restore, import). @param {*} raw @param {{clearHistory?:boolean, skipAssignmentPrompt?:boolean}} [opts] @returns {Score} */
function adoptScore(raw, opts = {}) {
  const score = repairScore(typeof structuredClone === 'function' ? structuredClone(raw) : JSON.parse(JSON.stringify(raw)));
  const result = validateScore(score);
  if (!result.ok) throw new Error(result.fatal || 'Invalid score data');
  APP.score = score;
  APP._lastUndoFP = _scoreFingerprint(score);
  _checkInvariants(score);
  if (opts.clearHistory !== false) {
    APP.undoStack = [];
    APP.redoStack = [];
  }
  // Detect assignments on file open
  if (score.assignments?.length && !opts.skipAssignmentPrompt) {
    setTimeout(() => {
      const pending = score.assignments.filter(a => !score.studentAnswers?.[a.id]?.submitted);
      if (pending.length) {
        makeModal(`
          <h2>📚 Assignment Detected</h2>
          <div style="font-size:13px;color:#4a5568;margin-bottom:12px">
            This score contains ${pending.length} assignment${pending.length > 1 ? 's' : ''}.
          </div>
          ${pending.map(a => `<button class="modal-btn secondary" style="margin-bottom:6px;width:100%;text-align:left" data-action="startAssignment" data-id="${a.id}">${a.title} (measures ${a.range.startMi+1}–${a.range.endMi+1})</button>`).join('')}
          <button class="modal-btn secondary" data-action="closeModal">Continue editing</button>
        `);
      }
    }, 300);
  }
  return score;
}

/** Shift measure-indexed annotations when inserting or deleting a measure. @param {Score} score @param {number} mi @param {'insert'|'delete'} mode */
function shiftMeasureRefs(score, mi, mode) {
  _ensureScoreAnnotationArrays(score);
  if (mode === 'insert') {
    const bump = ref => (typeof ref === 'number' && ref >= mi ? ref + 1 : ref);
    for (const rule of SCORE_MEASURE_REF_RULES) {
      const arr = score[rule.key];
      if (rule.range) {
        score[rule.key] = arr.map(item => ({
          ...item,
          [rule.start]: bump(item[rule.start]),
          [rule.end]: bump(item[rule.end]),
        }));
      } else {
        score[rule.key] = arr.map(item => ({
          ...item,
          [rule.field]: bump(item[rule.field]),
        }));
      }
    }
    return;
  }
  if (mode === 'delete') {
    for (const rule of SCORE_MEASURE_REF_RULES) {
      const arr = score[rule.key];
      if (rule.range) {
        score[rule.key] = arr
          .filter(item => item[rule.start] !== mi && item[rule.end] !== mi)
          .map(item => ({
            ...item,
            [rule.start]: item[rule.start] > mi ? item[rule.start] - 1 : item[rule.start],
            [rule.end]: item[rule.end] > mi ? item[rule.end] - 1 : item[rule.end],
          }));
      } else {
        score[rule.key] = arr
          .filter(item => item[rule.field] !== mi)
          .map(item => ({
            ...item,
            [rule.field]: item[rule.field] > mi ? item[rule.field] - 1 : item[rule.field],
          }));
      }
    }
  }
}

/** Validate structural invariants after a score mutation. Logs warnings but does not throw. @param {Score} score */
function _checkInvariants(score) {
  if (!score || typeof score !== 'object') return;
  const warnings = [];

  // 1. Measure count consistency across all staves
  let expectedMeasures = -1;
  if (Array.isArray(score.parts)) {
    score.parts.forEach((part, pi) => {
      if (!Array.isArray(part.staves)) return;
      part.staves.forEach((stave, si) => {
        const mCount = Array.isArray(stave.measures) ? stave.measures.length : 0;
        if (expectedMeasures === -1) {
          expectedMeasures = mCount;
        } else if (mCount !== expectedMeasures) {
          warnings.push(`Part ${pi + 1} stave ${si + 1} has ${mCount} measures; expected ${expectedMeasures}`);
        }
        // Check each measure has required fields
        if (Array.isArray(stave.measures)) {
          stave.measures.forEach((m, mi) => {
            if (!Array.isArray(m.notes)) {
              warnings.push(`Part ${pi + 1} stave ${si + 1} measure ${mi} has no notes array`);
            } else {
              m.notes.forEach((n, ni) => {
                if (n && !VALID_DURATIONS.has(n.duration)) {
                  warnings.push(`Part ${pi + 1} stave ${si + 1} measure ${mi} note ${ni} has invalid duration: '${n.duration}'`);
                }
                if (n && n.type === 'note' && typeof n.pitch !== 'number') {
                  warnings.push(`Part ${pi + 1} stave ${si + 1} measure ${mi} note ${ni} is type 'note' but has no pitch`);
                }
              });
            }
          });
        }
      });
    });
  }

  // 2. Annotation measure reference validity
  if (expectedMeasures > 0) {
    for (const rule of SCORE_MEASURE_REF_RULES) {
      const arr = score[rule.key];
      if (!Array.isArray(arr)) continue;
      arr.forEach((item, idx) => {
        if (rule.range) {
          const start = item[rule.start];
          const end = item[rule.end];
          if (typeof start !== 'number' || start < 0 || start >= expectedMeasures) {
            warnings.push(`${rule.key}[${idx}].${rule.start}=${start} out of range [0,${expectedMeasures - 1}]`);
          }
          if (typeof end !== 'number' || end < (start || 0) || end >= expectedMeasures) {
            warnings.push(`${rule.key}[${idx}].${rule.end}=${end} invalid (start=${start}, max=${expectedMeasures - 1})`);
          }
        } else {
          const mi = item[rule.field];
          if (typeof mi !== 'number' || mi < 0 || mi >= expectedMeasures) {
            warnings.push(`${rule.key}[${idx}].${rule.field}=${mi} out of range [0,${expectedMeasures - 1}]`);
          }
        }
      });
    }
  }

  // 3. Annotation cross-references — no duplicated slurs pointing at same pair
  if (Array.isArray(score.slurs)) {
    const seen = new Set();
    score.slurs.forEach((s, idx) => {
      const key = `${s.startMi}:${s.startNoteIdx}:${s.endMi}:${s.endNoteIdx}`;
      if (seen.has(key)) warnings.push(`slurs[${idx}] duplicates existing slur at ${key}`);
      seen.add(key);
    });
  }

  // 4. Selection validity
  if (typeof APP.selectedMeasure === 'number' && APP.selectedMeasure >= expectedMeasures) {
    warnings.push(`APP.selectedMeasure=${APP.selectedMeasure} out of range [0,${expectedMeasures - 1}]`);
  }
  const totalStaves = (score.parts || []).reduce((s, p) => s + (p.staves || []).length, 0);
  if (typeof APP.selectedStaff === 'number' && APP.selectedStaff >= totalStaves) {
    warnings.push(`APP.selectedStaff=${APP.selectedStaff} out of range [0,${totalStaves - 1}]`);
  }

  for (const w of warnings) console.warn('[Pauta Invariant]', w);
}

/** Get a stave by global staff index from a score object (not APP). @param {Score} score @param {number} si @returns {Stave|null} */
function _staveBySI(score, si) {
  let idx = 0;
  for (const part of (score.parts || [])) {
    for (const stave of (part.staves || [])) {
      if (idx === si) return stave;
      idx++;
    }
  }
  return null;
}

/**
 * Audit annotations after a structural edit (insert/delete measure, transpose).
 * Auto-repairs orphan ties; logs warnings for other issues.
 * @param {Score} score
 * @param {'deleteMeasure'|'insertMeasure'|'addMeasure'|'transpose'} editType
 * @param {number} editArg
 */
function _auditAnnotationsAfterEdit(score, editType, editArg) {
  if (!score || !Array.isArray(score.parts)) return;
  const repairs = [], warnings = [];
  const measureCount = score.parts[0]?.staves?.[0]?.measures?.length || 0;

  // 1. Ties — check each n.tieToNext has a target note (next note in measure, or first note in next measure)
  score.parts.forEach((part, pi) => {
    (part.staves || []).forEach((stave, localSI) => {
      (stave.measures || []).forEach((m, mi) => {
        (m.notes || []).forEach((n, ni) => {
          if (!n || n.type !== 'note' || !n.tieToNext) return;
          let found = false;
          // Look in same measure, same voice
          for (let j = ni + 1; j < (m.notes || []).length; j++) {
            const cand = m.notes[j];
            if (cand && cand.type === 'note' && (cand.voice || 1) === (n.voice || 1)) { found = true; break; }
          }
          // Fallback to first note in next measure, same voice
          if (!found && mi + 1 < measureCount) {
            const nextM = stave.measures[mi + 1];
            for (let j = 0; j < (nextM.notes || []).length; j++) {
              const cand = nextM.notes[j];
              if (cand && cand.type === 'note' && (cand.voice || 1) === (n.voice || 1)) { found = true; break; }
            }
          }
          if (!found) {
            delete n.tieToNext;
            repairs.push(`orphan tie: part ${pi+1} stave ${localSI+1} measure ${mi} note ${ni}`);
          }
        });
      });
    });
  });

  // 2. Slurs — check start/end notes still exist
  if (Array.isArray(score.slurs)) {
    const valid = [];
    score.slurs.forEach((s, idx) => {
      const stave = _staveBySI(score, s.si);
      const startM = stave?.measures?.[s.startMi];
      const endM   = stave?.measures?.[s.endMi];
      const startN = startM?.notes?.[s.startNi];
      const endN   = endM?.notes?.[s.endNi];
      if (!startN || startN.type !== 'note') {
        warnings.push(`removed slur[${idx}]: start note missing (si=${s.si} m=${s.startMi} n=${s.startNi})`);
        return;
      }
      if (!endN || endN.type !== 'note') {
        warnings.push(`removed slur[${idx}]: end note missing (si=${s.si} m=${s.endMi} n=${s.endNi})`);
        return;
      }
      valid.push(s);
    });
    if (valid.length !== score.slurs.length) {
      score.slurs = valid;
    }
  }

  // 3. Hairpins — check start/end notes still exist
  if (Array.isArray(score.hairpins)) {
    const valid = [];
    score.hairpins.forEach((h, idx) => {
      const stave = _staveBySI(score, h.si);
      const startM = stave?.measures?.[h.startMi];
      const endM   = stave?.measures?.[h.endMi];
      const startN = startM?.notes?.[h.startNi];
      const endN   = endM?.notes?.[h.endNi];
      if (!startN || startN.type !== 'note') {
        warnings.push(`removed hairpin[${idx}]: start note missing (si=${h.si} m=${h.startMi} n=${h.startNi})`);
        return;
      }
      if (!endN || endN.type !== 'note') {
        warnings.push(`removed hairpin[${idx}]: end note missing (si=${h.si} m=${h.endMi} n=${h.endNi})`);
        return;
      }
      valid.push(h);
    });
    if (valid.length !== score.hairpins.length) {
      score.hairpins = valid;
    }
  }

  // 4. Insert-measure specific: warn about ties crossing the insertion
  if (editType === 'insertMeasure' && editArg > 0) {
    const prevM = score.parts[0]?.staves?.[0]?.measures?.[editArg - 1];
    if (prevM) {
      prevM.notes.forEach((n, ni) => {
        if (n && n.type === 'note' && n.tieToNext) {
          warnings.push(`tie from measure ${editArg - 1} note ${ni} may cross inserted measure ${editArg}`);
        }
      });
    }
  }

  if (repairs.length) console.warn('[Pauta Audit] Repaired:', repairs.join('; '));
  if (warnings.length) console.warn('[Pauta Audit] Warnings:', warnings.join('; '));
}

/**
 * Single front door for score edits.
 * Ensures undo snapshot → mutate → repair → validate → render → autosave.
 * @param {function(Score):void} mutator
 * @param {{undo?:boolean, render?:boolean, toast?:string|null}} [opts]
 * @returns {boolean}
 */
function commitChange(mutator, opts = {}) {
  const { undo = true, render = true, toast = null } = opts;
  if (!APP.score) return false;
  // Snapshot before any mutation so we can roll back fully on error
  const preSnapshot = _cloneScore(APP.score);
  const preStackLen = APP.undoStack.length;
  if (undo) pushUndo();
  try {
    mutator(APP.score);
    APP.score = repairScore(APP.score);
    const check = validateScore(APP.score);
    if (!check.ok) throw new Error(check.fatal || 'Score validation failed');
    _checkInvariants(APP.score);
    APP._lastUndoFP = _scoreFingerprint(APP.score);
    if (render) renderScore();
    if (toast) showToast(toast);
    if (undo) _autosaveNow();
    return true;
  } catch (err) {
    // Roll back: restore pre-mutation score and remove any spurious undo entry
    APP.score = preSnapshot;
    if (APP.undoStack.length > preStackLen) APP.undoStack.pop();
    console.error('[Pauta] commitChange failed:', err);
    showToast('Could not apply change');
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 3: Import / Export
// ═══════════════════════════════════════════════════════════════════
// ── MSCX Parser ──────────────────────────────────────────────────
function parseMSCX(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr,'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML');

  // Namespace-safe query helpers — fallback when xmlns default namespace is present
  function nq(parent, tag) {
    let el = parent.querySelector(tag);
    if (!el) { const all = parent.querySelectorAll('*'); for (const c of all) { if (c.localName === tag) { el = c; break; } } }
    return el;
  }
  function nqa(parent, tag) {
    let els = Array.from(parent.querySelectorAll(tag));
    if (!els.length) { els = Array.from(parent.querySelectorAll('*')).filter(c => c.localName === tag); }
    return els;
  }

  function txt(parent, tag) {
    const el = nq(parent, tag);
    return el ? el.textContent.trim() : null;
  }

  // Console diagnostics
  const rootEl = doc.firstChild;
  debugLog('[PautaEngraving import] root element:', rootEl?.tagName, 'namespace:', rootEl?.namespaceURI);
  const mScoreEl = nq(doc, 'museScore');
  debugLog('[PautaEngraving import] museScore version:', mScoreEl?.getAttribute('version'));
  const staffCount = nqa(doc, 'Staff').length;
  const measureCount = nqa(doc, 'Measure').length;
  const partCount = nqa(doc, 'Part').length;
  const metaTags = nqa(doc, 'metaTag');
  debugLog('[PautaEngraving import] Staff:', staffCount, 'Measure:', measureCount, 'Part:', partCount, 'metaTag:', metaTags.length);
  metaTags.forEach(mt => debugLog('  metaTag:', mt.getAttribute('name'), '=', mt.textContent.trim()));

  const score = createScore();
  // Try metaTag first (MuseScore 4), then direct tags
  let metaTitle = '', metaComposer = '';
  metaTags.forEach(mt => {
    const name = mt.getAttribute('name');
    if (name === 'workTitle') metaTitle = mt.textContent.trim();
    if (name === 'composer') metaComposer = mt.textContent.trim();
  });
  score.title    = metaTitle || txt(doc,'Title') || txt(doc,'title') || 'Untitled Score';
  score.composer = metaComposer || txt(doc,'Composer') || txt(doc,'composer') || '';
  debugLog('[PautaEngraving import] title:', score.title, 'composer:', score.composer);
  const mps = nq(doc, 'PautaEngravingSettings') || nq(doc, 'PautaSettings');
  if (mps) {
    score.showMeasureNumbers     = mps.getAttribute('showMeasureNumbers') === '1';
    score.showMultiMeasureRests  = mps.getAttribute('showMultiMeasureRests') === '1';

  }
  score.parts    = [];

  const staffEls = nqa(doc, 'Staff');
  if (!staffEls.length) { debugLog('[PautaEngraving import] No Staff elements found'); return score; }

  const stavesByPart = [];
  let curTimeSigNum=4, curTimeSigDen=4, curKeySig=0;
  let clefType = 'treble';

  const docMeasures = nqa(doc, 'Measure');
  let anyStaffHadMeasures = false;

  function parseMeasureEls(mEls, si, $stavesByPart, $score) {
    const out = [];
    let firstMeasure = true;

    mEls.forEach(mEl => {
      const measure = {
        timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: []
      };

      // Clef
      const clefEl = (() => { const cp = nq(mEl, 'Clef'); return cp ? (nq(cp, 'concertClefType') || nq(cp, 'clefType')) : null; })();
      if (clefEl) {
        const ct = clefEl.textContent.trim().toLowerCase();
        clefType = ct.includes('bass') ? 'bass' : 'treble';
      }

      // Key signature
      const kEl = nq(mEl, 'KeySig');
      if (kEl) {
        const accEl = nq(kEl, 'accidental') || nq(kEl, 'atonal');
        curKeySig = accEl ? (parseInt(accEl.textContent)||0) : 0;
        measure.keySig = curKeySig;
      }
      if (firstMeasure && measure.keySig === null) measure.keySig = 0;

      // Time signature
      const tEl = nq(mEl, 'TimeSig');
      if (tEl) {
        const n = nq(tEl, 'sigN');
        const d = nq(tEl, 'sigD');
        if (n && d) {
          curTimeSigNum = parseInt(n.textContent)||4;
          curTimeSigDen = parseInt(d.textContent)||4;
          measure.timeSigNum = curTimeSigNum;
          measure.timeSigDen = curTimeSigDen;
        }
      }
      if (firstMeasure && measure.timeSigNum === null) {
        measure.timeSigNum = curTimeSigNum;
        measure.timeSigDen = curTimeSigDen;
      }

      // Notes & Rests — parse all voices
      const parseAccidental = (el) => {
        const accParent = nq(el, 'Accidental');
        const accSub = accParent ? txt(accParent, 'subtype') : (txt(el,'accidentalType') || '');
        if (accSub.includes('Sharp'))   return '#';
        if (accSub.includes('Flat'))    return 'b';
        if (accSub.includes('Natural')) return 'n';
        return null;
      };

      const els = Array.from(mEl.children);
      let curVoiceNum = 1;

      els.forEach(el => {
        const tag = el.localName;
        if (tag === 'voice') {
          curVoiceNum = parseInt(el.getAttribute('num') || '1');
          Array.from(el.children).forEach(child => parseNoteEl(child, curVoiceNum));
          return;
        }
        parseNoteEl(el, curVoiceNum);
      });

      function parseNoteEl(el, voiceNum) {
        const tag = el.localName;
        if (tag === 'Rest') {
          const dur  = MSCX_TO_VEX[txt(el,'durationType')||'quarter'] || 'q';
          const dots = parseInt(txt(el,'dots')||'0') || 0;
          const rest = mkRest(dur, dots, voiceNum);
          measure.notes.push(rest);

        } else if (tag === 'Chord') {
          const dur  = MSCX_TO_VEX[txt(el,'durationType')||'quarter'] || 'q';
          const dots = parseInt(txt(el,'dots')||'0') || 0;

          const noteEls = nqa(el, 'Note');
          if (!noteEls.length) return;

          const firstNoteEl = noteEls[0];
          const pitch = parseInt(txt(firstNoteEl,'pitch')||'60') || 60;
          const acc   = parseAccidental(firstNoteEl);
          const note  = mkNote(pitch, dur, dots, acc, voiceNum);

          noteEls.slice(1).forEach(ne => {
            const ep = parseInt(txt(ne,'pitch')||'60') || 60;
            const ea = parseAccidental(ne);
            if (!note.extraPitches) note.extraPitches = [];
            note.extraPitches.push({pitch: ep, accidental: ea});
          });

          if (nq(firstNoteEl, 'Tie')) note.tieToNext = true;

          const dynEl = nq(el, 'Dynamic');
          if (dynEl) {
            const sub = txt(dynEl,'subtype') || '';
            if (['pppp','ppp','pp','p','mp','mf','f','ff','fff','ffff','sfz','fp','sfp','rfz'].includes(sub)) note.dynamic = sub;
          }

          const artEl = nq(el, 'Articulation');
          if (artEl) note.articulation = txt(artEl,'subtype') || null;

          const lyrEl = nq(el, 'Lyrics');
          if (lyrEl) {
            const lyrText = txt(lyrEl,'text') || '';
            const sylEl   = nq(lyrEl, 'syllabic');
            if (lyrText) {
              note.lyric = {text:lyrText, separator:sylEl?.textContent==='middle'?'dash':null, font:"'Helvetica Neue',Helvetica,Arial,sans-serif", size:11, bold:false, italic:false};
            }
          }

          const stEl = nq(el, 'StaffText');
          if (stEl) note.staffText = txt(stEl,'text') || null;

          const harmEl = nq(el, 'Harmony');
          if (harmEl) note.chordSymbol = txt(harmEl,'root') || txt(harmEl,'name') || null;

          measure.notes.push(note);
        }
      }

      const rmEl = nq(mEl, 'RehearsalMark');
      if (rmEl) {
        const rmText = txt(rmEl,'text') || '';
        if (rmText && $score.rehearsalMarks) {
          $score.rehearsalMarks.push({mi: out.length, label: rmText});
        }
      }

      const tempoEl = nq(mEl, 'Tempo');
      if (tempoEl && $stavesByPart.length === 0) {
        const bpmRaw = parseFloat(txt(tempoEl,'tempo') || '2');
        const bpm    = Math.round(bpmRaw * 60);
        const name   = txt(tempoEl,'text') || '';
        if (!measure.tempo) measure.tempo = {name, bpm};
      }

      if (!measure.notes.length) measure.notes.push(mkRest('w'));

      out.push(measure);
      firstMeasure = false;
    });
    return out;
  }

  staffEls.forEach((staffEl, si) => {
    const staffMeasures = nqa(staffEl, 'Measure');
    if (staffMeasures.length) anyStaffHadMeasures = true;
    debugLog(`[PautaEngraving import] Staff ${si}: found ${staffMeasures.length} Measure children`);
    const prevClef = clefType;
    const measures = parseMeasureEls(staffMeasures, si, stavesByPart, score);
    // Use detected clef from first measure, fall back to alternating clefs
    const staffClef = measures.length && staffMeasures.length ? clefType : (si % 2 === 0 ? 'treble' : 'bass');
    debugLog(`[PautaEngraving import] Staff ${si}: parsed ${measures.length} measures, clef: ${staffClef}, first measure notes: ${measures[0]?.notes?.length||0}`);
    stavesByPart.push({clef: staffClef, measures});
  });

  // Fallback: if no Staff contained Measure children but Measures exist elsewhere in doc
  if (!anyStaffHadMeasures && docMeasures.length) {
    debugLog('[PautaEngraving import] No Measures inside Staff — using document-level measures as fallback');
    debugLog('[PautaEngraving import] Staff child tagNames:', Array.from(staffEls[0].children).map(c=>c.localName));
    stavesByPart.forEach(s => {
      s.measures = parseMeasureEls(docMeasures, 0, stavesByPart, score);
    });
  }

  // Remove staves that had no Measure elements (MuseScore 4 may emit ghost staff elements)
  const realStaves = stavesByPart.filter(s => s.measures.length > 0);
  if (realStaves.length) {
    stavesByPart.length = 0;
    stavesByPart.push(...realStaves);
  }

  // Ensure all staves have the same measure count (MuseScore may put measures in only one staff)
  const maxMeasures = Math.max(...stavesByPart.map(s => s.measures.length));
  if (maxMeasures > 0) {
    stavesByPart.forEach(s => {
      while (s.measures.length < maxMeasures) s.measures.push(emptyMeasure());
    });
  }

  // Detect part name from Part element
  let partName = 'Piano';
  const partEl = nq(doc, 'Part');
  if (partEl) {
    debugLog('[PautaEngraving import] Part child tags:', Array.from(partEl.children).map(c => c.localName));
    partName = txt(partEl, 'trackName') || txt(partEl, 'partName') || txt(partEl, 'longName') || 'Piano';
    debugLog('[PautaEngraving import] Part name found:', partName);
  }

  score.parts = [{
    name: partName,
    staves: stavesByPart.length ? stavesByPart : createScore().parts[0].staves
  }];
  if (!score.slurs)          score.slurs          = [];
  if (!score.hairpins)       score.hairpins       = [];
  if (!score.rehearsalMarks) score.rehearsalMarks = [];
  if (!score.staffTexts)     score.staffTexts     = [];
  return score;
}

// ── MusicXML Importer ────────────────────────────────────────────
function parseMusicXML(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr,'text/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML');

  // Namespace-safe helpers
  function nq(parent, tag) {
    let el = parent.querySelector(tag);
    if (!el) { const all = parent.querySelectorAll('*'); for (const c of all) { if (c.localName === tag) { el = c; break; } } }
    return el;
  }
  function nqa(parent, tag) {
    let els = Array.from(parent.querySelectorAll(tag));
    if (!els.length) { els = Array.from(parent.querySelectorAll('*')).filter(c => c.localName === tag); }
    return els;
  }
  function txt(parent, tag) {
    const el = nq(parent, tag);
    return el ? el.textContent.trim() : null;
  }

  const stepToIdx = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};

  function mxmlPitch(step, octave, alter) {
    const stepIdx = stepToIdx[step] !== undefined ? stepToIdx[step] : 0;
    return (octave + 1) * 12 + stepIdx + (alter || 0);
  }

  function mxmlAccidental(alter) {
    if (!alter || alter === 0) return null;
    return alter > 0 ? '#' : 'b';
  }

  const _typeToDur = {
    'maxima':'w','long':'w','breve':'w','whole':'w',
    'half':'h','quarter':'q','eighth':'8',
    '16th':'16','32nd':'32','64th':'64','128th':'64',
  };

  function mxmlDuration(typeStr, durDiv, divisions) {
    const t = (typeStr||'').toLowerCase();
    if (_typeToDur[t]) return _typeToDur[t];
    // Fallback: convert divisions-based duration to our codes
    if (divisions > 0 && durDiv > 0) {
      const beats = durDiv / divisions;
      const options = [[4,'w'],[2,'h'],[1,'q'],[0.5,'8'],[0.25,'16'],[0.125,'32'],[0.0625,'64']];
      let best = 'q';
      for (const [b, d] of options) {
        if (Math.abs(beats - b) < 0.01) { best = d; break; }
      }
      return best;
    }
    return 'q';
  }

  const score = createScore();
  const root = doc.documentElement;

  // Title & composer
  score.title    = txt(root, 'movement-title') || txt(root, 'work-title') || 'Untitled Score';
  score.composer = txt(root, 'movement-creator') || '';
  // Also check identification/creator
  const idEl = nq(root, 'identification');
  if (idEl) {
    const creator = nq(idEl, 'creator');
    if (creator && creator.getAttribute('type') === 'composer') score.composer = creator.textContent.trim();
  }

  const partListEl  = nq(root, 'part-list') || root;
  const partList    = nqa(partListEl, 'score-part');
  const partNames   = partList.map(el => txt(el, 'part-name') || 'Instrument');
  const partEls     = nqa(root, 'part');

  score.parts = [];

  partEls.forEach((partEl, pi) => {
    const part = {
      name:    partNames[pi] || `Part ${pi+1}`,
      instrument: 'Piano',
      volume:  1,
      osc:     'triangle',
      muted:   false,
      staves:  [],
    };

    // Determine number of staves for this part from part-list attributes
    const staffEl = nq(partList[pi], 'staff') || nq(partList[pi], 'staff-layout');
    const numStaves = partList[pi] ? parseInt(nq(partList[pi], 'staff')?.textContent) || 1 : 1;

    for (let s = 0; s < numStaves; s++) {
      part.staves.push({
        measures: [],
        clef: 'treble',
        transposition: 0,
        midiProgram: 0,
        midiChannel: pi * numStaves + s,
        pan: pi === 0 ? -0.3 : 0.3,
      });
    }

    let divisions    = 4;
    let curTimeSigNum= 4, curTimeSigDen=4;
    let curKeySig    = 0;
    let clefType     = 'treble';
    let firstMeasure = true;

    const measureEls = nqa(partEl, 'measure');

    measureEls.forEach(mEl => {
      const measure = {
        timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [],
      };

      // Attributes
      const attrs = nq(mEl, 'attributes');
      if (attrs) {
        const divEl = nq(attrs, 'divisions');
        if (divEl) divisions = parseInt(divEl.textContent) || 4;

        const keyEl = nq(attrs, 'key');
        if (keyEl) {
          const fifths = nq(keyEl, 'fifths');
          if (fifths) { curKeySig = parseInt(fifths.textContent) || 0; measure.keySig = curKeySig; }
        }

        const timeEl = nq(attrs, 'time');
        if (timeEl) {
          const beats = nq(timeEl, 'beats');
          const bt    = nq(timeEl, 'beat-type');
          if (beats && bt) { curTimeSigNum = parseInt(beats.textContent) || 4; curTimeSigDen = parseInt(bt.textContent) || 4; measure.timeSigNum = curTimeSigNum; measure.timeSigDen = curTimeSigDen; }
        }

        const clefEl = nq(attrs, 'clef');
        if (clefEl) {
          const sign = (txt(clefEl, 'sign') || 'G').toUpperCase();
          clefType = (sign === 'F') ? 'bass' : 'treble';
          // Clef per staff
          const staffIdxEl = nq(clefEl, 'number');
          const staffIdx = staffIdxEl ? (parseInt(staffIdxEl.textContent) || 1) : 1;
          const si = Math.min(staffIdx - 1, part.staves.length - 1);
          if (part.staves[si]) part.staves[si].clef = clefType;
        }
      }

      if (firstMeasure) {
        if (measure.keySig === null) measure.keySig = 0;
        if (measure.timeSigNum === null) { measure.timeSigNum = curTimeSigNum; measure.timeSigDen = curTimeSigDen; }
        firstMeasure = false;
      }

      // Barline
      const barlineEl = nq(mEl, 'barline');
      if (barlineEl) {
        const loc = txt(barlineEl, 'bar-style') || '';
        if (loc === 'final') measure.lineBreak = true;
      }

      // Harmony (chord symbols) — may appear before/after notes
      const harmonEls = nqa(mEl, 'harmony');
      const harmonyMap = new Map(); // beat → string
      let harmonyBeat = 0;
      harmonEls.forEach(hEl => {
        const rootEl = nq(hEl, 'root');
        const kindEl = nq(hEl, 'kind');
        if (rootEl) {
          const rootStep = txt(rootEl, 'root-step') || '';
          const rootAlt  = txt(rootEl, 'root-alter');
          let sym = rootStep;
          if (rootAlt === '1') sym += '#';
          else if (rootAlt === '-1') sym += 'b';
          if (kindEl) {
            const kindText = kindEl.textContent.trim();
            const kindMap = {
              'major':'','minor':'m','augmented':'aug','diminished':'dim',
              'dominant':'7','major-seventh':'maj7','minor-seventh':'m7',
              'diminished-seventh':'dim7','augmented-seventh':'aug7',
              'major-ninth':'maj9','minor-ninth':'m9','dominant-ninth':'9',
              'suspended-fourth':'sus4','suspended-second':'sus2',
              'major-sixth':'6','minor-sixth':'m6','power':'5',
            };
            sym += kindMap[kindText] || kindText;
          }
          harmonyMap.set(harmonyBeat, sym);
        }
        harmonyBeat += 1;
      });

      // Notes
      const noteEls = nqa(mEl, 'note');
      let lastNote = null;
      let beatPos  = 0;
      let harmonyIdx = 0;

      noteEls.forEach(noteEl => {
        const isChord = nq(noteEl, 'chord') !== null;
        const isRest  = nq(noteEl, 'rest') !== null;

        // Staff index (for multi-stave parts)
        let si = 0;
        const staffEl2 = nq(noteEl, 'staff');
        if (staffEl2) si = Math.min(parseInt(staffEl2.textContent) - 1, part.staves.length - 1);

        // Pitch
        let pitch = 60, alter = 0;
        if (!isRest) {
          const pitchEl = nq(noteEl, 'pitch');
          if (pitchEl) {
            const step   = txt(pitchEl, 'step') || 'C';
            const octave = parseInt(txt(pitchEl, 'octave')) || 4;
            const altEl  = nq(pitchEl, 'alter');
            alter = altEl ? parseFloat(altEl.textContent) || 0 : 0;
            pitch = mxmlPitch(step, octave, alter);
          }
        }

        // Duration
        const durEl    = nq(noteEl, 'duration');
        const durDiv   = durEl ? parseFloat(durEl.textContent) || 0 : 0;
        const typeEl   = nq(noteEl, 'type');
        const typeStr  = typeEl ? typeEl.textContent : '';
        const durCode  = mxmlDuration(typeStr, durDiv, divisions);
        const dotCount = nqa(noteEl, 'dot').length;

        // Tie
        const tieEl    = nq(noteEl, 'tie');
        const tieStart = nqa(noteEl, 'tie').filter(t => t.getAttribute('type') === 'start').length > 0;

        // Notehead
        const headEl = nq(noteEl, 'notehead');
        const notehead = headEl ? headEl.textContent.trim() : null;

        // Voice
        const voiceEl = nq(noteEl, 'voice');
        const voice   = voiceEl ? parseInt(voiceEl.textContent) || 1 : 1;

        // Dynamics from <direction> elements (collected per measure, applied to first note after)
        // Simplified: we just look for dynamics in <direction> elements preceding this note

        if (isChord && lastNote) {
          // Extra pitch on chord
          if (!lastNote.extraPitches) lastNote.extraPitches = [];
          lastNote.extraPitches.push(pitch);
          return;
        }

        if (isRest) {
          const note = {
            type: 'rest', duration: durCode, dots: dotCount,
            accidental: null, voice, pitch: 60,
          };
          // Assign chord symbol if harmony maps to this beat
          const hSym = harmonyMap.get(harmonyIdx);
          if (hSym) note.chordSymbol = hSym;
          harmonyIdx++;
          // Need to route to correct stave
          let targetStave = part.staves[si] || part.staves[0];
          targetStave.measures = targetStave.measures || [];
          if (!targetStave.measures[measureEls.indexOf(mEl)]) {
            // Ensure all staves have same measure count
            part.staves.forEach((st, sIdx) => {
              while (st.measures.length < measureEls.indexOf(mEl) + 1) {
                st.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [] });
              }
            });
          }
          const measIdx = measureEls.indexOf(mEl);
          targetStave = part.staves[si] || part.staves[0];
          while (targetStave.measures.length <= measIdx) {
            targetStave.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [] });
          }
          targetStave.measures[measIdx].notes.push(note);
          lastNote = note;
          beatPos += durDiv;
          return;
        }

        // Regular note
        const note = {
          type: 'note', duration: durCode, dots: dotCount,
          accidental: mxmlAccidental(alter),
          voice, pitch, tieToNext: tieStart || undefined,
          notehead: notehead || undefined,
        };

        // Chord symbol
        const hSym2 = harmonyMap.get(harmonyIdx);
        if (hSym2) note.chordSymbol = hSym2;
        harmonyIdx++;

        // Direction dynamics — look for <direction><direction-type><dynamics> elements
        const directions = nqa(mEl, 'direction');
        for (const dEl of directions) {
          const dirType = nq(dEl, 'direction-type');
          if (dirType) {
            const dynEl = nq(dirType, 'dynamics');
            if (dynEl) {
              const dynChild = dynEl.children[0];
              if (dynChild) note.dynamic = dynChild.localName;
            }
          }
        }

        // Route to correct stave
        const measIdx = measureEls.indexOf(mEl);
        let targetStave2 = part.staves[si] || part.staves[0];
        while (targetStave2.measures.length <= measIdx) {
          targetStave2.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [] });
        }
        targetStave2.measures[measIdx].notes.push(note);
        lastNote = note;
        beatPos += durDiv;
      });
    });

    // Fill in missing measures for staves that have fewer measures
    const maxMeas = Math.max(...part.staves.map(s => s.measures.length));
    part.staves.forEach(stave => {
      while (stave.measures.length < maxMeas) {
        stave.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [] });
      }
      // Apply time/key sigs missing from later measures
      let lastTSN = null, lastTSD = null, lastKS = null;
      stave.measures.forEach((m, idx) => {
        if (m.timeSigNum !== null) { lastTSN = m.timeSigNum; lastTSD = m.timeSigDen; }
        if (m.keySig !== null) lastKS = m.keySig;
        // Inherit key/time from first measure if not set
        if (idx > 0) {
          if (m.timeSigNum === null && lastTSN !== null) { m.timeSigNum = lastTSN; m.timeSigDen = lastTSD; }
          if (m.keySig === null && lastKS !== null) m.keySig = lastKS;
        }
      });
    });

    score.parts.push(part);
  });

  // Copy first part's stave measures to all parts (MusicXML-only parts may share)
  // Ensure measurements aren't lost for non-first parts
  if (!score.slurs)          score.slurs          = [];
  if (!score.hairpins)       score.hairpins       = [];
  if (!score.rehearsalMarks) score.rehearsalMarks = [];
  if (!score.staffTexts)     score.staffTexts     = [];

  return score;
}

// ── MSCX Exporter ────────────────────────────────────────────────
function exportMSCX() {
  return exportMSCXFromScore(APP.score);
}

// Shared MSCX exporter — works for full score or extracted part
function exportMSCXFromScore(s) {
  const esc = t => (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const am  = {'#':'accidentalSharp','b':'accidentalFlat','n':'accidentalNatural'};
  const dynMap = {pppp:'pppp',ppp:'ppp',pp:'pp',p:'p',mp:'mp',mf:'mf',f:'f',ff:'ff',fff:'fff',ffff:'ffff',sfz:'sfz',fp:'fp',sfp:'sfp',rfz:'rfz'};

  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<museScore version="4.0">\n  <Score>\n`;
  x += `    <Title>${esc(s.title)}</Title>\n`;
  if (s.composer) x += `    <Composer>${esc(s.composer)}</Composer>\n`;
  x += `    <PautaEngravingSettings showMeasureNumbers="${APP.showMeasureNumbers?'1':'0'}" showMultiMeasureRests="${APP.showMultiMeasureRests?'1':'0'}"/>\n`;

  // Part metadata
  s.parts.forEach((part, pi) => {
    x += `    <Part>\n      <Staff id="${pi+1}"/>\n`;
    x += `      <trackName>${esc(part.name)}</trackName>\n`;
    x += `    </Part>\n`;
  });

  const staves = s.parts.flatMap(p => p.staves);

  // Helper: global stave index offset for a part
  const gsiOf = (partIdx) => s.parts.slice(0, partIdx).reduce((a,p) => a + p.staves.length, 0);

  staves.forEach((stave, si) => {
    x += `    <Staff id="${si+1}">\n`;

    stave.measures.forEach((m, mi) => {
      // Resolve time sig for this measure (inherits from previous if not set)
      let tsNum = m.timeSigNum, tsDen = m.timeSigDen;
      if (tsNum === null || tsNum === undefined) {
        for (let pm = mi - 1; pm >= 0; pm--) {
          const pm_tn = stave.measures[pm]?.timeSigNum;
          const pm_td = stave.measures[pm]?.timeSigDen;
          if (pm_tn !== null && pm_tn !== undefined) { tsNum = pm_tn; tsDen = pm_td; break; }
        }
        if (tsNum === null || tsNum === undefined) { tsNum = 4; tsDen = 4; }
      }

      // Measure len attribute
      let measureLen = `${tsNum}/${tsDen}`;
      if (m.pickup) {
        const puBeats = m.pickup.num * (4 / m.pickup.den);
        const puTsNum = puBeats;
        const g = ((a,b) => { while(b){let t=b;b=a%b;a=t} return a; })(Math.round(puTsNum * tsDen), tsDen);
        const num = Math.round(puTsNum * tsDen) / g;
        const den = tsDen / g;
        measureLen = `${num}/${den}`;
      }

      x += `      <Measure number="${mi+1}" len="${measureLen}">\n`;

      // Clef — only at start or when it changes
      if (mi === 0 || m.clef) {
        const clefVal = m.clef || 'treble';
        x += `        <Clef>\n          <concertClefType>${clefVal}</concertClefType>\n        </Clef>\n`;
      }

      // Rehearsal mark
      const rm = (s.rehearsalMarks||[]).find(r => r.mi === mi);
      if (rm) x += `        <RehearsalMark>\n          <text>${esc(rm.label)}</text>\n        </RehearsalMark>\n`;

      // Tempo
      if (m.tempo && si === 0) {
        x += `        <Tempo>\n          <tempo>${(m.tempo.bpm/60).toFixed(4)}</tempo>\n`;
        x += `          <text>${esc(m.tempo.name)}</text>\n        </Tempo>\n`;
      }

      if (m.keySig !== null && m.keySig !== undefined)
        x += `        <KeySig><accidental>${m.keySig}</accidental></KeySig>\n`;
      if (m.timeSigNum !== null && m.timeSigNum !== undefined)
        x += `        <TimeSig><sigN>${m.timeSigNum}</sigN><sigD>${m.timeSigDen}</sigD></TimeSig>\n`;

      // Group notes by voice
      const voices = {};
      m.notes.forEach(n => {
        const v = n.voice || 1;
        if (!voices[v]) voices[v] = [];
        voices[v].push(n);
      });

      const writeNoteEl = (n, insideVoice) => {
        const durType = VEX_TO_MSCX[n.duration] || 'quarter';
        const vAttr = (insideVoice) ? '' : ` voice="${n.voice||1}"`;
        if (n.type === 'rest') {
          x += `          <Rest${vAttr}>\n`;
          x += `            <durationType>${durType}</durationType>\n`;
          if (n.dots) x += `            <dots>${n.dots}</dots>\n`;
          x += `          </Rest>\n`;
        } else {
          x += `          <Chord${vAttr}>\n`;
          x += `            <durationType>${durType}</durationType>\n`;
          if (n.dots) x += `            <dots>${n.dots}</dots>\n`;

          // Dynamic on this note
          if (n.dynamic) {
            x += `            <Dynamic>\n              <subtype>${dynMap[n.dynamic]||n.dynamic}</subtype>\n            </Dynamic>\n`;
          }

          // Articulation
          if (n.articulation) {
            x += `            <Articulation>\n              <subtype>${esc(n.articulation)}</subtype>\n            </Articulation>\n`;
          }

          // Staff text
          if (n.staffText) {
            x += `            <StaffText>\n              <text>${esc(n.staffText)}</text>\n            </StaffText>\n`;
          }

          // Chord symbol
          if (n.chordSymbol) {
            x += `            <Harmony>\n              <root>${esc(n.chordSymbol)}</root>\n            </Harmony>\n`;
          }

          // Primary note
          const writeNote = (pitch, acc) => {
            x += `            <Note>\n              <pitch>${pitch}</pitch>\n`;
            if (acc) x += `              <Accidental><subtype>${am[acc]||'accidentalNatural'}</subtype></Accidental>\n`;
            x += `            </Note>\n`;
          };
          writeNote(n.pitch, n.accidental);

          // Extra chord pitches
          (n.extraPitches||[]).forEach(ep => writeNote(ep.pitch, ep.accidental));

          // Lyric
          if (n.lyric) {
            x += `            <Lyrics>\n`;
            x += `              <text>${esc(n.lyric.text)}</text>\n`;
            if (n.lyric.separator === 'dash') x += `              <syllabic>middle</syllabic>\n`;
            x += `            </Lyrics>\n`;
          }

          // Tie to next
          if (n.tieToNext) x += `            <Tie/>\n`;

          x += `          </Chord>\n`;
        }
      };

      Object.keys(voices).sort((a,b) => a-b).forEach(v => {
        x += `        <voice num="${v}">\n`;
        voices[v].forEach(n => writeNoteEl(n, true));
        x += `        </voice>\n`;
      });

      x += `      </Measure>\n`;
    });

    // Slurs for this staff
    (s.slurs||[]).filter(sl => sl.si === si).forEach(sl => {
      x += `      <Spanner type="Slur">\n`;
      x += `        <Slur/>\n`;
      x += `        <next><location><measures>${sl.endMi - sl.startMi}</measures>`;
      x += `<notes>${sl.endNi - sl.startNi}</notes></location></next>\n`;
      x += `      </Spanner>\n`;
    });

    // Hairpins for this staff
    (s.hairpins||[]).filter(h => h.si === si).forEach(h => {
      const type = h.type === 'cresc' ? '0' : '1';
      x += `      <Spanner type="HairPin">\n`;
      x += `        <HairPin><subtype>${type}</subtype></HairPin>\n`;
      x += `        <next><location><measures>${h.endMi - h.startMi}</measures>`;
      x += `<notes>${h.endNi - h.startNi}</notes></location></next>\n`;
      x += `      </Spanner>\n`;
    });

    x += `    </Staff>\n`;
  });

  x += '  </Score>\n</museScore>';
  return x;
}
