// ═══════════════════════════════════════════════════════════════════
// kit.js — Assignments, progress, teacher, templates, builder,
//          diagnostic, composition tools, recorder exercises
// ═══════════════════════════════════════════════════════════════════

// ── Static listeners (called once at boot) ──────────────────────
function initListeners() {
  // Kit attaches listeners to dynamically created elements only.
  // No static DOM listeners needed.
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 5b: Assignments
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// MODULE 5b: Assignments
// ═══════════════════════════════════════════════════════════════════

function showAssignmentDialog() {
  const measureCount = APP.score?.parts?.[0]?.staves?.[0]?.measures?.length || 1;
  const selected = APP.selectedMeasure;
  const start = Math.max(0, Math.min(selected, measureCount - 1));
  const end = Math.min(measureCount - 1, start + 3);
  UI.makeModal(`
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
    UI.showToast('Invalid measure range'); return;
  }
  SCORE.commitChange(score => {
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
  UI.closeModal();
}

function startAssignment(id) {
  const asgn = APP.score?.assignments?.find(a => a.id === id);
  if (!asgn) { UI.showToast('Assignment not found'); return; }
  APP.assignmentMode = true;
  APP.currentAssignment = asgn;
  updateModeBanner();
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
  UI.showToast('Assignment started: ' + asgn.title);
  RENDER.renderScore();
}

function exitAssignmentMode() {
  APP.assignmentMode = false;
  APP.currentAssignment = null;
  _validateModeState();
  _setAssignmentUI(false);
  updateModeBanner();
  UI.showToast('Exited assignment mode');
  RENDER.renderScore();
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
  SCORE.commitChange(score => {
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
  UI.makeModal(`
    <h2>Check Answers — ${asgn.title}</h2>
    <div style="font-size:13px;color:var(--pauta-text-muted);margin-bottom:12px">
      <b>${results.correct}</b> / ${results.total} correct
      ${results.incorrect > 0 ? `<br><span style="color:var(--pauta-error)">${results.incorrect} incorrect</span>` : ''}
      ${results.partial > 0 ? `<br><span style="color:#d4a017">${results.partial} partial (enharmonic)</span>` : ''}
    </div>
    <div style="flex-shrink:0;max-height:200px;overflow-y:auto;font-size:12px;color:var(--pauta-text-muted);margin-bottom:12px">
      ${results.details.map(d => `<div style="margin-bottom:4px;display:flex;align-items:center;gap:6px">
        <span style="width:16px;text-align:center;font-size:14px">${d.ok?'✓':'✗'}</span>
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

// ── Student Progress Analytics ─────────────────────────────────
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

function showStudentProgress() {
  const results = _loadResults();
  if (!results.length) { UI.showToast('No exercise results yet. Complete an exercise first!'); return; }

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
  if (overallPct >= 90) badges.push({ emoji: '', label: '90%+ Overall', color: 'var(--pauta-primary)' });
  if (bestStreak >= 10) badges.push({ emoji: '', label: '10+ Streak', color: 'var(--pauta-primary-light)' });
  if (totalSessions >= 50) badges.push({ emoji: '', label: '50+ Sessions', color: 'var(--pauta-warning)' });
  if (totalSessions >= 100) badges.push({ emoji: '', label: '100+ Sessions', color: 'var(--pauta-success)' });
  Object.keys(byType).forEach(type => {
    const avg = Math.round(byType[type].reduce((s, x) => s + x.pct, 0) / byType[type].length);
    if (avg >= 85 && byType[type].length >= 5) {
      badges.push({ emoji: '', label: `${TYPE_LABELS[type]} Master`, color: 'var(--pauta-success)' });
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

  UI.makeModal(`
    <h2>My Progress</h2>
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
        <span>Current streak: ${currentStreak} day${currentStreak !== 1 ? 's' : ''}</span>
        <span>Best streak: ${bestStreak}</span>
        <span>Total time: ${timeStr}</span>
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
      <button class="modal-btn primary" data-action="exportProgress">Export Report</button>
      <button class="modal-btn secondary" data-action="importProgress">Import Report</button>
      <button class="modal-btn secondary" data-action="clearProgress" style="color:var(--pauta-primary-light)">Clear All</button>
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function exportProgress() {
  const results = _loadResults();
  if (!results.length) { UI.showToast('Nothing to export'); UI.closeModal(); return; }
  const data = { version: 1, exportedAt: new Date().toISOString(), results };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `pauta-progress-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  UI.showToast('Report exported');
}

function importProgress() {
  UI.closeModal();
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.results)) { UI.showToast('Invalid report format'); return; }
        const imported = _loadImported();
        const name = prompt('Student name for this report:', 'Student');
        if (!name) { UI.showToast('Import cancelled'); return; }
        imported[name] = (imported[name] || []).concat(data.results);
        localStorage.setItem(IMPORTED_KEY, JSON.stringify(imported));
        UI.showToast(`Imported ${data.results.length} results for ${name}`);
        showTeacherDashboard();
      } catch(e) { UI.showToast('Could not read file: ' + e.message); }
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
  UI.closeModal();
  UI.showToast('Results cleared');
}

function showTeacherDashboard() {
  const imported = _loadImported();
  const studentNames = Object.keys(imported);
  if (!studentNames.length) {
    UI.makeModal(`
      <h2>Teacher Dashboard</h2>
      <p style="color:var(--pauta-text-muted);font-size:13px;text-align:center;margin:12px 0">
        No imported reports yet.<br>
        Ask students to export their progress from <b>Exercises → My Progress → Export Report</b>,<br>
        then use <b>Import Report</b> here.
      </p>
      <button class="modal-btn primary" data-action="importProgress">Import Report</button>
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
        <span style="font-weight:600;color:var(--pauta-text);font-size:13px">${UI.escHtml(name)}</span>
        <span style="font-size:13px;color:var(--pauta-primary);font-weight:700">${avg}%</span>
      </div>
      <div style="font-size:11px;color:rgba(74,85,104,0.6)">
        ${n} sessions · best ${best}% · ${total}/${all} correct
      </div>
      <div style="font-size:10px;color:rgba(74,85,104,0.5);margin-top:2px">${typeSummary}</div>
    </div>`;
  }).join('');

  UI.makeModal(`
    <h2>Teacher Dashboard</h2>
    <div style="font-size:12px;color:var(--pauta-text-muted);margin-bottom:8px">
      ${studentNames.length} student(s) · ${imported[studentNames[0]]?.length || 0} total submissions
    </div>
    <div style="flex-shrink:0;max-height:300px;overflow-y:auto;margin-bottom:8px">${rows}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="modal-btn primary" data-action="importProgress">Import Report</button>
      <button class="modal-btn secondary" data-action="clearAllImported" style="color:var(--pauta-primary-light)">Clear All</button>
    </div>
    <button class="modal-btn secondary" data-action="closeModal">Close</button>
  `);
}

function clearAllImported() {
  if (!confirm('Delete all imported student reports?')) return;
  localStorage.removeItem(IMPORTED_KEY);
  UI.closeModal();
  UI.showToast('Imported data cleared');
}

// ── Starter Assignments ─────────────────────────────────────────
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
  if (APP.exerciseMode) { UI.showToast('Finish your current exercise first'); return; }
  UI.makeModal(`
    <h2>Starter Assignments</h2>
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
  if (APP.exerciseMode) { UI.showToast('Finish your current exercise first'); return; }

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
              <div style="font-weight:600;font-size:12px;color:var(--pauta-text)">${UI.escHtml(ex.name)}</div>
              <div style="font-size:10px;color:rgba(74,85,104,0.6)">${ex.exercises.length} exercises · ${ex.difficulty}</div>
            </div>
            <button class="modal-btn secondary" data-action="exportCustomExercise" data-idx="${idx}" style="padding:3px 8px;font-size:10px">Export</button>
            <button class="modal-btn secondary" data-action="deleteCustomExercise" data-idx="${idx}" style="padding:3px 8px;font-size:10px;color:var(--pauta-primary-light)">Delete</button>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  UI.makeModal(`
    <h2>Exercise Builder</h2>
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
      <button class="modal-btn primary" id="exb-save">Save Set</button>
      <button class="modal-btn secondary" id="exb-export">Export JSON</button>
      <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
    </div>
  `);

  setTimeout(() => {
    const saveBtn = document.getElementById('exb-save');
    const exportBtn = document.getElementById('exb-export');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const name = document.getElementById('exb-name')?.value?.trim();
      if (!name) { UI.showToast('Enter a name for the set'); return; }
      const difficulty = document.getElementById('exb-diff')?.value || 'beginner';
      const count = parseInt(document.getElementById('exb-count')?.value || '10');
      const types = Array.from(document.querySelectorAll('.exb-type-check:checked')).map(cb => cb.value);
      if (!types.length) { UI.showToast('Select at least one exercise type'); return; }
      const customEx = { name, difficulty, count, types, exercises: types.map(t => ({ type: t, count: Math.ceil(count / types.length) })) };
      const all = _loadCustomExercises();
      all.push(customEx);
      _saveCustomExercises(all);
      UI.showToast(`"${name}" saved`);
      UI.closeModal();
    });
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const name = document.getElementById('exb-name')?.value?.trim() || 'Custom Exercise Set';
      const difficulty = document.getElementById('exb-diff')?.value || 'beginner';
      const count = parseInt(document.getElementById('exb-count')?.value || '10');
      const types = Array.from(document.querySelectorAll('.exb-type-check:checked')).map(cb => cb.value);
      if (!types.length) { UI.showToast('Select at least one exercise type'); return; }
      const data = { version: 1, name, difficulty, count, types, exercises: types.map(t => ({ type: t, count: Math.ceil(count / types.length) })) };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `pauta-exercise-set-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      UI.showToast('Exercise set exported');
    });
  }, 50);
}

function deleteCustomExercise(idx) {
  const all = _loadCustomExercises();
  if (!confirm(`Delete "${all[idx]?.name}"?`)) return;
  all.splice(idx, 1);
  _saveCustomExercises(all);
  UI.closeModal();
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
  UI.showToast('Exercise set exported');
}

function importCustomExercise() {
  UI.closeModal();
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.name || !data.exercises) { UI.showToast('Invalid exercise set format'); return; }
        const all = _loadCustomExercises();
        all.push(data);
        _saveCustomExercises(all);
        UI.showToast(`Imported "${data.name}"`);
        showExerciseBuilderDialog();
      } catch(e) { UI.showToast('Could not read file: ' + e.message); }
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
    const score = SCORE.createScore({ title: `${tonic} ${SCALE_TYPES.find(s => s.id === type)?.label || type}`, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    const notes = scale.map((n, i) => SCORE.mkNote(n.pitch, 'q', i === 0 ? 0 : null, n.accidental));
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
    const score = SCORE.createScore({ title: `Rhythm Dictation ${i+1}`, instruments: ['Percussion'], ts: {num:4,den:4}, ks: 0 });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    for (let m = 0; m < 8; m++) {
      const slice = ws.target.beats.slice(m*4, m*4+4);
      const notes = slice.map((b, bi) => b === 'q' ? SCORE.mkNote(48, 'q', bi === 0 ? 0 : null) : SCORE.mkRest('q'));
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
    const score = SCORE.createScore({ title: `Melody Dictation ${i+1}`, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks: targetKeySig });
    const stave = score.parts[0].staves[0];
    stave.measures = [];
    const totalBeats = md.target.notes.reduce((s, n) => s + durBeats(n.duration, 0, null), 0);
    const measureCount = Math.max(1, Math.ceil(totalBeats / 4));
    for (let m = 0; m < measureCount; m++) {
      stave.measures.push({
        timeSigNum: m === 0 ? 4 : null, timeSigDen: m === 0 ? 4 : null,
        keySig: m === 0 ? targetKeySig : null, lineBreak: m > 0 && m % 4 === 0, notes: [SCORE.mkRest('w')]
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
    const score = SCORE.createScore({ title: `Scale ID ${i+1}: ${_scaleNoteName(tonic)} ${SCALE_LABELS[scaleType]}`, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks });
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
  UI.closeModal();
  const tpl = STARTER_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) { UI.showToast('Template not found'); return; }
  window._pendingStarterTemplate = templateId;
  UI.makeModal(`
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
  UI.closeModal();
  const tpl = STARTER_TEMPLATES.find(t => t.id === templateId);
  if (!tpl) { UI.showToast('Template not found'); return; }
  try {
    UI.showToast('Generating: ' + tpl.label);
    const exercises = tpl.fn();
    if (!exercises || !exercises.length) { UI.showToast('No exercises generated'); return; }
    // Apply clef to all generated scores
    exercises.forEach(ex => {
      if (ex.score) _applyClefToScore(ex.score, clef);
    });
    // Show preview dialog instead of auto-downloading
    showStarterPreviewDialog(exercises, tpl.label);
  } catch(e) {
    UI.showToast('Error: ' + e.message);
    console.error('generateStarterAssignmentWithClef error:', e);
  }
}

function showStarterPreviewDialog(exercises, label) {
  const count = exercises.length;
  const fileLabel = count === 1 ? exercises[0].title : label;
  UI.makeModal(`
    <h2>${UI.escHtml(label)}</h2>
    <p style="color:var(--pauta-text-muted);font-size:13px;margin-bottom:12px">
      ${count} exercise${count > 1 ? 's' : ''} generated with the selected clef.
    </p>
    <div style="flex-shrink:0;max-height:200px;overflow-y:auto;margin-bottom:16px;font-size:12px;color:var(--pauta-text-muted)">
      ${exercises.map((ex, i) => `
        <div style="padding:6px 8px;background:rgba(192,86,33,0.03);border-radius:6px;margin-bottom:4px">
          <div style="font-weight:600;color:var(--pauta-text)">${UI.escHtml(ex.title)}</div>
          ${ex.answerKey ? `<div style="font-size:10px;color:rgba(74,85,104,0.6)">Answer key included</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="modal-btn primary" data-action="confirmStarterDownload" style="flex:1">Download .mscx</button>
      <button class="modal-btn secondary" data-action="previewStarterScore">Preview in Pauta</button>
      <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
    </div>
  `);
  // Store exercises for download/preview actions
  window._pendingStarterExercises = exercises;
  window._pendingStarterLabel = label;
}

function confirmStarterDownload() {
  UI.closeModal();
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
  UI.closeModal();
  const exercises = window._pendingStarterExercises;
  if (!exercises || !exercises.length) return;
  if (exercises.length === 1) {
    const { score } = exercises[0];
    SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
    RENDER.renderScore();
    UI.showToast('Previewing: ' + exercises[0].title);
  } else {
    const combined = SCORE.createScore({ title: window._pendingStarterLabel, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks: 0 });
    combined.parts[0].staves[0].measures = [];
    exercises.forEach((ex, idx) => {
      ex.score.parts[0].staves[0].measures.forEach((m, mi) => {
        const newM = { ...m };
        if (mi === 0 && idx === 0) newM.timeSigNum = 4;
        combined.parts[0].staves[0].measures.push(newM);
      });
      if (idx < exercises.length - 1) combined.parts[0].staves[0].measures.push({ lineBreak: true, notes: [SCORE.mkRest('w')] });
    });
    // Apply the clef from the first exercise to the combined score
    const firstClef = exercises[0].score.parts[0].staves[0].clef || 'treble';
    _applyClefToScore(combined, firstClef);
    SCORE.adoptScore(combined, { clearHistory: true, skipAssignmentPrompt: true });
    RENDER.renderScore();
    UI.showToast('Previewing: ' + window._pendingStarterLabel);
  }
}

function _exportMSCZ(score, answerKey, filename) {
  const mscx = SCORE.exportMSCXFromScore(score);
  if (answerKey) {
    score.answerKey = answerKey;
    const mscxWithKey = SCORE.exportMSCXFromScore(score);
    _downloadBlob(new Blob([mscxWithKey], { type: 'application/vnd.recordare.musicxml' }), filename + '.mscx');
  } else {
    _downloadBlob(new Blob([mscx], { type: 'application/vnd.recordare.musicxml' }), filename + '.mscx');
  }
  UI.showToast('Downloaded: ' + filename + '.mscx');
}

function _exportMSCZBatch(exercises, label) {
  const combined = SCORE.createScore({ title: label, instruments: ['Soprano Recorder'], ts: {num:4,den:4}, ks: 0 });
  combined.parts[0].staves[0].measures = [];
  exercises.forEach((ex, idx) => {
    ex.score.parts[0].staves[0].measures.forEach((m, mi) => {
      const newM = { ...m };
      if (mi === 0 && idx === 0) newM.timeSigNum = 4;
      combined.parts[0].staves[0].measures.push(newM);
    });
    if (idx < exercises.length - 1) combined.parts[0].staves[0].measures.push({ lineBreak: true, notes: [SCORE.mkRest('w')] });
  });
  const firstClef = exercises[0].score.parts[0].staves[0].clef || 'treble';
  _applyClefToScore(combined, firstClef);
  SCORE.adoptScore(combined, { clearHistory: true, skipAssignmentPrompt: true });
  RENDER.renderScore();
  const mscx = SCORE.exportMSCXFromScore(combined);
  _downloadBlob(new Blob([mscx], { type: 'application/vnd.recordare.musicxml' }), label + '.mscx');
  UI.showToast('Downloaded: ' + label + '.mscx');
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Diagnostic Assessment ──────────────────────────────────────
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
  if (APP.exerciseMode) { UI.showToast('Finish your current exercise first'); return; }
  UI.makeModal(`
    <h2>Diagnostic Assessment</h2>
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
    if (btn) btn.addEventListener('click', () => { UI.closeModal(); _startDiagnostic(); });
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
    UI.showToast('Not quite — answer: ' + q.ex.answer);
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

  UI.makeModal(`
    <h2>Assessment Complete</h2>
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
      UI.closeModal();
      const kitLevel = placement.label.toLowerCase();
      applyKit(APP.teachingKit || 'recorder', kitLevel);
      applyUIProfile(placement.profile);
      UI.showToast('Profile set to: ' + placement.label);
      RENDER.renderScore();
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
  if (!val) { UI.showToast('Type your answer first'); return; }
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
   _genMelodyDictAssignment, _exportMSCZ, _exportMSCZBatch, _downloadBlob,
   initListeners
].forEach(fn => { EXERCISE[fn.name] = fn; });

function showTransposeDialog() {
  UI.makeModal(`
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
  if (APP.exerciseMode) { UI.showToast('Finish your current exercise first'); return; }
  UI.makeModal(`
    <h2 style="font-size:15px;margin-bottom:6px">Rhythm Composer</h2>
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

  const score = SCORE.createScore({ title: 'Rhythm Composition', instruments: ['Piano'], ts: {num,den}, ks: 0 });
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
    stave.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [SCORE.mkRest('w')] });
  }

  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  APP.inputMode = true;
  APP.curOctave = 5;
  document.getElementById('btn-input')?.classList.add('active');
  RENDER.renderScore();

  UI.closeModal();
  _enterRhythmMode();
  UI.showToast('Tap note durations & click staff to add notes. 𝄽 to exit.');
}

function _enterRhythmMode() {
  APP.compositionMode = 'rhythm';
  _savePalette();
  updateModeBanner();

  const body = document.getElementById('palette-body');
  if (!body) return;

  body.innerHTML = `
    \x3C!-- Rhythm row: durations --\x3E
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
    \x3C!-- Rhythm note row --\x3E
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
  if (APP.exerciseMode) { UI.showToast('Finish your current exercise first'); return; }
  const KEY_NAMES = ['C♭','G♭','D♭','A♭','E♭','B♭','F','C','G','D','A','E','B','F♯','C♯'];
  const ksOpts = [-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7].map(v =>
    `<option value="${v}" ${v===0?'selected':''}>${KEY_NAMES[v+7]||'C'}</option>`
  ).join('');

  UI.makeModal(`
    <h2 style="font-size:15px;margin-bottom:6px">Melody Composer</h2>
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

  const score = SCORE.createScore({ title: 'Melody Composition', instruments: ['Piano'], ts: {num,den}, ks });
  const stave = score.parts[0].staves[0];
  while (stave.measures.length < measures) {
    stave.measures.push({ timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [SCORE.mkRest('w')] });
  }

  SCORE.adoptScore(score, { clearHistory: true, skipAssignmentPrompt: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  APP.inputMode = true;
  APP.curOctave = 4;
  document.getElementById('btn-input')?.classList.add('active');
  RENDER.renderScore();

  UI.closeModal();
  _enterMelodyMode(ks);
  UI.showToast('Tap a scale degree, then click staff to place notes. ✕ to exit.');
}

function _enterMelodyMode(ks) {
  APP.compositionMode = 'melody';
  _savePalette();
  updateModeBanner();

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
    \x3C!-- Melody duration row --\x3E
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
    \x3C!-- Scale-degree note names --\x3E
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
  UI.showToast('Composition mode exited');
  updateModeBanner();
}

// ═══════════════════════════════════════════════════════════════════
// RECORDER EXERCISES — moved from notation.js (belongs with education)
// ═══════════════════════════════════════════════════════════════════
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
  if (!ex) { UI.showToast('Exercise not found'); return; }
  const score = SCORE.createScore({title: ex.title, instruments: ['Soprano Recorder'], ts: ex.ts, ks: 0});
  const stave = score.parts[0].staves[0];
  stave.measures = [];

  const beatsPerMeasure = ex.ts.num * (4 / ex.ts.den);
  let measureNotes = [], beats = 0;

  for (const n of ex.notes) {
    measureNotes.push(SCORE.mkNote(n.pitch, n.dur));
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

  SCORE.adoptScore(score, { clearHistory: true });
  APP.selectedMeasure = 0; APP.selectedStaff = 0; APP.selectedNoteIdx = -1;
  RENDER.renderScore();
  UI.showToast('Loaded: ' + ex.title);
}

function showRecorderExercises() {
  const exercises = Object.entries(RECORDER_EXERCISES).map(([key, ex]) => `
    <button class="panel-btn-wide" style="margin-bottom:4px;text-align:left"
      data-action="loadRecorderExercise" data-key="${key}">
      <span style="font-weight:700">${ex.title}</span>
      <span style="float:right;opacity:0.6;font-size:11px">${ex.tempoName} · ♩=${ex.tempoBpm}</span>
    </button>
  `).join('');

  UI.makeModal(`
    <h2>Recorder Exercises</h2>
    <p class="dialog-hint">Built-in songs with automatic fingerings. Great for classroom practice.</p>
    ${exercises}
    <button class="modal-btn secondary" data-action="closeModal">Cancel</button>
  `);
}


