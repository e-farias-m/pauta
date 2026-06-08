// ── Hit Testing / Input ──────────────────────────────────────────
function getEventXY(e) {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl) return null;
  const rect = svgEl.getBoundingClientRect();
  const touch = (e.changedTouches && e.changedTouches.length)
    ? e.changedTouches[0]
    : (e.touches && e.touches.length ? e.touches[0] : e);

  // Convert CSS-pixel position to SVG user units.
  // VexFlow sets width/height attributes; CSS may scale the element differently.
  const svgW  = parseFloat(svgEl.getAttribute('width'))  || rect.width;
  const svgH  = parseFloat(svgEl.getAttribute('height')) || rect.height;
  const scaleX = rect.width  > 0 ? svgW / rect.width  : 1;
  const scaleY = rect.height > 0 ? svgH / rect.height : 1;

  return {
    x: (touch.clientX - rect.left)  * scaleX,
    y: (touch.clientY - rect.top)   * scaleY,
  };
}

// Accurate Y → MIDI pitch using actual rendered stave positions from staveLayout
function yToPitchAccurate(y, sl) {
  // Staff has 5 lines, 4 spaces. Each VexFlow line-spacing spans 2 diastaff
  // positions (e.g. line→space→line). The MIDDLE LINE (VF line 2) is:
  //   Treble: B4 (MIDI 71), diatonic index 6 (B), octave 4
  //   Alto:   C4 (MIDI 60), diatonic index 0 (C), octave 4
  //   Bass:   D3 (MIDI 50), diatonic index 1 (D), octave 3
  const lineSpacing = (sl.bottomY - sl.topLineY) / 4;

  // ── Percussion: map Y position directly to drum MIDI pitches ──
  if (sl.clef === 'percussion') {
    const n = (y - sl.topLineY) / lineSpacing; // 0=top, 4=bottom
    if (n < 0.5) return 42;      // above staff → closed hi-hat
    if (n < 1.0) return 49;      // top space → crash cymbal
    if (n < 1.5) return 50;      // top line → high tom
    if (n < 2.0) return 48;      // 2nd space → high tom 2
    if (n < 2.5) return 45;      // middle line → mid tom
    if (n < 3.0) return 38;      // 3rd space → snare
    if (n < 3.5) return 43;      // 4th line → low-mid tom
    return 36;                    // bottom → bass drum
  }

  const REF = {
    treble: { dia: 6, oct: 4 },
    alto:   { dia: 0, oct: 4 },
    bass:   { dia: 1, oct: 3 },
  };
  const ref = REF[sl.clef] || REF.treble;

  // Fractional VexFlow line index (0 = top, 2 = middle, 4 = bottom)
  const n = (y - sl.topLineY) / lineSpacing;

  // Diatonic offset from the middle line (VF line 2).
  // Each VF line-spacing = 2 diastaff positions, so multiply by 2.
  const diaOffset = Math.round(2 * (2 - n));

  const rawDiaPos = ref.dia + diaOffset;
  const octave    = ref.oct + Math.floor(rawDiaPos / 7);
  const diaPos    = ((rawDiaPos % 7) + 7) % 7;

  const diaMidi = [0, 2, 4, 5, 7, 9, 11];
  return Math.max(12, Math.min(120, (octave + 1) * 12 + diaMidi[diaPos]));
}

// ── Touch / Stylus Input ─────────────────────────────────────────
// Stroke recogniser: tracks pointer from down → move → up
// Distinguishes: tap/short stroke → pitch-from-Y note input
//                longer stroke    → select (no accidental pitch)
const STROKE = {
  active: false,
  points: [],
  startX: 0, startY: 0,
  pointerType: 'touch',
  lastHandledAt: 0,   // timestamp of last handled stroke — used to debounce click/touchend
};

const scoreEl = document.getElementById('score-svg');

scoreEl.addEventListener('pointerdown', e => {
  const pos = getEventXY(e);
  if (!pos) return;

  // Check if this tap is actually on a stave
  let onStave = false;
  const margin = 40;
  for (const sl of APP.staveLayout) {
    const top = (sl.topLineY || sl.y) - margin;
    const bot = sl.bottomY + margin;
    const xOk = pos.x >= sl.x && pos.x <= sl.x + sl.w;
    if (pos.y >= top && pos.y <= bot && xOk) { onStave = true; break; }
  }

  if (!onStave) return; // let the event propagate → browser handles scroll

  // Always track pointer so pointerup can classify tap vs drag
  STROKE.active      = true;
  STROKE.points      = [{x: pos.x, y: pos.y, t: Date.now()}];
  STROKE.startX      = pos.x;
  STROKE.startY      = pos.y;
  STROKE.pointerType = e.pointerType;

  if (APP.inputMode || APP.chordMode) {
    e.preventDefault();
    scoreEl.setPointerCapture(e.pointerId);
    _showStrokeDot(pos.x, pos.y);
  }
}, {passive: false});

scoreEl.addEventListener('pointermove', e => {
  if (!STROKE.active) return;
  const pos = getEventXY(e);
  if (!pos) return;
  STROKE.points.push({x: pos.x, y: pos.y, t: Date.now()});
  if (APP.inputMode || APP.chordMode) {
    e.preventDefault();
    _showStrokeDot(pos.x, pos.y);
  }
}, {passive: false});

scoreEl.addEventListener('pointerup', e => {
  if (!STROKE.active) return;
  STROKE.active = false;
  _clearStrokeDot();
  const pos = getEventXY(e);
  if (pos) STROKE.points.push({x: pos.x, y: pos.y, t: Date.now()});

  const pts = STROKE.points;
  const xs    = pts.map(p => p.x);
  const ys    = pts.map(p => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const dur   = pts[pts.length-1].t - pts[0].t;
  const isTap = (spanX < 22 && spanY < 22) || dur < 200;

  if (isTap && !APP.inputMode && !APP.chordMode) {
    // Select mode tap — select measure / note
    STROKE.lastHandledAt = Date.now(); // block click/touchend from double-firing
    handleScoreTap(e);
    return;
  }

  if (APP.inputMode && (isTap || STROKE.pointerType === 'pen')) {
    STROKE.lastHandledAt = Date.now(); // block click/touchend from double-firing
    _handleStroke();
  }
});

scoreEl.addEventListener('pointercancel', () => {
  STROKE.active = false;
  _clearStrokeDot();
});

function _showStrokeDot(x, y) {
  const svgEl = scoreEl.querySelector('svg');
  if (!svgEl) return;
  let dot = svgEl.getElementById('stroke-dot');
  if (!dot) {
    dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('id','stroke-dot');
    dot.setAttribute('r','5');
    dot.setAttribute('fill','rgba(192,86,33,0.50)');
    dot.setAttribute('pointer-events','none');
    svgEl.appendChild(dot);
  }
  dot.setAttribute('cx', x);
  dot.setAttribute('cy', y);
}

function _clearStrokeDot() {
  const dot = document.getElementById('stroke-dot');
  if (dot) dot.remove();
}

function _handleStroke() {
  const pts = STROKE.points;
  if (!pts.length) return;

  // Compute stroke bounding box and duration
  const xs    = pts.map(p => p.x);
  const ys    = pts.map(p => p.y);
  const minX  = Math.min(...xs), maxX = Math.max(...xs);
  const minY  = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const dur   = pts[pts.length-1].t - pts[0].t;

  // Use the centroid Y as the pitch reference point
  const centroidY = ys.reduce((a,b) => a+b, 0) / ys.length;
  const centroidX = xs.reduce((a,b) => a+b, 0) / xs.length;

  // Hit-test: find which stave the centroid lands in.
  // Use topLineY/bottomY (same as yToPitchAccurate) for consistency.
  // Pick the stave whose vertical midpoint is closest to centroidY.
  let hitSL    = null;
  let bestDist = Infinity;
  const margin = 40; // generous margin above/below staff lines

  for (const sl of APP.staveLayout) {
    const top = sl.topLineY - margin;
    const bot = sl.bottomY  + margin;
    if (centroidY < top || centroidY > bot) continue;
    // Prefer the stave whose x range contains centroidX
    const xMatch = centroidX >= sl.x && centroidX <= sl.x + sl.w;
    const mid    = (sl.topLineY + sl.bottomY) / 2;
    const dist   = Math.abs(centroidY - mid) + (xMatch ? 0 : 1000);
    if (dist < bestDist) { bestDist = dist; hitSL = sl; }
  }
  if (!hitSL) return;

  // Select the measure
  APP.selectedMeasure = hitSL.mi;
  APP.selectedStaff   = hitSL.si;

  // Classify stroke:
  // Small span (<20px both axes) or short duration → TAP → use Y for pitch
  // Larger vertical stroke → treat as rest entry trigger
  const isTap = (spanX < 22 && spanY < 22) || dur < 200;

  if (isTap || STROKE.pointerType === 'pen') {
    STROKE.lastHandledAt = Date.now(); // block click/touchend from double-firing
    // Use accurate Y→pitch from actual stave positions
    let pitch = yToPitchAccurate(centroidY, hitSL);
    // Apply key sig / curAcc adjustment (same logic as handleScoreTap)
    const pc0 = pitch % 12;
    const ks0 = getResolvedKeySig(hitSL.mi, hitSL.si);
    const km0 = getKeyAccidentals(ks0);
    if (APP.curAcc === 'b') {
      pitch = Math.max(12, pitch - 1);
    } else if (APP.curAcc === '#') {
      pitch = Math.min(120, pitch + 1);
    } else if (APP.curAcc === 'n') {
      // Keep natural — yToPitchAccurate already returns the natural pitch
    } else {
      if (km0[pc0] === 'b') pitch--;
      else if (km0[pc0] === '#') pitch++;
    }
    // Do NOT alter octave — preserve the clicked staff position exactly
    APP.curOctave = Math.floor(pitch / 12) - 1;
    updateOctaveDisplay();
    APP.curRest = false;
    const _sDur2 = APP.curDur, _sDot2 = APP.curDot;
    insertNote(hitSL.mi, hitSL.si, pitch);
    APP.curDur = _sDur2; APP.curDot = _sDot2;
  }
}

// Keep click handler for mouse/desktop
document.getElementById('score-svg').addEventListener('click', function(e) {
  if (Date.now() - STROKE.lastHandledAt < 400) return; // already handled by pointer events
  if (STROKE.pointerType && STROKE.pointerType !== 'mouse') return;
  handleScoreTap(e);
});

// Keep touchend for selection in non-input mode
let lastTouchEnd = 0;
document.getElementById('score-svg').addEventListener('touchend', function(e) {
  if (APP.inputMode) return; // handled by pointer events above
  if (Date.now() - STROKE.lastHandledAt < 400) return; // debounce
  const now = Date.now();
  if (now - lastTouchEnd < 350) return;
  lastTouchEnd = now;
  e.preventDefault();
  handleScoreTap(e);
}, {passive:false});

function handleScoreTap(e) {
  const pos = getEventXY(e);
  if (!pos) return;
  const {x, y} = pos;

  // ── Individual note hit test ─────────────────────────────────
  if (APP.noteLayout.length) {
    const RADIUS = 28; // px in SVG user units
    let bestNote = null, bestDist = RADIUS;
    for (const nl of APP.noteLayout) {
      const dx   = x - nl.x;
      const dy   = y - nl.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) { bestDist = dist; bestNote = nl; }
    }
    if (bestNote && !APP.inputMode) {
      if (APP.markingMode && APP.markingStart) {
        completeMarking(bestNote.mi, bestNote.si, bestNote.ni);
        return;
      }
      // Check if we're completing an ottava span
      APP.selectedMeasure = bestNote.mi;
      APP.selectedStaff   = bestNote.si;
      APP.selectedNoteIdx = bestNote.ni;
      APP.selStartIdx = -1;
      renderSelection();
      scrollToSelectedMeasure();
      const _stave = getStaveBySI(bestNote.si);
      const n = _stave?.measures[bestNote.mi]?.notes[bestNote.ni];
      if (n) {
        const isPercLabel = _stave?.clef === 'percussion';
        const DRUM_LABELS = {35:'Bass Drum',36:'Bass Drum',37:'Side Stick',38:'Snare',39:'Clap',40:'Snare',
          41:'Low Tom',42:'Hi-Hat',43:'Low-Mid Tom',44:'Pedal HH',45:'Mid Tom',46:'Open HH',
          47:'Mid-High Tom',48:'High Tom',49:'Crash',50:'High Tom 2',51:'Ride',52:'Chinese',53:'Ride Bell',56:'Cowbell'};
        const label = n.type === 'rest'
          ? `Rest (${VEX_TO_MSCX[n.duration]||n.duration})`
          : isPercLabel ? (DRUM_LABELS[n.pitch] || `Drum ${n.pitch}`)
          : `${NOTE_NAMES[PC_TO_DIA[n.pitch%12]].toUpperCase()}${Math.floor(n.pitch/12)-1}`;
        showToast(label + ' selected');
      }
      return;
    }
  }

  // ── Measure hit test (select mode, or input mode fallback) ────
  let hit = null;
  let bestDist2 = Infinity;
  const margin2 = 40;
  for (const layout of APP.staveLayout) {
    const top = (layout.topLineY || layout.y) - margin2;
    const bot = layout.bottomY + margin2;
    if (y < top || y > bot) continue;
    const xMatch = x >= layout.x && x <= layout.x + layout.w;
    const mid    = ((layout.topLineY || layout.y) + layout.bottomY) / 2;
    const dist   = Math.abs(y - mid) + (xMatch ? 0 : 1000);
    if (dist < bestDist2) { bestDist2 = dist; hit = layout; }
  }
  if (!hit) { APP.selectedNoteIdx = -1; renderSelection(); return; }

  APP.selectedMeasure = hit.mi;
  APP.selectedStaff   = hit.si;
  APP.selectedNoteIdx = -1;

  if (APP.inputMode) {
    let pitch = yToPitchAccurate(y, hit);
    const pc0 = pitch % 12;
    const ks0 = getResolvedKeySig(hit.mi, hit.si);
    const km0 = getKeyAccidentals(ks0);
    if (APP.curAcc === 'b') {
      pitch = Math.max(12, pitch - 1);
    } else if (APP.curAcc === '#') {
      pitch = Math.min(120, pitch + 1);
    } else if (APP.curAcc === 'n') {
      // Keep natural — yToPitchAccurate already returns the natural pitch.
      // insertNote will add an explicit natural sign if the key sig
      // has a flat/sharp on this letter.
    } else {
      // Normal key sig adjustment (no curAcc)
      // km0 stores accidentals on the NATURAL pc (e.g. 3 flats: km0[4]='b' for Eb)
      if (km0[pc0] === 'b') pitch--;
      else if (km0[pc0] === '#') pitch++;
    }
    APP.curOctave = Math.floor(pitch / 12) - 1;
    updateOctaveDisplay();
    APP.curRest = false;
    insertNote(hit.mi, hit.si, pitch);
  } else if (APP.selectedNoteIdx >= 0 &&
             APP.selectedMeasure === hit.mi &&
             APP.selectedStaff   === hit.si) {
    // A note is selected on this stave — change its pitch
    const n = getMeasureBySI(hit.si, hit.mi)?.notes[APP.selectedNoteIdx];
    if (n && n.type === 'note') {
      const newPitch = yToPitchAccurate(y, hit);
      commitChange(score => {
        n.pitch = newPitch;
        n.accidental = DIATONIC_PCS.has(newPitch % 12) ? null : (getResolvedKeySig(hit.mi, hit.si) < 0 ? 'b' : '#');
      });
      scrollToSelectedMeasure();
    }
  } else {
    APP.selectedNoteIdx = -1;
    showToast(`Measure ${hit.mi + 1} selected`);
    renderSelection();
  }
}

function insertNote(mi, si, pitch) {
  const measure  = getMeasureBySI(si, mi);
  if (!measure) return;
  const capacity = measureBeatsCapacity(mi, si);

  // ── Chord mode: add pitch to the currently selected note ─────
  if (APP.chordMode && APP.selectedNoteIdx >= 0) {
    const targetNote = measure.notes[APP.selectedNoteIdx];
    if (targetNote && targetNote.type === 'note' && (targetNote.voice||1) === APP.curVoice) {
      const pc2 = pitch % 12;
      const existingPitches = [targetNote.pitch, ...(targetNote.extraPitches || []).map(e => e.pitch)];
      const highestPitch    = Math.max(...existingPitches);
      const baseOct = Math.floor(highestPitch / 12) - 1;
      const cands   = [baseOct, baseOct + 1].map(o => (o + 1) * 12 + pc2);
      const preferred = cands.find(m => m >= highestPitch - 2) || cands[cands.length - 1];
      const ks2 = getResolvedKeySig(mi, si);
      const km2 = getKeyAccidentals(ks2);
      const ka2 = km2[pc2] || null;
      let keyCovers2 = ka2;
      if (!keyCovers2 && !DIATONIC_PCS.has(pc2)) {
        const npc = ks2 < 0 ? (pc2 + 1) % 12 : (pc2 + 11) % 12;
        const na  = km2[npc];
        if (na && ((ks2 < 0 && na === 'b') || (ks2 > 0 && na === '#'))) keyCovers2 = na;
      }
      const ea  = APP.curAcc || (DIATONIC_PCS.has(pc2) ? (ka2 ? 'n' : null) : (keyCovers2 ? null : (ks2 < 0 ? 'b' : '#')));
      commitChange(score => {
        if (!targetNote.extraPitches) targetNote.extraPitches = [];
        targetNote.extraPitches.push({pitch: preferred, accidental: ea});
      }, { toast: 'Added ' + NOTE_NAMES[PC_TO_DIA[pc2]].toUpperCase() + ' to chord' });
      return;
    }
  }

  // ── Beat capacity check (per voice) ──────────────────────────
  const voiceNotes   = measure.notes.filter(n => (n.voice||1) === APP.curVoice);
  const isEmpty      = voiceNotes.length === 0 ||
    (voiceNotes.length === 1 && voiceNotes[0].type === 'rest' &&
      (voiceNotes[0].duration === 'w' || measure.pickup));
  const currentBeats = isEmpty ? 0 : beatsUsed(voiceNotes);
  const newBeats     = durBeats(APP.curDur, APP.curDot, APP.curTuplet);
  const remaining    = Math.max(0, capacity - currentBeats);

  // Pre-compute displayed accidental (needed for overflow splitting)
  // Skip all accidental/key-sig logic for percussion — pitches are direct drum mappings
  let displayAcc = null;
  const isPercussion = getStaveBySI(si)?.clef === 'percussion';
  if (!APP.curRest && !isPercussion) {
    const pc      = pitch % 12;
    const ks      = getResolvedKeySig(mi, si);
    const kMap    = getKeyAccidentals(ks);
    // Key sig stores accidentals on the NATURAL pc (e.g. D major → km[5]='#' for F#).
    // For chromatic notes we need to check the natural PC in the key sig's direction:
    //   flat keys  (ks<0): check the natural ABOVE (pc+1) for a flat (e.g. Bb→km[11]='b')
    //   sharp keys (ks>0): check the natural BELOW (pc-1) for a sharp (e.g. F#→km[5]='#')
    let keyAcc    = kMap[pc] || null;
    if (!keyAcc && !DIATONIC_PCS.has(pc)) {
      const npc = ks < 0 ? (pc + 1) % 12 : (pc + 11) % 12;
      const na  = kMap[npc];
      if (na && ((ks < 0 && na === 'b') || (ks > 0 && na === '#'))) keyAcc = na;
    }
    const actMap  = getMeasureActiveAccidentals(mi, si);
    let actAcc    = actMap[pc] !== undefined ? actMap[pc] : keyAcc;
    if (!DIATONIC_PCS.has(pc)) {
      // Same direction-respecting lookback for the active map
      if (actAcc == null) {
        const npc = ks < 0 ? (pc + 1) % 12 : (pc + 11) % 12;
        const na  = actMap[npc];
        if (na && ((ks < 0 && na === 'b') || (ks > 0 && na === '#'))) actAcc = na;
      }
    }
    if (APP.curAcc) {
      displayAcc = (APP.curAcc !== actAcc) ? APP.curAcc : null;
      if (APP.curAcc === 'n') displayAcc = (keyAcc || actAcc) ? 'n' : null;
    } else {
      if (!DIATONIC_PCS.has(pc)) {
        if (actAcc === '#' || actAcc === 'b') {
          displayAcc = null;
        } else {
          displayAcc = ks < 0 ? 'b' : '#';
        }
      } else {
        displayAcc = (actAcc && actAcc !== 'n' && actAcc !== keyAcc) ? 'n' : null;
      }
    }
    // Adjust pitch when the accidental overrides the key-signature default.
    // Skip when APP.curAcc is set — the caller (handleScoreTap/insertNoteByName)
    // already adjusted the pitch, and we'd double-adjust.
    if (!APP.curAcc) {
      if (displayAcc === 'n' && keyAcc) {
        pitch = keyAcc === 'b' ? Math.min(120, pitch + 1) : Math.max(12, pitch - 1);
      } else if (displayAcc === 'b' && !keyAcc && !DIATONIC_PCS.has(pc)) {
        pitch = Math.max(12, pitch - 1);
      } else if (displayAcc === '#' && !keyAcc && !DIATONIC_PCS.has(pc)) {
        pitch = Math.min(120, pitch + 1);
      }
    }
  }

  if (newBeats > remaining + 0.001) {
    const nextMi = mi + 1;
    if (nextMi >= APP.score.parts[0].staves[0].measures.length) {
      commitChange(score => {
        score.parts.forEach(p => p.staves.forEach(s => s.measures.push(emptyMeasure())));
      }, { toast: 'New measure added automatically' });
    }

    // Tuplets can't be split cleanly — move full note to next measure
    if (APP.curTuplet) {
      APP.selectedMeasure = nextMi;
      APP.selectedStaff   = si;
      insertNote(nextMi, si, pitch);
      return;
    }

    // Split: fill remaining space in current measure, tie to remainder in next
    const partial = findBestDuration(remaining);

    // If nothing fits in remaining space, move full note to next measure
    if (!partial) {
      APP.selectedMeasure = nextMi;
      APP.selectedStaff   = si;
      insertNote(nextMi, si, pitch);
      return;
    }

    commitChange(score => {
      const m = getMeasureBySI(si, mi);
      const ph2 = m.notes.findIndex(
        n => n.type==='rest' && n.duration==='w' && (n.voice||1)===APP.curVoice
      );
      const partialEntry = APP.curRest
        ? mkRest(partial.dur, partial.dots, APP.curVoice)
        : mkNote(pitch, partial.dur, partial.dots, displayAcc, APP.curVoice);
      if (!APP.curRest) partialEntry.tieToNext = true;
      if (ph2 >= 0) {
        m.notes.splice(ph2, 1, partialEntry);
      } else {
        const li2 = m.notes.reduce((b, n, i) => (n.voice||1)===APP.curVoice ? i : b, -1);
        m.notes.splice(li2 + 1, 0, partialEntry);
      }
    });

    // Recurse for the leftover duration
  const leftoverBeats = newBeats - partial.beats;
  const remainder = findBestDuration(leftoverBeats);
  APP.curDur  = remainder.dur;
  APP.curDot  = remainder.dots > 0;

  APP.selectedMeasure = nextMi;
  APP.selectedStaff   = si;
  insertNote(nextMi, si, pitch);
  return;
  }

  commitChange(score => {
    const m = getMeasureBySI(si, mi);
    const entry = APP.curRest
      ? mkRest(APP.curDur, APP.curDot ? 1 : 0, APP.curVoice)
      : mkNote(pitch, APP.curDur, APP.curDot ? 1 : 0, displayAcc, APP.curVoice);

    if (APP.curTuplet && !APP.curRest) {
      if (APP.tupletPending <= 0) APP.tupletPending = APP.curTuplet.num;
      entry.tuplet = {
        num: APP.curTuplet.num,
        den: APP.curTuplet.den,
        groupId: APP.tupletGroupId,
      };
      APP.tupletPending--;
      if (APP.tupletPending <= 0) {
        APP.tupletGroupId++;
        APP.tupletPending = 0;
        if (APP.curTuplet) APP.tupletPending = APP.curTuplet.num;
      }
    }

    const phIdx = m.notes.findIndex(
      n => n.type==='rest' && (n.duration==='w' || m.pickup) && (n.voice||1)===APP.curVoice
    );
    if (phIdx >= 0) {
      m.notes.splice(phIdx, 1, entry);
    } else {
      const lastIdx = m.notes.reduce((b, n, i) => (n.voice||1)===APP.curVoice ? i : b, -1);
      m.notes.splice(lastIdx + 1, 0, entry);
    }

    APP.selectedMeasure = mi;
    APP.selectedStaff   = si;
    APP.selectedNoteIdx = m.notes.indexOf(entry);
  });

  scrollToSelectedMeasure();

  const isPerc = getStaveBySI(si)?.clef === 'percussion';
  if (isPerc) {
    const DRUM_LABELS = {35:'Bass Drum',36:'Bass Drum',37:'Side Stick',38:'Snare',39:'Clap',40:'Snare',
      41:'Low Tom',42:'Hi-Hat',43:'Low-Mid Tom',44:'Pedal HH',45:'Mid Tom',46:'Open HH',
      47:'Mid-High Tom',48:'High Tom',49:'Crash',50:'High Tom 2',51:'Ride',52:'Chinese',53:'Ride Bell',56:'Cowbell'};
    showToast(APP.curRest ? 'Rest inserted' : `${DRUM_LABELS[pitch] || 'Drum ' + pitch} (V${APP.curVoice})`);
  } else {
    const pc2     = pitch % 12;
    const name    = NOTE_NAMES[PC_TO_DIA[pc2]].toUpperCase();
    const oct     = Math.floor(pitch / 12) - 1;
    const accLbl  = displayAcc==='#'?'♯':displayAcc==='b'?'♭':displayAcc==='n'?'♮':'';
    showToast(APP.curRest ? 'Rest inserted' : `${name}${accLbl}${oct} (V${APP.curVoice})`);
  }
}

// ── Controls ─────────────────────────────────────────────────────
const NAME_TO_PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11};

function insertNoteByName(name) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  // Practice mode: palette input validates against target note
  if (APP.practiceMode && APP.practiceWaiting) {
    let pc = NAME_TO_PC[name];
    if (APP.curAcc === '#') pc = (pc + 1) % 12;
    if (APP.curAcc === 'b') pc = (pc + 11) % 12;
    // Use target octave from current note
    const measure = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure);
    const note = measure?.notes[APP.selectedNoteIdx];
    const targetOct = note ? Math.floor(note.pitch / 12) - 1 : 4;
    const midi = targetOct * 12 + pc + 12;
    _checkPracticeNote(midi);
    return;
  }
  const canEnter = APP.inputMode || (APP.chordMode && APP.selectedNoteIdx >= 0);
  // Pitch-edit mode: note selected, not input mode, not chord mode → change existing pitch
  if (!APP.inputMode && !APP.chordMode && APP.selectedNoteIdx >= 0) {
    changePitchOfSelected(name);
    return;
  }
  // Exercise mode: palette input submits answers
  if (APP.exerciseMode && APP.exerciseSession) {
    const ex = APP.exerciseSession.current;
    if (ex.type === EXERCISE_TYPES.NOTE_ID) {
      // Build answer with octave from target
      const ansPc = NAME_TO_PC[name];
      const targetOct = ex.target.octave;
      const chromPc = APP.curAcc === '#' ? (ansPc + 1) % 12 : APP.curAcc === 'b' ? (ansPc + 11) % 12 : ansPc;
      const finalName = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][chromPc];
      checkExerciseAnswer(finalName + targetOct);
    } else if (ex.type === EXERCISE_TYPES.MELODY_DICT) {
      // In melody dictation, palette notes build the answer incrementally
      changePitchOfSelected(name);
    }
    return;
  }
  // Assignment mode: must select an existing note, cannot insert new ones
  if (APP.assignmentMode) {
    if (APP.selectedNoteIdx >= 0 && _isInAssignmentRange(APP.selectedMeasure)) {
      changePitchOfSelected(name);
    } else {
      showToast('Select a note inside the assignment range');
    }
    return;
  }
  if (!canEnter) {
    showToast('Tap ✏️ Input, or select a note to change its pitch');
    return;
  }

  // ── Percussion: map letter keys to specific drums ──
  const stave = getStaveBySI(APP.selectedStaff);
  const clef  = stave?.clef || 'treble';
  if (clef === 'percussion') {
    const DRUM_MAP = { C:36, D:38, E:42, F:49, G:45, A:56, B:39 };
    const midi = DRUM_MAP[name] || 38;
    APP.curRest = false;
    document.getElementById('btn-rest')?.classList.remove('active');
    const _sDur = APP.curDur, _sDot = APP.curDot;
    insertNote(APP.selectedMeasure, APP.selectedStaff, midi);
    APP.curDur = _sDur; APP.curDot = _sDot;
    return;
  }

  let pc = NAME_TO_PC[name];
  // ── Apply key signature: if the key has a sharp or flat on this letter,
  //    use that accidental unless the user has explicitly overridden it ──
  if (!APP.curAcc) {
    const ks    = getResolvedKeySig(APP.selectedMeasure, APP.selectedStaff);
    const kMap  = getKeyAccidentals(ks);
    // Check if this LETTER is flatted/sharped in the key sig.
    // km0 stores accidentals on the NATURAL pc (e.g. Eb → kMap[4]='b').
    if (kMap[pc] === 'b') pc = (pc + 11) % 12;
    else if (kMap[pc] === '#') pc = (pc + 1) % 12;
  } else {
    if (APP.curAcc === '#') pc = (pc + 1) % 12;
    if (APP.curAcc === 'b') pc = (pc + 11) % 12;
  }

  // ── Default octave by clef when there is no previous note ──────
  // Treble: octave 4 (middle range), Alto: octave 3 (C3–B3 centre), Bass: octave 3
  const defaultOct = clef === 'bass' ? 3 : 4;

  // Find the last real note in this measure to use as reference pitch
  const measure  = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure);
  const prevNote = measure?.notes
    .filter(n => n.type === 'note')
    .pop();

  let midi;
  if (prevNote) {
    // Always pick the octave that minimises the absolute semitone interval.
    // Build candidates spanning ±1 octave above and below reference.
    const refPitch = prevNote.pitch;
    const refBase  = Math.floor(refPitch / 12) * 12; // MIDI C of ref octave
    const candidates = [-12, 0, 12, 24].map(o => refBase + o + pc).filter(m => m >= 12 && m <= 120);
    midi = candidates.reduce((best, m) => {
      const dNew = Math.abs(m - refPitch), dBest = Math.abs(best - refPitch);
      if (dNew < dBest) return m;
      if (dNew === dBest) return m < best ? m : best; // tie: prefer lower
      return best;
    });
    APP.curOctave = Math.floor(midi / 12) - 1;
    updateOctaveDisplay();
  } else {
    // No previous note — use clef-appropriate default octave
    midi = (defaultOct + 1) * 12 + pc;
    APP.curOctave = defaultOct;
    updateOctaveDisplay();
  }

  APP.curRest = false;
  document.getElementById('btn-rest')?.classList.remove('active');
  const _sDur = APP.curDur, _sDot = APP.curDot;
  insertNote(APP.selectedMeasure, APP.selectedStaff, midi);
  APP.curDur = _sDur; APP.curDot = _sDot;
}

function insertRest() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (!APP.inputMode) {
    showToast('Tap ✏️ Input first to enter note-input mode');
    return;
  }
  APP.curRest = true;
  const _sDur = APP.curDur, _sDot = APP.curDot;
  insertNote(APP.selectedMeasure, APP.selectedStaff, 60 /* pitch ignored for rests */);
  APP.curDur = _sDur; APP.curDot = _sDot;
  APP.curRest = false;
  document.getElementById('btn-rest')?.classList.remove('active');
}

function shiftNoteOctave(direction) {
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)
              ?.notes[APP.selectedNoteIdx];
  if (!n || n.type === 'rest') return;
  commitChange(score => {
    n.pitch = Math.max(12, Math.min(120, n.pitch + direction));
    if (n.extraPitches) {
      n.extraPitches.forEach(ep => {
        ep.pitch = Math.max(12, Math.min(120, ep.pitch + direction));
      });
    }
  }, { toast: `${NOTE_NAMES[PC_TO_DIA[n.pitch % 12]].toUpperCase()}${Math.floor(n.pitch / 12) - 1}` });
}

function changePitchOfSelected(name) {
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)
              ?.notes[APP.selectedNoteIdx];
  if (!n) return;
  if (n.type === 'rest' && APP.exerciseMode && APP.exerciseSession?.current?.type === EXERCISE_TYPES.MELODY_DICT) {
    // Convert rest to note during melody dictation
    n.type = 'note';
    n.pitch = 60; // placeholder, will be set below
  } else if (n.type === 'rest') {
    showToast('Select a note (not a rest) to change pitch'); return;
  }

  let pc = NAME_TO_PC[name];
  if (APP.curAcc === '#') pc = (pc + 1) % 12;
  if (APP.curAcc === 'b') pc = (pc + 11) % 12;

  const refPitch = n.pitch;
  const cands    = [-12, 0, 12].map(o => Math.floor(refPitch / 12) * 12 + pc + o).filter(m => m > 0);
  const newPitch = cands.reduce((best, m) =>
    Math.abs(m - refPitch) < Math.abs(best - refPitch) ? m : best, cands[0]);

  // Assignment mode: store answer instead of mutating score
  if (APP.assignmentMode && _isInAssignmentRange(APP.selectedMeasure)) {
    _storeAssignmentAnswer(APP.selectedMeasure, APP.selectedNoteIdx, { pitch: newPitch });
    return;
  }

  const mi  = APP.selectedMeasure;
  const si  = APP.selectedStaff;
  commitChange(score => {
    n.pitch = newPitch;
    const ks  = getResolvedKeySig(mi, si);
    const kMap = getKeyAccidentals(ks);
    const keyAcc = kMap[pc] || null;
    if (APP.curAcc) {
      n.accidental = APP.curAcc;
    } else if (!DIATONIC_PCS.has(pc)) {
      n.accidental = ks < 0 ? 'b' : '#';
    } else {
      n.accidental = keyAcc ? 'n' : null;
    }
  }, { toast: `Changed to ${NOTE_NAMES[PC_TO_DIA[pc]].toUpperCase()}${Math.floor(newPitch / 12) - 1}` });
}

function _isInAssignmentRange(mi) {
  const asgn = APP.currentAssignment;
  if (!asgn) return false;
  return mi >= asgn.range.startMi && mi <= asgn.range.endMi;
}

function _storeAssignmentAnswer(mi, ni, answer) {
  const asgn = APP.currentAssignment;
  if (!asgn) return;
  const id = asgn.id;
  if (!APP.score.studentAnswers) APP.score.studentAnswers = {};
  if (!APP.score.studentAnswers[id]) APP.score.studentAnswers[id] = { notes: {} };
  if (!APP.score.studentAnswers[id].notes[mi]) APP.score.studentAnswers[id].notes[mi] = {};
  const existing = APP.score.studentAnswers[id].notes[mi][ni] || {};
  APP.score.studentAnswers[id].notes[mi][ni] = { ...existing, ...answer };

  // Persist to localStorage so answers survive reloads
  try {
    const key = `pauta_answers_${id}`;
    localStorage.setItem(key, JSON.stringify(APP.score.studentAnswers[id]));
  } catch(e) { console.warn('[Pauta]', e.message); }

  // Immediate visual feedback
  const hiddenSet = new Set(asgn.hidden || ['pitch']);
  const targetNote = getMeasureBySI(APP.selectedStaff, mi)?.notes[ni];
  if (!targetNote) return;
  let ok = true, msg = '';
  if (hiddenSet.has('pitch') && answer.pitch != null) {
    if (answer.pitch === targetNote.pitch) {
      msg = 'Correct!';
    } else if ((answer.pitch % 12) === (targetNote.pitch % 12)) {
      ok = false; msg = 'Enharmonic — try again';
    } else {
      ok = false; msg = 'Wrong pitch — try again';
    }
  }
  showToast(msg, ok ? 800 : 1500);
  renderScore();
}

function changeOctave(delta) {
  if (APP.selectedNoteIdx >= 0 && !APP.inputMode) {
    shiftNoteOctave(delta);
  } else {
    APP.curOctave = Math.max(0, Math.min(8, APP.curOctave + delta));
    updateOctaveDisplay();
    showToast('Octave ' + APP.curOctave);
  }
}

function updateOctaveDisplay() {
  const el = document.getElementById('oct-display');
  if (el) el.textContent = 'Octave ' + APP.curOctave;
}

// ── Note Name / Solfège Labels ──────────────────────────────────
const SOLFEGE = [
  { nat:'Do', sh:'Di', fl:'Ra' },  // C   / C#  / Db
  { nat:'Re', sh:'Ri', fl:'Me' },  // D   / D#  / Eb
  { nat:'Mi', sh:'Mi', fl:'Me' },  // E   / E#  / Fb
  { nat:'Fa', sh:'Fi', fl:'Fa' },  // F   / F#  / Gb
  { nat:'Sol',sh:'Si', fl:'Se' },  // G   / G#  / Ab
  { nat:'La', sh:'Li', fl:'Le' },  // A   / A#  / Bb
  { nat:'Ti', sh:'Ti', fl:'Te' },  // B   / B#  / Cb
];

function noteLabelForPitch(pitch, ks, acc, mode, clef) {
  // ── Percussion: return drum abbreviations ──
  if (clef === 'percussion') {
    const DRUM_NAMES = {
      35:'BD', 36:'BD', 37:'SS', 38:'SN', 39:'SS', 40:'SN',
      41:'LT', 42:'HH', 43:'LT', 44:'CH', 45:'MT',
      46:'OH', 47:'MT', 48:'HT', 49:'CC', 50:'HT', 51:'RC',
      52:'CH', 53:'RB', 56:'CB'
    };
    const name = DRUM_NAMES[pitch];
    if (name) return name;
  }
  const pc = pitch % 12;
  const dia = PC_TO_DIA[pc];
  // Determine the effective key-sig context for spelling
  if (mode === 'solfege') {
    const row = SOLFEGE[dia];
    // Explicit accidental determines the spelling
    if (acc === 'b') return row.fl;
    if (acc === '#') return row.sh;
    if (acc === 'n') return row.nat;
    if (pc === CHROMATIC[dia]) return row.nat; // diatonic
    const isSharp = pc > CHROMATIC[dia];
    if (ks < 0 && !isSharp) return row.fl; // flat key + flat-side note → flat
    if (ks > 0 && isSharp) return row.sh;  // sharp key + sharp-side note → sharp
    return isSharp ? row.sh : row.fl;
  }
  // Letter-name mode
  const letter = NOTE_NAMES[dia].toUpperCase();
  if (acc === 'b') return letter + 'b';
  if (acc === '#') return letter + '#';
  if (acc === 'n') return letter;
  if (pc === CHROMATIC[dia]) return letter;
  const isSharp = pc > CHROMATIC[dia];
  if (ks < 0 && !isSharp) return letter + 'b';
  if (ks > 0 && isSharp) return letter + '#';
  return letter + (isSharp ? '#' : 'b');
}

function toggleNoteLabels() {
  if (!APP.showNoteLabels) {
    APP.showNoteLabels = true;
    APP.noteLabelMode = 'solfege';
  } else if (APP.noteLabelMode === 'solfege') {
    APP.noteLabelMode = 'letter';
  } else {
    APP.showNoteLabels = false;
  }
  updateNoteLabelsButton();
  renderScore();
  showToast(!APP.showNoteLabels ? 'Labels off' : APP.noteLabelMode === 'solfege' ? 'Solfège on' : 'Letter names on');
}

function toggleHighContrast() {
  document.body.classList.toggle('high-contrast');
  const on = document.body.classList.contains('high-contrast');
  showToast(on ? 'High contrast on' : 'High contrast off');
  renderScore();
}

function renderNoteLabels() {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl || !APP.score || !APP.showNoteLabels) return;
  const mode = APP.noteLabelMode;
  for (const nl of APP.noteLayout) {
    const m = getMeasureBySI(nl.si, nl.mi);
    const n = m?.notes[nl.ni];
    if (!n || n.type !== 'note') continue;
    const ks = getResolvedKeySig(nl.mi, nl.si);
    const clef = sl?.clef || 'treble';
    const label = noteLabelForPitch(n.pitch, ks, n.accidental, mode, clef);
    const sl = APP.staveLayout.find(l => l.mi === nl.mi && l.si === nl.si);
    const staffBot = sl ? sl.bottomY : nl.y;
    const fontSize = Math.round(LAYOUT.STAVE_H * 0.22);
    const lbl = document.createElementNS('http://www.w3.org/2000/svg','text');
    lbl.setAttribute('x', nl.x);
    lbl.setAttribute('y', staffBot + fontSize + Math.round(LAYOUT.STAVE_H * 0.16));
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('font-family', "'Helvetica Neue',Helvetica,Arial,sans-serif");
    lbl.setAttribute('font-size', fontSize);
    lbl.setAttribute('font-weight', '700');
    lbl.setAttribute('fill', '#555');
    lbl.setAttribute('pointer-events', 'none');
    lbl.textContent = label;
    svgEl.appendChild(lbl);
  }
}

function updateNoteLabelsButton() {
  const btn = document.getElementById('btn-note-labels');
  if (!btn) return;
  const on = APP.showNoteLabels;
  btn.classList.toggle('active', on);
  const dot = document.getElementById('note-labels-dot');
  if (dot) dot.classList.toggle('active', on);
  const txt = document.getElementById('note-labels-text');
  if (txt) txt.textContent = on ? (APP.noteLabelMode === 'solfege' ? '𝅘 Solfège' : '𝅘 Names') : '𝅘 Solfege';
}


// ── Dynamics ──────────────────────────────────────────────────────
// ── Side Panel ───────────────────────────────────────────────────
let _activePanel = null;
const PANEL_PAGES = ['search','marks','artic','lines','text','clef','bars','tempo'];

function togglePanel(name) {
  const panel = document.getElementById('side-panel');

  if (_activePanel === name) {
    panel.classList.add('panel-hidden');
    PANEL_PAGES.forEach(p => {
      document.getElementById('tab-'+p)?.classList.remove('active');
    });
    _activePanel = null;
    return;
  }

  _activePanel = name;
  panel.classList.remove('panel-hidden');

  PANEL_PAGES.forEach(p => {
    const pg  = document.getElementById('panel-'+p);
    const tab = document.getElementById('tab-'+p);
    if (pg)  pg.style.display  = (p === name) ? '' : 'none';
    if (tab) tab.classList.toggle('active', p === name);
  });

  if (name === 'search') populateSearchPanel();
  resetPaletteFilter();
}

function resetPaletteFilter() {
  document.querySelectorAll('.palette-row .pal-btn').forEach(btn => {
    btn.style.display = '';
  });
}

let _searchPopulated = false;
function populateSearchPanel() {
  if (_searchPopulated) return;
  _searchPopulated = true;
  const container = document.getElementById('search-results');
  if (!container) return;
  container.innerHTML = '';
  const allBtns = document.querySelectorAll('.palette-row .pal-btn');
  allBtns.forEach(btn => {
    const clone = btn.cloneNode(true);
    const origId = btn.id;
    if (origId) clone.id = 'search-'+origId;
    container.appendChild(clone);
  });
}

function filterSearchPanels(query) {
  const container = document.getElementById('search-results');
  if (!container) return;
  const q = query.toLowerCase();
  container.querySelectorAll('.pal-btn').forEach(btn => {
    const label = btn.querySelector('.pal-lbl')?.textContent?.toLowerCase() || '';
    btn.style.display = label.includes(q) ? '' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('score-area')?.addEventListener('touchstart', () => {
    if (_activePanel) togglePanel(_activePanel);
  }, {passive:true});
});

// ── Articulations ────────────────────────────────────────────────
const ARTIC_SYMBOLS = {
  staccato:      '.',
  accent:        '>',
  tenuto:        '—',
  marcato:       '^',
  fermata:       '𝄐',
  staccatissimo: '▾',
  trill:         'tr~',
  'staccato+tenuto':  '· —',
  'tenuto+accent':    '— >',
  'staccato+accent':  '· >',
  'marcato+staccato': '^ ·',
};

function applyArticulation(type) {
  try { _require({ require: ['selectedNote'], forbid: ['exercise', 'assignment'] }); } catch(e) { showToast(e.message); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (!n || n.type === 'rest') { showToast('Select a note (not a rest)'); return; }
  commitChange(score => {
    n.articulation = (n.articulation === type || !type) ? null : type;
  }, { toast: n.articulation ? ARTIC_SYMBOLS[n.articulation] + ' ' + n.articulation : 'Articulation removed' });
}

// ── Fingering ─────────────────────────────────────────────────────
function applyFingering(f) {
  try { _require({ require: ['selectedNote'], forbid: ['exercise', 'assignment'] }); } catch(e) { showToast(e.message); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (!n || n.type === 'rest') { showToast('Select a note (not a rest)'); return; }
  commitChange(score => {
    n.fingering = (!f || n.fingering === f) ? null : f;
  }, { toast: n.fingering ? `Fingering ${n.fingering}` : 'Fingering removed' });
}

// ── Barlines ─────────────────────────────────────────────────────
function applyBarline(type) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const mi = APP.selectedMeasure;
  commitChange(score => {
    score.parts.forEach(p => p.staves.forEach(s => {
      const m = s.measures[mi];
      if (m) m.barline = type;
    }));
  }, { toast: 'Barline: ' + type });
}

// ── Clef Changes ─────────────────────────────────────────────────
function applyClefChange(clef) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedMeasure < 0) { showToast('Select a measure first'); return; }
  commitChange(score => {
    score.parts.forEach(p => p.staves.forEach(s => {
      const m = s.measures[APP.selectedMeasure];
      if (m) m.clef = clef;
    }));
  }, { toast: clef ? `Clef: ${clef.charAt(0).toUpperCase() + clef.slice(1)}` : 'Clef change removed' });
}

// ── Navigation Markers (segno, coda, Fine, D.C., D.S.) ────────────
function applyMarker(type) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedMeasure < 0) { showToast('Select a measure first'); return; }
  commitChange(score => {
    score.parts[0].staves.forEach(s => {
      const m = s.measures[APP.selectedMeasure];
      if (m) {
        if (m[type]) { delete m[type]; } else { m[type] = true; }
      }
    });
  }, { toast: `${{segno:'Segno', coda:'Coda', fine:'Fine', dc:'D.C.', ds:'D.S.'}[type] || type} ${APP.score.parts[0].staves[0].measures[APP.selectedMeasure]?.[type] ? 'added' : 'removed'}` });
}

function clearMarker() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedMeasure < 0) { showToast('Select a measure first'); return; }
  commitChange(score => {
    score.parts[0].staves.forEach(s => {
      const m = s.measures[APP.selectedMeasure];
      if (m) { delete m.segno; delete m.coda; delete m.fine; delete m.dc; delete m.ds; }
    });
  }, { toast: 'Navigation markers cleared' });
}

function clearTie() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedNoteIdx < 0) { showToast('Select a note first'); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)?.notes[APP.selectedNoteIdx];
  if (!n || !n.tieToNext) { showToast('Selected note has no tie'); return; }
  commitChange(score => {
    const note = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure, score)?.notes[APP.selectedNoteIdx];
    if (note) delete note.tieToNext;
  }, { toast: 'Tie removed' });
}

function clearSlur() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  if (APP.selectedNoteIdx < 0) { showToast('Select a note first'); return; }
  const si = APP.selectedStaff;
  const mi = APP.selectedMeasure;
  const ni = APP.selectedNoteIdx;
  const score = APP.score;
  if (!score || !score.slurs) { showToast('No slurs in score'); return; }
  const before = score.slurs.length;
  commitChange(sc => {
    if (!sc.slurs) return;
    sc.slurs = sc.slurs.filter(s =>
      !(s.si === si && s.startMi === mi && s.startNi === ni) &&
      !(s.si === si && s.endMi === mi && s.endNi === ni)
    );
  }, { toast: 'Slur removed' });
  if (score.slurs.length === before) showToast('Selected note is not inside a slur');
}

// ── Tempo ─────────────────────────────────────────────────────────
function toggleTempoDisplay() {
  APP.showTempoOnScore = !APP.showTempoOnScore;
  const btn = document.getElementById('btn-tempo-toggle');
  if (btn) {
    btn.textContent = APP.showTempoOnScore ? '✓ Show on score' : '○ Show on score';
    btn.classList.toggle('active', APP.showTempoOnScore);
  }
  renderScore();
}

function applyTempo(name, bpm) {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const mi = APP.selectedMeasure;
  commitChange(score => {
    score.parts[0].staves[0].measures[mi].tempo = {name, bpm};
  });
  APP.tempo = bpm;
  document.getElementById('tempo-slider').value = Math.min(240, Math.max(40, bpm));
  document.getElementById('tempo-val').textContent = bpm;
  showToast(name + ' ♩=' + bpm);
}

function applyDynamic(dyn) {
  try { _require({ require: ['selectedNote'], forbid: ['exercise', 'assignment'] }); } catch(e) { showToast(e.message); return; }
  const n = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure)
              ?.notes[APP.selectedNoteIdx];
  if (!n) return;
  commitChange(score => {
    n.dynamic = (n.dynamic === dyn) ? null : dyn;
  }, { toast: n.dynamic ? dyn : 'Dynamic removed' });
}

// ── Slurs / Ties / Hairpins ───────────────────────────────────────
function startMarking(type) {
  if (APP.selectedNoteIdx < 0) {
    showToast('Select the first note, then tap the marking');
    return;
  }
  // If already in this marking mode, cancel
  if (APP.markingMode === type) {
    APP.markingMode  = null;
    APP.markingStart = null;
    document.querySelectorAll('#btn-tie,#btn-slur,#btn-cresc,#btn-dim')
      .forEach(b => b.classList.remove('active'));
    showToast('Cancelled');
    _validateModeState();
    return;
  }
  // Clear conflicting modes
  if (APP.inputMode) toggleInputMode();
  APP.chordMode = false;
  document.getElementById('btn-chord')?.classList.remove('active');
  APP.markingMode  = type;
  APP.markingStart = {
    mi: APP.selectedMeasure,
    si: APP.selectedStaff,
    ni: APP.selectedNoteIdx
  };
  // Highlight active button
  document.querySelectorAll('#btn-tie,#btn-slur,#btn-cresc,#btn-dim')
    .forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + type)?.classList.add('active');
  const labels = {tie:'Tie', slur:'Slur', cresc:'Crescendo', dim:'Diminuendo'};
  showToast(`${labels[type]}: now select the END note`);
  _validateModeState();
}

function completeMarking(endMi, endSi, endNi) {
  const {markingMode: type, markingStart: s} = APP;
  // Validate: end must be same staff, after start
  if (endSi !== s.si) { showToast('Markings must be on the same staff'); return; }
  if (endMi < s.mi || (endMi === s.mi && endNi <= s.ni)) {
    showToast('End note must come after start note'); return;
  }

  commitChange(score => {
    if (!score.slurs)    score.slurs    = [];
    if (!score.hairpins) score.hairpins = [];

    if (type === 'tie') {
      const n = getMeasureBySI(s.si, s.mi)?.notes[s.ni];
      if (n) n.tieToNext = true;
    } else if (type === 'slur') {
      score.slurs.push({si: s.si, startMi: s.mi, startNi: s.ni, endMi, endNi});
    } else {
      score.hairpins.push({type, si: s.si, startMi: s.mi, startNi: s.ni, endMi, endNi});
    }

    APP.markingMode  = null;
    APP.markingStart = null;
    document.querySelectorAll('#btn-tie,#btn-slur,#btn-cresc,#btn-dim')
      .forEach(b => b.classList.remove('active'));
  }, { toast: `${labels[type]} added` });
  _validateModeState();
}
function selectDur(d) {
  APP.curDur = d;
  document.querySelectorAll('[data-dur]').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-dur="${d}"]`)?.classList.add('active');
}
function toggleDot() {
  APP.curDot = !APP.curDot;
  document.getElementById('btn-dot').classList.toggle('active', APP.curDot);
}
function toggleChordMode() {
  APP.chordMode = !APP.chordMode;
  if (APP.chordMode) {
    APP.markingMode  = null;
    APP.markingStart = null;
    document.querySelectorAll('#btn-tie,#btn-slur,#btn-cresc,#btn-dim').forEach(b => b.classList.remove('active'));
  }
  document.getElementById('btn-chord').classList.toggle('active', APP.chordMode);
  if (APP.chordMode) {
    showToast('Chord mode — select a note, then tap note names to stack');
  } else {
    showToast('Chord mode off');
  }
  _validateModeState();
}

function setVoice(v) {
  APP.curVoice = v;
  document.getElementById('btn-voice1').classList.toggle('active', v === 1);
  document.getElementById('btn-voice2').classList.toggle('active-v2', v === 2);
  showToast('Voice ' + v);
}
function setAcc(a) {
  APP.curAcc = APP.curAcc === a ? null : a;
  document.getElementById('btn-sharp').classList.toggle('active', APP.curAcc === '#');
  document.getElementById('btn-flat').classList.toggle('active',  APP.curAcc === 'b');
  document.getElementById('btn-nat').classList.toggle('active',   APP.curAcc === 'n');
}

// ── Notehead Controls ────────────────────────────────────────────
// ── Tuplet Controls ───────────────────────────────────────────────
function toggleTuplet(num, den) {
  // If same tuplet is active, toggle off
  if (APP.curTuplet && APP.curTuplet.num === num) {
    APP.curTuplet    = null;
    APP.tupletPending = 0;
    document.getElementById('btn-triplet')?.classList.remove('active');
    showToast('Tuplet off');
    return;
  }
  APP.curTuplet     = {num, den};
  APP.tupletPending = num;      // first group starts immediately
  document.getElementById('btn-triplet')?.classList.toggle('active', num === 3);
  const label = num === 3 ? 'Triplet' : `${num}:${den} tuplet`;
  showToast(`${label} mode — enter ${num} notes`);
}


function toggleInputMode() {
  APP.inputMode = !APP.inputMode;
  // Clear conflicting modes when entering input mode
  if (APP.inputMode) {
    APP.markingMode  = null;
    APP.markingStart = null;
    document.querySelectorAll('#btn-tie,#btn-slur,#btn-cresc,#btn-dim').forEach(b => b.classList.remove('active'));
  }
  const btn = document.getElementById('btn-input-mode');
  btn.classList.toggle('active', APP.inputMode);
  btn.textContent = APP.inputMode ? '⏹ Input' : '✏️ Input';
  document.getElementById('score-svg').style.cursor = APP.inputMode ? 'crosshair' : 'pointer';
  document.getElementById('st-mode').textContent = APP.inputMode ? 'Note input' : 'Select';
  document.getElementById('note-row').style.opacity = APP.inputMode ? '1' : '0.4';
  if (APP.inputMode) {
    showToast('1 — Tap a measure  2 — Tap a note name (C–B)');
  } else {
    showToast('Select mode');
  }
  _validateModeState();
}
function deleteSelected() {
  if (APP.selectedNoteIdx < 0) return;
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const m = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure);
  if (!m) return;
  commitChange(score => {
    if (APP.selStartIdx >= 0) {
      const lo = Math.min(APP.selStartIdx, APP.selectedNoteIdx);
      const hi = Math.max(APP.selStartIdx, APP.selectedNoteIdx);
      m.notes.splice(lo, hi - lo + 1);
      APP.selStartIdx = -1;
    } else {
      m.notes.splice(APP.selectedNoteIdx, 1);
    }
    if (!m.notes.length) m.notes.push(mkRest('w'));
    APP.selectedNoteIdx = -1;
  }, { toast: 'Deleted' });
}

function copySelection() {
  const mi = APP.selectedMeasure;
  const si = APP.selectedStaff;
  const m = getMeasureBySI(si, mi);
  if (!m) { showToast('Nothing to copy'); return; }
  if (APP.selStartIdx >= 0) {
    const lo = Math.min(APP.selStartIdx, APP.selectedNoteIdx);
    const hi = Math.max(APP.selStartIdx, APP.selectedNoteIdx);
    APP.clipboard = { type: 'notes', data: JSON.parse(JSON.stringify(m.notes.slice(lo, hi + 1))) };
    showToast((hi - lo + 1) + ' notes copied');
  } else if (APP.selectedNoteIdx >= 0 && m.notes[APP.selectedNoteIdx]) {
    APP.clipboard = { type: 'note', data: JSON.parse(JSON.stringify(m.notes[APP.selectedNoteIdx])) };
    showToast('Note copied');
  } else {
    APP.clipboard = { type: 'measure', data: JSON.parse(JSON.stringify(m)) };
    showToast('Measure copied');
  }
}

function cutSelection() {
  copySelection();
  if (!APP.clipboard) return;
  const mi = APP.selectedMeasure;
  const si = APP.selectedStaff;
  const m = getMeasureBySI(si, mi);
  if (!m) return;
  commitChange(score => {
    if (APP.selStartIdx >= 0) {
      const lo = Math.min(APP.selStartIdx, APP.selectedNoteIdx);
      const hi = Math.max(APP.selStartIdx, APP.selectedNoteIdx);
      m.notes.splice(lo, hi - lo + 1);
      APP.selStartIdx = -1;
    } else if (APP.selectedNoteIdx >= 0) {
      m.notes.splice(APP.selectedNoteIdx, 1);
    } else return;
    if (!m.notes.length) m.notes.push(mkRest('w'));
    APP.selectedNoteIdx = -1;
  });
}

function pasteClipboard() {
  if (!APP.clipboard) { showToast('Nothing to paste'); return; }
  const clipType = APP.clipboard.type;
  const clipData = JSON.parse(JSON.stringify(APP.clipboard.data));
  const mi = APP.selectedMeasure;
  const si = APP.selectedStaff;
  commitChange(score => {
    if (clipType === 'note') {
      const m = getMeasureBySI(si, mi);
      if (!m) return;
      const ni = APP.selectedNoteIdx;
      if (ni >= 0) {
        m.notes.splice(ni + 1, 0, clipData);
        APP.selectedNoteIdx = ni + 1;
      } else {
        m.notes.push(clipData);
        APP.selectedNoteIdx = m.notes.length - 1;
      }
    } else if (clipType === 'measure') {
      score.parts.forEach(p => p.staves.forEach(s => {
        if (s.measures[mi]) s.measures[mi] = JSON.parse(JSON.stringify(clipData));
      }));
    }
  }, { toast: clipType === 'note' ? 'Note pasted' : 'Measure pasted' });
}

// ── Selection helpers ────────────────────────────────────────────
function isNoteSelected(mi, si, ni) {
  if (mi !== APP.selectedMeasure || si !== APP.selectedStaff) return false;
  if (APP.selStartIdx < 0) return ni === APP.selectedNoteIdx;
  const lo = Math.min(APP.selStartIdx, APP.selectedNoteIdx);
  const hi = Math.max(APP.selStartIdx, APP.selectedNoteIdx);
  return ni >= lo && ni <= hi;
}
function selectAllNotes() {
  const m = getMeasureBySI(APP.selectedStaff, APP.selectedMeasure);
  if (!m || !m.notes.length) return;
  APP.selStartIdx = 0;
  APP.selectedNoteIdx = m.notes.length - 1;
  renderSelection();
  showToast(`Selected ${m.notes.length} notes`);
}

// ── Delete Measure ────────────────────────────────────────────────
function deleteMeasure() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const nM = APP.score.parts[0].staves[0].measures.length;
  if (nM <= 1) { showToast('Cannot delete the only measure'); return; }
  const mi = APP.selectedMeasure;
  commitChange(score => {
    score.parts.forEach(p => p.staves.forEach(s => s.measures.splice(mi, 1)));
    shiftMeasureRefs(score, mi, 'delete');
  }, { toast: 'Measure deleted' });
  APP.selectedMeasure = Math.min(mi, nM - 2);
  APP.selectedNoteIdx = -1;
  _auditAnnotationsAfterEdit(APP.score, 'deleteMeasure', mi);
}

function toggleLineBreak() {
  try { _require({ forbid: ['exercise', 'assignment', 'marking'] }); } catch(e) { showToast(e.message); return; }
  const mi = APP.selectedMeasure;
  const measure = APP.score.parts[0].staves[0].measures[mi];
  if (!measure) return;
  const newVal = !measure.lineBreak;
  commitChange(score => {
    score.parts.forEach(p => p.staves[0].measures[mi].lineBreak = newVal);
  }, { toast: newVal ? '⏎ Line break' : 'Line break removed' });
}

function toggleContinuousView() {
  APP.continuousView = !APP.continuousView;
  document.getElementById('btn-continuous').classList.toggle('active', APP.continuousView);
  renderScore();
  showToast(APP.continuousView ? 'Continuous view' : 'Page view');
}

function toggleMeasureNumbers() {
  APP.showMeasureNumbers = !APP.showMeasureNumbers;
  renderScore();
  showToast(APP.showMeasureNumbers ? 'Measure numbers shown on every bar' : 'Measure numbers at system start only');
}

function toggleMultiMeasureRests() {
  APP.showMultiMeasureRests = !APP.showMultiMeasureRests;
  renderScore();
  showToast(APP.showMultiMeasureRests ? 'Multi-measure rests enabled' : 'Multi-measure rests disabled');
}

function toggleTheoryOverlay() {
  APP.showTheoryOverlay = !APP.showTheoryOverlay;
  renderScore();
  showToast(APP.showTheoryOverlay ? 'Theory overlay on' : 'Theory overlay off');
}

function toggleRhythmCounting() {
  APP.showRhythmCounting = !APP.showRhythmCounting;
  renderScore();
  showToast(APP.showRhythmCounting ? 'Rhythm counting on' : 'Rhythm counting off');
}

// ── Zoom ──────────────────────────────────────────────────────────
function applyZoom() {
  const z = Math.round(APP.zoom * 100);
  document.getElementById('score-svg').style.transform = `scale(${APP.zoom})`;
  document.getElementById('score-svg').style.transformOrigin = 'top center';
  document.getElementById('score-svg').style.width = `${100 / APP.zoom}%`;
  document.getElementById('zoom-pct').textContent = z + '%';
}
function zoomIn()  { APP.zoom = Math.min(2,   APP.zoom + 0.1); applyZoom(); }
function zoomOut() { APP.zoom = Math.max(0.5, APP.zoom - 0.1); applyZoom(); }
function zoomReset(){ APP.zoom = 1; applyZoom(); }

// ── Pinch-to-zoom ─────────────────────────────────────────────────
let _pinchDist = 0;
document.getElementById('score-canvas-container').addEventListener('gesturestart', e => { e.preventDefault(); _pinchDist = 0; });
document.getElementById('score-canvas-container').addEventListener('gesturechange', e => {
  e.preventDefault();
  const d = e.scale;
  APP.zoom = Math.max(0.5, Math.min(2, APP.zoom * d / (_pinchDist || 1)));
  _pinchDist = d;
  applyZoom();
});
document.getElementById('score-canvas-container').addEventListener('gestureend', e => {
  APP.zoom = Math.round(APP.zoom * 10) / 10; // snap to 0.1 increments
  applyZoom();
  _pinchDist = 0;
});

// ── Transposition ─────────────────────────────────────────────────