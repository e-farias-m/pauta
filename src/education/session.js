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
        <div style="background:rgba(192,86,33,0.05);border-left:3px solid var(--pauta-primary);padding:12px;margin-bottom:16px;border-radius:0 6px 6px 0">
          <div style="font-weight:600;color:var(--pauta-primary);margin-bottom:4px">Learning Goal</div>
          <div style="font-size:13px;color:var(--pauta-text)">${intro.goal}</div>
        </div>

        <p style="font-size:13px;color:var(--pauta-text-muted);line-height:1.6;margin-bottom:16px">${intro.description}</p>

        <div style="margin-bottom:16px">
          <div style="font-weight:600;color:var(--pauta-text);margin-bottom:8px;font-size:12px">Tips</div>
          <ul style="margin:0;padding-left:20px;font-size:12px;color:var(--pauta-text-muted);line-height:1.8">
            ${intro.tips.map(tip => `<li>${tip}</li>`).join('')}
          </ul>
        </div>

        <div style="background:rgba(34,197,94,0.05);border-left:3px solid var(--pauta-success);padding:12px;border-radius:0 6px 6px 0">
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
    nextActionHtml = `<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:8px;margin-bottom:12px;text-align:center">
      <div style="font-weight:600;color:var(--pauta-success);font-size:13px">Ready to advance!</div>
      <div style="font-size:11px;color:rgba(74,85,104,0.7)">${recommendation.reason}</div>
    </div>`;
  } else if (recommendation.action === 'review') {
    nextActionHtml = `<div style="background:rgba(230,168,23,0.1);border:1px solid rgba(230,168,23,0.2);border-radius:6px;padding:8px;margin-bottom:12px;text-align:center">
      <div style="font-weight:600;color:var(--pauta-warning);font-size:13px">Review recommended</div>
      <div style="font-size:11px;color:rgba(74,85,104,0.7)">${recommendation.reason}</div>
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
    <div style="text-align:center">
      <h2 style="font-size:22px;font-weight:700;margin-bottom:4px;color:var(--pauta-text)">Session Complete</h2>

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

      <div style="font-size:12px;color:var(--pauta-text-muted);margin:6px 0 12px">
        Best streak: ${s.maxStreak} · Time: ${Math.floor(time/60)}:${(time%60).toString().padStart(2,'0')}
      </div>
    </div>

    ${nextActionHtml}

    <div style="flex-shrink:0;margin-bottom:12px;max-height:180px;overflow-y:auto;font-size:12px;color:var(--pauta-text-muted);border-radius:var(--pauta-radius-sm);background:var(--pauta-bg);padding:8px">
      ${s.completed.map((c,i) => {
        if (c.type === 'difficulty_change') {
          return `<div style="margin-bottom:3px;display:flex;align-items:center;gap:6px">
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
        return `<div style="margin-bottom:3px;display:flex;align-items:center;gap:6px">
          <span style="width:16px;text-align:center;font-size:14px">${icon}</span>
          <span>#${i+1}: ${label}${c.nearMiss && !c.ok ? ' (off by 1)' : ''}</span>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
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
  APP.exerciseSession = null;
  _setExerciseUI(false);
  updateModeBanner();
  _validateModeState();
}

function closeModalExercise() {
  UI.closeModal();
  RENDER.renderScore();
}

function restartExerciseSession() {
  UI.closeModal();
  const s = APP.exerciseSession;
  const savedType = s?.type;
  const savedDiff = s?.difficulty;
  // s is nulled by endExerciseSession if the modal triggered it, so save first
  if (savedType) startExerciseSession(savedType, savedDiff);
}

function reviewExerciseSession() {
  UI.closeModal();
  const s = APP.exerciseSession;
  if (!s || !s.completed.length) { UI.showToast('No exercises to review'); return; }

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
      const noteName = noteNames[pc];
      questionHtml = `<div style="font-size:20px;text-align:center;margin:12px 0;font-family:'Bravura',serif">${noteName}</div>`;
    } else if (c.type === EXERCISE_TYPES.INTERVAL_ID) {
      const bottom = c.target?.bottom;
      const top = c.target?.top;
      const semitones = c.target?.semitones;
      const dir = c.target?.direction;
      const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const bName = noteNames[bottom % 12];
      const tName = noteNames[top % 12];
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
        const names = notes.map(n => noteNames[n.pitch % 12]);
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

    UI.makeModal(`
      <h2>Review: ${typeLabel} (${idx + 1}/${completed.length})</h2>
      <div style="margin-bottom:12px;padding:12px;background:rgba(192,86,33,0.05);border-radius:8px">
        <div style="font-weight:600;margin-bottom:6px">Question</div>
        ${questionHtml}
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px;flex-wrap:wrap">
        <div style="padding:8px 16px;background:${isCorrect ? 'rgba(34,197,94,0.1)' : 'rgba(255,96,96,0.1)'};border-radius:8px;border:1px solid ${isCorrect ? 'var(--pauta-success)' : '#ff6060'}">
          <div style="font-size:11px;color:rgba(74,85,104,0.6);font-weight:600">${isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}</div>
          <div style="font-size:16px;font-weight:700;color:${isCorrect ? 'var(--pauta-success)' : '#c05421'}">${UI.escHtml(userAns)}</div>
        </div>
        ${!isCorrect ? `
        <div style="padding:8px 16px;background:rgba(34,197,94,0.1);border-radius:8px;border:1px solid var(--pauta-success)">
          <div style="font-size:11px;color:rgba(74,85,104,0.6);font-weight:600">Correct Answer</div>
          <div style="font-size:16px;font-weight:700;color:var(--pauta-success)">${UI.escHtml(correctAns)}</div>
        </div>` : ''}
      </div>
      ${hint ? `<div style="font-size:12px;color:rgba(74,85,104,0.7);background:rgba(192,86,33,0.06);padding:8px 12px;border-radius:6px;margin-bottom:12px">${UI.escHtml(hint)}</div>` : ''}
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        ${idx > 0 ? `<button class="modal-btn secondary" data-action="reviewPrev">← Previous</button>` : ''}
        ${idx < completed.length - 1 ? `<button class="modal-btn primary" data-action="reviewNext">Next →</button>` : `<button class="modal-btn primary" data-action="closeModal">Done</button>`}
        ${completed.length > 1 ? `<button class="modal-btn secondary" data-action="closeModal" style="margin-left:auto">Close Review</button>` : ''}
      </div>
    `);
  }

  // Register one-time handlers for review navigation
  const origRegister = window._registerAction;
  window._registerAction('reviewPrev', () => { UI.closeModal(); showReview(reviewIndex - 1); });
  window._registerAction('reviewNext', () => { UI.closeModal(); showReview(reviewIndex + 1); });

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

function _presentRhythmRead(ex) {
  const score = SCORE.createScore({title: 'Rhythm Reading', instruments: ['Percussion'], ts: {num:4,den:4}, ks: 0});
  const notes = ex.target.durations.map(d => SCORE.mkNote(60, d));
  score.parts[0].staves[0].measures[0].notes = notes;
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
   UI.showToast('Tap play to hear it, then clap or tap it back!');
}

function _presentRhythmWorksheet(ex) {
  const mx = ex.target.measures;
  const score = SCORE.createScore({title: 'Rhythm Dictation', instruments: ['Percussion'], ts: {num:4,den:4}, ks: 0});
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
    <button class="modal-btn secondary" id="dictation-ready" style="padding:6px 12px;font-size:12px">I'm Ready</button>
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
  el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:2001;background:linear-gradient(135deg,var(--pauta-primary),var(--pauta-primary-light));color:#fff;padding:32px 48px;border-radius:var(--pauta-radius-lg);box-shadow:0 12px 40px rgba(192,86,33,0.4);text-align:center;min-width:280px';
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
  bar.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%) translateY(20px);z-index:200;display:flex;align-items:flex-start;gap:10px;background:rgba(255,251,235,0.98);border:1px solid rgba(217,160,60,0.3);border-radius:10px;padding:12px 16px;box-shadow:0 3px 16px rgba(0,0,0,0.09);font-size:13px;color:var(--pauta-text-muted);flex-wrap:wrap;max-width:92vw;opacity:0;transition:opacity 0.3s ease, transform 0.3s ease;font-family:var(--pauta-font-sans)';
  bar.innerHTML = `
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-weight:700;color:#b45309;font-size:14px">Not quite</span>
        <div style="display:flex;gap:6px;align-items:center;font-size:12px">
          <span style="background:rgba(239,68,68,0.1);padding:2px 8px;border-radius:4px;color:#dc2626">You: <b>${UI.escHtml(userAnswer)}</b></span>
          <span style="color:rgba(74,85,104,0.4)">→</span>
          <span style="background:rgba(34,197,94,0.1);padding:2px 8px;border-radius:4px;color:#16a34a">Correct: <b>${UI.escHtml(correctLabel)}</b>${extraNote}</span>
        </div>
      </div>
      ${hintText ? `
        <details open style="margin-top:2px">
          <summary style="cursor:pointer;font-size:11px;color:rgba(74,85,104,0.6);font-weight:600;user-select:none">Why? ▸</summary>
          <div style="margin-top:4px;font-size:11px;color:rgba(74,85,104,0.7);line-height:1.5">${hintText}</div>
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
  try { localStorage.setItem('pauta_rhythm_workout', JSON.stringify(s)); } catch(e) { console.warn('Failed to save rhythm workout settings:', e); }
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
    instruments: ['Percussion'],
    ts: { num: ts.num, den: ts.den },
    ks: 0,
  });

  // Build notes array
  const vfNotes = notes.map(n => {
    if (n.rest) return SCORE.mkRest(n.duration, n.dots);
    return SCORE.mkNote(60, n.duration, n.dots);
  });

  score.parts[0].staves[0].measures[0].notes = vfNotes;
  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  RENDER.renderScore();
  UI.showToast(`${ts.num}/${ts.den} — ${notes.length} notes — ${tempo} BPM`);
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
