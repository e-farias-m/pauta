// ═══════════════════════════════════════════════════════════════════
// session.js — Session lifecycle, presenters, answer checking,
//              UI, rhythm worksheet, rhythm workout, main dialog
// ═══════════════════════════════════════════════════════════════════

// ── Static listeners (called once at boot) ──────────────────────
function initListeners() {
  // Session attaches listeners to dynamically created elements only.
  // No static DOM listeners needed.
}

// ── Exercise Session Manager ────────────────────────────────────
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

  UI.makeModal(`
    <div class="pauta-modal">
      <div class="pauta-modal-header">
        <h2 class="pauta-modal-title">${intro.title}</h2>
        <p class="pauta-modal-subtitle">${diffLabel} level</p>
      </div>

      <div class="pauta-modal-body">
        <div class="pauta-card" style="border-left:3px solid var(--pauta-primary);padding:12px;margin-bottom:16px;border-radius:0 6px 6px 0">
          <div style="font-weight:600;color:var(--pauta-primary);margin-bottom:4px">Learning Goal</div>
          <div style="font-size:13px;color:var(--pauta-text)">${intro.goal}</div>
        </div>

        <p class="dialog-hint" style="line-height:1.5;margin-bottom:16px">${intro.description}</p>

        <div style="margin-bottom:16px">
          <div class="pauta-dlg-section" style="margin:0 0 8px">Tips</div>
          <ul style="margin:0;padding-left:20px;font-size:12px;color:var(--pauta-text-muted);line-height:1.8">
            ${intro.tips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>

        <div class="pauta-card" style="border-left:3px solid var(--pauta-success);padding:12px;border-radius:0 6px 6px 0;border-top-color:transparent;border-right-color:transparent;border-bottom-color:transparent">
          <div style="font-weight:600;color:var(--pauta-success);margin-bottom:4px">Session Structure</div>
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
  // A fresh session invalidates whatever the summary modal was reviewing.
  APP._lastExerciseSession = null;
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
  updateModeBanner();
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
    nextActionHtml = `<div class="pauta-dlg-card" style="text-align:center;border-color:rgba(34,197,94,0.2)">
      <div class="pauta-text-success" style="font-weight:600;font-size:13px">Ready to advance!</div>
      <div class="pauta-text-muted-sm">${recommendation.reason}</div>
    </div>`;
  } else if (recommendation.action === 'review') {
    nextActionHtml = `<div class="pauta-dlg-card" style="text-align:center;border-color:rgba(230,168,23,0.2)">
      <div class="pauta-text-warning" style="font-weight:600;font-size:13px">Review recommended</div>
      <div class="pauta-text-muted-sm">${recommendation.reason}</div>
    </div>`;
  }

  const starCount = pct >= 80 ? 3 : pct >= 50 ? 2 : 1;
  const scoreCircleColor = pct >= 80 ? 'var(--pauta-success)' : pct >= 50 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)';
  const encouragements = [
    'Great effort!', 'Nice work!', 'Keep practicing!',
    'You\'re improving!', 'Well done!', 'Fantastic!'
  ];
  const cheer = encouragements[Math.floor(Math.random() * encouragements.length)];

  UI.makeModal(`
    <div class="pauta-hero">
      <h2 class="pauta-hero-title">Session Complete</h2>

      <div class="pauta-score-circle" style="background:${scoreCircleColor};box-shadow:0 4px 20px ${scoreCircleColor}44">
        <span class="score-pct">${pct}%</span>
        <span class="score-label">${correct} / ${total} correct</span>
      </div>

      <div class="pauta-star-rating">
        ${[1,2,3].map(i =>
          `<span class="star ${i <= starCount ? 'filled' : ''}">★</span>`
        ).join('')}
      </div>

      <div class="pauta-encouragement" style="color:${scoreCircleColor}">${cheer}</div>

      <div class="pauta-card-meta" style="margin:6px 0 12px">
        Best streak: ${s.maxStreak} · Time: ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}
      </div>
    </div>

    ${nextActionHtml}

    <div class="pauta-scroll-y pauta-mb-md" style="max-height:180px;font-size:12px;color:var(--pauta-text-muted);border-radius:var(--pauta-radius-sm);background:var(--pauta-bg);padding:8px">
      ${s.completed.map((c,i) => {
        if (c.type === 'difficulty_change') {
          return `<div class="pauta-row pauta-mb0" style="gap:6px">
            <span style="width:16px;text-align:center;font-size:14px">↕</span>
            <span>#${i+1}: Difficulty ${c.difficultyChange === 'up' ? '↑' : '↓'} to ${c.answer}</span>
          </div>`;
        }
        const icon = c.ok ? '✓' : (c.nearMiss ? '~' : '✗');
        const label = c.type === EXERCISE_TYPES.NOTE_ID ? 'Note ' + c.answer
          : c.type === EXERCISE_TYPES.INTERVAL_ID ? 'Interval ' + c.answer
          : c.type === EXERCISE_TYPES.KEY_SIG_ID ? 'Key ' + c.answer
          : c.type === EXERCISE_TYPES.MELODY_DICT ? 'Melody'
          : c.type === EXERCISE_TYPES.RHYTHM_WS ? 'Rhythm Dict'
          : c.type === EXERCISE_TYPES.SCALE_ID ? 'Scale ' + c.answer
          : c.type === EXERCISE_TYPES.NOTE_CONSTRUCT ? 'Construct ' + c.answer
          : 'Rhythm';
        return `<div class="pauta-row pauta-mb0" style="gap:6px">
          <span style="width:16px;text-align:center;font-size:14px">${icon}</span>
          <span>#${i+1}: ${label}${c.nearMiss && !c.ok ? ' (off by 1)' : ''}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="pauta-row center wrap">
      <button class="modal-btn primary" data-action="reviewExerciseSession">Review Answers</button>
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
  APP._lastExerciseSession = s;
  APP.exerciseSession = null;
  // Hand the student's own score back; the session replaced it with the
  // generated task scores and the summary modal would otherwise sit over
  // the last one until a manual reload.
  SCORE.restorePreExerciseScore();
  _setExerciseUI(false);
  updateModeBanner();
  _validateModeState();
  RENDER.renderScore();
}

function closeModalExercise() {
  UI.closeModal();
  RENDER.renderScore();
}

function restartExerciseSession() {
  UI.closeModal();
  // endExerciseSession clears exerciseSession, so fall back to the session it
  // kept for exactly this button.
  const s = APP.exerciseSession || APP._lastExerciseSession;
  const savedType = s?.type;
  const savedDiff = s?.difficulty;
  if (savedType) startExerciseSession(savedType, savedDiff);
}

function reviewExerciseSession() {
  UI.closeModal();
  const s = APP.exerciseSession || APP._lastExerciseSession;
  if (!s || !s.completed.length) { UI.showToast('No exercises to review'); return; }

  let reviewIndex = 0;
  const completed = s.completed;

  function showReview(idx) {
    const c = completed[idx];
    if (!c) return;
    reviewIndex = idx;

    const typeLabel = TYPE_LABELS[c.type] || c.type;
    let questionHtml = '';

    if (c.type === EXERCISE_TYPES.NOTE_ID) {
      const pitch = c.target?.pitch;
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const pc = pitch % 12;
      const noteName = noteNames[pc];
      questionHtml = `<div class="pauta-text-center" style="font-size:20px;margin:12px 0;font-family:'Bravura',serif">${noteName}</div>`;
    } else if (c.type === EXERCISE_TYPES.INTERVAL_ID) {
      const bottom = c.target?.bottom;
      const top = c.target?.top;
      const semitones = c.target?.semitones;
      const dir = c.target?.direction;
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const bName = noteNames[bottom % 12];
      const tName = noteNames[top % 12];
      questionHtml = `<div class="pauta-text-center" style="font-size:18px;margin:8px 0">${bName} → ${tName}</div>
        <div class="pauta-text-center pauta-text-muted-sm">${semitones} semitones ${dir > 0 ? '↑' : '↓'}</div>`;
    } else if (c.type === EXERCISE_TYPES.RHYTHM_READ || c.type === EXERCISE_TYPES.RHYTHM_WS) {
      const beats = c.target?.beats || c.target?.durations;
      if (beats) {
        const symbols = beats.map(d => d === 'q' ? '♩' : d === 'h' ? '𝅗𝅥' : d === '8' ? '♪' : d === '16' ? '𝅘𝅥𝅮' : d === 'r' ? '𝄽' : '·');
        questionHtml = `<div class="pauta-text-center" style="font-size:20px;letter-spacing:8px;margin:12px 0;font-family:'Bravura',serif">${symbols.join(' ')}</div>`;
      }
    } else if (c.type === EXERCISE_TYPES.MELODY_DICT) {
      const notes = c.target?.notes;
      if (notes) {
        const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const names = notes.map(n => noteNames[n.pitch % 12]);
        questionHtml = `<div class="pauta-text-center" style="font-size:18px;margin:8px 0;letter-spacing:4px">${names.join(' ')}</div>`;
      }
    } else if (c.type === EXERCISE_TYPES.KEY_SIG_ID) {
      const ks = c.target?.keySig;
      const names = { '-7':'Cb','-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F','0':'C','1':'G','2':'D','3':'A','4':'E','5':'B','6':'F#','7':'C#' };
      const minorNames = { '-7':'Abm','-6':'Ebm','-5':'Bbm','-4':'Fm','-3':'Cm','-2':'Gm','-1':'Dm','0':'Am','1':'Em','2':'Bm','3':'F#m','4':'C#m','5':'G#m','6':'D#m','7':'A#m' };
      questionHtml = `<div class="pauta-text-center" style="font-size:18px;margin:8px 0">Key Signature: ${ks > 0 ? '♯'.repeat(ks) : ks < 0 ? '♭'.repeat(-ks) : '(none)'}</div>
        <div class="pauta-text-center pauta-text-muted-sm">Major: ${names[String(ks)]} · Minor: ${minorNames[String(ks)]}</div>`;
    }

    const isCorrect = c.ok;
    const userAns = c.answer;
    const correctAns = c.correctAnswer || c.questionLabel;
    const hint = c.hint;

    UI.makeModal(`
      <h2>Review: ${typeLabel} (${idx + 1}/${completed.length})</h2>
      <div class="pauta-card pauta-mb-md">
        <div style="font-weight:600;margin-bottom:6px">Question</div>
        ${questionHtml}
      </div>
      <div class="pauta-dlg-input-group pauta-row center wrap pauta-mb-md">
        <div style="padding:8px 16px;background:${isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(255,96,96,0.1)'};border-radius:var(--pauta-radius-md);border:1px solid ${isCorrect ? 'var(--pauta-success)' : '#ff6060'}">
          <div class="pauta-text-muted-sm pauta-text-center" style="font-weight:600">${isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}</div>
          <div class="pauta-text-center" style="font-size:16px;font-weight:700;color:${isCorrect ? 'var(--pauta-success)' : '#c05421'}">${UI.escHtml(userAns)}</div>
        </div>
        ${!isCorrect ? `
        <div style="padding:8px 16px;background:rgba(34,197,94,0.1);border-radius:var(--pauta-radius-md);border:1px solid var(--pauta-success)">
          <div class="pauta-text-muted-sm pauta-text-center" style="font-weight:600">Correct Answer</div>
          <div class="pauta-text-center" style="font-size:16px;font-weight:700;color:var(--pauta-success)">${UI.escHtml(correctAns)}</div>
        </div>` : ''}
      </div>
      ${hint ? `<div class="pauta-dlg-feedback-hint pauta-mb-md pauta-block" style="padding:8px 12px">${UI.escHtml(hint)}</div>` : ''}
      <div class="pauta-row center wrap">
        ${idx > 0 ? `<button class="modal-btn secondary" data-action="reviewPrev">← Previous</button>` : ''}
        ${idx < completed.length - 1 ? `<button class="modal-btn primary" data-action="reviewNext">Next →</button>` : `<button class="modal-btn primary" data-action="closeModal">Done</button>`}
        ${completed.length > 1 ? `<button class="modal-btn secondary" data-action="closeModal">Close Review</button>` : ''}
      </div>
    `);
  }

  // Register handlers for review navigation. Actions are dispatched through
  // _ACTION_MAP, so this must call the local registrar, not window.
  _registerAction('reviewPrev', () => { UI.closeModal(); showReview(reviewIndex - 1); });
  _registerAction('reviewNext', () => { UI.closeModal(); showReview(reviewIndex + 1); });

  showReview(0);
}


// ── Exercise Presenters ─────────────────────────────────────────
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
  container.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;background:rgba(247,243,237,0.98);border:1px solid rgba(204,24,69,0.2);border-radius:12px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);display:flex;flex-direction:column;align-items:center;gap:12px;min-width:360px';
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
    btn.style.cssText = 'padding:12px 20px;font-size:15px;font-weight:600;background:#f7f3ed;border:2px solid rgba(204,24,69,0.2);border-radius:8px;cursor:pointer;transition:all 0.15s;color:var(--pauta-text);font-family:inherit';
    btn.addEventListener('click', () => handler(opt, correctAnswer, container));
    btn.addEventListener('mouseover', () => {
      if (!btn.dataset.answered) {
        btn.style.background = 'rgba(204,24,69,0.1)';
        btn.style.borderColor = 'rgba(204,24,69,0.4)';
      }
    });
    btn.addEventListener('mouseout', () => {
      if (!btn.dataset.answered) {
        btn.style.background = '#f7f3ed';
        btn.style.borderColor = 'rgba(204,24,69,0.2)';
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
    btn.style.cssText = 'padding:16px 24px;font-size:18px;font-weight:600;background:#f7f3ed;border:2px solid rgba(204,24,69,0.2);border-radius:8px;cursor:pointer;transition:all 0.15s;color:var(--pauta-text);font-family:inherit';
    btn.addEventListener('click', () => _handleNoteChoice(opt, ex.target.pitch, container));
    btn.addEventListener('mouseover', () => {
      if (!btn.dataset.answered) {
        btn.style.background = 'rgba(204,24,69,0.1)';
        btn.style.borderColor = 'rgba(204,24,69,0.4)';
      }
    });
    btn.addEventListener('mouseout', () => {
      if (!btn.dataset.answered) {
        btn.style.background = '#f7f3ed';
        btn.style.borderColor = 'rgba(204,24,69,0.2)';
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
  
  // Draw treble clef (Note Drills use treble clef positioning)
  const clef = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  clef.setAttribute('x', '28');
  clef.setAttribute('y', '68');
  clef.setAttribute('font-size', '44');
  clef.setAttribute('fill', 'var(--pauta-text)');
  clef.textContent = '𝄞';
  svg.appendChild(clef);

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
  const correctName = noteNames[correctPc];

  const options = [correctName];
  const usedNames = new Set([correctName]);
  
  // Add nearby notes by pitch class
  for (let pcOffset of [-1, 1, -2, 2]) {
    const rawPc = correctPc + pcOffset;
    const pc = (rawPc + 12) % 12;
    const name = noteNames[pc];
    if (!usedNames.has(name) && options.length < 4) {
      options.push(name);
      usedNames.add(name);
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
  const correctName = noteNames[correctPc];
  
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
  const score = SCORE.createScore({title: 'Note Construction', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  score.parts[0].staves[0].measures[0].notes = [SCORE.mkRest('w')];
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
  UI.showToast('Tap on the staff to place your note!');
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
  const userAnswer = names[pc];
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
    UI.showToast(`Leveling up to ${newDiff} — great progress!`);
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
      UI.showToast(`Easing to ${newDiff} — keep going!`);
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
  const score = SCORE.createScore({title: 'Interval Training', instruments: [instr], ts: {num:4,den:4}, ks: 0});
  score.parts[0].staves[0].measures[0].notes = [
    SCORE.mkNote(ex.target.bottom, 'q', 0, midiAutoAcc(ex.target.bottom)),
    SCORE.mkNote(ex.target.top, 'q', 0, midiAutoAcc(ex.target.top)),
  ];
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
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

function _durBeats(dur, dots) {
  const base = dur === 'w' ? 4 : dur === 'h' ? 2 : dur === 'q' ? 1 : dur === '8' ? 0.5 : dur === '16' ? 0.25 : 1;
  return dots ? base * 1.5 : base;
}

// Shared tap-pad grader for rhythm exercises: records tap timestamps and
// compares them to the expected beat times.
function _showRhythmTapPad(expectedTimes, beatDurMs, onGrade) {
  const existing = document.getElementById('rhythm-tap-pad');
  if (existing) existing.remove();

  const pad = document.createElement('div');
  pad.id = 'rhythm-tap-pad';
  pad.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:200;background:rgba(247,243,237,0.98);border:1px solid rgba(204,24,69,0.2);border-radius:12px;padding:12px 16px;box-shadow:0 2px 12px rgba(0,0,0,0.08);display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;';

  const tapBtn = document.createElement('button');
  tapBtn.id = 'rtp-tap';
  tapBtn.textContent = 'Tap';
  tapBtn.style.cssText = 'padding:16px 32px;font-size:20px;font-weight:700;background:var(--pauta-primary);color:#fff;border:none;border-radius:10px;cursor:pointer;min-width:120px;';

  const counter = document.createElement('span');
  counter.id = 'rtp-counter';
  counter.style.cssText = 'font-size:14px;font-weight:600;color:var(--pauta-text);min-width:80px;text-align:center;';
  counter.textContent = `0 / ${expectedTimes.length} taps`;

  const checkBtn = document.createElement('button');
  checkBtn.id = 'rtp-check';
  checkBtn.textContent = 'Check';
  checkBtn.style.cssText = 'padding:10px 18px;font-size:14px;font-weight:600;background:#f7f3ed;border:2px solid rgba(204,24,69,0.2);border-radius:8px;cursor:pointer;';

  const resetBtn = document.createElement('button');
  resetBtn.id = 'rtp-reset';
  resetBtn.textContent = 'Reset';
  resetBtn.style.cssText = 'padding:10px 18px;font-size:14px;font-weight:600;background:#f7f3ed;border:2px solid rgba(204,24,69,0.2);border-radius:8px;cursor:pointer;';

  pad.appendChild(tapBtn);
  pad.appendChild(counter);
  pad.appendChild(checkBtn);
  pad.appendChild(resetBtn);
  document.body.appendChild(pad);

  const taps = [];
  let started = false;
  let startMs = 0;

  function updateCounter() {
    counter.textContent = `${taps.length} / ${expectedTimes.length} taps`;
  }

  tapBtn.addEventListener('click', () => {
    const now = performance.now();
    if (!started) { started = true; startMs = now; }
    taps.push(now - startMs);
    updateCounter();
    if (taps.length >= expectedTimes.length) {
      // auto-grade shortly after the last tap
      setTimeout(() => grade(), 400);
    }
  });

  resetBtn.addEventListener('click', () => {
    taps.length = 0;
    started = false;
    startMs = 0;
    updateCounter();
  });

  function grade() {
    const tolerance = Math.max(150, beatDurMs * 0.3);
    let matches = 0;
    const used = new Array(taps.length).fill(false);
    for (const exp of expectedTimes) {
      let best = -1, bestDist = Infinity;
      for (let i = 0; i < taps.length; i++) {
        if (used[i]) continue;
        const d = Math.abs(taps[i] - exp);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      if (best >= 0 && bestDist <= tolerance) { matches++; used[best] = true; }
    }
    const pct = expectedTimes.length > 0 ? Math.round(100 * matches / expectedTimes.length) : 0;
    // penalise extra taps
    const extraPenalty = Math.max(0, taps.length - expectedTimes.length);
    const finalPct = Math.max(0, pct - extraPenalty * 5);
    onGrade(finalPct, matches, expectedTimes.length, taps.length);
    // remove pad after grading
    setTimeout(() => { const p = document.getElementById('rhythm-tap-pad'); if (p) p.remove(); }, 1500);
  }

  checkBtn.addEventListener('click', grade);
}

function _presentRhythmRead(ex) {
  const score = SCORE.createScore({title: 'Rhythm Reading', instruments: ['Snare Drum'], ts: {num:4,den:4}, ks: 0});
  const notes = ex.target.durations.map(d => SCORE.mkNote(67, d));
  score.parts[0].staves[0].measures[0].notes = notes;
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
  UI.showToast('Read the rhythm, then tap along with the beat.');

  // Build expected tap times (one per note) at 100 BPM
  const beatDurMs = 60000 / (APP.tempo || 100);
  const expected = [];
  let t = 0;
  ex.target.durations.forEach(d => {
    expected.push(t);
    t += _durBeats(d, 0) * beatDurMs;
  });

  const s = APP.exerciseSession;
  _showRhythmTapPad(expected, beatDurMs, (pct, matches, expectedCount, tapCount) => {
    if (!s || !s.current) return;
    s.totalCount++;
    if (pct >= 80) { s.correctCount++; s.streak++; if (s.streak > s.maxStreak) s.maxStreak = s.streak; }
    else { s.streak = 0; }
    s.completed.push({ type: EXERCISE_TYPES.RHYTHM_READ, answer: `${matches}/${expectedCount}`, ok: pct >= 80, hint: 'Compare your taps to the rhythm.' });
    _updateScoreDisplay();
    if (pct >= 80) {
      _showSuccessBanner(`✓ ${matches}/${expectedCount} taps matched!`, { correctAnswer: ex.target.durations.join(' '), streak: s.streak });
      const session = s;
      const exType = ex.type;
      setTimeout(() => {
        if (!APP.exerciseSession || APP.exerciseSession !== session) return;
        _hideSuccessBanner();
        session.current = generateExercise(exType, session.difficulty);
        _presentExercise(session.current);
      }, 1500);
    } else {
      _showExerciseFeedback(ex, `${matches}/${expectedCount} taps matched`);
    }
  });
}

function _presentRhythmWorksheet(ex) {
  const mx = ex.target.measures;
  const score = SCORE.createScore({title: 'Rhythm Dictation', instruments: ['Snare Drum'], ts: {num:4,den:4}, ks: 0});
  const stave = score.parts[0].staves[0];
  stave.measures = [];
  for (let m = 0; m < mx; m++) {
    stave.measures.push({
      timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
      keySig: m === 0 ? 0 : null, lineBreak: (m > 0 && m % 4 === 0),
      notes: [SCORE.mkRest('w')],
    });
  }
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
  _renderRhythmBeatGrid(ex);
}

function _presentMelodyDict(ex) {
  // Phase 1: blank score with key signature — student hears but does NOT see the melody
  const instr = _kitDefaultInstrument();
  const ks = ex.target.keySig || 0;
  const blankScore = SCORE.createScore({title: 'Melody Dictation', instruments: [instr], ts: {num:4,den:4}, ks: ks});
  
  // Fill with whole-measure rests so the score has structure but no pitches
  const totalBeats = ex.target.notes.reduce((s, n) => s + durBeats(n.duration, 0, null), 0);
  const measureCount = Math.max(1, Math.ceil(totalBeats / 4));
  blankScore.parts[0].staves[0].measures = [];
  for (let i = 0; i < measureCount; i++) {
    blankScore.parts[0].staves[0].measures.push({
      timeSigNum: i === 0 ? 4 : null, timeSigDen: i === 0 ? 4 : null,
      keySig: i === 0 ? ks : null, lineBreak: false, notes: [SCORE.mkRest('w')]
    });
  }
  SCORE.adoptScore(blankScore, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();

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
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:200;display:flex;align-items:center;background:rgba(247,243,237,0.98);border:1px solid rgba(204,24,69,0.2);border-radius:8px;padding:8px 14px;box-shadow:0 2px 12px rgba(0,0,0,0.08);font-size:13px;color:var(--pauta-text-muted);' + (extraCss || '');
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
    <button class="modal-btn secondary" id="dictation-ready" style="padding:6px 12px;font-size:var(--pauta-text-md)">I'm Ready</button>
    <div class="pauta-dlg-input-group" style="margin-left:auto">
      <label style="font-size:11px;color:var(--pauta-text-muted);font-weight:600">♩</label>
      <input type="range" id="dictation-tempo" min="40" max="200" value="${currentTempo}" style="width:100px" aria-label="Tempo">
      <span style="font-size:12px;font-weight:700;color:var(--pauta-primary);min-width:36px;text-align:right" id="dictation-tempo-val">${currentTempo}</span> BPM
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
  countdown.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:2001;font-size:72px;font-weight:700;color:var(--pauta-primary);text-shadow:0 4px 20px rgba(204,24,69,0.3);opacity:0;transition:all 0.3s ease;pointer-events:none';
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
  UI.showToast('Playing melody…');
}

function _startDictationNotate() {
  const bar = document.getElementById('dictation-bar');
  if (bar) bar.remove();
  const s = APP.exerciseSession;
  if (s) s._dictationPhase = 'notate';
  // Show a floating submit bar
  _showDictationCheckBar();
    UI.showToast('Write down the notes you heard — tap the palette or play your instrument!');
}

function _showDictationCheckBar() {
  const bar = _createFeedbackBar('dictation-check-bar', 'gap:10px;flex-wrap:wrap');
  const currentTempo = APP.tempo || 120;
  bar.innerHTML = `<span style="font-weight:600;white-space:nowrap">Done notating?</span>
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

  UI.makeModal(`
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
  UI.closeModal();
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
  const score = SCORE.createScore({title: 'Key Signature ID', instruments: [instr], ts: {num:4,den:4}, ks: ex.target.keySig});
  score.parts[0].staves[0].measures[0].notes = [SCORE.mkRest('w')];
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
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
  const score = SCORE.createScore({title: 'Scale Gym', instruments: [instr], ts: {num:4,den:4}, ks});
  const stave = score.parts[0].staves[0];
  stave.measures = [];
  const notesPerMeasure = 4;
  for (let m = 0; m < Math.ceil(notes.length / notesPerMeasure); m++) {
    const slice = notes.slice(m * notesPerMeasure, m * notesPerMeasure + notesPerMeasure);
    stave.measures.push({
      timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
      keySig: m === 0 ? ks : null, lineBreak: m > 0 && m % 4 === 0,
      notes: slice.map(p => SCORE.mkNote(p, 'q', 0, midiAutoAcc(p, ks))),
    });
  }
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
  _showMCGrid(_generateScaleOptions(ex), ex.answer, _handleScaleChoice, 'Name this scale');
  setTimeout(() => {
    UI.showToast('Listen to the scale, then name it!');
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
    UI.showToast(`Leveling up to ${newDiff} — great progress!`);
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
      UI.showToast(`Easing to ${newDiff} — keep going!`);
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
  if (streak === 3) milestone = 'Awesome!';
  else if (streak === 5) milestone = 'Amazing!';
  else if (streak >= 10) milestone = 'Incredible!';

  const encouragements = [
    'Great job!', 'Nailed it!', 'Nice work!',
    'Keep it up!', 'You got this!', 'Fantastic!',
    'Way to go!', 'Super!', 'Brilliant!'
  ];
  const cheer = encouragements[Math.floor(Math.random() * encouragements.length)];

  const el = document.createElement('div');
  el.id = 'exercise-success-banner';
  el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%) translateY(-12px) scale(0.9);z-index:2000;background:linear-gradient(135deg,var(--pauta-success),var(--pauta-kid-lime));color:#fff;padding:14px 32px;border-radius:var(--pauta-radius-bubble);font-size:16px;font-weight:700;box-shadow:0 4px 24px rgba(34,197,94,0.4);pointer-events:none;white-space:nowrap;font-family:var(--pauta-font-sans);text-align:center';
  el.innerHTML = `<div>${cheer} ${UI.escHtml(msg)}</div>${correctAnswer ? `<div style="font-size:11px;opacity:0.85;margin-top:2px">Answer: ${UI.escHtml(correctAnswer)}</div>` : ''}${milestone ? `<div style="font-size:13px;margin-top:3px;opacity:0.9">${milestone}</div>` : ''}`;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.animation = 'celebrate-bounce 0.4s var(--pauta-bounce) forwards';
  });

  setTimeout(() => {
    el.style.animation = 'celebrate-bounce-out 0.25s ease forwards';
    setTimeout(() => { if (el.parentNode) el.remove(); }, 260);
  }, 1200);
}

function _hideSuccessBanner() {
  const el = document.getElementById('exercise-success-banner');
  if (el) el.style.opacity = '0';
}

function _showLevelUpMoment(correctCount, pct) {
  const existing = document.getElementById('level-up-moment');
  if (existing) existing.remove();
  const existingConfetti = document.getElementById('level-up-confetti');
  if (existingConfetti) existingConfetti.remove();

  const s = APP.exerciseSession;
  if (!s) return;

  const messages = [
    { threshold: 5, title: 'Warming Up!', desc: 'You\'re getting the hang of it.' },
    { threshold: 10, title: 'Halfway There!', desc: 'Great consistency. Keep going!' },
    { threshold: 15, title: 'Solid Progress!', desc: 'Your accuracy is improving.' },
    { threshold: 20, title: 'Building Mastery!', desc: 'This skill is becoming automatic.' },
    { threshold: 25, title: 'Almost There!', desc: 'You\'re approaching mastery.' },
    { threshold: 30, title: 'Mastery Zone!', desc: 'Excellent work. You\'ve got this!' },
  ];

  const msg = messages.find(m => m.threshold === correctCount) || messages[0];

  // Confetti dots
  const confettiColors = ['var(--pauta-kid-pink)', 'var(--pauta-kid-blue)', 'var(--pauta-kid-lime)', 'var(--pauta-kid-yellow)', 'var(--pauta-kid-purple)', 'var(--pauta-primary)'];
  const confettiContainer = document.createElement('div');
  confettiContainer.id = 'level-up-confetti';
  confettiContainer.className = 'pauta-confetti-container';
  for (let i = 0; i < 24; i++) {
    const dot = document.createElement('div');
    dot.className = 'pauta-confetti-dot';
    dot.style.cssText = `left:${Math.random() * 200 - 100}px;top:${Math.random() * 40 - 20}px;background:${confettiColors[i % confettiColors.length]};animation-delay:${Math.random() * 0.3}s;width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px`;
    confettiContainer.appendChild(dot);
  }
  document.body.appendChild(confettiContainer);

  const el = document.createElement('div');
  el.id = 'level-up-moment';
  el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:2001;background:linear-gradient(135deg,var(--pauta-primary),var(--pauta-primary-light));color:#fff;padding:32px 48px;border-radius:var(--pauta-radius-lg);box-shadow:0 12px 40px rgba(204,24,69,0.4);text-align:center;min-width:280px';
  el.innerHTML = `
    <div style="font-size:24px;font-weight:700;margin-bottom:8px">${msg.title}</div>
    <div style="font-size:14px;opacity:0.9;margin-bottom:12px">${msg.desc}</div>
    <div style="font-size:13px;opacity:0.8">${correctCount} correct · ${pct}% accuracy</div>
  `;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.animation = 'pop-in 0.4s var(--pauta-bounce) forwards';
  });

  setTimeout(() => {
    el.style.animation = 'pop-out 0.25s ease forwards';
    if (confettiContainer.parentNode) {
      confettiContainer.style.transition = 'opacity 0.3s';
      confettiContainer.style.opacity = '0';
      setTimeout(() => { if (confettiContainer.parentNode) confettiContainer.remove(); }, 300);
    }
    setTimeout(() => { if (el.parentNode) el.remove(); }, 260);
  }, 2500);
}

function _showExerciseFeedback(ex, userAnswer) {
  const existing = document.getElementById('exercise-feedback-bar');
  if (existing) existing.remove();

  const correctLabel = ex.answerLabel || ex.answer;
  const hintText = UI.escHtml(ex.hint || '');

  const extraNote = (ex.type === EXERCISE_TYPES.KEY_SIG_ID)
    ? (ex.askMinor ? ` (also ${UI.escHtml(ex.answerMajor)})`
                  : ` (also ${UI.escHtml(ex.answerMinor)})`)
    : '';

  const bar = document.createElement('div');
  bar.id = 'exercise-feedback-bar';
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%) translateY(20px);z-index:200;display:flex;align-items:flex-start;gap:10px;background:rgba(255,251,235,0.98);border:1px solid rgba(217,160,60,0.3);border-radius:var(--pauta-radius-lg);padding:12px 16px;box-shadow:0 3px 16px rgba(0,0,0,0.09);font-size:var(--pauta-text-lg);color:var(--pauta-text-muted);flex-wrap:wrap;max-width:92vw;opacity:0;transition:opacity 0.3s ease, transform 0.3s ease;font-family:var(--pauta-font-sans)';
  bar.innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="pauta-dlg-input-group" style="margin-bottom:6px;flex-wrap:wrap">
        <span style="font-weight:700;color:#b45309;font-size:14px">Not quite</span>
        <div class="pauta-dlg-input-group" style="font-size:12px;flex-wrap:wrap">
          <span class="pauta-dlg-feedback-wrong">You: <b>${UI.escHtml(userAnswer)}</b></span>
          <span style="color:rgba(74,85,104,0.4)">→</span>
          <span class="pauta-dlg-feedback-correct">Correct: <b>${UI.escHtml(correctLabel)}</b>${extraNote}</span>
        </div>
      </div>
      ${hintText ? `
        <details open style="margin-top:2px">
          <summary style="cursor:pointer;font-size:11px;color:rgba(74,85,104,0.6);font-weight:600;user-select:none">Why? ▸</summary>
          <div style="margin-top:4px;font-size:11px;color:rgba(74,85,104,0.7);line-height:1.5">${hintText}</div>
        </details>` : ''}
    </div>
    <div class="pauta-dlg-input-group" style="flex-shrink:0;align-self:center">
      <button class="modal-btn" data-action="skipExercise" style="padding:4px 10px;font-size:12px;background:transparent;border:1px solid rgba(204,24,69,0.2);color:var(--pauta-text-muted);border-radius:var(--pauta-radius-sm)">Skip</button>
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
  UI.closeModal();
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
  UI.closeModal();
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
    ? `<span class="score-streak">${s.streak}</span>`
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

function _setExerciseUI(enabled, type) {
  document.body.classList.toggle('exercise-mode', enabled);
  const transport = document.getElementById('transport-bar');
  if (transport) transport.style.opacity = enabled ? '0.5' : '';
  // Hide the palette during other exercises to reduce distraction, but keep
  // it visible during Melody Dictation so the user can input notes.
  const pal = document.getElementById('palette');
  if (pal) pal.style.display = (enabled && type !== EXERCISE_TYPES.MELODY_DICT) ? 'none' : '';
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
    exitEl.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:201;padding:8px 16px;font-size:13px;background:rgba(224,104,80,0.1);border:1.5px solid rgba(224,104,80,0.3);color:var(--pauta-primary-light);border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.15s;font-family:var(--pauta-font-sans);box-shadow:0 2px 8px rgba(0,0,0,0.08);';
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
  if (s.playsLeft !== undefined && s.playsLeft <= 0) { UI.showToast('No more plays — try again from the start!'); return; }

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

// Scores the rendered beat grid from the DOM alone (no session), so the
// diagnostic assessment can reuse it — its rhythm question runs without an
// APP.exerciseSession for checkRhythmWorksheet() to record into.
function _scoreRhythmGrid() {
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

  const checkBtn = document.getElementById('rg-check-btn');
  if (checkBtn) {
    checkBtn.textContent = `${pct}% — ${correct}/${total}`;
    checkBtn.style.background = pct === 100 ? 'var(--pauta-success)' : pct >= 80 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)';
    checkBtn.style.color = '#fff';
    checkBtn.style.borderColor = 'transparent';
    checkBtn.disabled = true;
  }

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

  return { pct, correct, total, results };
}

function checkRhythmWorksheet() {
  const s = APP.exerciseSession;
  if (!s || !s.current || s.current.type !== EXERCISE_TYPES.RHYTHM_WS) return;

  const { pct, correct, total } = _scoreRhythmGrid();

  s.totalCount++;
  if (pct === 100) { s.correctCount++; s.streak++; if (s.streak > s.maxStreak) s.maxStreak = s.streak; }
  else { s.streak = 0; }
  s.completed.push({ type: 'rhythm_worksheet', answer: correct + '/' + total, ok: pct === 100, hint: 'Compare each beat carefully.' });
  _updateScoreDisplay();
}

function showRhythmWorksheetDialog() {
  if (APP.exerciseMode) { UI.showToast('Finish your exercise first, then come back!'); return; }
  const diffs = ['beginner', 'intermediate', 'advanced'];
  const currentDiff = APP.exerciseDifficulty || 'beginner';

  UI.makeModal(`
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
      UI.closeModal();
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
  updateModeBanner();
  _presentRhythmWorksheet(ex);
  _validateModeState();
}

// ── Main Exercise Dialog ───────────────────────────────────────
function showExerciseDialog() {
  if (APP.exerciseMode) { UI.showToast('Finish your exercise first, then come back!'); return; }

  const results = _loadResults();
  const byType = {};
  results.forEach(r => { if (!byType[r.type]) byType[r.type] = []; byType[r.type].push(r); });

  const currentDiff = APP.exerciseDifficulty || 'beginner';

  // Categories with exercises
  const categories = [
    {
      name: 'Rhythm',
      color: 'var(--pauta-kid-pink)',
      exercises: [
        {key: EXERCISE_TYPES.RHYTHM_WORKOUT, icon:'', label:'Rhythm Workout', desc:'Random rhythms — customize time sig, tempo, note values'},
        {key: EXERCISE_TYPES.RHYTHM_READ,  icon:'𝅘𝅥𝅮', label:'Rhythm Reading', desc:'Read and clap patterns'},
        {key: EXERCISE_TYPES.RHYTHM_WS,    icon:'', label:'Rhythm Dictation', desc:'Hear it, mark each beat'},
      ]
    },
    {
      name: 'Pitch & Theory',
      color: 'var(--pauta-kid-blue)',
      exercises: [
        {key: EXERCISE_TYPES.NOTE_ID,      icon:'', label:'Note Drills', desc:'Name notes on the staff'},
        {key: EXERCISE_TYPES.INTERVAL_ID,  icon:'↔',  label:'Interval Training', desc:'Identify intervals'},
        {key: EXERCISE_TYPES.KEY_SIG_ID,   icon:'♭♯', label:'Key Sig Drills', desc:'Name keys from signatures'},
        {key: EXERCISE_TYPES.SCALE_ID,     icon:'', label:'Scale Gym', desc:'Hear scales and modes'},
      ]
    },
    {
      name: 'Ear Training',
      color: 'var(--pauta-kid-lime)',
      exercises: [
        {key: EXERCISE_TYPES.MELODY_DICT,  icon:'', label:'Melody Dictation', desc:'Hear it, notate it'},
      ]
    },
  ];

  // Quick stats
  const totalSessions = results.length;
  const overallPct = results.length > 0 ? Math.round(results.reduce((s,r) => s + r.pct, 0) / results.length) : 0;

  UI.makeModal(`
    <div class="pauta-modal" style="border-radius:var(--pauta-radius-lg)">
      <div class="pauta-modal-header">
        <h2 class="pauta-modal-title" style="font-size:22px;text-align:center">Practice Gym</h2>
        <p class="pauta-modal-subtitle" style="text-align:center;font-size:14px">Let's practice and get better together!</p>

        ${totalSessions > 0 ? `
        <div class="pauta-stats" style="font-size:14px">
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
        <div class="pauta-hero" data-action="showRhythmWorkoutDialog" style="border-radius:var(--pauta-radius-lg)">
          <div class="pauta-hero-badge" style="background:var(--pauta-kid-yellow);color:#7c5e00">Most Popular</div>
          <div class="pauta-hero-title">Rhythm Workout</div>
          <div class="pauta-hero-desc">Make your own rhythm patterns with fun sounds!</div>
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
                let starCount = 0;
                if (sessions > 0) {
                  const lastPct = typeResults[typeResults.length - 1].pct;
                  scoreColor = lastPct >= 80 ? 'var(--pauta-success)' : lastPct >= 60 ? 'var(--pauta-warning)' : 'var(--pauta-primary-light)';
                  scoreText = lastPct + '%';
                  starCount = lastPct >= 80 ? 3 : lastPct >= 60 ? 2 : 1;
                }
                return `
                  <div class="pauta-card" style="--pauta-card-color:${cat.color};border-radius:var(--pauta-radius-md)" data-action="startExerciseSession" data-type="${ex.key}" data-diff="${currentDiff}">
                    ${scoreText ? `<span class="pauta-card-badge" style="background:${scoreColor}18;color:${scoreColor}">${scoreText}</span>` : ''}
                    <div class="pauta-card-title"><span style="font-size:15px">${ex.icon}</span>${ex.label}</div>
                    <div class="pauta-card-desc">${ex.desc}</div>
                    <div class="pauta-card-meta">
                      ${sessions > 0
                        ? `<span class="pauta-star">${'★'.repeat(starCount)}${'☆'.repeat(3-starCount)}</span>`
                        : `<span class="pauta-star empty">☆☆☆</span>`}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="pauta-modal-footer">
        <button class="modal-btn secondary" data-action="showCurriculumDialog">Curriculum</button>
        <button class="modal-btn secondary" data-action="showStudentProgress">Progress</button>
        <button class="modal-btn secondary" data-action="closeModal">Close</button>
      </div>
    </div>
  `);
}

function selectExerciseDifficulty(diff) {
  APP.exerciseDifficulty = diff;
  // Re-render dialog with new difficulty highlighted
  showExerciseDialog();
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


// ═══════════════════════════════════════════════════════════════════
// Rhythm games — Rhythm Randomizer + Poison Rhythm (shared engine)
// Grid unit = one sixteenth note; all onsets/durations are integers.
// Globals used: VF (VexFlow 3), LS, UI, getAudioCtx, scheduleNote.
// ═══════════════════════════════════════════════════════════════════

// ── i18n (EN / PT / FR) ───────────────────────────────────────────
const _RG_I18N = {
  en: {
    randTitle:'Rhythm Randomizer', poisonTitle:'Poison Rhythm', close:'Close',
    gen:'New rhythm', echo:'Echo', stop:'Stop', tapBtn:'TAP',
    ts:'Time signature', meas:'Measures', tempo:'Tempo (BPM)', vals:'Note values', opts:'Options',
    countIn:'Count-in', counting:'Show counting', hideEcho:'Hide notation while echoing', more:'More settings',
    v_h:'Half', v_dq:'Dotted quarter', v_q:'Quarter', v_8:'Eighth', v_16:'Sixteenth', v_rq:'Quarter rest', v_r8:'Eighth rest',
    st_ready:'Ready', st_count:'Count-in', st_listen:'Listen…', st_play:'Playing…', st_echo:'Your turn — echo!', st_stopped:'Stopped',
    hits:'Hits', extra:'Extra taps', perfect:'Perfect!',
    poisonTag:"Don't echo this one!", learn:'Learn the poison rhythm, then press Start.',
    start:'Start', hear:'Hear poison', newPoison:'New poison',
    other:'The other rhythms are', o_diff:'Different', o_tricky:'Tricky: one beat off',
    freq:'The poison comes', f_now:'Now and then', f_often:'Often',
    len:'Length of each rhythm', beats4:'4 beats', beats8:'8 beats',
    pause:'Pause after the poison', screen:'When the poison comes up, the screen says',
    m_sit:'Tell them to sit down', m_poison:'Just say it was the poison', m_custom:'My own message', customPh:'Your message',
    msgPoison:'That was the poison!', msgSit:'Sit down!', showPlay:'Show rhythm while it plays', showEcho:'Show rhythm while echoing', cont:'Continue',
    sc_echoed:'Echoed', sc_missed:'Missed', sc_poison:'Poison tapped', sc_avoided:'Poison avoided',
    r_good:'Good echo!', r_miss:'Not quite', r_avoid:'Poison avoided!',
    dictTitle:'Rhythm Dictation', dictHelp:'Listen, then place the rhythm on the beats.',
    playPhrase:'Play the phrase', playMine:'Play my answer', check:'Check', showAnswer:'Show answer', nextPhrase:'Next phrase', clear:'Clear',
    st_mine:'Playing your answer…', st_readyD:'Listen, then write what you heard.', st_checked:'Checked', st_empty:'Place some tiles first.',
    beatsCorrect:'beats correct', allCorrect:'All correct!', session:'Session', phrases:'phrases',
    view:'Show', viewNotation:'Notation', viewPictures:'Pictures', viewBoth:'Both',
    sayWith:'Say with', sayCount:'Counting', saySyll:'Syllables', sayHide:'Hide',
    hint:'Give the first beat as a hint', yourAnswer:'Your answer', correctAnswer:'Correct rhythm', tileTip:'Tap a tile, then tap a beat.', rdHint:'Hint'
  },
  pt: {
    randTitle:'Ritmo Aleatório', poisonTitle:'Ritmo Veneno', close:'Fechar',
    gen:'Novo ritmo', echo:'Eco', stop:'Parar', tapBtn:'BATER',
    ts:'Compasso', meas:'Compassos', tempo:'Andamento (BPM)', vals:'Figuras', opts:'Opções',
    countIn:'Contagem inicial', counting:'Mostrar contagem', hideEcho:'Ocultar partitura durante o eco', more:'Mais configurações',
    v_h:'Mínima', v_dq:'Semínima pontuada', v_q:'Semínima', v_8:'Colcheia', v_16:'Semicolcheia', v_rq:'Pausa de semínima', v_r8:'Pausa de colcheia',
    st_ready:'Pronto', st_count:'Contagem', st_listen:'Escute…', st_play:'Tocando…', st_echo:'Sua vez — eco!', st_stopped:'Parado',
    hits:'Acertos', extra:'Toques extras', perfect:'Perfeito!',
    poisonTag:'Não faça eco deste!', learn:'Aprenda o ritmo veneno e aperte Iniciar.',
    start:'Iniciar', hear:'Ouvir veneno', newPoison:'Novo veneno',
    other:'Os outros ritmos são', o_diff:'Diferentes', o_tricky:'Difíceis: um tempo diferente',
    freq:'O veneno aparece', f_now:'De vez em quando', f_often:'Com frequência',
    len:'Duração de cada ritmo', beats4:'4 tempos', beats8:'8 tempos',
    pause:'Pausar após o veneno', screen:'Quando o veneno aparece, a tela diz',
    m_sit:'Mandar sentar', m_poison:'Só dizer que era o veneno', m_custom:'Minha mensagem', customPh:'Sua mensagem',
    msgPoison:'Era o veneno!', msgSit:'Sente-se!', showPlay:'Mostrar o ritmo ao tocar', showEcho:'Mostrar o ritmo durante o eco', cont:'Continuar',
    sc_echoed:'Ecos certos', sc_missed:'Erros', sc_poison:'Veneno batido', sc_avoided:'Veneno evitado',
    r_good:'Bom eco!', r_miss:'Quase', r_avoid:'Veneno evitado!',
    dictTitle:'Ditado Rítmico', dictHelp:'Escute e coloque o ritmo nos tempos.',
    playPhrase:'Ouvir a frase', playMine:'Ouvir minha resposta', check:'Verificar', showAnswer:'Mostrar resposta', nextPhrase:'Próxima frase', clear:'Limpar',
    st_mine:'Tocando sua resposta…', st_readyD:'Escute e escreva o que ouviu.', st_checked:'Verificado', st_empty:'Coloque algumas peças primeiro.',
    beatsCorrect:'tempos certos', allCorrect:'Tudo certo!', session:'Sessão', phrases:'frases',
    view:'Mostrar', viewNotation:'Notação', viewPictures:'Figuras', viewBoth:'Ambos',
    sayWith:'Dizer com', sayCount:'Contagem', saySyll:'Sílabas', sayHide:'Ocultar',
    hint:'Dar o primeiro tempo como dica', yourAnswer:'Sua resposta', correctAnswer:'Ritmo correto', tileTip:'Toque numa peça e depois num tempo.', rdHint:'Dica'
  },
  fr: {
    randTitle:'Rythme aléatoire', poisonTitle:'Rythme poison', close:'Fermer',
    gen:'Nouveau rythme', echo:'Écho', stop:'Arrêter', tapBtn:'FRAPPER',
    ts:'Mesure', meas:'Mesures', tempo:'Tempo (BPM)', vals:'Valeurs', opts:'Options',
    countIn:'Décompte', counting:'Afficher le comptage', hideEcho:'Masquer la partition pendant l’écho', more:'Plus de réglages',
    v_h:'Blanche', v_dq:'Noire pointée', v_q:'Noire', v_8:'Croche', v_16:'Double-croche', v_rq:'Soupir', v_r8:'Demi-soupir',
    st_ready:'Prêt', st_count:'Décompte', st_listen:'Écoutez…', st_play:'Lecture…', st_echo:'À vous — écho !', st_stopped:'Arrêté',
    hits:'Réussis', extra:'Frappes en trop', perfect:'Parfait !',
    poisonTag:'Ne pas répéter celui-ci !', learn:'Apprenez le rythme poison, puis appuyez sur Démarrer.',
    start:'Démarrer', hear:'Écouter le poison', newPoison:'Nouveau poison',
    other:'Les autres rythmes sont', o_diff:'Différents', o_tricky:'Pièges : un temps change',
    freq:'Le poison arrive', f_now:'De temps en temps', f_often:'Souvent',
    len:'Durée de chaque rythme', beats4:'4 temps', beats8:'8 temps',
    pause:'Pause après le poison', screen:'Quand le poison arrive, l’écran dit',
    m_sit:'Dire de s’asseoir', m_poison:'Dire que c’était le poison', m_custom:'Mon message', customPh:'Votre message',
    msgPoison:'C’était le poison !', msgSit:'Assis !', showPlay:'Afficher le rythme pendant la lecture', showEcho:'Afficher le rythme pendant l’écho', cont:'Continuer',
    sc_echoed:'Échos réussis', sc_missed:'Ratés', sc_poison:'Poison frappé', sc_avoided:'Poison évité',
    r_good:'Bon écho !', r_miss:'Presque', r_avoid:'Poison évité !',
    dictTitle:'Dictée rythmique', dictHelp:'Écoutez, puis placez le rythme sur les temps.',
    playPhrase:'Écouter la phrase', playMine:'Écouter ma réponse', check:'Vérifier', showAnswer:'Montrer la réponse', nextPhrase:'Phrase suivante', clear:'Effacer',
    st_mine:'Lecture de votre réponse…', st_readyD:'Écoutez et écrivez ce que vous entendez.', st_checked:'Vérifié', st_empty:'Placez d’abord des tuiles.',
    beatsCorrect:'temps justes', allCorrect:'Tout est juste !', session:'Séance', phrases:'phrases',
    view:'Afficher', viewNotation:'Notation', viewPictures:'Images', viewBoth:'Les deux',
    sayWith:'Dire avec', sayCount:'Comptage', saySyll:'Syllabes', sayHide:'Masquer',
    hint:'Donner le premier temps comme indice', yourAnswer:'Votre réponse', correctAnswer:'Rythme correct', tileTip:'Touchez une tuile, puis un temps.', rdHint:'Indice'
  }
};
function _rgLang() {
  let l = null;
  try { l = LS.getItem('pauta_lang'); } catch (e) {}
  if (!l) l = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return _RG_I18N[l] ? l : 'en';
}
function _rgT(key) { return _RG_I18N[_rgLang()][key] || _RG_I18N.en[key] || key; }

function _rgLoad(key, defaults) {
  try { const raw = LS.getItem(key); return Object.assign({}, defaults, raw ? JSON.parse(raw) : {}); }
  catch (e) { return Object.assign({}, defaults); }
}
function _rgSave(key, s) { try { LS.setItem(key, JSON.stringify(s)); } catch (e) {} }

// ── Rhythm model ──────────────────────────────────────────────────
const _RG_METERS = {
  '2/4': { num: 2, den: 4, units: 8,  beat: 4 },
  '3/4': { num: 3, den: 4, units: 12, beat: 4 },
  '4/4': { num: 4, den: 4, units: 16, beat: 4 },
  '6/8': { num: 6, den: 8, units: 12, beat: 6 }
};
const _RG_VALS = ['h', 'dq', 'q', '8', '16', 'rq', 'r8'];
const _RG_VAL_OF = { n8: 'h', n6: 'dq', n4: 'q', n2: '8', n1: '16', r4: 'rq', r2: 'r8' };
const _RG_VF = { 8: ['h', 0], 6: ['q', 1], 4: ['q', 0], 2: ['8', 0], 1: ['16', 0] };
const _rgKey = (u, rest) => _RG_VAL_OF[(rest ? 'r' : 'n') + u];

// Cells: [units, isRest] lists that exactly fill one beat (or two, for CELLS2); w = weight.
const _RG_CELLS = {
  4: [
    { c: [[4,0]], w: 4 }, { c: [[2,0],[2,0]], w: 4 }, { c: [[1,0],[1,0],[1,0],[1,0]], w: 2 },
    { c: [[2,0],[1,0],[1,0]], w: 1.5 }, { c: [[1,0],[1,0],[2,0]], w: 1.5 }, { c: [[1,0],[2,0],[1,0]], w: 1 },
    { c: [[4,1]], w: 1.5 }, { c: [[2,1],[2,0]], w: 1.2 }, { c: [[2,0],[2,1]], w: 1.2 }, { c: [[2,1],[1,0],[1,0]], w: 0.6 }
  ],
  6: [
    { c: [[6,0]], w: 4 }, { c: [[4,0],[2,0]], w: 2 }, { c: [[2,0],[4,0]], w: 2 }, { c: [[2,0],[2,0],[2,0]], w: 4 },
    { c: [[2,0],[2,0],[1,0],[1,0]], w: 1.5 }, { c: [[1,0],[1,0],[2,0],[2,0]], w: 1.5 }, { c: [[2,0],[1,0],[1,0],[2,0]], w: 1 },
    { c: [[2,1],[2,0],[2,0]], w: 1 }, { c: [[2,0],[2,1],[2,0]], w: 0.8 }, { c: [[2,0],[2,0],[2,1]], w: 1 }, { c: [[4,1],[2,0]], w: 1 }
  ]
};
const _RG_CELLS2 = [
  { c: [[8,0]], w: 3 }, { c: [[6,0],[2,0]], w: 2 }, { c: [[6,0],[1,0],[1,0]], w: 1 }, { c: [[2,0],[6,0]], w: 1 }
];

function _rgCellOk(cell, active) { return cell.c.every(([u, r]) => active.has(_rgKey(u, r))); }
function _rgPick(list) {
  let t = list.reduce((a, x) => a + x.w, 0), r = Math.random() * t;
  for (const x of list) { r -= x.w; if (r <= 0) return x; }
  return list[list.length - 1];
}
function _rgGenMeasureSlots(meter, active) {
  const nB = meter.units / meter.beat;
  const one = _RG_CELLS[meter.beat].filter(x => _rgCellOk(x, active));
  const two = meter.beat === 4 ? _RG_CELLS2.filter(x => _rgCellOk(x, active)) : [];
  const fallback = { c: meter.beat === 6 ? [[6,0]] : [[4,0]] };
  const slots = [];
  for (let b = 0; b < nB;) {
    const canTwo = two.length && b + 1 < nB && (meter.num !== 4 || b % 2 === 0);
    if (canTwo && (!one.length || Math.random() < 0.3)) { slots.push({ span: 2, c: _rgPick(two).c }); b += 2; continue; }
    slots.push({ span: 1, c: (one.length ? _rgPick(one) : fallback).c });
    b++;
  }
  return slots;
}
function _rgBuild(meter, slotsPerMeasure) {
  const measures = [], events = [];
  let on = 0;
  slotsPerMeasure.forEach((slots, mi) => {
    const arr = [];
    slots.forEach(sl => sl.c.forEach(([u, r]) => { const e = { u, rest: !!r, on, m: mi }; arr.push(e); events.push(e); on += u; }));
    measures.push(arr);
  });
  return { meter, slots: slotsPerMeasure, measures, events, len: on };
}
function _rgGenPiece(meter, active, nMeas) {
  let piece;
  for (let i = 0; i < 30; i++) {
    const sm = [];
    for (let k = 0; k < nMeas; k++) sm.push(_rgGenMeasureSlots(meter, active));
    piece = _rgBuild(meter, sm);
    if (!piece.events[0].rest && piece.measures.every(m => m.some(e => !e.rest))) break;
  }
  return piece;
}
function _rgSig(p) { return p.events.map(e => e.u + (e.rest ? 'r' : '')).join(','); }
// "Tricky" copy: same as base but with one beat replaced.
function _rgTricky(base, active) {
  const meter = base.meter, cand = [];
  base.slots.forEach((sl, mi) => sl.forEach((s, si) => { if (s.span === 1) cand.push([mi, si]); }));
  const pool = _RG_CELLS[meter.beat].filter(x => _rgCellOk(x, active));
  if (!cand.length || pool.length < 2) return null;
  for (let i = 0; i < 30; i++) {
    const [mi, si] = cand[Math.floor(Math.random() * cand.length)];
    const cell = _rgPick(pool);
    if (JSON.stringify(cell.c) === JSON.stringify(base.slots[mi][si].c)) continue;
    const sm = base.slots.map(sl => sl.map(s => ({ span: s.span, c: s.c })));
    sm[mi][si] = { span: 1, c: cell.c };
    const p = _rgBuild(meter, sm);
    if (_rgSig(p) !== _rgSig(base) && !p.events[0].rest) return p;
  }
  return null;
}

// ── Grading ───────────────────────────────────────────────────────
function _rgGrade(piece, taps, us) {
  const exp = [];
  piece.events.forEach((e, i) => { if (!e.rest) exp.push({ i, t: e.on * us }); });
  const tol = Math.min(0.2, Math.max(0.09, us * 0.9));
  const used = new Array(taps.length).fill(false);
  const hits = {};
  let hit = 0;
  for (const x of exp) {
    let b = -1, bd = Infinity;
    taps.forEach((t, j) => { if (!used[j]) { const d = Math.abs(t - x.t); if (d < bd) { bd = d; b = j; } } });
    if (b >= 0 && bd <= tol) { used[b] = true; hits[x.i] = true; hit++; } else hits[x.i] = false;
  }
  return { hits, hit, total: exp.length, extra: used.filter(u => !u).length, taps: taps.length };
}

// ── Notation (VexFlow 3, percussion clef) ─────────────────────────
function _rgCountLabel(m, e) {
  const mu = e.on % m.units, b = Math.floor(mu / m.beat), sub = mu % m.beat;
  let s;
  if (sub === 0) s = String(b + 1);
  else if (m.beat === 4) s = ({ 1: 'e', 2: '+', 3: 'a' })[sub];
  else s = ({ 2: 'la', 4: 'li' })[sub] || '·';
  return e.rest ? '(' + s + ')' : s;
}
function _rgSvgEl(out, tag, attrs, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (text != null) el.textContent = text;
  el.setAttribute('class', 'rg-ov');
  out.svg.appendChild(el);
  return el;
}
function _rgRender(host, piece, showCount, wordFn) {
  host.innerHTML = '';
  const m = piece.meter, nM = piece.measures.length;
  const W = Math.max(280, Math.min(host.clientWidth || 520, 1400));
  const minM = m.units >= 16 ? 270 : (m.beat === 6 ? 240 : (m.units === 12 ? 210 : 150));
  const perRow = Math.max(1, Math.min(4, nM, Math.floor(W / minM)));
  const rows = Math.ceil(nM / perRow), rowH = (showCount || wordFn) ? 120 : 100;
  const out = { host, piece, marks: [], svg: null, showCount: !!(showCount || wordFn) };
  try {
    const r = new VF.Renderer(host, VF.Renderer.Backends.SVG);
    r.resize(W, rows * rowH + 8);
    const ctx = r.getContext();
    out.svg = ctx.svg;
    const staveW = Math.floor((W - 8) / perRow);
    piece.measures.forEach((evs, mi) => {
      const row = Math.floor(mi / perRow), col = mi % perRow;
      const stave = new VF.Stave(4 + col * staveW, row * rowH + 8, staveW);
      if (col === 0) stave.addClef('percussion');
      if (mi === 0) stave.addTimeSignature(m.num + '/' + m.den);
      stave.setContext(ctx).draw();
      const notes = evs.map(e => {
        const [d, dot] = _RG_VF[e.u];
        const n = new VF.StaveNote({ keys: ['b/4'], duration: d + (dot ? 'd' : '') + (e.rest ? 'r' : ''), clef: 'percussion', stem_direction: VF.Stem.UP });
        if (e.ghost && typeof n.setStyle === 'function') n.setStyle({ fillStyle: '#c9c9c9', strokeStyle: '#c9c9c9' });
        if (dot) { if (typeof n.addDotToAll === 'function') n.addDotToAll(); else VF.Dot.buildAndAttach([n], { all: true }); }
        return n;
      });
      let beams = [];
      try { beams = VF.Beam.generateBeams(notes, { groups: [new VF.Fraction(m.beat === 6 ? 3 : 1, m.beat === 6 ? 8 : 4)], stem_direction: VF.Stem.UP }); } catch (e) {}
      const voice = new VF.Voice({ num_beats: m.num, beat_value: m.den }).setStrict(false);
      voice.addTickables(notes);
      new VF.Formatter().joinVoices([voice]).format([voice], Math.max(60, stave.getWidth() - (stave.getNoteStartX() - stave.getX()) - 14));
      voice.draw(ctx, stave);
      beams.forEach(b => b.setContext(ctx).draw());
      const top = stave.getYForLine(0), bot = stave.getYForLine(4);
      notes.forEach((n, i) => {
        const x = n.getAbsoluteX();
        out.marks.push({ x, top, bot });
        if (showCount || wordFn) {
          const label = wordFn ? wordFn(m, evs[i]) : _rgCountLabel(m, evs[i]);
          if (label) {
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', x + 6); t.setAttribute('y', bot + 30); t.setAttribute('text-anchor', 'middle');
            t.setAttribute('font-size', '13'); t.setAttribute('fill', '#555');
            t.textContent = label;
            ctx.svg.appendChild(t);
          }
        }
      });
    });
  } catch (err) {
    console.warn('Rhythm render failed:', err);
    host.textContent = piece.events.map(e => e.rest ? '𝄽' : '♩').join(' ');
    out.svg = null; out.marks = [];
  }
  return out;
}
function _rgClearOv(out) { if (out && out.svg) out.svg.querySelectorAll('.rg-ov').forEach(e => e.remove()); }
function _rgHL(out, idx) {
  if (!out || !out.svg) return;
  out.svg.querySelectorAll('.rg-hl').forEach(e => e.remove());
  const mk = out.marks[idx]; if (!mk) return;
  const r = _rgSvgEl(out, 'rect', { x: mk.x - 6, y: mk.top - 14, width: 22, height: mk.bot - mk.top + 28, rx: 4, fill: 'rgba(255,140,0,0.25)' });
  r.setAttribute('class', 'rg-ov rg-hl');
}
function _rgMarkResults(out, hits) {
  if (!out || !out.svg) return;
  out.svg.querySelectorAll('.rg-hl').forEach(e => e.remove());
  for (const i in hits) {
    const mk = out.marks[i]; if (!mk) continue;
    _rgSvgEl(out, 'text', { x: mk.x + 6, y: mk.bot + (out.showCount ? 52 : 34), 'text-anchor': 'middle', 'font-size': '15', 'font-weight': '700', fill: hits[i] ? '#2e7d32' : '#c62828' }, hits[i] ? '✓' : '✗');
  }
}

// ── Audio runner: count-in → pattern → (echo window) with tap capture ──
// mode: 'play' (just hear it) or 'echo' (hear it, then tap it back). With o.echoCountIn, a second
// count-in separates the pattern from the echo window.
// Uses a short look-ahead scheduler so Stop is immediate.
function _rgRunner(piece, o) {
  const ctx = getAudioCtx(); if (ctx.state === 'suspended') ctx.resume();
  const m = piece.meter, us = 60 / (o.tempo * m.beat);
  const lat = ctx.outputLatency || ctx.baseLatency || 0;
  const t0 = ctx.currentTime + 0.2;
  const cin = o.countIn ? m.units : 0;
  const patT = t0 + cin * us;
  const gap = (o.mode === 'echo' && o.echoCountIn) ? cin : 0;
  const patEnd = patT + piece.len * us;
  const winT = o.mode === 'echo' ? patEnd + gap * us : patT;
  const endT = winT + piece.len * us;
  const q = [];
  for (let u = 0; u < cin; u += m.beat) q.push({ t: t0 + u * us, click: true, acc: u === 0 });
  const clickLen = o.mode === 'echo' ? 2 * piece.len + gap : piece.len;
  for (let u = 0; u < clickLen; u += m.beat) q.push({ t: patT + u * us, click: true, acc: u % m.units === 0 });
  piece.events.forEach(e => { if (!e.rest) q.push({ t: patT + e.on * us, d: e.u * us * (e.midi ? 0.95 : 0.9), midi: e.midi }); });
  q.sort((a, b) => a.t - b.t);
  let qi = 0, stopped = false, finished = false, raf = 0, endTimer = 0;
  const taps = [];
  const timer = setInterval(() => {
    if (o.alive && !o.alive()) { api.stop(); return; }
    while (qi < q.length && q[qi].t < ctx.currentTime + 0.25) {
      const x = q[qi++];
      if (x.click) scheduleNote(ctx, 76, x.t, 0.07, 'noise', (x.acc ? 0.45 : 0.26) * (o.clickBoost || 1));
      else if (x.midi) scheduleNote(ctx, x.midi, x.t, x.d, 'sine', 0.5);
      else scheduleNote(ctx, x.midi || 72, x.t, x.d, o.noteOsc || 'noise', o.noteVol ?? 0.4);
    }
  }, 30);
  const frame = () => {
    if (stopped || finished) return;
    const now = ctx.currentTime - lat;
    const winEnd = o.mode === 'echo' ? winT : endT;
    if (now < patT) o.onFrame('count', 0, Math.max(0, Math.floor((now - t0) / (m.beat * us))));
    else if (gap && now >= patEnd && now < winT) o.onFrame('count2', 0, Math.floor((now - patEnd) / (m.beat * us)));
    else if (o.mode === 'echo' && now >= winT) o.onFrame('echo', (now - winT) / us, 0);
    else if (now < winEnd) o.onFrame(o.mode === 'play' ? 'play' : 'listen', (now - patT) / us, 0);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  endTimer = setTimeout(() => {
    if (stopped || finished) return;
    finished = true; clearInterval(timer); cancelAnimationFrame(raf);
    o.onDone({ taps, us });
  }, (endT - ctx.currentTime) * 1000 + 450);
  const api = {
    us,
    stop() { if (stopped) return; stopped = true; clearInterval(timer); clearTimeout(endTimer); cancelAnimationFrame(raf); },
    tap() {
      if (stopped || finished || o.mode === 'play') return;
      scheduleNote(ctx, 72, ctx.currentTime, 0.1, 'noise', 0.35);
      const now = ctx.currentTime - lat;
      if (now >= winT - 2 * us && now <= endT + 0.3) taps.push(now - winT);
    }
  };
  return api;
}
function _rgEvAt(piece, unit) {
  for (let i = 0; i < piece.events.length; i++) { const e = piece.events[i]; if (unit >= e.on && unit < e.on + e.u) return i; }
  return -1;
}

// ── Shared UI bits ────────────────────────────────────────────────
let _rgDlgSeq = 0;
const _rgChip = (act, v, label, on) =>
  `<button class="modal-btn ${on ? 'primary' : 'secondary'}" data-rg="${act}" data-v="${v}" style="padding:4px 8px;font-size:11px">${label}</button>`;
const _rgRow = (label, html) =>
  `<div style="font-size:11px;color:var(--pauta-text-muted);margin:6px 0 3px">${label}</div><div style="display:flex;flex-wrap:wrap;gap:4px">${html}</div>`;
const _rgLangChips = () => ['en', 'pt', 'fr'].map(l => _rgChip('lang', l, l.toUpperCase(), _rgLang() === l)).join('');
const _rgValChips = vals => _RG_VALS.map(v => _rgChip('val', v, _rgT('v_' + v), vals.includes(v))).join('');
const _rgTapPad = () =>
  `<button id="rg-tap" style="width:100%;margin-top:8px;padding:18px 0;font-size:20px;font-weight:700;background:var(--pauta-primary);color:#fff;border:none;border-radius:10px;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none">${_rgT('tapBtn')}</button>`;
const _rgTempoRow = tempo =>
  `<div style="display:flex;align-items:center;gap:6px">${_rgChip('tempo', -5, '−', false)}<b id="rg-tempo" style="min-width:34px;text-align:center">${tempo}</b>${_rgChip('tempo', 5, '+', false)}</div>`;

// Near-full-screen modal (iPad landscape, Chromebook, laptop) + re-layout on resize/rotation.
function _rgBig(root) {
  const m = root.closest('.pauta-modal'); if (!m) return;
  [['width', '96vw'], ['max-width', '1400px'], ['max-height', '94vh'], ['overflow-y', 'auto'], ['box-sizing', 'border-box']].forEach(([k, v]) => m.style.setProperty(k, v, 'important'));
}
function _rgOnResize(id, fn) {
  let t = 0;
  const h = () => {
    if (!document.getElementById(id)) { window.removeEventListener('resize', h); return; }
    clearTimeout(t); t = setTimeout(fn, 150);
  };
  window.addEventListener('resize', h);
}
const _rgCss = id => `<style>#${id} .rg-set{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:2px 16px}#${id} .rg-pair{display:grid;grid-template-columns:minmax(300px,34%) 1fr;gap:12px;align-items:start}@media (max-width:900px){#${id} .rg-pair{grid-template-columns:1fr}}</style>`;

// Wires the Space key (capture phase, so Pauta shortcuts don't fire) and cleanup. getRun() returns the active runner (or null).
function _rgWireTap(id, getRun, onClose) {
  const key = ev => {
    if (!document.getElementById(id)) { document.removeEventListener('keydown', key, true); if (onClose) onClose(); return; }
    if (ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
    if (ev.code === 'Space' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); const r = getRun(); if (!ev.repeat && r) r.tap(); }
  };
  document.addEventListener('keydown', key, true);
}

// ── Rhythm Randomizer ─────────────────────────────────────────────
function showRhythmRandomizerDialog() {
  const KEY = 'pauta_rg_rand', id = 'rg-root-' + (++_rgDlgSeq);
  const s = _rgLoad(KEY, { ts: '4/4', measures: 2, tempo: 90, vals: ['h', 'q', '8', 'rq'], countIn: true, counting: true, hideEcho: true });
  let piece = null, out = null, run = null, status = '', setOpen = true, lastHits = null;
  const active = () => new Set(s.vals);
  const alive = () => !!document.getElementById(id);
  const stopRun = () => { if (run) { run.stop(); run = null; } };

  UI.makeModal(`<div id="${id}"></div>`);
  const root = document.getElementById(id);
  _rgBig(root);

  function regen() {
    stopRun(); lastHits = null;
    if (!s.vals.length) { s.vals = ['q']; }
    piece = _rgGenPiece(_RG_METERS[s.ts], active(), s.measures);
    status = _rgT('st_ready');
    paint();
  }
  function paint() {
    const T = _rgT;
    root.innerHTML = `
      ${_rgCss(id)}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">
        <h2 style="margin:0">${T('randTitle')}</h2>
        <div style="display:flex;gap:4px;align-items:center">${_rgLangChips()}<button class="modal-btn secondary" data-rg="close" style="padding:4px 12px;font-size:12px;margin-left:8px">${T('close')}</button></div>
      </div>
      <details id="rg-set" ${setOpen ? 'open' : ''}><summary style="cursor:pointer;font-weight:600;font-size:13px">${T('more')}</summary>
        <div class="rg-set">
          <div>${_rgRow(T('ts'), Object.keys(_RG_METERS).map(k => _rgChip('ts', k, k, s.ts === k)).join(''))}</div>
          <div>${_rgRow(T('meas'), [1, 2, 4, 8].map(n => _rgChip('meas', n, n, s.measures === n)).join(''))}</div>
          <div>${_rgRow(T('tempo'), _rgTempoRow(s.tempo))}</div>
          <div>${_rgRow(T('opts'), _rgChip('tog', 'countIn', T('countIn'), s.countIn) + _rgChip('tog', 'counting', T('counting'), s.counting) + _rgChip('tog', 'hideEcho', T('hideEcho'), s.hideEcho))}</div>
          <div style="grid-column:1/-1">${_rgRow(T('vals'), _rgValChips(s.vals))}</div>
        </div>
      </details>
      <div id="rg-notation" style="margin:10px 0 2px;overflow-x:auto"></div>
      <div id="rg-status" style="text-align:center;font-weight:700;min-height:22px">${status}</div>
      <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
        <button class="modal-btn secondary" data-rg="gen" style="flex:1">${T('gen')}</button>
        <button class="modal-btn primary" data-rg="echo" style="flex:1">${T('echo')}</button>
        <button class="modal-btn secondary" data-rg="stop" style="flex:1">${T('stop')}</button>
      </div>
      ${_rgTapPad()}`;
    const det = root.querySelector('#rg-set'); if (det) det.addEventListener('toggle', () => { setOpen = det.open; });
    const pad = root.querySelector('#rg-tap');
    if (pad) pad.addEventListener('pointerdown', e => { e.preventDefault(); if (run) run.tap(); });
    out = _rgRender(root.querySelector('#rg-notation'), piece, s.counting);
  }
  const setStatus = t => { status = t; const el = root.querySelector('#rg-status'); if (el) el.textContent = t; };

  function start() {
    stopRun(); _rgClearOv(out); lastHits = null;
    const host = root.querySelector('#rg-notation');
    host.style.visibility = 'visible';
    let lastPhase = '', lastIdx = -2;
    run = _rgRunner(piece, {
      tempo: s.tempo, mode: 'echo', echoCountIn: true, countIn: s.countIn, alive,
      onFrame(phase, unit, beat) {
        if (phase === 'count' || phase === 'count2') {
          setStatus(_rgT('st_count') + ' ' + (beat + 1));
          host.style.visibility = (phase === 'count2' && s.hideEcho) ? 'hidden' : 'visible';
          if (phase !== lastPhase) { _rgHL(out, -1); lastIdx = -2; }
          lastPhase = phase; return;
        }
        if (phase !== lastPhase) {
          lastPhase = phase;
          setStatus(_rgT(phase === 'echo' ? 'st_echo' : 'st_listen'));
          host.style.visibility = (phase === 'echo' && s.hideEcho) ? 'hidden' : 'visible';
        }
        const idx = (phase === 'echo' && s.hideEcho) ? -1 : _rgEvAt(piece, unit);
        if (idx !== lastIdx) { lastIdx = idx; _rgHL(out, idx); }
      },
      onDone({ taps, us }) {
        run = null; host.style.visibility = 'visible';
        const g = _rgGrade(piece, taps, us);
        lastHits = g.hits; _rgMarkResults(out, g.hits);
        setStatus(g.hit === g.total && !g.extra ? _rgT('perfect') : `${_rgT('hits')}: ${g.hit}/${g.total} · ${_rgT('extra')}: ${g.extra}`);
      }
    });
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-rg]'); if (!b) return;
    const a = b.dataset.rg, v = b.dataset.v;
    if (a === 'tempo') {
      s.tempo = Math.max(40, Math.min(200, s.tempo + parseInt(v))); _rgSave(KEY, s);
      root.querySelector('#rg-tempo').textContent = s.tempo; return;
    }
    if (a === 'gen') { regen(); return; }
    if (a === 'echo') { start(); return; }
    if (a === 'stop') { stopRun(); _rgClearOv(out); root.querySelector('#rg-notation').style.visibility = 'visible'; setStatus(_rgT('st_stopped')); return; }
    if (a === 'close') { stopRun(); UI.closeModal(); return; }
    stopRun();
    if (a === 'lang') { try { LS.setItem('pauta_lang', v); } catch (err) {} status = _rgT('st_ready'); paint(); return; }
    if (a === 'ts') s.ts = v;
    else if (a === 'meas') s.measures = parseInt(v);
    else if (a === 'val') s.vals = s.vals.includes(v) ? s.vals.filter(x => x !== v) : s.vals.concat(v);
    else if (a === 'tog') { s[v] = !s[v]; _rgSave(KEY, s); paint(); return; }
    _rgSave(KEY, s);
    regen();
  });
  _rgWireTap(id, () => run, stopRun);
  _rgOnResize(id, () => { if (run) return; out = _rgRender(root.querySelector('#rg-notation'), piece, s.counting); if (lastHits) _rgMarkResults(out, lastHits); });
  regen();
}

// ── Poison Rhythm ─────────────────────────────────────────────────
function showPoisonRhythmDialog() {
  const KEY = 'pauta_rg_poison', id = 'rg-root-' + (++_rgDlgSeq), M = _RG_METERS['4/4'];
  const s = _rgLoad(KEY, { tempo: 90, beats: 4, other: 'different', freq: 'now', pause: true, msg: 'poison', custom: '', showPlay: true, showEcho: true, counting: true, vals: ['h', 'q', '8', 'rq'] });
  let poison = null, run = null, game = null, pOut = null, rOut = null, status = '', waiting = false, cur = null, setOpen = true;
  const active = () => new Set(s.vals);
  const alive = () => !!document.getElementById(id);
  const stopRun = () => { if (run) { run.stop(); run = null; } };
  const stopGame = () => { stopRun(); if (game) game.running = false; waiting = false; };

  UI.makeModal(`<div id="${id}"></div>`);
  const root = document.getElementById(id);
  _rgBig(root);

  function newPoison() {
    stopGame();
    if (!s.vals.length) s.vals = ['q'];
    poison = _rgGenPiece(M, active(), s.beats / 4);
    game = null; cur = null; status = '';
    paint();
  }
  function makeOther() {
    for (let i = 0; i < 20; i++) {
      const p = (s.other === 'tricky' ? _rgTricky(poison, active()) : null) || _rgGenPiece(M, active(), s.beats / 4);
      if (_rgSig(p) !== _rgSig(poison)) return p;
    }
    return _rgGenPiece(M, active(), s.beats / 4);
  }
  const msgText = () => s.msg === 'sit' ? _rgT('msgSit') : (s.msg === 'custom' && s.custom ? s.custom : _rgT('msgPoison'));
  function scoreText() {
    const g = game || { echoed: 0, missed: 0, poisonTapped: 0, avoided: 0 };
    return `${_rgT('sc_echoed')}: ${g.echoed} · ${_rgT('sc_missed')}: ${g.missed} · ☠ ${_rgT('sc_poison')}: ${g.poisonTapped} · ${_rgT('sc_avoided')}: ${g.avoided}`;
  }
  function paint() {
    const T = _rgT;
    root.innerHTML = `
      ${_rgCss(id)}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">
        <h2 style="margin:0">${T('poisonTitle')}</h2>
        <div style="display:flex;gap:4px;align-items:center">${_rgLangChips()}<button class="modal-btn secondary" data-rg="close" style="padding:4px 12px;font-size:12px;margin-left:8px">${T('close')}</button></div>
      </div>
      <details id="rg-set" ${setOpen ? 'open' : ''}><summary style="cursor:pointer;font-weight:600;font-size:13px">${T('more')}</summary>
        <div class="rg-set">
          <div>${_rgRow(T('tempo'), _rgTempoRow(s.tempo))}</div>
          <div>${_rgRow(T('len'), _rgChip('beats', 4, T('beats4'), s.beats === 4) + _rgChip('beats', 8, T('beats8'), s.beats === 8))}</div>
          <div>${_rgRow(T('other'), _rgChip('other', 'different', T('o_diff'), s.other === 'different') + _rgChip('other', 'tricky', T('o_tricky'), s.other === 'tricky'))}</div>
          <div>${_rgRow(T('freq'), _rgChip('freq', 'now', T('f_now'), s.freq === 'now') + _rgChip('freq', 'often', T('f_often'), s.freq === 'often'))}</div>
          <div>${_rgRow(T('opts'), _rgChip('tog', 'pause', T('pause'), s.pause) + _rgChip('tog', 'showPlay', T('showPlay'), s.showPlay) + _rgChip('tog', 'showEcho', T('showEcho'), s.showEcho) + _rgChip('tog', 'counting', T('counting'), s.counting))}</div>
          <div>${_rgRow(T('screen'), _rgChip('msg', 'sit', T('m_sit'), s.msg === 'sit') + _rgChip('msg', 'poison', T('m_poison'), s.msg === 'poison') + _rgChip('msg', 'custom', T('m_custom'), s.msg === 'custom'))}
            ${s.msg === 'custom' ? `<input id="rg-custom" type="text" maxlength="60" placeholder="${T('customPh')}" value="${UI.escHtml(s.custom)}" style="width:100%;margin-top:4px;padding:6px;box-sizing:border-box">` : ''}</div>
          <div style="grid-column:1/-1">${_rgRow(T('vals'), _rgValChips(s.vals))}</div>
        </div>
      </details>
      <div class="rg-pair" style="margin-top:8px">
        <div style="border:2px solid #7b4fa3;background:#f1eaf7;border-radius:10px;padding:6px 8px">
          <div style="font-weight:700;color:#5b3a82">☠ ${T('poisonTitle')} — <span style="font-weight:500">${T('poisonTag')}</span></div>
          <div id="rg-poison" style="background:#fff;border-radius:6px;margin-top:4px;overflow-x:auto"></div>
        </div>
        <div id="rg-notation" style="overflow-x:auto;min-height:20px"></div>
      </div>
      <div id="rg-status" style="text-align:center;font-weight:700;min-height:22px;margin-top:6px">${status || T('learn')}</div>
      <div id="rg-score" style="text-align:center;font-size:12px;margin:4px 0">${scoreText()}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="modal-btn primary" data-rg="start" style="flex:1">${T('start')}</button>
        <button class="modal-btn secondary" data-rg="hear" style="flex:1">${T('hear')}</button>
        <button class="modal-btn secondary" data-rg="new" style="flex:1">${T('newPoison')}</button>
        <button class="modal-btn secondary" data-rg="stop" style="flex:1">${T('stop')}</button>
      </div>
      <button id="rg-cont" class="modal-btn primary" data-rg="cont" style="width:100%;margin-top:6px;display:none">${T('cont')}</button>
      ${_rgTapPad()}`;
    const det = root.querySelector('#rg-set'); if (det) det.addEventListener('toggle', () => { setOpen = det.open; });
    const pad = root.querySelector('#rg-tap');
    if (pad) pad.addEventListener('pointerdown', e => { e.preventDefault(); if (run) run.tap(); });
    const ci = root.querySelector('#rg-custom');
    if (ci) ci.addEventListener('input', () => { s.custom = ci.value; _rgSave(KEY, s); });
    pOut = _rgRender(root.querySelector('#rg-poison'), poison, s.counting);
    rOut = null;
  }
  const setStatus = t => { status = t; const el = root.querySelector('#rg-status'); if (el) el.textContent = t; };
  const setScore = () => { const el = root.querySelector('#rg-score'); if (el) el.textContent = scoreText(); };
  const noteHost = () => root.querySelector('#rg-notation');

  function hear() {
    stopGame(); _rgClearOv(pOut);
    let lastIdx = -2;
    run = _rgRunner(poison, {
      tempo: s.tempo, mode: 'play', countIn: true, alive,
      onFrame(phase, unit) { setStatus(_rgT(phase === 'count' ? 'st_count' : 'st_play')); if (phase === 'count') return; const i = _rgEvAt(poison, unit); if (i !== lastIdx) { lastIdx = i; _rgHL(pOut, i); } },
      onDone() { run = null; _rgHL(pOut, -1); setStatus(_rgT('learn')); }
    });
  }
  function startGame() {
    stopGame();
    game = { running: true, round: 0, last: false, echoed: 0, missed: 0, poisonTapped: 0, avoided: 0 };
    setScore(); nextRound();
  }
  function nextRound() {
    if (!alive() || !game || !game.running) return;
    const wantPoison = game.round > 0 && !game.last && Math.random() < (s.freq === 'often' ? 0.4 : 0.2);
    const piece = wantPoison ? poison : makeOther();
    cur = { piece, isPoison: wantPoison };
    game.last = wantPoison; game.round++;
    rOut = _rgRender(noteHost(), piece, s.counting);
    let lastPhase = '', lastIdx = -2;
    run = _rgRunner(piece, {
      tempo: s.tempo, mode: 'echo', countIn: true, alive,
      onFrame(phase, unit, beat) {
        if (phase !== lastPhase) { lastPhase = phase; noteHost().style.visibility = ((phase === 'listen' && !s.showPlay) || (phase === 'echo' && !s.showEcho)) ? 'hidden' : 'visible'; }
        if (phase === 'count') { setStatus(_rgT('st_count') + ' ' + (beat + 1)); return; }
        setStatus(_rgT(phase === 'echo' ? 'st_echo' : 'st_listen'));
        const i = (noteHost().style.visibility === 'hidden') ? -1 : _rgEvAt(piece, unit);
        if (i !== lastIdx) { lastIdx = i; _rgHL(rOut, i); }
      },
      onDone({ taps, us }) { run = null; endRound(taps, us); }
    });
  }
  function endRound(taps, us) {
    noteHost().style.visibility = 'visible';
    const { piece, isPoison } = cur, g = _rgGrade(piece, taps, us);
    if (isPoison) {
      _rgHL(rOut, -1);
      if (taps.length > 0) {
        game.poisonTapped++; setScore();
        setStatus('☠ ' + msgText());
        if (s.pause) { waiting = true; root.querySelector('#rg-cont').style.display = 'block'; return; }
        setTimeout(nextRound, 1800); return;
      }
      game.avoided++; setStatus('✓ ' + _rgT('r_avoid'));
    } else if (g.total && g.hit / g.total >= 0.75 && g.extra <= 1) {
      game.echoed++; _rgMarkResults(rOut, g.hits); setStatus('✓ ' + _rgT('r_good'));
    } else {
      game.missed++; _rgMarkResults(rOut, g.hits); setStatus('✗ ' + _rgT('r_miss'));
    }
    setScore();
    setTimeout(nextRound, 1100);
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-rg]'); if (!b) return;
    const a = b.dataset.rg, v = b.dataset.v;
    if (a === 'tempo') { s.tempo = Math.max(40, Math.min(200, s.tempo + parseInt(v))); _rgSave(KEY, s); root.querySelector('#rg-tempo').textContent = s.tempo; return; }
    if (a === 'start') { startGame(); return; }
    if (a === 'hear') { hear(); return; }
    if (a === 'cont') { if (waiting) { waiting = false; b.style.display = 'none'; nextRound(); } return; }
    if (a === 'stop') { stopGame(); _rgClearOv(rOut); noteHost().style.visibility = 'visible'; setStatus(_rgT('st_stopped')); return; }
    if (a === 'close') { stopGame(); UI.closeModal(); return; }
    if (a === 'new') { newPoison(); return; }
    stopGame();
    if (a === 'lang') { try { LS.setItem('pauta_lang', v); } catch (err) {} paint(); return; }
    if (a === 'other') s.other = v;
    else if (a === 'freq') s.freq = v;
    else if (a === 'msg') s.msg = v;
    else if (a === 'tog') s[v] = !s[v];
    else if (a === 'beats') { s.beats = parseInt(v); _rgSave(KEY, s); newPoison(); return; }
    else if (a === 'val') { s.vals = s.vals.includes(v) ? s.vals.filter(x => x !== v) : s.vals.concat(v); _rgSave(KEY, s); newPoison(); return; }
    _rgSave(KEY, s);
    paint();
  });
  _rgWireTap(id, () => run, stopGame);
  _rgOnResize(id, () => { if (run) return; pOut = _rgRender(root.querySelector('#rg-poison'), poison, s.counting); if (cur) rOut = _rgRender(noteHost(), cur.piece, s.counting); });
  newPoison();
}

// ── Poison Melody (fixed-do solfège) ─────────────────────────────────────
// No student input: the teacher judges. A melody round plays, the class sings it back
// (echo window), and the poison melody is the one they must NOT sing.
Object.assign(_RG_I18N.en, {
  solfTitle:'Poison Melody', m_silly:'Silly: “it was the poison!”', silly:['Ha ha! That was the poison! 😈','Gotcha! That was the poison! 🤪','Mwahaha! The poison strikes again! ☠️','Oops… that one was poison! 🙈'], learnS:'Learn the poison melody, then press Start.', o_trickyS:'Tricky: one note off',
  clef:'Clef', treble:'Treble', bass:'Bass', range:'Range', rhythm:'Rhythm', rh_q:'Quarter notes only', rh_mix:'Quarters + a half',
  plen:'Notes in the poison', syl:'Show syllables', solf:['Do','Re','Mi','Fa','Sol','La','Ti']
});
Object.assign(_RG_I18N.pt, {
  solfTitle:'Melodia Veneno', m_silly:'Boba: “era o veneno!”', silly:['Rá rá! Era o veneno! 😈','Peguei! Era o veneno! 🤪','Muahaha! O veneno atacou de novo! ☠️','Ops… essa era o veneno! 🙈'], learnS:'Aprenda a melodia veneno e aperte Iniciar.', o_trickyS:'Difíceis: uma nota diferente',
  clef:'Clave', treble:'Clave de sol', bass:'Clave de fá', range:'Extensão', rhythm:'Ritmo', rh_q:'Só semínimas', rh_mix:'Semínimas + uma mínima',
  plen:'Notas no veneno', syl:'Mostrar sílabas', solf:['Do','Re','Mi','Fa','Sol','La','Si']
});
Object.assign(_RG_I18N.fr, {
  solfTitle:'Mélodie poison', m_silly:'Rigolo : « c’était le poison ! »', silly:['Ha ha ! C’était le poison ! 😈','Gagné ! C’était le poison ! 🤪','Mouahaha ! Le poison a encore frappé ! ☠️','Oups… c’était le poison ! 🙈'], learnS:'Apprenez la mélodie poison, puis appuyez sur Démarrer.', o_trickyS:'Pièges : une note change',
  clef:'Clé', treble:'Clé de sol', bass:'Clé de fa', range:'Étendue', rhythm:'Rythme', rh_q:'Noires seulement', rh_mix:'Noires + une blanche',
  plen:'Notes dans le poison', syl:'Afficher les syllabes', solf:['Do','Ré','Mi','Fa','Sol','La','Si']
});
const _rgSyl = d => _RG_I18N[_rgLang()].solf[d % 7];
const _PS_STEPS = [0, 2, 4, 5, 7, 9, 11];
const _PS_NAMES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

// Piece = one 4/4 measure. deg 0..7 (0 = Do, 7 = high Do); treble Do = C4, bass Do = C3.
function _psNote(deg, clef) {
  const oct = (clef === 'bass' ? 3 : 4) + Math.floor(deg / 7);
  return { deg, key: _PS_NAMES[deg % 7] + '/' + oct, midi: 12 * (oct + 1) + _PS_STEPS[deg % 7] };
}
function _psBuild(degs, durs, clef) {
  const events = []; let on = 0;
  degs.forEach((d, i) => { const n = _psNote(d, clef); events.push(Object.assign({ u: durs[i], rest: false, on, deg: d }, n)); on += durs[i]; });
  if (on < 16) events.push({ u: 16 - on, rest: true, on, deg: -1 });
  return { meter: _RG_METERS['4/4'], events, len: 16, clef };
}
const _psSig = p => p.events.map(e => (e.rest ? 'r' : e.deg) + ':' + e.u).join(',');
function _psDurs(n, mixed) {
  if (n === 4) return [4, 4, 4, 4];
  if (mixed) { const a = [[8,4,4], [4,8,4], [4,4,8]]; return a[Math.floor(Math.random() * 3)]; }
  return [4, 4, 4];
}
function _psGen(s, n) {
  const max = s.range === 'octave' ? 7 : 4;
  for (let tries = 0; tries < 50; tries++) {
    const degs = [Math.floor(Math.random() * (max + 1))];
    while (degs.length < n) {
      let d; do { d = Math.max(0, Math.min(max, degs[degs.length - 1] + Math.floor(Math.random() * 7) - 3)); } while (d === degs[degs.length - 1]);
      degs.push(d);
    }
    if (new Set(degs).size > 1) return _psBuild(degs, _psDurs(n, s.rhythm === 'mixed'), s.clef);
  }
  return _psBuild([0, 2, 4].slice(0, n), _psDurs(n, false), s.clef);
}
function _psTricky(base, s) {
  const max = s.range === 'octave' ? 7 : 4, idx = [];
  base.events.forEach((e, i) => { if (!e.rest) idx.push(i); });
  for (let i = 0; i < 30; i++) {
    const k = idx[Math.floor(Math.random() * idx.length)], d = Math.floor(Math.random() * (max + 1));
    if (d === base.events[k].deg) continue;
    const degs = [], durs = [];
    base.events.forEach((e, j) => { if (!e.rest) { degs.push(j === k ? d : e.deg); durs.push(e.u); } });
    const p = _psBuild(degs, durs, s.clef);
    if (_psSig(p) !== _psSig(base)) return p;
  }
  return null;
}

function _rgRenderMelody(host, piece, showSyl) {
  host.innerHTML = '';
  const out = { host, piece, marks: [], svg: null };
  const W = Math.max(260, Math.min(host.clientWidth || 420, 600));
  try {
    const r = new VF.Renderer(host, VF.Renderer.Backends.SVG);
    r.resize(W, 170);
    const ctx = r.getContext(); out.svg = ctx.svg;
    const stave = new VF.Stave(4, 30, W - 8);
    stave.addClef(piece.clef).addTimeSignature('4/4'); stave.setContext(ctx).draw();
    const restKey = piece.clef === 'bass' ? 'd/3' : 'b/4';
    const notes = piece.events.map(e => new VF.StaveNote({
      keys: [e.rest ? restKey : e.key], duration: (e.u === 8 ? 'h' : 'q') + (e.rest ? 'r' : ''), clef: piece.clef, auto_stem: true }));
    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
    voice.addTickables(notes);
    new VF.Formatter().joinVoices([voice]).format([voice], Math.max(80, stave.getWidth() - (stave.getNoteStartX() - stave.getX()) - 20));
    voice.draw(ctx, stave);
    const top = stave.getYForLine(0), bot = stave.getYForLine(4);
    notes.forEach((n, i) => {
      const x = n.getAbsoluteX(), e = piece.events[i];
      out.marks.push({ x, top, bot });
      if (showSyl && !e.rest) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', x + 6); t.setAttribute('y', bot + 58); t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-size', '15'); t.setAttribute('font-weight', '600'); t.setAttribute('fill', '#333');
        t.textContent = _rgSyl(e.deg); ctx.svg.appendChild(t);
      }
    });
  } catch (err) {
    console.warn('Melody render failed:', err);
    host.textContent = piece.events.map(e => e.rest ? '𝄽' : _rgSyl(e.deg)).join(' ');
    out.svg = null; out.marks = [];
  }
  return out;
}

function showPoisonSolfegeDialog() {
  const KEY = 'pauta_rg_solfege', id = 'rg-root-' + (++_rgDlgSeq);
  const s = _rgLoad(KEY, { tempo: 80, clef: 'treble', range: 'dosol', rhythm: 'quarters', plen: 3, other: 'different', freq: 'now', pause: true, msg: 'poison', custom: '', showPlay: true, showEcho: true, syl: true, countIn: true });
  let poison = null, run = null, game = null, pOut = null, rOut = null, status = '', waiting = false, cur = null, setOpen = true;
  const alive = () => !!document.getElementById(id);
  const stopRun = () => { if (run) { run.stop(); run = null; } };
  const stopGame = () => { stopRun(); if (game) game.running = false; waiting = false; delete root.dataset.playing; };

  UI.makeModal(`<div id="${id}"></div>`);
  const root = document.getElementById(id);
  _rgBig(root);

  function newPoison() {
    stopGame(); poison = _psGen(s, s.plen); game = null; cur = null; status = ''; paint();
  }
  function makeOther() {
    for (let i = 0; i < 20; i++) {
      const p = (s.other === 'tricky' ? _psTricky(poison, s) : null) || _psGen(s, 3 + Math.floor(Math.random() * 2));
      if (_psSig(p) !== _psSig(poison)) return p;
    }
    return _psGen(s, 4);
  }
  const msgText = () => {
    if (s.msg === 'sit') return _rgT('msgSit');
    if (s.msg === 'custom' && s.custom) return s.custom;
    const l = _RG_I18N[_rgLang()].silly; return l[Math.floor(Math.random() * l.length)];
  };
  function paint() {
    const T = _rgT, chip = _rgChip;
    root.innerHTML = `
      ${_rgCss(id)}
      <style>#${id}[data-playing] .rg-pbox{display:none}#${id}[data-playing] .rg-pair{grid-template-columns:1fr}@keyframes rgpop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}</style>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">
        <h2 style="margin:0">${T('solfTitle')}</h2>
        <div style="display:flex;gap:4px;align-items:center">${_rgLangChips()}<button class="modal-btn secondary" data-rg="close" style="padding:4px 12px;font-size:12px;margin-left:8px">${T('close')}</button></div>
      </div>
      <details id="rg-set" ${setOpen ? 'open' : ''}><summary style="cursor:pointer;font-weight:600;font-size:13px">${T('more')}</summary>
        <div class="rg-set">
          <div>${_rgRow(T('clef'), chip('clef', 'treble', '𝄞 ' + T('treble'), s.clef === 'treble') + chip('clef', 'bass', '𝄢 ' + T('bass'), s.clef === 'bass'))}</div>
          <div>${_rgRow(T('range'), chip('range', 'dosol', 'Do–Sol', s.range === 'dosol') + chip('range', 'octave', 'Do–Do', s.range === 'octave'))}</div>
          <div>${_rgRow(T('rhythm'), chip('rhythm', 'quarters', T('rh_q'), s.rhythm === 'quarters') + chip('rhythm', 'mixed', T('rh_mix'), s.rhythm === 'mixed'))}</div>
          <div>${_rgRow(T('plen'), chip('plen', 3, '3', s.plen === 3) + chip('plen', 4, '4', s.plen === 4))}</div>
          <div>${_rgRow(T('tempo'), _rgTempoRow(s.tempo))}</div>
          <div>${_rgRow(T('other'), chip('other', 'different', T('o_diff'), s.other === 'different') + chip('other', 'tricky', T('o_trickyS'), s.other === 'tricky'))}</div>
          <div>${_rgRow(T('freq'), chip('freq', 'now', T('f_now'), s.freq === 'now') + chip('freq', 'often', T('f_often'), s.freq === 'often'))}</div>
          <div>${_rgRow(T('opts'), chip('tog', 'countIn', T('countIn'), s.countIn) + chip('tog', 'pause', T('pause'), s.pause) + chip('tog', 'showPlay', T('showPlay'), s.showPlay) + chip('tog', 'showEcho', T('showEcho'), s.showEcho) + chip('tog', 'syl', T('syl'), s.syl))}</div>
          <div>${_rgRow(T('screen'), chip('msg', 'sit', T('m_sit'), s.msg === 'sit') + chip('msg', 'poison', T('m_silly'), s.msg === 'poison') + chip('msg', 'custom', T('m_custom'), s.msg === 'custom'))}
            ${s.msg === 'custom' ? `<input id="rg-custom" type="text" maxlength="60" placeholder="${T('customPh')}" value="${UI.escHtml(s.custom)}" style="width:100%;margin-top:4px;padding:6px;box-sizing:border-box">` : ''}</div>
        </div>
      </details>
      <div class="rg-pair" style="margin-top:8px">
        <div class="rg-pbox" style="border:2px solid #7b4fa3;background:#f1eaf7;border-radius:10px;padding:6px 8px">
          <div style="font-weight:700;color:#5b3a82">☠ ${T('solfTitle')} — <span style="font-weight:500">${T('poisonTag')}</span></div>
          <div id="rg-poison" style="background:#fff;border-radius:6px;margin-top:4px;overflow-x:auto"></div>
        </div>
        <div id="rg-notation" style="overflow-x:auto;min-height:20px"></div>
      </div>
      <div id="rg-status" style="text-align:center;font-weight:700;min-height:22px;margin-top:6px">${status || T('learnS')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <button class="modal-btn primary" data-rg="start" style="flex:1">${T('start')}</button>
        <button class="modal-btn secondary" data-rg="hear" style="flex:1">${T('hear')}</button>
        <button class="modal-btn secondary" data-rg="new" style="flex:1">${T('newPoison')}</button>
        <button class="modal-btn secondary" data-rg="stop" style="flex:1">${T('stop')}</button>
      </div>
      <button id="rg-cont" class="modal-btn primary" data-rg="cont" style="width:100%;margin-top:6px;display:none">${T('cont')}</button>`;
    const det = root.querySelector('#rg-set'); if (det) det.addEventListener('toggle', () => { setOpen = det.open; });
    const ci = root.querySelector('#rg-custom');
    if (ci) ci.addEventListener('input', () => { s.custom = ci.value; _rgSave(KEY, s); });
    pOut = _rgRenderMelody(root.querySelector('#rg-poison'), poison, s.syl);
    rOut = null;
  }
  const setStatus = (t, big) => {
    status = t; const el = root.querySelector('#rg-status'); if (!el) return;
    el.textContent = t; el.style.fontSize = big ? '30px' : ''; el.style.color = big ? '#7b4fa3' : ''; el.style.animation = 'none';
    if (big) { void el.offsetWidth; el.style.animation = 'rgpop .45s ease-out'; }
  };
  const noteHost = () => root.querySelector('#rg-notation');

  function hear() {
    stopGame(); _rgClearOv(pOut);
    let lastIdx = -2;
    run = _rgRunner(poison, {
      tempo: s.tempo, mode: 'play', countIn: s.countIn, alive,
      onFrame(phase, unit) { setStatus(_rgT(phase === 'count' ? 'st_count' : 'st_play')); if (phase === 'count') return; const i = _rgEvAt(poison, unit); if (i !== lastIdx) { lastIdx = i; _rgHL(pOut, i); } },
      onDone() { run = null; _rgHL(pOut, -1); setStatus(_rgT('learnS')); }
    });
  }
  function startGame() { stopGame(); game = { running: true, round: 0, last: false }; root.dataset.playing = '1'; nextRound(); }
  function nextRound() {
    if (!alive() || !game || !game.running) return;
    const wantPoison = game.round > 0 && !game.last && Math.random() < (s.freq === 'often' ? 0.4 : 0.2);
    const piece = wantPoison ? poison : makeOther();
    cur = { piece, isPoison: wantPoison };
    game.last = wantPoison; game.round++;
    rOut = _rgRenderMelody(noteHost(), piece, s.syl);
    let lastPhase = '', lastIdx = -2;
    run = _rgRunner(piece, {
      tempo: s.tempo, mode: 'echo', countIn: s.countIn, alive,
      onFrame(phase, unit, beat) {
        if (phase !== lastPhase) { lastPhase = phase; noteHost().style.visibility = ((phase === 'listen' && !s.showPlay) || (phase === 'echo' && !s.showEcho)) ? 'hidden' : 'visible'; }
        if (phase === 'count') { setStatus(_rgT('st_count') + ' ' + (beat + 1)); return; }
        setStatus(_rgT(phase === 'echo' ? 'st_echo' : 'st_listen'));
        const i = (noteHost().style.visibility === 'hidden') ? -1 : _rgEvAt(piece, unit);
        if (i !== lastIdx) { lastIdx = i; _rgHL(rOut, i); }
      },
      onDone() {
        run = null; noteHost().style.visibility = 'visible'; _rgHL(rOut, -1);
        if (cur.isPoison) {
          setStatus('☠ ' + msgText(), true);
          if (s.pause) { waiting = true; root.querySelector('#rg-cont').style.display = 'block'; return; }
          setTimeout(nextRound, 1800); return;
        }
        setTimeout(nextRound, 900);
      }
    });
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-rg]'); if (!b) return;
    const a = b.dataset.rg, v = b.dataset.v;
    if (a === 'tempo') { s.tempo = Math.max(40, Math.min(160, s.tempo + parseInt(v))); _rgSave(KEY, s); root.querySelector('#rg-tempo').textContent = s.tempo; return; }
    if (a === 'start') { startGame(); return; }
    if (a === 'hear') { hear(); return; }
    if (a === 'cont') { if (waiting) { waiting = false; b.style.display = 'none'; nextRound(); } return; }
    if (a === 'stop') { stopGame(); _rgClearOv(rOut); noteHost().style.visibility = 'visible'; setStatus(_rgT('st_stopped')); return; }
    if (a === 'close') { stopGame(); UI.closeModal(); return; }
    if (a === 'new') { newPoison(); return; }
    stopGame();
    if (a === 'lang') { try { LS.setItem('pauta_lang', v); } catch (err) {} paint(); return; }
    if (a === 'tog') { s[v] = !s[v]; _rgSave(KEY, s); paint(); return; }
    if (a === 'other' || a === 'freq' || a === 'msg') { s[a] = v; _rgSave(KEY, s); paint(); return; }
    // clef / range / rhythm / plen change the poison itself → new poison
    s[a] = (a === 'plen') ? parseInt(v) : v; _rgSave(KEY, s); newPoison();
  });
  _rgOnResize(id, () => { if (run) return; pOut = _rgRenderMelody(root.querySelector('#rg-poison'), poison, s.syl); if (cur) rOut = _rgRenderMelody(noteHost(), cur.piece, s.syl); });
  _rgWireTap(id, () => null, stopGame);
  newPoison();
}

// ── Sight Reading ─────────────────────────────────────────────
const _SR_NAMES = ['C4','D4','E4','F4','G4','A4','B4'];
function showSightReadingDialog() {
  const s = Object.assign({ measures:2, tsNum:4, tsDen:4, key:'C', range:'do-sol', clef:'treble', transpose:'concert', tempo:110, countIn:true, showSyllables:false, showNames:false, showCounting:false }, LS.getItem('sight_reading') ? JSON.parse(LS.getItem('sight_reading')) : {});
  let melody = null;
  let mediaRecorder = null, chunks = [], recording = false, recordedUrl = null;
  function gen() {
    melody = _srGenMelody(s);
    render();
  }
  function render() {
    const area = document.getElementById('sr-area'); if (!area) return;
    area.innerHTML = '';
    if (!melody) { area.textContent = 'Press Generate'; return; }
    const div = document.createElement('div'); div.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:8px';
    const key = _SR_KEYS.find(k=>k.key===s.key) || _SR_KEYS[0];
    const scale = key.type==='minor' ? ['do','re','me','fa','sol','le','ti'] : ['do','re','mi','fa','sol','la','ti'];
    const degs = s.range==='do-sol' ? scale.slice(0,5) : scale.slice(0,8);
    for (const n of melody) {
      const wrap = document.createElement('div'); wrap.style.cssText = 'text-align:center;min-width:28px';
      if (n.rest) {
        const r = document.createElement('div'); r.textContent = '𝄽'; r.style.fontSize='18px'; wrap.appendChild(r);
      } else {
        const note = document.createElement('div'); note.textContent = '♩'; note.style.fontSize='18px'; wrap.appendChild(note);
        if (s.showSyllables) { const sy = document.createElement('div'); sy.textContent = degs[n.deg]; sy.style.fontSize='10px'; sy.style.color='var(--pauta-primary)'; wrap.appendChild(sy); }
        if (s.showNames) { const nm = document.createElement('div'); nm.textContent = _srMidiToName(n.midi); nm.style.fontSize='9px'; nm.style.color='var(--pauta-text-muted)'; wrap.appendChild(nm); }
      }
      if (s.showCounting) { const c = document.createElement('div'); c.textContent = (n.onset/4+1).toFixed(0); c.style.fontSize='9px'; c.style.color='#888'; wrap.appendChild(c); }
      div.appendChild(wrap);
    }
    area.appendChild(div);
    const info = document.createElement('div'); info.style.cssText='text-align:center;font-size:11px;color:var(--pauta-text-muted)'; info.textContent = melody.length + ' notes · ' + s.measures + ' measures · ' + s.tsNum + '/' + s.tsDen + ' · ' + s.key + ' · ' + s.clef;
    area.appendChild(info);
  }
  function playMelody() {
    if (!melody) return;
    try {
      const ctx = getAudioCtx(); if (ctx.state==='suspended') ctx.resume();
      const bd = 60 / s.tempo;
      const t0 = ctx.currentTime + (s.countIn ? 4*bd : 0.1);
      if (s.countIn) { for (let i=0;i<4;i++) scheduleNote(ctx, 76, t0 - (4-i)*bd, 0.1, 'noise', 0.3); }
      for (const n of melody) { if (!n.rest) { const semi = _SR_TRANSPOSE[s.transpose] || 0; scheduleNote(ctx, n.midi + semi, t0 + (n.onset/4)*bd, (n.dur/4)*bd*0.9, 'sine', 0.5); } }
    } catch(e) {}
  }
  function startRec() {
    if (recording) {
      if (mediaRecorder) mediaRecorder.stop();
      recording = false; document.getElementById('sr-rec').textContent = 'Record it';
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) { UI.showToast('No microphone'); return; }
    navigator.mediaDevices.getUserMedia({audio:true}).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = e => { if (e.data.size>0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t=>t.stop());
        const blob = new Blob(chunks, {type:'audio/webm'});
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        recordedUrl = URL.createObjectURL(blob);
        const audio = document.getElementById('sr-audio');
        if (audio) { audio.src = recordedUrl; audio.style.display=''; }
      };
      mediaRecorder.start();
      recording = true;
      document.getElementById('sr-rec').textContent = 'Stop recording';
    }).catch(()=>UI.showToast('Mic unavailable'));
  }
  UI.makeModal(`
    <h2>Sight Reading</h2>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      ${[1,2,4,8].map(m=>`<button class="modal-btn ${s.measures===m?'primary':'secondary'}" data-action="srMeas" data-m="${m}" style="padding:4px 8px;font-size:11px">${m}m</button>`).join('')}
      ${['2/4','3/4','4/4','6/8'].map(ts=>{const [a,b]=ts.split('/'); return `<button class="modal-btn ${s.tsNum==+a&&s.tsDen==+b?'primary':'secondary'}" data-action="srTs" data-n="${a}" data-d="${b}" style="padding:4px 8px;font-size:11px">${ts}</button>`;}).join('')}
    </div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      <select id="sr-key" style="padding:4px 6px;font-size:11px">${_SR_KEYS.map(k=>`<option value="${k.key}" ${s.key===k.key?'selected':''}>${k.label}</option>`).join('')}</select>
      <select id="sr-range" style="padding:4px 6px;font-size:11px"><option value="do-sol" ${s.range==='do-sol'?'selected':''}>Do–Sol</option><option value="do-do" ${s.range==='do-do'?'selected':''}>Do–Do</option></select>
      <select id="sr-clef" style="padding:4px 6px;font-size:11px">${_SR_CLEFS.map(c=>`<option value="${c}" ${s.clef===c?'selected':''}>${c}</option>`).join('')}</select>
      <select id="sr-trans" style="padding:4px 6px;font-size:11px">${Object.keys(_SR_TRANSPOSE).map(t=>`<option value="${t}" ${s.transpose===t?'selected':''}>${t}</option>`).join('')}</select>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
      ${['showSyllables','showNames','showCounting'].map(k=>`<button class="modal-btn ${s[k]?'primary':'secondary'}" data-action="srToggle" data-k="${k}" style="padding:4px 8px;font-size:11px">${k.replace('show','')}</button>`).join('')}
    </div>
    <div id="sr-area" style="min-height:80px;margin-bottom:8px"></div>
    <audio id="sr-audio" style="display:none;width:100%" controls></audio>
    <div style="display:flex;gap:8px">
      <button class="modal-btn primary" id="sr-gen" style="flex:1">Generate</button>
      <button class="modal-btn secondary" id="sr-hear" style="flex:1">Hear it</button>
      <button class="modal-btn secondary" id="sr-rec" style="flex:1">Record it</button>
      <button class="modal-btn secondary" id="sr-close" style="flex:1">Close</button>
    </div>
  `);
  setTimeout(() => {
    document.querySelectorAll('[data-action="srMeas"]').forEach(b=>b.addEventListener('click',()=>{ s.measures=parseInt(b.dataset.m); LS.setItem('sight_reading',JSON.stringify(s)); showSightReadingDialog(); }));
    document.querySelectorAll('[data-action="srTs"]').forEach(b=>b.addEventListener('click',()=>{ s.tsNum=parseInt(b.dataset.n); s.tsDen=parseInt(b.dataset.d); LS.setItem('sight_reading',JSON.stringify(s)); showSightReadingDialog(); }));
    document.querySelectorAll('[data-action="srToggle"]').forEach(b=>b.addEventListener('click',()=>{ s[b.dataset.k]=!s[b.dataset.k]; LS.setItem('sight_reading',JSON.stringify(s)); showSightReadingDialog(); }));
    const keySel=document.getElementById('sr-key'); if(keySel) keySel.addEventListener('change',()=>{ s.key=keySel.value; LS.setItem('sight_reading',JSON.stringify(s)); showSightReadingDialog(); });
    const rangeSel=document.getElementById('sr-range'); if(rangeSel) rangeSel.addEventListener('change',()=>{ s.range=rangeSel.value; LS.setItem('sight_reading',JSON.stringify(s)); showSightReadingDialog(); });
    const clefSel=document.getElementById('sr-clef'); if(clefSel) clefSel.addEventListener('change',()=>{ s.clef=clefSel.value; LS.setItem('sight_reading',JSON.stringify(s)); showSightReadingDialog(); });
    const transSel=document.getElementById('sr-trans'); if(transSel) transSel.addEventListener('change',()=>{ s.transpose=transSel.value; LS.setItem('sight_reading',JSON.stringify(s)); showSightReadingDialog(); });
    const gen=document.getElementById('sr-gen'); if(gen) gen.addEventListener('click',()=>{ melody=_srGenMelody(s); render(); });
    const hear=document.getElementById('sr-hear'); if(hear) hear.addEventListener('click',playMelody);
    const rec=document.getElementById('sr-rec'); if(rec) rec.addEventListener('click',startRec);
    const cl=document.getElementById('sr-close'); if(cl) cl.addEventListener('click',()=>UI.closeModal());
    melody = _srGenMelody(s); render();
  },0);
}

// ── Rhythm Dictation ─────────────────────────────────────────────
// Hear a phrase, write it with beat tiles, check beat by beat. Built on the
// same rhythm engine as the Randomizer and Poison Rhythm. No pitch input.
const _RD_KEY = 'pauta_rg_dict';
const _RD_GLYPH = { 8: '𝅗𝅥', 6: '♩.', 4: '♩', 2: '♪', 1: '𝅘𝅥𝅯' };
const _RD_REST = { 8: '𝄽', 6: '𝄽', 4: '𝄽', 2: '𝄾', 1: '𝄿' };
const _RD_PIC = { 8: '🐢', 6: '🐢', 4: '🚶', 2: '🐇', 1: '🐝' };
// VexFlow rest glyph paths, normalised to their bounding boxes. Reusing the
// score's own shapes keeps the tile notation identical to the staff notation.
const _RD_RESTS = {
  q: {
    x: 77.1783, y: 54.4676, w: 9.7776, h: 27.1404,
    d: 'M77.15312 68M81.38672 81.2804C81.68912 81.5072,82.04192 81.608,82.34432 81.608C82.59632 81.608,82.84832 81.5324,82.89872 81.3812C82.92392 81.2804,82.94912000000001 81.2048,82.94912000000001 81.1292C82.94912000000001 80.80160000000001,82.67192 80.5244,82.36952 80.2724C81.91592 80.2724,81.51272 79.28960000000001,81.43712000000001 78.962C81.33632 78.6596,81.28592 78.332,81.28592 78.0044C81.28592 76.5176,82.04192 75.3584,83.57912 75.3584C84.63752 75.3584,85.82192 75.7616,86.40152 75.9884C86.45192 75.9884,86.47712 76.0136,86.52752 76.0136C86.62832 76.064,86.70392 76.064,86.77952 76.064C86.88032 76.064,86.95592 76.0136,86.95592 75.9128C86.95592 75.4844,85.99832 74.2748,85.62032 73.8464C84.23432 72.1832,83.10032 70.8224,83.10032 68.8064C83.10032 68.6552,83.15072 68.4788,83.15072 68.3276C83.27672 66.2108,84.58712 64.472,85.54472 62.9852C85.64552 62.8088,85.67072 62.6324,85.67072 62.456C85.67072 62.078,85.54472 61.7504,85.54472 61.7504C85.54472 61.7504,80.17712 55.3748,79.54712 54.7448C79.37072 54.5684,79.11872 54.4676,78.89192 54.4676C78.53912 54.4676,78.16112 54.7196,78.16112 55.2236C78.16112 55.4,78.21152000000001 55.6016,78.31232 55.803200000000004C78.46352 56.2064,80.52992 58.046,80.52992 60.6668C80.52992 62.0024,79.97552 63.5648,78.36272 65.2784C77.98472 65.6312,77.83352000000001 66.0344,77.83352000000001 66.3368C77.83352000000001 66.8408,78.21152000000001 67.1936,78.21152000000001 67.1936L79.97552 69.386C80.55512 70.1168,81.08432 70.7972,81.53792 71.5532C81.61352 71.7044,81.76472 71.9816,81.76472 72.0572C81.76472 72.1076,81.76472 72.1832,81.71432 72.2084C81.66392 72.3596,81.51272 72.3848,81.33632 72.3848C81.18512 72.3848,80.88272 72.3092,80.75672 72.284C80.55512 72.284,80.35352 72.1832,80.17712 72.1832C78.61472 72.1832,77.17832 73.7456,77.17832 75.6608C77.17832 77.4752,78.74072 79.2392,81.38672 81.2804'
  },
  e: {
    x: 77.15312, y: 62.9456, w: 11.934, h: 10.1088,
    d: 'M77.15312 68M77.15312 69.6848C77.15312 71.7908,78.89408 73.0544,81.08432 73.0544C84.67856 73.0544,89.08712 69.74096,89.08712 66.3152C89.08712 64.23728,87.45848000000001 62.9456,85.15592000000001 62.9456C80.71928 62.9456,77.15312 66.23096,77.15312 69.6848'
  }
};
const _RD_SYLL = { 8: 'ta-a', 6: 'ta-a', 4: 'ta', 2: 'ti', 1: 'ti-ka' };

function _rdTiles(meter, active) {
  const list = [];
  _RG_CELLS[meter.beat].forEach(c => { if (_rgCellOk(c, active)) list.push({ span: 1, c: c.c, w: c.w }); });
  if (meter.beat === 4) _RG_CELLS2.forEach(c => { if (_rgCellOk(c, active)) list.push({ span: 2, c: c.c, w: c.w }); });
  return list;
}
function _rdKeyOf(c) { return c.map(([u, r]) => u + (r ? 'r' : '')).join('-'); }
function _rdGlyphs(cell) { return cell.map(([u, r]) => r ? (_RD_REST[u] || '𝄽') : (_RD_GLYPH[u] || '♩')).join(''); }
function _rdPics(cell) { return cell.map(([u, r]) => r ? '😴' : (_RD_PIC[u] || '🚶')).join(''); }
// Self-contained SVG notation for a beat cell. Unicode music glyphs are not
// installed on many systems and render as tofu, so tiles draw their own notes.
function _rdCellSVG(cell) {
  const W = 130, H = 44, base = 28;
  const total = cell.reduce((a, [u]) => a + u, 0) || 4;
  const step = (W - 18) / total;
  const stems = [], parts = [];
  let x = 9;
  cell.forEach(([u, r]) => {
    const w = u * step, cx = x + w / 2;
    if (r) {
      const g = u >= 4 ? _RD_RESTS.q : _RD_RESTS.e;
      const sc = u === 1 ? 0.8 : 1;
      parts.push('<g transform="translate(' + (cx - g.w * sc / 2) + ',' + (base - g.h * sc / 2) +
        ') scale(' + sc + ') translate(-' + g.x + ',-' + g.y + ')"><path d="' + g.d + '" fill="#111"/></g>');
    } else {
      const open = u >= 6;
      parts.push('<ellipse cx="' + cx + '" cy="' + base + '" rx="5.4" ry="4" fill="' + (open ? '#fff' : '#111') + '" stroke="#111" stroke-width="1.6"/>');
      const sx = cx + 5;
      parts.push('<line x1="' + sx + '" y1="' + base + '" x2="' + sx + '" y2="9" stroke="#111" stroke-width="1.8"/>');
      if (u === 6) parts.push('<circle cx="' + (cx + 10) + '" cy="' + (base - 1) + '" r="1.5" fill="#111"/>');
      if (u <= 2) stems.push({ x: sx, sixteenth: u === 1 });
    }
    x += w;
  });
  // Beam consecutive short notes; the second beam spans only sixteenth pairs.
  let group = [];
  const flush = () => {
    if (group.length > 1) {
      const a = group[0].x, b = group[group.length - 1].x;
      parts.push('<line x1="' + a + '" y1="9" x2="' + b + '" y2="9" stroke="#111" stroke-width="3"/>');
      let run = [];
      const endRun = () => {
        if (run.length > 1) {
          parts.push('<line x1="' + run[0].x + '" y1="13" x2="' + run[run.length - 1].x + '" y2="13" stroke="#111" stroke-width="3"/>');
        } else if (run.length === 1) {
          // An isolated sixteenth (e.g. 16-8-16) gets a partial second beam,
          // not a full beam that would wrongly beam the eighth note twice.
          const n = run[0], i = group.indexOf(n);
          const left = group.slice(0, i).some(x => x.sixteenth);
          const right = group.slice(i + 1).some(x => x.sixteenth);
          const frag = Math.min(14, step * 0.6);
          if (left) parts.push('<line x1="' + (n.x - frag) + '" y1="13" x2="' + n.x + '" y2="13" stroke="#111" stroke-width="3"/>');
          if (right) parts.push('<line x1="' + n.x + '" y1="13" x2="' + (n.x + frag) + '" y2="13" stroke="#111" stroke-width="3"/>');
        }
        run = [];
      };
      group.forEach(n => { if (!n.sixteenth) endRun(); else run.push(n); });
      endRun();
    }
    group = [];
  };
  stems.forEach(n => { if (group.length && Math.abs(n.x - group[group.length - 1].x) > step * 3.2) flush(); group.push(n); });
  flush();
  return '<svg class="rd-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + parts.join('') + '</svg>';
}
function _rdWord(meter, cell, startUnit, say) {
  if (say === 'hide') return '';
  let on = startUnit;
  const parts = cell.map(([u, r]) => {
    const label = say === 'count' ? _rgCountLabel(meter, { on, rest: !!r }) : (r ? 'rest' : (_RD_SYLL[u] || 'ta'));
    on += u;
    return label;
  });
  return parts.join(say === 'count' ? ' ' : '-');
}
function _rdWordFn(say) {
  if (say === 'hide') return null;
  return (meter, e) => e.ghost ? null : (say === 'count' ? _rgCountLabel(meter, e) : (e.rest ? 'rest' : (_RD_SYLL[e.u] || 'ta')));
}
function _rdClose(meter, active) {
  const full = meter.beat;
  if (active.has(_rgKey(full, false))) return [[full, 0]];
  const cands = _rdTiles(meter, active).filter(t => t.span === 1 && t.c.every(([u, r]) => !r));
  if (!cands.length) return null;
  cands.sort((a, b) => a.c.length - b.c.length);
  const best = cands.filter(t => t.c.length === cands[0].c.length);
  return best[Math.floor(Math.random() * best.length)].c;
}
function _rdGenTarget(meter, active, nMeas) {
  const tiles = _rdTiles(meter, active);
  const one = tiles.filter(t => t.span === 1), two = tiles.filter(t => t.span === 2);
  if (!one.length) return null;
  for (let k = 0; k < 40; k++) {
    const close = _rdClose(meter, active);
    if (!close) return null;
    const perMeasure = [];
    for (let mi = 0; mi < nMeas; mi++) {
      const nB = meter.units / meter.beat, slots = [];
      for (let b = 0; b < nB;) {
        if (mi === nMeas - 1 && b === nB - 1) { slots.push({ span: 1, c: close }); b++; continue; }
        const canTwo = two.length && b % 2 === 0 && b + 2 <= nB && !(mi === nMeas - 1 && b + 2 >= nB);
        const pool = canTwo && Math.random() < 0.25 ? two : one;
        const pick = _rgPick(pool);
        slots.push({ span: pick.span, c: pick.c });
        b += pick.span;
      }
      perMeasure.push(slots);
    }
    const p = _rgBuild(meter, perMeasure);
    if (p.events[0].rest || !p.measures.every(m => m.some(e => !e.rest))) continue;
    return p;
  }
  return null;
}
function _rdBuildAnswer(meter, answer, nMeas) {
  const perMeasure = [], ghostAt = new Set();
  for (let mi = 0; mi < nMeas; mi++) {
    const items = answer.filter(it => it.m === mi).sort((a, b) => a.beat - b.beat);
    const slots = [];
    for (let b = 0; b < meter.units / meter.beat;) {
      const it = items.find(x => x.beat === b);
      if (it) { slots.push({ span: it.span, c: it.c }); b += it.span; }
      else { slots.push({ span: 1, c: [[meter.beat, 1]] }); ghostAt.add(mi + ':' + (b * meter.beat)); b++; }
    }
    perMeasure.push(slots);
  }
  const p = _rgBuild(meter, perMeasure);
  p.events.forEach(e => { if (ghostAt.has(e.m + ':' + e.on)) e.ghost = true; });
  return p;
}
function _rdBeatMarks(target, ans, meter) {
  const total = target.len / meter.beat, marks = [];
  for (let b = 0; b < total; b++) {
    const start = b * meter.beat;
    const norm = p => p.events.filter(e => e.on >= start && e.on < start + meter.beat)
      .map(e => (e.ghost ? 'g' : 'n') + ':' + (e.on - start) + ':' + e.u + ':' + (e.rest ? 1 : 0)).join(',');
    marks.push(norm(target) === norm(ans));
  }
  return marks;
}
function _rdWireKeys(id, map) {
  const key = ev => {
    if (!document.getElementById(id)) { document.removeEventListener('keydown', key, true); return; }
    if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
    if (ev.target && ev.target.isContentEditable) return;
    const fn = map[ev.code] || map[ev.key];
    if (!fn) return;
    ev.preventDefault(); ev.stopPropagation();
    if (!ev.repeat) fn();
  };
  document.addEventListener('keydown', key, true);
}
const _rdCss = id => `<style>
#${id} .rd-layout{display:grid;grid-template-columns:minmax(190px,230px) 1fr;gap:12px;align-items:start}
@media(max-width:820px){#${id} .rd-layout{grid-template-columns:1fr}}
#${id} .rd-side{background:var(--pauta-bg-card);border:1px solid rgba(74,85,104,.18);border-radius:var(--pauta-radius-md);padding:8px}
#${id} .rd-cap{font-size:12px;font-weight:700;color:var(--pauta-text-muted);margin-bottom:6px}
#${id} .rd-pal{display:flex;flex-direction:column;gap:6px}
#${id} .rd-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:54px;padding:6px 8px;border:2px solid rgba(74,85,104,.25);border-radius:var(--pauta-radius-sm);background:var(--pauta-bg-card);cursor:grab;touch-action:manipulation;font-family:inherit}
#${id} .rd-tile:hover{border-color:var(--pauta-primary)}
#${id} .rd-tile.is-sel{border-color:var(--pauta-primary);background:rgba(204,24,69,.08)}
#${id} .rd-face{display:flex;align-items:center;justify-content:center;gap:3px;min-height:24px}
#${id} .rd-svg{display:block;width:100%;max-width:120px;height:38px}
#${id} .rd-cell .rd-svg{height:34px}
#${id} .rd-pic{font-size:19px;line-height:1}
#${id} .rd-word{font-size:11px;color:var(--pauta-text-muted)}
#${id} .rd-measure{display:grid;gap:6px;margin-bottom:8px}
#${id} .rd-mlabel{display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--pauta-text-muted);font-weight:700}
#${id} .rd-cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:68px;padding:4px;border:2px dashed rgba(74,85,104,.35);border-radius:var(--pauta-radius-sm);background:var(--pauta-bg-card);cursor:pointer;font-family:inherit;touch-action:manipulation;transition:border-color .12s,background .12s}
#${id} .rd-cell:hover{border-color:var(--pauta-primary)}
#${id} .rd-cell.is-filled{border-style:solid}
#${id} .rd-cell.is-right{border-color:var(--pauta-success);background:rgba(34,197,94,.1)}
#${id} .rd-cell.is-wrong{border-color:var(--pauta-error);background:rgba(224,104,80,.1)}
#${id} .rd-beat{font-size:13px;color:var(--pauta-text-muted)}
#${id} .rd-badge{font-size:9px;color:var(--pauta-primary);font-weight:700}
#${id} .rd-mark{position:absolute;top:2px;right:4px;font-size:13px;font-weight:700}
#${id} .rd-cell.is-right .rd-mark{color:#15803d}
#${id} .rd-cell.is-wrong .rd-mark{color:#b91c1c}
</style>`;

function showRhythmDictationDialog() {
  const id = 'rg-root-' + (++_rgDlgSeq);
  const s = _rgLoad(_RD_KEY, { ts: '4/4', measures: 1, tempo: 90, vals: ['q', '8'], countIn: true, hint: false, view: 'notation', say: 'hide' });
  let target = null, answer = [], tiles = [], sel = null;
  let checked = false, marks = null, celebrated = false, reveal = false;
  let solOut = null, ansOut = null, run = null, playing = null, setOpen = true;
  let sess = { phrases: 0, correct: 0, total: 0, checkedThis: false };
  const alive = () => !!document.getElementById(id);
  const meter = () => _RG_METERS[s.ts];
  const nBeats = () => meter().units / meter().beat;
  const active = () => new Set(s.vals);
  const T = _rgT;
  const wordFn = () => _rdWordFn(s.say);

  UI.makeModal(`<div id="${id}"></div>`);
  const root = document.getElementById(id);
  _rgBig(root);

  function updateButtons() {
    const bp = root.querySelector('[data-rd="playPhrase"]');
    if (bp) bp.textContent = playing === 'phrase' ? '■ ' + T('stop') : '▶ ' + T('playPhrase');
    const bm = root.querySelector('[data-rd="playMine"]');
    if (bm) bm.textContent = playing === 'mine' ? '■ ' + T('stop') : '▶ ' + T('playMine');
  }
  function stopRun() {
    if (run) { run.stop(); run = null; }
    playing = null; updateButtons();
  }
  function setStatus(t) { const el = root.querySelector('#rd-status'); if (el) el.textContent = t; }
  function updateScore() {
    const el = root.querySelector('#rd-score'); if (!el) return;
    const parts = [];
    if (sess.phrases) parts.push(sess.phrases + ' ' + T('phrases'));
    if (sess.total) parts.push(sess.correct + '/' + sess.total);
    el.textContent = parts.length ? T('session') + ': ' + parts.join(' · ') : '';
  }
  function tileOK(it) {
    if (!marks) return false;
    const nB = nBeats();
    for (let k = 0; k < it.span; k++) if (!marks[it.m * nB + it.beat + k]) return false;
    return true;
  }
  function face(tile, cell, startUnit) {
    const word = _rdWord(meter(), cell, startUnit, s.say);
    const notation = s.view !== 'pictures' ? _rdCellSVG(cell) : '';
    const picture = s.view !== 'notation' ? `<span class="rd-pic">${_rdPics(cell)}</span>` : '';
    return `<span class="rd-face">${notation}${picture}</span>` + (word ? `<span class="rd-word">${word}</span>` : '');
  }

  function paintPalette() {
    const pal = root.querySelector('#rd-pal'); if (!pal) return;
    pal.innerHTML = '';
    tiles.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'rd-tile' + (sel === i ? ' is-sel' : '');
      b.dataset.rdTile = String(i);
      b.draggable = true;
      b.title = T('tileTip');
      b.innerHTML = face(t, t.c, 0);
      pal.appendChild(b);
    });
  }
  function paintGrid() {
    const host = root.querySelector('#rd-grid'); if (!host) return;
    host.innerHTML = '';
    const M = meter(), nB = M.units / M.beat;
    for (let mi = 0; mi < s.measures; mi++) {
      const row = document.createElement('div');
      row.className = 'rd-measure';
      row.style.gridTemplateColumns = '26px repeat(' + nB + ', minmax(56px,1fr))';
      const label = document.createElement('div');
      label.className = 'rd-mlabel'; label.textContent = String(mi + 1);
      row.appendChild(label);
      for (let b = 0; b < nB;) {
        const it = answer.find(x => x.m === mi && x.beat === b);
        const gBeat = mi * nB + b;
        const cell = document.createElement('button');
        cell.className = 'rd-cell' + (it ? ' is-filled' : '');
        cell.dataset.rdM = String(mi); cell.dataset.rdB = String(b);
        if (it) {
          cell.style.gridColumn = 'span ' + it.span;
          cell.innerHTML = face(it, it.c, b * M.beat);
          if (it.hint) { const badge = document.createElement('span'); badge.className = 'rd-badge'; badge.textContent = T('rdHint'); cell.appendChild(badge); }
        } else {
          cell.innerHTML = '<span class="rd-beat">' + (b + 1) + '</span>';
        }
        if (checked) {
          const ok = it ? tileOK(it) : !!marks && marks[gBeat];
          cell.classList.add(ok ? 'is-right' : 'is-wrong');
          const mk = document.createElement('span');
          mk.className = 'rd-mark'; mk.textContent = ok ? '✓' : '✗';
          cell.appendChild(mk);
        }
        row.appendChild(cell);
        b += it ? it.span : 1;
      }
      host.appendChild(row);
    }
  }
  function renderStaffs() {
    const p = _rdBuildAnswer(meter(), answer, s.measures);
    ansOut = _rgRender(root.querySelector('#rd-staff'), p, s.say === 'count', wordFn());
    const sol = root.querySelector('#rd-solution');
    if (reveal && target) {
      sol.style.display = '';
      solOut = _rgRender(root.querySelector('#rd-solstaff'), target, s.say === 'count', wordFn());
    } else {
      sol.style.display = 'none'; solOut = null;
    }
  }
  function paint() {
    if (!s.vals.length) s.vals = ['q'];
    tiles = _rdTiles(meter(), active());
    if (sel !== null && sel >= tiles.length) sel = null;
    const settingsHTML = `
      <div class="rg-set">
        <div>${_rgRow(T('ts'), Object.keys(_RG_METERS).map(k => _rgChip('rdTs', k, k, s.ts === k)).join(''))}</div>
        <div>${_rgRow(T('meas'), [1, 2].map(n => _rgChip('rdMeas', n, n, s.measures === n)).join(''))}</div>
        <div>${_rgRow(T('tempo'), _rgTempoRow(s.tempo))}</div>
        <div>${_rgRow(T('opts'), _rgChip('rdTog', 'countIn', T('countIn'), s.countIn) + _rgChip('rdTog', 'hint', T('hint'), s.hint))}</div>
        <div>${_rgRow(T('view'), ['notation', 'pictures', 'both'].map(v => _rgChip('rdView', v, T('view' + v[0].toUpperCase() + v.slice(1)), s.view === v)).join(''))}</div>
        <div>${_rgRow(T('sayWith'), ['hide', 'count', 'syll'].map(v => _rgChip('rdSay', v, T(v === 'hide' ? 'sayHide' : v === 'count' ? 'sayCount' : 'saySyll'), s.say === v)).join(''))}</div>
        <div style="grid-column:1/-1">${_rgRow(T('vals'), _rgValChips(s.vals))}</div>
      </div>`.replace(/data-rg=/g, 'data-rd=');
    root.innerHTML = `
      ${_rgCss(id)}${_rdCss(id)}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">
        <h2 style="margin:0">${T('dictTitle')}</h2>
        <div style="display:flex;gap:4px;align-items:center">${_rgLangChips()}<button class="modal-btn secondary" data-rd="close" style="padding:4px 12px;font-size:12px;margin-left:8px">${T('close')}</button></div>
      </div>
      <details id="rd-set" ${setOpen ? 'open' : ''}><summary style="cursor:pointer;font-weight:600;font-size:13px">${T('more')}</summary>${settingsHTML}</details>
      <div style="font-size:12px;color:var(--pauta-text-muted);margin:6px 0">${T('dictHelp')} ${T('tileTip')}</div>
      <div class="rd-layout">
        <div class="rd-side">
          <div class="rd-cap">${T('vals')}</div>
          <div class="rd-pal" id="rd-pal"></div>
        </div>
        <div class="rd-board">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="rd-cap" style="margin:0">${T('yourAnswer')}</div>
            <button class="modal-btn secondary" data-rd="clear" style="padding:3px 8px;font-size:11px">${T('clear')}</button>
          </div>
          <div id="rd-staff" style="overflow-x:auto"></div>
          <div id="rd-grid"></div>
          <div id="rd-status" style="text-align:center;font-weight:700;min-height:22px"></div>
          <div id="rd-score" style="text-align:center;font-size:12px;color:var(--pauta-text-muted)"></div>
          <div id="rd-solution" style="display:none">
            <div class="rd-cap" style="margin-top:6px">${T('correctAnswer')}</div>
            <div id="rd-solstaff" style="overflow-x:auto"></div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        <button class="modal-btn primary" data-rd="playPhrase" style="flex:1">▶ ${T('playPhrase')}</button>
        <button class="modal-btn secondary" data-rd="playMine" style="flex:1">▶ ${T('playMine')}</button>
        <button class="modal-btn secondary" data-rd="check" style="flex:1">✓ ${T('check')}</button>
        <button class="modal-btn secondary" data-rd="show" style="flex:1">${T('showAnswer')}</button>
        <button class="modal-btn secondary" data-rd="next" style="flex:1">${T('nextPhrase')}</button>
      </div>`;
    const det = root.querySelector('#rd-set'); if (det) det.addEventListener('toggle', () => { setOpen = det.open; });
    paintPalette(); paintGrid(); renderStaffs(); updateScore(); updateButtons();
  }
  function hintItem() {
    const first = target.slots[0][0];
    return { m: 0, beat: 0, span: first.span, c: first.c, hint: true };
  }
  function next() {
    stopRun();
    if (!s.vals.length) s.vals = ['q'];
    // A meter-only rest selection (or dotted-quarter-only in 4/4) yields no
    // usable tiles. Add the meter's full-beat note so the tool stays usable.
    if (!_rdTiles(meter(), active()).length) {
      const fallback = meter().beat === 6 ? 'dq' : 'q';
      if (!s.vals.includes(fallback)) { s.vals.push(fallback); _rgSave(_RD_KEY, s); }
    }
    target = null;
    for (let i = 0; i < 6 && !target; i++) target = _rdGenTarget(meter(), active(), s.measures);
    if (!target) { paint(); setStatus(T('st_empty')); return; }
    answer = s.hint ? [hintItem()] : [];
    checked = false; marks = null; celebrated = false; reveal = false; sess.checkedThis = false; sel = null;
    paint();
    setStatus(T('st_readyD'));
  }
  function previewTile(t) {
    try {
      const ctx = getAudioCtx(); if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime + 0.02, step = (60 / s.tempo) / 4;
      let off = 0;
      t.c.forEach(([u, r]) => { if (!r) scheduleNote(ctx, 72, now + off, Math.max(0.06, u * step * 0.8), 'triangle', 0.75); off += u * step; });
    } catch (e) {}
  }
  function selectTile(i) {
    if (!tiles[i]) return;
    sel = i; previewTile(tiles[i]); paintPalette();
  }
  function tapBeat(m, b) {
    if (!target) return;
    const M = meter(), nB = M.units / M.beat;
    if (b < 0 || b >= nB) return;
    const it = answer.find(x => x.m === m && b >= x.beat && b < x.beat + x.span);
    if (sel === null) {
      if (!it) return;
      answer = answer.filter(x => x !== it);
    } else {
      const t = tiles[sel];
      if (it && _rdKeyOf(it.c) === _rdKeyOf(t.c) && it.span === t.span) {
        answer = answer.filter(x => x !== it);
      } else {
        let beat = b;
        if (t.span === 2) {
          if (M.num === 4) beat = b % 2 === 0 ? b : b - 1;
          if (beat + 2 > nB) beat = Math.max(0, nB - 2);
        }
        answer = answer.filter(x => !(x.m === m && beat < x.beat + x.span && x.beat < beat + t.span));
        answer.push({ m, beat, span: t.span, c: t.c });
      }
    }
    checked = false; marks = null; celebrated = false;
    paintGrid(); renderStaffs();
    setStatus(T('st_readyD'));
  }
  function celebrate() {
    try {
      const ctx = getAudioCtx(); if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime + 0.04;
      [72, 76, 79].forEach((n, i) => scheduleNote(ctx, n, now + i * 0.09, 0.18, 'sine', 0.35));
    } catch (e) {}
    const old = document.getElementById('rd-confetti'); if (old) old.remove();
    const c = document.createElement('div');
    c.id = 'rd-confetti'; c.className = 'pauta-confetti-container';
    c.style.cssText = 'position:absolute;left:50%;top:38%;z-index:5';
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('div');
      d.className = 'pauta-confetti-dot';
      d.style.cssText = 'left:' + (Math.random() * 200 - 100) + 'px;top:' + (Math.random() * 40 - 20) + 'px;background:' +
        ['var(--pauta-primary)', '#22c55e', '#f59e0b', '#3b82f6'][i % 4] + ';animation-delay:' + (Math.random() * 0.3) + 's';
      c.appendChild(d);
    }
    (root.querySelector('.rd-board') || root).appendChild(c);
    setTimeout(() => { if (c.parentNode) c.remove(); }, 1800);
  }
  function check() {
    if (!target) return;
    if (!answer.length) { setStatus(T('st_empty')); return; }
    const ans = _rdBuildAnswer(meter(), answer, s.measures);
    marks = _rdBeatMarks(target, ans, meter());
    checked = true;
    const correct = marks.filter(Boolean).length;
    setStatus(correct === marks.length ? T('allCorrect') : correct + '/' + marks.length + ' ' + T('beatsCorrect'));
    paintGrid();
    if (correct === marks.length && !celebrated) { celebrated = true; celebrate(); }
    if (!sess.checkedThis) {
      sess.checkedThis = true; sess.phrases++; sess.correct += correct; sess.total += marks.length;
      if (typeof _saveExerciseResult === 'function') {
        _saveExerciseResult({ type: 'rhythm_dictation', difficulty: s.ts, correctCount: correct, totalCount: marks.length, streak: 0, maxStreak: 0, startedAt: Date.now() });
      }
      updateScore();
    }
  }
  function showAnswer() {
    if (!target) return;
    reveal = true; paint(); setStatus(T('st_checked'));
  }
  function playPhrase() {
    if (!target) return;
    stopRun(); playing = 'phrase'; updateButtons();
    let last = -2;
    run = _rgRunner(target, {
      tempo: s.tempo, mode: 'play', countIn: s.countIn, alive,
      noteOsc: 'triangle', noteVol: 0.85, clickBoost: 1.6,
      onFrame(phase, unit, beat) {
        setStatus(phase === 'count' ? T('st_count') + ' ' + (beat + 1) : T('st_listen'));
        if (solOut) {
          const i = phase === 'count' ? -1 : _rgEvAt(target, unit);
          if (i !== last) { last = i; _rgHL(solOut, i); }
        }
      },
      onDone() { if (solOut) _rgHL(solOut, -1); stopRun(); setStatus(T('st_readyD')); }
    });
  }
  function playMine() {
    if (!answer.length) { setStatus(T('st_empty')); return; }
    stopRun();
    const p = _rdBuildAnswer(meter(), answer, s.measures);
    playing = 'mine'; updateButtons();
    let last = -2;
    run = _rgRunner(p, {
      tempo: s.tempo, mode: 'play', countIn: s.countIn, alive,
      noteOsc: 'triangle', noteVol: 0.85, clickBoost: 1.6,
      onFrame(phase, unit, beat) {
        setStatus(phase === 'count' ? T('st_count') + ' ' + (beat + 1) : T('st_mine'));
        if (phase !== 'count' && ansOut) {
          const i = _rgEvAt(p, unit);
          if (i !== last) { last = i; _rgHL(ansOut, i); }
        }
      },
      onDone() { if (ansOut) _rgHL(ansOut, -1); stopRun(); setStatus(T('st_readyD')); }
    });
  }

  root.addEventListener('click', e => {
    const tile = e.target.closest('[data-rd-tile]');
    if (tile) { selectTile(parseInt(tile.dataset.rdTile, 10)); return; }
    const cell = e.target.closest('[data-rd-m]');
    if (cell) { tapBeat(parseInt(cell.dataset.rdM, 10), parseInt(cell.dataset.rdB, 10)); return; }
    const b = e.target.closest('[data-rd],[data-rg]'); if (!b) return;
    const a = b.dataset.rd || b.dataset.rg, v = b.dataset.v;
    if (a === 'tempo') {
      s.tempo = Math.max(40, Math.min(200, s.tempo + parseInt(v, 10))); _rgSave(_RD_KEY, s);
      const el = root.querySelector('#rg-tempo'); if (el) el.textContent = s.tempo;
      return;
    }
    if (a === 'close') { stopRun(); UI.closeModal(); return; }
    if (a === 'clear') {
      answer = s.hint && target ? [hintItem()] : [];
      checked = false; marks = null; celebrated = false;
      paint(); setStatus(T('st_readyD')); return;
    }
    if (a === 'playPhrase') { if (playing === 'phrase') { stopRun(); setStatus(T('st_stopped')); } else playPhrase(); return; }
    if (a === 'playMine') { if (playing === 'mine') { stopRun(); setStatus(T('st_stopped')); } else playMine(); return; }
    if (a === 'check') { check(); return; }
    if (a === 'show') { showAnswer(); return; }
    if (a === 'next') { next(); return; }
    if (a === 'lang') { try { LS.setItem('pauta_lang', v); } catch (err) {} setOpen = root.querySelector('#rd-set').open; next(); return; }
    if (a === 'rdTs') s.ts = v;
    else if (a === 'rdMeas') s.measures = parseInt(v, 10);
    else if (a === 'val') s.vals = s.vals.includes(v) ? s.vals.filter(x => x !== v) : s.vals.concat(v);
    else if (a === 'rdTog') s[v] = !s[v];
    else if (a === 'rdView') s.view = v;
    else if (a === 'rdSay') s.say = v;
    else return;
    _rgSave(_RD_KEY, s); next();
  });
  root.addEventListener('dragstart', e => {
    const t = e.target.closest('[data-rd-tile]'); if (!t) return;
    e.dataTransfer.setData('text/plain', t.dataset.rdTile);
    e.dataTransfer.effectAllowed = 'copy';
    sel = parseInt(t.dataset.rdTile, 10);
  });
  root.addEventListener('dragover', e => { if (e.target.closest('[data-rd-m]')) e.preventDefault(); });
  root.addEventListener('drop', e => {
    const c = e.target.closest('[data-rd-m]'); if (!c) return;
    e.preventDefault();
    const idx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(idx) && tiles[idx]) { sel = idx; tapBeat(parseInt(c.dataset.rdM, 10), parseInt(c.dataset.rdB, 10)); paintPalette(); }
  });
  _rdWireKeys(id, {
    Space: () => { if (playing) { stopRun(); setStatus(T('st_stopped')); } else playPhrase(); },
    KeyC: check, KeyA: showAnswer, KeyN: next,
    Escape: () => { stopRun(); UI.closeModal(); }
  });
  _rgOnResize(id, () => { if (!run) renderStaffs(); });
  next();
}

function _rwGetSettings() {
  try { const _s = LS.getItem('pauta_rhythm_workout'); return _s ? JSON.parse(_s) : JSON.parse(JSON.stringify(RHYTHM_WORKOUT_DEFAULTS)); }
  catch(e) { return JSON.parse(JSON.stringify(RHYTHM_WORKOUT_DEFAULTS)); }
}

function _rwSaveSettings(s) {
  try { LS.setItem('pauta_rhythm_workout', JSON.stringify(s)); } catch(e) { console.warn('Failed to save rhythm workout settings:', e); }
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
  let _guard = 0;
  while (beatsRemaining > 0.001 && _guard < 10000) {
    _guard++;
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

  UI.makeModal(`
    <h2>Rhythm Workout</h2>
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
    UI.closeModal();
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
  const score = SCORE.createScore({
    title: 'Rhythm Workout',
    instruments: ['Snare Drum'],
    ts: { num: ts.num, den: ts.den },
    ks: 0,
  });

  // Build notes array
  const vfNotes = notes.map(n => {
    if (n.rest) return SCORE.mkRest(n.duration, n.dots);
    return SCORE.mkNote(67, n.duration, n.dots);
  });

  score.parts[0].staves[0].measures[0].notes = vfNotes;
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  RENDER.renderScore();
  UI.showToast(`Rhythm Workout: ${ts.num}/${ts.den} at ${tempo} BPM — read it, then tap along.`);

  // Build expected tap times (one per note, skipping rests)
  const beatDurMs = 60000 / (tempo || 100);
  const expected = [];
  let t = 0;
  notes.forEach(n => {
    const beats = _durBeats(n.duration, n.dots);
    if (n.type !== 'rest') expected.push(t);
    t += beats * beatDurMs;
  });

  const s = APP.exerciseSession;
  _showRhythmTapPad(expected, beatDurMs, (pct, matches, expectedCount, tapCount) => {
    if (!s || !s.current) return;
    s.totalCount++;
    if (pct >= 80) { s.correctCount++; s.streak++; if (s.streak > s.maxStreak) s.maxStreak = s.streak; }
    else { s.streak = 0; }
    s.completed.push({ type: EXERCISE_TYPES.RHYTHM_WORKOUT, answer: `${matches}/${expectedCount}`, ok: pct >= 80, hint: 'Compare your taps to the rhythm.' });
    _updateScoreDisplay();
    if (pct >= 80) {
      _showSuccessBanner(`✓ ${matches}/${expectedCount} taps matched!`, { correctAnswer: '', streak: s.streak });
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
    } else {
      _showExerciseFeedback(ex, `${matches}/${expectedCount} taps matched`);
    }
  });
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
