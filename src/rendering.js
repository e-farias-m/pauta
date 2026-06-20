// ── Spacing helpers ───────────────────────────────────────────────
/**
 * @namespace RENDER
 * VexFlow rendering, layout, SVG overlays, recorder diagrams.
 * Provides: renderScore, scrollToSelectedMeasure, renderSelection,
 * positionAllDiagrams, updateRecorderDiagram, updateWoodwindDiagram,
 * updateBrassDiagram, _runBootSelfCheck.
 */
const RENDER = {};

// ── Static listeners (called once at boot) ──────────────────────
function initListeners() {
  // Rendering attaches listeners dynamically via SVG overlays.
  // No static DOM listeners needed.
}

// Natural pixel width for a single note/rest of given duration
function noteNaturalWidth(dur, dots) {
  const noteScale = APP.continuousView ? 1 : 0.7;
  const base = {w:87, h:59, q:37, '8':28, '16':23, '32':19, '64':18}[dur] || 37;
  return Math.max(12, Math.round(base * noteScale));
}
// Natural width of a measure's note content (excluding leading clef/key/time extras)
function measureContentWidth(notes) {
  const noteScale = APP.continuousView ? 1 : 0.7;
  if (isWholeRestPlaceholder(notes)) return Math.round(92 * noteScale);
  return notes.reduce((s, n) => s + noteNaturalWidth(n.duration, n.dots), 0)
       + Math.round(34 * noteScale);
}

function findMultiRestGroups() {
  const groups = [];
  const parts = APP.score.parts;
  const staves = parts.flatMap(p => p.staves);
  for (let si = 0; si < staves.length; si++) {
    const measures = staves[si].measures;
    let start = -1;
    for (let mi = 0; mi < measures.length; mi++) {
      const m = measures[mi];
      const isEmpty = isWholeRestPlaceholder(m.notes) || m.notes.length === 0;
      if (isEmpty && start === -1) {
        start = mi;
      } else if (!isEmpty && start >= 0) {
        if (mi - start >= 2) {
          groups.push({ gsi: si, startMi: start, endMi: mi - 1 });
        }
        start = -1;
      }
    }
    if (start >= 0 && measures.length - start >= 2) {
      groups.push({ gsi: si, startMi: start, endMi: measures.length - 1 });
    }
  }
  return groups;
}

// Build ghosted filler-rest StaveNotes for remaining beats in a voice (display-only, not in model)
function buildFillerRests(leftover, clef, capacity, stemDir) {
  const fillers = [];
  if (leftover <= 0.001 || leftover >= capacity - 0.001) return fillers;
  const restKey = clef === 'bass' ? 'd/3' : clef === 'alto' ? 'c/4' : clef === 'tenor' ? 'a/3' : 'b/4';
  let rem = leftover;
  while (rem > 0.001) {
    const best = beatsToBestRestDuration(rem);
    if (!best) break;
    const base   = best.base || best.dur;
    const durStr = base + (best.dot ? 'd' : '') + 'r';
    try {
      const fr = new VF.StaveNote({ keys: [restKey], duration: durStr, clef });
      if (best.dot) { vfSafe(() => fr.addDot(0), 'fillerDot'); }
      fr.setStyle({ fillStyle: 'rgba(0,0,0,0.28)', strokeStyle: 'rgba(0,0,0,0.28)' });
      fillers.push(fr);
    } catch(e) { if (DEBUG) console.warn('[Pauta] filler rest:', e.message); }
    rem -= best.beats;
  }
  return fillers;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 4: Rendering
// ═══════════════════════════════════════════════════════════════════
// ── Rendering ────────────────────────────────────────────────────
// ── Rendering constants ────────────────────────────────────────
// Immutable defaults — computed values live in LAYOUT (set per render).
const REND = Object.freeze({
  STAVE_H: 132,
  STAVE_SPACING: 145,
  STAVE_GAP: 10,
  SYS_SPACING: 6,
  MARGIN_X: 166,
  MARGIN_TOP: 116,
});
// Per-render layout — recomputed at the start of _renderScoreBody().
const LAYOUT = { STAVE_H: 132, STAVE_SPACING: 145, SYS_SPACING: 6, MARGIN_X: 166, MARGIN_TOP: 116 };

/** Wrap a VexFlow call so internal errors are logged instead of silently swallowed. */
function vfSafe(fn, label) {
  try { fn(); } catch(e) { if (DEBUG) console.warn('[Pauta]', label, e.message); }
}

/** Vertical layout — page view gaps are the reference; staves pack by measured height. */
function _layoutScales() {
  const isContinuous = APP.continuousView;
  const viewScale = isContinuous ? 1 : 0.7;
  const staffScale = isContinuous ? 1.2 : 1;
  const lineSpacing = Math.round(33 * viewScale * staffScale);
  const staveH = lineSpacing * 4;
  const staveGap = 10;
  const contentPad = 6;
  const sysGap = 3;
  return {
    viewScale, staffScale, staveH, lineSpacing,
    staveGap, contentPad, sysGap,
    staveStep: staveH + staveGap,
  };
}

/** Advance Y to the top of the next system using actual rendered staff bottoms. */
function _advanceSystemY(system, sysY, siOffset, ns, contentPad) {
  const miSet = new Set(system);
  let systemBottom = sysY;
  for (let gsi = 0; gsi < ns; gsi++) {
    APP.staveLayout.forEach(sl => {
      if (sl.si === gsi + siOffset && miSet.has(sl.mi)) {
        systemBottom = Math.max(systemBottom, sl.bottomY);
      }
    });
  }
  return systemBottom + contentPad + LAYOUT.SYS_SPACING;
}

// ── SVG Drawing Helpers ──────────────────────────────────────
const _SVG_NS = 'http://www.w3.org/2000/svg';
const _DEFAULT_FONT = 'var(--pauta-font-sans)';

function _svgCreate(tag, attrs, parent) {
  const el = document.createElementNS(_SVG_NS, tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (parent) parent.appendChild(el);
  return el;
}

function svgRect(parent, {x, y, w, h, rx, fill, stroke, strokeWidth, opacity, pointerEvents, cls} = {}) {
  const attrs = {
    x, y, width: w, height: h,
    rx: rx || 0, fill: fill || 'none',
    stroke: stroke || 'none', 'stroke-width': strokeWidth || 0,
    opacity: opacity ?? 1, 'pointer-events': pointerEvents || 'none',
  };
  if (cls) attrs['class'] = cls;
  return _svgCreate('rect', attrs, parent);
}

function svgLine(parent, {x1, y1, x2, y2, stroke, strokeWidth, strokeLinecap} = {}) {
  return _svgCreate('line', {
    x1, y1, x2, y2,
    stroke: stroke || '#000', 'stroke-width': strokeWidth || 1,
    'stroke-linecap': strokeLinecap || 'round',
    'pointer-events': 'none',
  }, parent);
}

function svgCircle(parent, {cx, cy, r, fill, stroke, strokeWidth, opacity, pointerEvents, cls} = {}) {
  return _svgCreate('circle', {
    cx, cy, r: r || 0,
    fill: fill || 'none', stroke: stroke || 'none',
    'stroke-width': strokeWidth || 0, opacity: opacity ?? 1,
    'pointer-events': pointerEvents || 'none',
    class: cls,
  }, parent);
}

function svgText(parent, {x, y, text, fontSize, fontWeight, fontFamily, fill, anchor, pointerEvents, opacity} = {}) {
  const el = _svgCreate('text', {
    x, y,
    'text-anchor': anchor || 'start',
    'font-family': fontFamily || _DEFAULT_FONT,
    'font-size': fontSize || 12,
    'font-weight': fontWeight || 'normal',
    fill: fill || '#111',
    'pointer-events': pointerEvents || 'none',
    opacity: opacity ?? 1,
  }, parent);
  el.textContent = text || '';
  return el;
}

function svgPath(parent, {d, fill, stroke, strokeWidth, strokeLinecap, opacity} = {}) {
  return _svgCreate('path', {
    d: d || '',
    fill: fill || 'none', stroke: stroke || 'none',
    'stroke-width': strokeWidth || 1,
    'stroke-linecap': strokeLinecap || 'round',
    'pointer-events': 'none', opacity: opacity ?? 1,
  }, parent);
}

// ── System packing ─────────────────────────────────────────────
function packSystems(staves, allM, nM, ns, viewScale, container) {
  const FIRST_EXTRA_GLOBAL = Math.round(156 * viewScale);
  const FIRST_EXTRA_SYS    = Math.round(108 * viewScale);
  const mNatW = Array.from({length: nM}, (_, mi) =>
    measureContentWidth(staves[0].measures[mi]?.notes || [SCORE.mkRest('w')])
  );
  for (let mi = 0; mi < nM; mi++) {
    if (allM[mi]?.pickup) {
      const n = allM[mi].notes;
      if (n.length === 1 && n[0].type === 'rest') mNatW[mi] = 20;
    }
  }
  const cW = APP.continuousView
    ? mNatW.reduce((a,b)=>a+b,0) + FIRST_EXTRA_GLOBAL + (nM-1)*FIRST_EXTRA_SYS + 2*LAYOUT.MARGIN_X
    : Math.max(container.clientWidth || 700, 400);
  const usable = cW - 2 * LAYOUT.MARGIN_X;
  const systems = [];
  let sys = [], sysContentW = 0;
  for (let mi = 0; mi < nM; mi++) {
    const firstExtra = systems.length === 0 && sys.length === 0
      ? (allM[0]?.pickup ? FIRST_EXTRA_SYS : FIRST_EXTRA_GLOBAL) : (sys.length === 0 ? FIRST_EXTRA_SYS : 0);
    const needed = sysContentW + firstExtra + mNatW[mi];
    const forceBreak = sys.length > 0 && (allM[mi]?.lineBreak || (!APP.continuousView && needed > usable));
    if (forceBreak) {
      systems.push(sys);
      sys = []; sysContentW = 0;
      mi--;
    } else {
      sys.push(mi);
      sysContentW += (sys.length === 1 ? firstExtra : 0) + mNatW[mi];
    }
  }
  if (sys.length) systems.push(sys);
  debugLog('[renderScore] systems:', systems.length, 'for nM:', nM);
  return { systems, mNatW, cW, usable, FIRST_EXTRA_GLOBAL, FIRST_EXTRA_SYS };
}

// ── Renderer / container setup ─────────────────────────────────
function initScoreRenderer(container, cW, totalH, score) {
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
  renderer.resize(cW, totalH);
  const ctx = renderer.getContext();
  APP.staveLayout = [];
  if (APP.continuousView) {
    container.style.overflowX = 'auto';
    container.style.overflowY = 'hidden';
    container.style.whiteSpace = 'nowrap';
    const svgEl = container.querySelector('svg');
    if (svgEl) {
      svgEl.style.width = cW + 'px';
      svgEl.style.height = totalH + 'px';
      svgEl.style.maxWidth = 'none';
    }
  } else {
    container.style.overflowX = 'hidden';
    container.style.overflowY = 'auto';
    container.style.whiteSpace = '';
  }
  const multiRestGroups = APP.showMultiMeasureRests ? findMultiRestGroups() : [];
  const svgEl = container.querySelector('svg');
  function addSVGText(svgEl, text, x, y, fontSize, weight, anchor, fontFamily) {
    const el = document.createElementNS('http://www.w3.org/2000/svg','text');
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    el.setAttribute('text-anchor', anchor);
    el.setAttribute('font-family', fontFamily || 'var(--pauta-font-sans)');
    el.setAttribute('font-size', fontSize);
    el.setAttribute('font-weight', weight);
    el.setAttribute('fill', '#111');
    el.textContent = text;
    svgEl.appendChild(el);
  }
  if (score.title)    addSVGText(svgEl, score.title,    cW/2, 66, score.titleSize||22, 'bold',   'middle', score.titleFont);
  if (score.composer) addSVGText(svgEl, score.composer, cW-LAYOUT.MARGIN_X, 66, 12, 'normal', 'end');
  return { ctx, multiRestGroups };
}

function renderInstrumentLabels(container, activeParts, system, sysY, siOffset, ns, isFirstSysOfScore, ctx, vfStaveRef) {
  const svgEl2 = container.querySelector('svg');
  let flatIdx = 0;
  activeParts.forEach(part => {
    const nStaves = part.staves.length;
    const firstMi = system[0];
    const gsi0    = flatIdx + siOffset;
    const topSL   = APP.staveLayout.find(sl => sl.mi === firstMi && sl.si === gsi0);
    const botSL   = APP.staveLayout.find(sl => sl.mi === firstMi && sl.si === gsi0 + nStaves - 1);
    const topY    = topSL?.topLineY ?? (sysY + flatIdx * LAYOUT.STAVE_SPACING + 4);
    const botY    = botSL?.bottomY  ?? (sysY + (flatIdx + nStaves - 1) * LAYOUT.STAVE_SPACING + LAYOUT.STAVE_H - 4);
    const midY    = (topY + botY) / 2;
    if (isFirstSysOfScore) {
      const instr = instrByName(part.instrument || part.name);
      const diagramId = `instr-diagram-${flatIdx}`;
      const diagramCY = (topY + botY) / 2;
      if (ns === 1 && instr && instr.recorder) {
        const recG = renderLargeRecorder([''], 0, '');
        const recScale = nStaves > 1 ? 1.8 : 1.35;
        recG.setAttribute('transform', `translate(${LAYOUT.MARGIN_X - 136},${diagramCY - 95 * recScale}) scale(${recScale}, -${recScale})`);
        recG.setAttribute('id', diagramId);
        recG.setAttribute('data-recorder-type', instr.recorderType || 'soprano');
        recG.setAttribute('data-instr-type', 'recorder');
        recG.setAttribute('data-rec-scale', recScale);
        recG.setAttribute('data-rec-cy', diagramCY);
        svgEl2.appendChild(recG);
      } else if (ns === 1 && instr && instr.family === 'Woodwinds') {
        const type = instr.name.toLowerCase();
        const shorthand = type.includes('flute')?'flute':type.includes('clarinet')?'clarinet':type.includes('sax')?'sax':type.includes('oboe')?'oboe':'bassoon';
        const wwG = renderWoodwindDiagram('', shorthand);
        const scale = 1.44;
        const wwYOff = shorthand === 'flute' ? 193 : 183;
        wwG.setAttribute('transform', `translate(${LAYOUT.MARGIN_X - 190},${diagramCY - wwYOff}) scale(${scale})`);
        wwG.setAttribute('id', diagramId);
        wwG.setAttribute('data-instr-type', 'woodwind');
        wwG.setAttribute('data-instr-name', shorthand);
        wwG.setAttribute('data-diagram-cy', diagramCY);
        svgEl2.appendChild(wwG);
      } else if (ns === 1 && instr && instr.family === 'Brass') {
        const type = instr.name.toLowerCase();
        const shorthand = type.includes('trumpet')?'trumpet':type.includes('horn')?'horn':type.includes('trombone')?'trombone':type.includes('euphonium')?'euphonium':'tuba';
        const brG = renderBrassDiagram([''], shorthand);
        const scale = 1.44;
        const brX = shorthand === 'trombone' ? LAYOUT.MARGIN_X - 152 : LAYOUT.MARGIN_X - 176;
        brG.setAttribute('transform', `translate(${brX},${diagramCY - 101}) scale(${scale})`);
        brG.setAttribute('id', diagramId);
        brG.setAttribute('data-instr-type', 'brass');
        brG.setAttribute('data-instr-name', shorthand);
        brG.setAttribute('data-diagram-cy', diagramCY);
        svgEl2.appendChild(brG);
      }
      const labelG = _svgCreate('g', {
        'data-label-x': LAYOUT.MARGIN_X - (nStaves > 1 ? 31 : 7),
        'data-label-y': midY + 7,
        transform: `translate(${LAYOUT.MARGIN_X - (nStaves > 1 ? 31 : 7)},${midY + 6})`,
      });
      const nm = part.name;
      const el = svgText(labelG, {x: 0, y: 0, text: '', fontSize: 11, fill: '#444', anchor: 'end'});
      if (nm.length > 12 && nm.includes(' ')) {
        const si = nm.indexOf(' ');
        el.textContent = nm.slice(0, si);
        const ts = _svgCreate('tspan', {x: 0, dy: 13}, el);
        ts.textContent = nm.slice(si + 1);
        labelG.setAttribute('transform', `translate(${LAYOUT.MARGIN_X - (nStaves > 1 ? 31 : 7)},${midY - 6.5})`);
        labelG.setAttribute('data-label-y', midY - 6.5);
      } else { el.textContent = nm; }
      svgEl2.appendChild(labelG);
    }
    if (nStaves > 1) {
      try {
        const topStave = vfStaveRef[`${gsi0}_${firstMi}`];
        const botStave = vfStaveRef[`${gsi0 + nStaves - 1}_${firstMi}`];
        if (topStave && botStave) {
          const brace = new VF.StaveConnector(topStave, botStave);
          brace.setType(VF.StaveConnector.type.BRACE);
          brace.setContext(ctx).draw();
        }
      } catch(e) { if (DEBUG) console.warn('[Pauta] part brace:', e.message); }
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', LAYOUT.MARGIN_X); line.setAttribute('y1', topY);
      line.setAttribute('x2', LAYOUT.MARGIN_X); line.setAttribute('y2', botY);
      line.setAttribute('stroke','#111'); line.setAttribute('stroke-width','1.5');
      line.setAttribute('pointer-events','none');
      svgEl2.appendChild(line);
    }
    flatIdx += nStaves;
  });
}

function renderPartBrackets(container, activeParts, system, siOffset, ns, vfStaveRef, ctx) {
  if (ns < 2) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;
  const firstMi = system[0];
  const topSL = APP.staveLayout.find(sl => sl.mi === firstMi && sl.si === siOffset);
  const botSL = APP.staveLayout.find(sl => sl.mi === firstMi && sl.si === siOffset + ns - 1);
  if (topSL && botSL) {
    svgLine(svgEl, {x1: LAYOUT.MARGIN_X, y1: topSL.topLineY, x2: LAYOUT.MARGIN_X, y2: botSL.bottomY,
      stroke: '#111', strokeWidth: 1.5, strokeLinecap: 'square'});
  }
  let flatIdx = 0;
  activeParts.forEach(part => {
    const nStaves = part.staves.length;
    const gsi0 = flatIdx + siOffset;
    if (nStaves > 1) {
      try {
        const topStave = vfStaveRef[`${gsi0}_${firstMi}`];
        const botStave = vfStaveRef[`${gsi0 + nStaves - 1}_${firstMi}`];
        if (topStave && botStave) {
          const brace = new VF.StaveConnector(topStave, botStave);
          brace.setType(VF.StaveConnector.type.BRACE);
          brace.setContext(ctx).draw();
        }
      } catch (e) { console.warn('[Pauta]', e.message); }
    }
    flatIdx += nStaves;
  });
}

function renderMeasureNumbers(container, ns, siOffset, sysIdx, system) {
  const firstMiOfSys = system[0];
  if (!(sysIdx === 0 && firstMiOfSys === 0)) {
    const topSL = APP.staveLayout.find(sl => sl.mi === firstMiOfSys && sl.si === siOffset);
    if (topSL) {
      const svgEl3 = document.getElementById('score-svg').querySelector('svg');
      svgText(svgEl3, {x: topSL.x + 1, y: topSL.topLineY - 6, text: String(firstMiOfSys + 1), fontSize: 10, fontWeight: '500', fill: '#555'});
    }
  }
  if (APP.showMeasureNumbers) {
    const svgEl4 = document.getElementById('score-svg').querySelector('svg');
    system.forEach(mi => {
      const sl = APP.staveLayout.find(sl => sl.mi === mi && sl.si === siOffset + ns - 1);
      if (sl) {
        svgText(svgEl4, {x: sl.x + sl.w / 2, y: sl.bottomY + 18, text: String(mi + 1), fontSize: 9, fill: '#777', anchor: 'middle'});
      }
    });
  }
}

function _showRenderFailure(err) {
  const container = document.getElementById('score-svg');
  const msg = err?.message || String(err);
  if (container) {
    container.innerHTML =
       `<div style="padding:32px;text-align:center;color:var(--pauta-text-muted);max-width:360px;margin:0 auto">
         <p style="font-size:15px;font-weight:600;margin-bottom:8px">Could not draw the score</p>
         <p style="font-size:13px;color:rgba(74,85,104,0.75);margin-bottom:16px;line-height:1.5">${UI.escHtml(msg)}</p>
         <button data-action="reload" style="padding:10px 20px;background:var(--pauta-primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">Reload Pauta</button>
       </div>`;
  }
  UI.showToast('Score display error');
}

function _runBootSelfCheck() {
  if (!DEBUG) return;
  let ok = true;

  // ── Score validation ────────────────────────────────────────────
  const sample = SCORE.createScore({ title: 'Self-check', instruments: ['Piano', 'Soprano Recorder'] });
  const check = SCORE.validateScore(SCORE.repairScore(sample));
  if (!check.ok) { console.warn('[Pauta] boot self-check failed:', check.issues); ok = false; }
  else debugLog('[Pauta] boot self-check score validation passed');

  // ── MSCX round-trip ─────────────────────────────────────────────
  try {
    const xml = SCORE.exportMSCXFromScore(sample);
    const reparsed = SCORE.parseMSCX(xml);
    if (reparsed.parts.length !== sample.parts.length) {
      console.warn('[Pauta] self-check MSCX round-trip part count mismatch'); ok = false;
    }
    debugLog('[Pauta] boot self-check MSCX round-trip passed');
  } catch(e) { console.warn('[Pauta] self-check MSCX round-trip error:', e.message); ok = false; }

  // ── MusicXML import ─────────────────────────────────────────────
  try {
    const mxml = `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;
    const mxScore = SCORE.parseMusicXML(mxml);
    if (!mxScore.parts.length || !mxScore.parts[0].staves[0].measures.length) {
      console.warn('[Pauta] self-check MusicXML import produced empty score'); ok = false;
    } else {
      const m = mxScore.parts[0].staves[0].measures[0];
      if (m.notes.length !== 1 || m.notes[0].pitch !== 60) {
        console.warn('[Pauta] self-check MusicXML note mismatch'); ok = false;
      }
    }
    debugLog('[Pauta] boot self-check MusicXML import passed');
  } catch(e) { console.warn('[Pauta] self-check MusicXML error:', e.message); ok = false; }

  if (ok) debugLog('[Pauta] all boot self-checks passed');
  else console.warn('[Pauta] some boot self-checks failed (see above)');
}

function renderScore() {
  try {
    _renderScoreBody();
    updatePaletteForPercussion();
  } catch (err) {
    console.error('[Pauta] renderScore failed:', err);
    _showRenderFailure(err);
  }
}

let _selRAF = 0;
function _renderScoreBody() {
  const rc = _setupRender();
  if (!rc) return;
  _renderSystems(rc);
  _renderScoreAnnotations(rc);
  _renderScoreCompletions(rc);
}

// Render phases broken out of _renderScoreBody for maintainability.
// rc = render context object returned by _setupRender.

function _setupRender() {
  const container = document.getElementById('score-svg');
  const area = document.getElementById('score-area');
  const savedScrollTop = area ? area.scrollTop : 0;
  container.innerHTML = '';
  if (!APP.score) return null;

  const viewScale = APP.continuousView ? 1 : 0.7;
  LAYOUT.STAVE_H       = REND.STAVE_H;
  LAYOUT.STAVE_SPACING = REND.STAVE_SPACING;
  LAYOUT.SYS_SPACING   = REND.SYS_SPACING;
  LAYOUT.MARGIN_X      = REND.MARGIN_X;
  LAYOUT.MARGIN_TOP    = REND.MARGIN_TOP;
  APP._lastPlayKey = '';
  APP.staveLayout = [];
  APP.noteLayout  = [];

  const score  = APP.score;
  const allParts  = score.parts;
  const staves = allParts.flatMap(p => p.staves);
  const siOffset = 0;
  const ns     = staves.length;
  const refStave = staves.find(s => s.measures.length) || staves[0];
  const allM   = refStave.measures;
  const nM     = allM.length;
  debugLog('[PautaEngraving import render] nM:', nM, 'ns:', ns, 'ref stave measures:', allM?.length, 'first measure notes:', allM[0]?.notes?.length);

  const { systems, mNatW, cW, usable, FIRST_EXTRA_GLOBAL, FIRST_EXTRA_SYS } = packSystems(staves, allM, nM, ns, viewScale, container);
  const totalH = LAYOUT.MARGIN_TOP + systems.length * (LAYOUT.STAVE_H + (ns-1) * LAYOUT.STAVE_SPACING + LAYOUT.SYS_SPACING) + 48;
  const { ctx, multiRestGroups } = initScoreRenderer(container, cW, totalH, score);

  return { container, area, savedScrollTop, viewScale, score, staves, siOffset, ns, allM,
    systems, mNatW, cW, usable, FIRST_EXTRA_GLOBAL, FIRST_EXTRA_SYS, totalH, ctx, multiRestGroups };
}

function _renderSystems(rc) {
  const { container, staves, ns, siOffset, allM, viewScale, systems, mNatW, usable, FIRST_EXTRA_GLOBAL, FIRST_EXTRA_SYS, ctx, multiRestGroups } = rc;
  let sysY = LAYOUT.MARGIN_TOP;
  const vfStaveRef = {};

  systems.forEach((system, sysIdx) => {
    const isFirstSysOfScore = sysIdx === 0;
    const firstExtra = isFirstSysOfScore
      ? (allM[0]?.pickup ? FIRST_EXTRA_SYS : FIRST_EXTRA_GLOBAL) : FIRST_EXTRA_SYS;
    const mWidths = system.map(mi => Math.round(mNatW[mi]));

    if (!APP.continuousView && mWidths.length > 0) {
      const total = mWidths.reduce((a,b) => a+b, 0);
      const target = usable - firstExtra;
      if (total > 10 && Math.abs(total - target) > 5) {
        const scale = target / total;
        system.forEach((mi, li) => { mWidths[li] = Math.round(Math.max(20, mWidths[li] * scale)); });
      }
    }

    let x = LAYOUT.MARGIN_X;

    staves.forEach((stave, si) => {
      let mx = x;
      system.forEach((mi, li) => {
        const isFirstOfSys    = li === 0;
        const isGlobalFirst   = isFirstSysOfScore && li === 0;
        const staveY = sysY + si * LAYOUT.STAVE_SPACING;
        const w = _renderStaveMeasure(rc, { mi, si, stave, mx, li, isFirstOfSys, isGlobalFirst, firstExtra, staveY, sysY, vfStaveRef, mWidths });
        mx += w;
      });
    });

    renderInstrumentLabels(container, APP.score.parts, system, sysY, siOffset, ns, isFirstSysOfScore, ctx, vfStaveRef);
    renderPartBrackets(container, APP.score.parts, system, siOffset, ns, vfStaveRef, ctx);
    renderMeasureNumbers(container, ns, siOffset, sysIdx, system);

    sysY = _advanceSystemY(system, sysY, siOffset, ns, 6);
  });

  updateOctaveDisplay();
}

// Hide all staff lines except the middle one for single-line rhythm staves
function _hideNonMiddleStaffLines(container, vfStave) {
  const svg = container.querySelector('svg');
  if (!svg) return;
  const midY = vfStave.getYForLine(2);
  const staveW = vfStave.getWidth();
  svg.querySelectorAll('path').forEach(path => {
    const d = path.getAttribute('d');
    if (!d) return;
    const m = d.match(/M\s*([\d.]+)\s+([\d.]+)\s*L\s*([\d.]+)\s+([\d.]+)/);
    if (!m) return;
    const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
    const x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
    if (Math.abs(y1 - y2) > 0.5) return; // vertical (bar line)
    if (x2 - x1 < staveW * 0.35) return; // too short (ledger line)
    if (Math.abs(y1 - midY) > 0.5) {
      path.setAttribute('stroke', 'none');
      path.setAttribute('stroke-opacity', '0');
    }
  });
}

function _renderStaveMeasure(rc, sm) {
  const { container, ctx, siOffset, viewScale, multiRestGroups } = rc;
  const { mi, si, stave, mx, li, isFirstOfSys, isGlobalFirst, staveY, vfStaveRef, mWidths } = sm;
  let mWidth = mWidths[li] + (isFirstOfSys ? sm.firstExtra : 0);

  const isSingleLine = stave.singleLine;
  const vfStave = new VF.Stave(mx, staveY, mWidth,
    { space_above_staff_ln: 4, num_lines: isSingleLine ? 5 : 5, fill_style: '#000' }
  );
  try { vfStave.setSpacingBetweenLines(Math.round(33 * viewScale)); } catch(e) { if (DEBUG) console.warn('[Pauta] stave spacing:', e.message); }

  const currentClef = getResolvedClef(mi, si + siOffset);
  if (isFirstOfSys) {
    vfStave.addClef(currentClef, 'default');
  } else if (mi > 0) {
    const prevClef = getResolvedClef(mi - 1, si + siOffset);
    if (prevClef !== currentClef) vfStave.addClef(currentClef, 'default');
  }

  const ks = stave.measures[mi]?.keySig;
  if (isGlobalFirst && ks !== null && ks !== undefined) {
    if (ks !== 0) vfStave.addKeySignature(keySigName(ks));
  } else if (!isGlobalFirst && ks !== null && ks !== undefined && mi > 0) {
    if (ks !== 0) vfStave.addKeySignature(keySigName(ks));
  }

  const tsMeasure = stave.measures[mi];
  if (tsMeasure?.timeSigNum !== null && tsMeasure?.timeSigNum !== undefined) {
    if (isGlobalFirst || mi > 0) vfStave.addTimeSignature(`${tsMeasure.timeSigNum}/${tsMeasure.timeSigDen}`);
  }

  const BT = VF.Barline.type;
  const barlineType = stave.measures[mi]?.barline || 'single';
  const VF_END = { single:BT.SINGLE, double:BT.DOUBLE, end:BT.END, repeat_end:BT.REPEAT_END, repeat_both:BT.REPEAT_BOTH }[barlineType] ?? BT.SINGLE;
  const VF_BEGIN = { repeat_begin:BT.REPEAT_BEGIN, repeat_both:BT.REPEAT_BOTH }[barlineType] ?? BT.SINGLE;
  vfStave.setEndBarType(VF_END);
  if (VF_BEGIN !== BT.SINGLE) vfStave.setBegBarType(VF_BEGIN);

  // Adjust width if clef/key/time modifiers take more space than firstExtra accounted for
  if (isFirstOfSys) {
    const actualExtra = vfStave.getNoteStartX() - mx;
    const correctWidth = actualExtra + mWidths[li];
    if (correctWidth !== mWidth) { mWidth = correctWidth; vfStave.setWidth(mWidth); }
  }

  vfStave.setContext(ctx).draw();
  vfStaveRef[`${si + siOffset}_${mi}`] = vfStave;

  if (mi === APP.selectedMeasure && si === APP.selectedStaff) {
    const svgEl2 = container.querySelector('svg');
    const lineTop = vfStave.getYForLine(0);
    const lineBot = vfStave.getYForLine(4);
    svgRect(svgEl2, {x: mx, y: lineTop - 2, w: mWidth, h: lineBot - lineTop + 4, rx: 4,
      fill: 'rgba(192,86,33,0.18)', stroke: 'rgba(192,86,33,0.55)', strokeWidth: 2, cls: 'sel-overlay'});
  }

  const measure = stave.measures[mi];
  const ts      = resolvedTimeSig(mi, si + siOffset);
  const isBW    = isBoomwhackerSI(si + siOffset);
  const isBR    = isBeginnerRecorderSI(si + siOffset);
  const capacity = measureBeatsCapacity(mi, si + siOffset);

  const v1Data = measure.notes.map((n, idx) => ({n, idx})).filter(({n}) => (n.voice||1) === 1);
  const v2Data = measure.notes.map((n, idx) => ({n, idx})).filter(({n}) => (n.voice||1) === 2);
  const v1Notes = v1Data.map(d => d.n);
  const v2Notes = v2Data.map(d => d.n);
  const v1Indices = v1Data.map(d => d.idx);
  const v2Indices = v2Data.map(d => d.idx);

  const hasV2Real = v2Notes.length > 0 && !isWholeRestPlaceholder(v2Notes);
  const dirs1 = hasV2Real ? v1Notes.map(() => VF.Stem.UP) : calcStemDirections(v1Notes, stave.clef, ts, si + siOffset);
  const dirs2 = v2Notes.map(() => VF.Stem.DOWN);

  const vfNotes1 = buildVFNotes(v1Notes, stave.clef, mi, si + siOffset, dirs1, isBW, isBR);
  const vfNotes2 = buildVFNotes(v2Notes, stave.clef, mi, si + siOffset, dirs2, isBW, isBR);

  const v1Used = isWholeRestPlaceholder(v1Notes) ? capacity : beatsUsed(v1Notes);
  const fillers1 = buildFillerRests(capacity - v1Used, stave.clef, capacity, VF.Stem.UP);
  const fillers2 = hasV2Real ? buildFillerRests(capacity - beatsUsed(v2Notes), stave.clef, capacity, VF.Stem.DOWN) : [];

  const allVF1 = [...vfNotes1, ...fillers1];
  const allVF2 = hasV2Real ? [...vfNotes2, ...fillers2] : [];

  const gsi = si + siOffset;
  const mmrGroup = multiRestGroups.find(g => g.gsi === gsi && g.startMi <= mi && g.endMi >= mi);

  if (!mmrGroup && (allVF1.length || allVF2.length)) {
    try {
      const beams1 = buildBeams(vfNotes1, v1Notes, ts);
      const beams2 = buildBeams(vfNotes2, v2Notes, ts);
      const voices = [];

      if (allVF1.length) {
        const voice1 = new VF.Voice({num_beats: ts.num, beat_value: ts.den});
        voice1.setStrict(false); voice1.addTickables(allVF1); voices.push(voice1);
      }
      if (allVF2.length) {
        const voice2 = new VF.Voice({num_beats: ts.num, beat_value: ts.den});
        voice2.setStrict(false); voice2.addTickables(allVF2); voices.push(voice2);
      }

      const noteStartX = vfStave.getNoteStartX();
      const staveEndX = mx + mWidth;
      const rawAvailable = Math.max(40, isFirstOfSys ? Math.min(mWidths[li], staveEndX - noteStartX) : staveEndX - noteStartX);
      const rightMargin = Math.min(38, Math.max(14, rawAvailable * 0.08));
      const availableW = rawAvailable - rightMargin;

      new VF.Formatter({ softmaxFactor: 20 }).joinVoices(voices).format(voices, availableW);
      voices.forEach(v => v.draw(ctx, vfStave));

      vfNotes1.forEach((vfn, i) => {
        try {
          const nx = vfn.getAbsoluteX() + 6;
          const ys = vfn.getYs();
          const ny = ys?.length ? ys[0] : (staveY + LAYOUT.STAVE_H / 2);
          const sLen = (vfStave.getYForLine(4) - vfStave.getYForLine(0)) * 0.875;
          const stemTipY = dirs1[i] === VF.Stem.UP ? ny - sLen : ny + sLen;
          APP.noteLayout.push({ mi, si: si + siOffset, ni: v1Indices[i], x: nx, y: ny, stemDir: dirs1[i], stemTipY });
        } catch(e) { if (DEBUG) console.warn('[Pauta] noteLayout v1:', e.message); }
      });
      vfNotes2.forEach((vfn, i) => {
        try {
          const nx = vfn.getAbsoluteX() + 6;
          const ys = vfn.getYs();
          const ny = ys?.length ? ys[0] : (staveY + LAYOUT.STAVE_H / 2);
          const sLen = (vfStave.getYForLine(4) - vfStave.getYForLine(0)) * 0.875;
          const stemTipY = dirs2[i] === VF.Stem.UP ? ny - sLen : ny + sLen;
          APP.noteLayout.push({ mi, si: si + siOffset, ni: v2Indices[i], x: nx, y: ny, stemDir: dirs2[i], stemTipY });
        } catch(e) { if (DEBUG) console.warn('[Pauta] noteLayout v2:', e.message); }
      });

      [...beams1, ...beams2].forEach(b => vfSafe(() => b.setContext(ctx).draw(), 'beam'));
      const tups1 = buildTuplets(vfNotes1, v1Notes);
      const tups2 = buildTuplets(vfNotes2, v2Notes);
      [...tups1, ...tups2].forEach(t => vfSafe(() => t.setContext(ctx).draw(), 'tuplet'));
    } catch(e) { console.warn('Render measure', mi, e.message); }
  }

  if (isSingleLine) _hideNonMiddleStaffLines(container, vfStave);

  APP.staveLayout.push({
    mi, si: si + siOffset, x: mx, y: staveY,
    topLineY: vfStave.getYForLine(0),
    bottomY:  vfStave.getYForLine(4),
    w: mWidth, h: LAYOUT.STAVE_H, clef: stave.clef
  });
  return mWidth;
}

// ── Theory Overlay (scale degrees, intervals) ───────────────────
const KEY_ROOT_PC = {};
for (let ks = -7; ks <= 7; ks++) KEY_ROOT_PC[ks] = ((ks * 7) % 12 + 12) % 12;
const DEGREE_LABELS = ['1̂','♭2̂','2̂','♭3̂','3̂','4̂','♯4̂','5̂','♭6̂','6̂','♭7̂','7̂'];

function _getScaleDegree(pitch, ks) {
  const pc = pitch % 12;
  const rootPc = KEY_ROOT_PC[ks] ?? 0;
  return DEGREE_LABELS[(pc - rootPc + 12) % 12];
}

function _getIntervalLabel(pitchA, pitchB) {
  const semitones = Math.abs(pitchB - pitchA) % 12;
  return INTERVAL_NAMES[semitones] || '';
}

function _renderTheoryOverlay() {
  const svgEl = document.getElementById('score-svg')?.querySelector('svg');
  if (!svgEl || !APP.score) return;
  // Scale degrees below each note
  for (const nl of APP.noteLayout) {
    const ks = getResolvedKeySig(nl.mi, nl.si);
    const note = getNoteByLayout(nl);
    if (!note || note.type === 'rest') continue;
    const deg = _getScaleDegree(note.pitch, ks);
    svgText(svgEl, {x: nl.x, y: nl.y + 18, text: deg, fontSize: 10, fontWeight: '600', fill: 'var(--pauta-primary)', anchor: 'middle', font: _DEFAULT_FONT});
  }
  // Interval label when 2 notes selected
  if (APP.selectedNoteIdx >= 0 && APP.selStartIdx >= 0 && APP.selectedNoteIdx !== APP.selStartIdx) {
    const mi = APP.selectedMeasure, si = APP.selectedStaff;
    const nl1 = APP.noteLayout.find(l => l.mi === mi && l.si === si && l.ni === APP.selectedNoteIdx);
    const nl2 = APP.noteLayout.find(l => l.mi === mi && l.si === si && l.ni === APP.selStartIdx);
    if (nl1 && nl2) {
      const n1 = getNoteByLayout(nl1), n2 = getNoteByLayout(nl2);
      if (n1 && n2 && n1.type === 'note' && n2.type === 'note') {
        const label = _getIntervalLabel(n1.pitch, n2.pitch);
        if (label) {
          const midX = (nl1.x + nl2.x) / 2, midY = Math.min(nl1.y, nl2.y) - 20;
          svgText(svgEl, {x: midX, y: midY, text: label, fontSize: 12, fontWeight: '700', fill: '#2b6cb0', anchor: 'middle', font: _DEFAULT_FONT});
        }
      }
    }
  }
}

// ── Rhythm Counting ────────────────────────────────────────────
const SIXTEENTH_LABELS = ['1','e','+','a','2','e','+','a','3','e','+','a','4','e','+','a'];

function _renderRhythmCounting() {
  const svgEl = document.getElementById('score-svg')?.querySelector('svg');
  if (!svgEl || !APP.score) return;
  for (const sl of APP.staveLayout) {
    const m = APP.score.parts[0]?.staves?.[sl.si]?.measures?.[sl.mi];
    if (!m || !m.notes) continue;
    const beatUnit = 4 / (resolvedTimeSig(sl.mi, sl.si).den || 4);
    let beatPos = 0;
    for (let ni = 0; ni < m.notes.length; ni++) {
      const n = m.notes[ni];
      if (n.type !== 'note' && n.type !== 'rest') continue;
      const beats = durBeats(n.duration, n.dots, n.tuplet);
      const beatFloor = Math.floor(beatPos);
      const subbeat = beatPos - beatFloor;
      let label;
      if (Math.abs(beats - 1) < 0.01) {
        label = String(beatFloor + 1);
      } else if (Math.abs(beats - 0.5) < 0.01) {
        label = subbeat < 0.01 ? String(beatFloor + 1) : '+';
      } else {
        const sixteenthIdx = Math.round(beatPos * 4);
        label = (sixteenthIdx >= 0 && sixteenthIdx < 16) ? SIXTEENTH_LABELS[sixteenthIdx] : '';
      }
      const nl = APP.noteLayout.find(l => l.mi === sl.mi && l.si === sl.si && l.ni === ni);
      if (nl) {
        svgText(svgEl, {x: nl.x, y: sl.bottomY + 24, text: label, fontSize: 9, fontWeight: '500', fill: '#555', anchor: 'middle', font: _DEFAULT_FONT});
      }
      beatPos += beats;
    }
  }
}

// ── Note lookup helper for theory overlay ──────────────────────
function getNoteByLayout(nl) {
  return APP.score?.parts?.[0]?.staves?.[nl.si]?.measures?.[nl.mi]?.notes?.[nl.ni];
}

function _renderScoreAnnotations(rc) {
  const { ctx } = rc;
  renderMarkings(ctx);
  UI.renderRehearsalMarks();
  UI.renderStaffTexts();
  UI.renderChordSymbols();
  UI.renderLyrics();
  renderNavigationMarkers();
  renderLyricClickHandlers();
  renderBWNoteheads();
  if (APP.showTheoryOverlay) _renderTheoryOverlay();
  if (APP.showRhythmCounting) _renderRhythmCounting();
}

function _renderScoreCompletions(rc) {
  const { container, multiRestGroups, area, savedScrollTop } = rc;

  const lbBtn = document.getElementById('btn-linebreak');
  if (lbBtn) {
    const m = APP.score?.parts?.[0]?.staves?.[0]?.measures?.[APP.selectedMeasure];
    lbBtn.classList.toggle('active', !!m?.lineBreak);
  }

  if (APP.showMultiMeasureRests && multiRestGroups.length) {
    const svgEl9 = container.querySelector('svg');
    for (const g of multiRestGroups) {
      const firstSL = APP.staveLayout.find(sl => sl.mi === g.startMi && sl.si === g.gsi);
      const lastSL  = APP.staveLayout.find(sl => sl.mi === g.endMi && sl.si === g.gsi);
      if (!firstSL || !lastSL) continue;
      const spanX = firstSL.x;
      const spanW = (lastSL.x + lastSL.w) - firstSL.x;
      const barY = (firstSL.topLineY + firstSL.bottomY) / 2;
      svgLine(svgEl9, {x1: spanX + 4, y1: barY, x2: spanX + spanW - 4, y2: barY, stroke: '#444', strokeWidth: 3});
      const tickLen = 12;
      for (const xPos of [spanX + 4, spanX + spanW - 4]) {
        svgLine(svgEl9, {x1: xPos, y1: barY - tickLen / 2, x2: xPos, y2: barY + tickLen / 2, stroke: '#444', strokeWidth: 2});
      }
      svgText(svgEl9, {x: spanX + spanW / 2, y: firstSL.topLineY - 8, text: String(g.endMi - g.startMi + 1), fontSize: 11, fontWeight: 'bold', fill: '#444', anchor: 'middle'});
    }
  }

  if (area) area.scrollTop = savedScrollTop;
  scrollToSelectedMeasure();
  updateRecorderDiagram();
  updateWoodwindDiagram();
  updateBrassDiagram();
  renderNoteLabels();

  if (APP.continuousView) {
    const svgContainer = document.getElementById('score-svg');
    if (svgContainer) {
      if (svgContainer._recScrollHandler) svgContainer.removeEventListener('scroll', svgContainer._recScrollHandler);
      const handler = () => positionAllDiagrams();
      svgContainer._recScrollHandler = handler;
      svgContainer.addEventListener('scroll', handler);
    }
  }
  positionAllDiagrams();
}

let _scrollAnim = null;

function _smoothScroll(el, prop, to, dur) {
  if (_scrollAnim && _scrollAnim.el === el && _scrollAnim.prop === prop) {
    _scrollAnim.cancelled = true;
  }
  const from = el[prop];
  if (Math.abs(to - from) < 2) { el[prop] = to; return; }
  const start = performance.now();
  const anim = { el, prop, from, to, dur, cancelled: false };
  _scrollAnim = anim;
  function tick(now) {
    if (anim.cancelled) return;
    const t = Math.min((now - start) / anim.dur, 1);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    el[prop] = anim.from + (anim.to - anim.from) * ease;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function scrollToSelectedMeasure() {
  const mi = APP.selectedMeasure;
  if (!APP.staveLayout || !APP.staveLayout.length) return;
  const sl = APP.staveLayout.find(l => l.mi === mi && l.si === (APP.selectedStaff || 0));
  if (!sl) return;

  if (APP.continuousView) {
    const container = document.getElementById('score-svg');
    if (!container) return;
    const scrollLeft = container.scrollLeft || 0;
    const viewWidth  = container.clientWidth;
    const measureX   = sl.x;
    const margin     = viewWidth * 0.3;
    if (measureX > scrollLeft + 20 && measureX < scrollLeft + viewWidth - margin) return;
    const target = Math.max(0, measureX - viewWidth * 0.15);
    const dist = Math.abs(target - scrollLeft);
    const dur = Math.max(80, Math.min(200, dist * 0.3));
    _smoothScroll(container, 'scrollLeft', target, dur);
  } else {
    const area = document.getElementById('score-area');
    if (!area) return;
    const scrollTop = area.scrollTop || 0;
    const viewH = area.clientHeight;
    const measureTop = sl.y - 20;
    const measureBot = sl.y + LAYOUT.STAVE_H + 20;
    if (measureBot < scrollTop + viewH && measureTop > scrollTop) return;
    const target = Math.max(0, sl.y - viewH * 0.35);
    const dur = Math.max(80, Math.min(200, Math.abs(target - scrollTop) * 0.3));
    _smoothScroll(area, 'scrollTop', target, dur);
  }
}

function _renderSelectionBody() {
  if (!APP.score || !APP.staveLayout || !APP.staveLayout.length) return;
  const svgEl = document.getElementById('score-svg')?.querySelector('svg');
  if (!svgEl) return;

  svgEl.querySelectorAll('.sel-overlay').forEach(el => el.remove());
  svgEl.querySelectorAll('.sel-note').forEach(el => el.remove());

  const sl = APP.staveLayout.find(l => l.mi === APP.selectedMeasure && l.si === (APP.selectedStaff || 0));
  if (sl && APP.selectedMeasure >= 0) {
    svgRect(svgEl, {
      x: sl.x, y: sl.topLineY - 2, w: sl.w, h: sl.bottomY - sl.topLineY + 4, rx: 4,
      fill: 'rgba(192,86,33,0.18)', stroke: 'rgba(192,86,33,0.55)', strokeWidth: 2, cls: 'sel-overlay'
    });
  }

  if (APP.selectedNoteIdx >= 0 && APP.selectedMeasure >= 0) {
    const nl = APP.noteLayout.find(l =>
      l.mi === APP.selectedMeasure && l.si === (APP.selectedStaff || 0) && l.ni === APP.selectedNoteIdx);
    if (nl) {
      svgCircle(svgEl, {
        cx: nl.x, cy: nl.y, r: 6,
        fill: 'rgba(192,86,33,0.45)', stroke: 'var(--pauta-primary)', strokeWidth: 1.2, cls: 'sel-note'
      });
    }
  }

  updateRecorderDiagram();
  updateWoodwindDiagram();
  updateBrassDiagram();
  UI.updateStatusBar();
  positionAllDiagrams();
}

function renderSelection() {
  if (_selRAF) cancelAnimationFrame(_selRAF);
  _selRAF = requestAnimationFrame(() => { _selRAF = 0; _renderSelectionBody(); });
}

// Keep diagram SVGs fixed during horizontal scroll in continuous view
function positionAllDiagrams(scrollOverride) {
  const container = document.getElementById('score-svg');
  if (!container) return;
  const scrollLeft = scrollOverride !== undefined ? scrollOverride : (container.scrollLeft || 0);
  // Recorder diagrams
  document.querySelectorAll('[data-instr-type="recorder"]').forEach(el => {
    const recScale = parseFloat(el.getAttribute('data-rec-scale')) || 1.6;
    const recCY = parseFloat(el.getAttribute('data-rec-cy')) || 0;
    el.setAttribute('transform', `translate(${LAYOUT.MARGIN_X - 136 + scrollLeft},${recCY - 95 * recScale}) scale(${recScale}, -${recScale})`);
  });
  // Woodwind diagrams
  document.querySelectorAll('[data-instr-type="woodwind"]').forEach(el => {
    const cy = parseFloat(el.getAttribute('data-diagram-cy')) || 100;
    el.setAttribute('transform', `translate(${LAYOUT.MARGIN_X - 190 + scrollLeft},${cy - 173}) scale(1.44)`);
  });
  // Brass diagrams
  document.querySelectorAll('[data-instr-type="brass"]').forEach(el => {
    const cy = parseFloat(el.getAttribute('data-diagram-cy')) || 100;
    const name = el.getAttribute('data-instr-name') || '';
    const brX = name === 'trombone' ? LAYOUT.MARGIN_X - 152 : LAYOUT.MARGIN_X - 176;
    el.setAttribute('transform', `translate(${brX + scrollLeft},${cy - 101}) scale(1.44)`);
  });
  // Instrument name labels
  document.querySelectorAll('.instrument-label').forEach(el => {
    const bx = parseFloat(el.getAttribute('data-label-x')) || LAYOUT.MARGIN_X - 6;
    const by = parseFloat(el.getAttribute('data-label-y')) || 0;
    el.setAttribute('transform', `translate(${bx + scrollLeft},${by})`);
  });
}
window.addEventListener('beforeprint', () => positionAllDiagrams(0));

// Helper: find the VexFlow note object and its stave layout for a given mi/si/ni
function findNoteVF(mi, si, ni) {
  return APP.noteLayout.find(nl => nl.mi === mi && nl.si === si && nl.ni === ni) || null;
}
function findStaveLayout(mi, si) {
  return APP.staveLayout.find(sl => sl.mi === mi && sl.si === si) || null;
}

function renderMarkings(ctx) {
  const score = APP.score;
  if (!score) return;

  // ── Ties ─────────────────────────────────────────────────────────
  // Properly engraved ties attach to notehead edges and bow away from
  // stems.  We iterate every part/staff so multi-part scores work.
  let globalSI = 0;
  score.parts.forEach(part => {
    part.staves.forEach((stave, localSI) => {
      const si = globalSI + localSI;
      stave.measures.forEach((measure, mi) => {
        measure.notes.forEach((note, ni) => {
          if (!note.tieToNext) return;
          const startNL = findNoteVF(mi, si, ni);
          let endNL = findNoteVF(mi, si, ni + 1);
          if (!endNL) endNL = findNoteVF(mi + 1, si, 0);
          if (!startNL) return;

          const staveObj = getStaveBySI(si);
          const startNote = staveObj?.measures[mi]?.notes[ni];
          const endNote   = endNL ? staveObj?.measures[endNL.mi]?.notes[endNL.ni] : null;

          // Notehead width estimation: open heads (whole/half) are wider
          const noteheadW = (dur) => (dur === 'w' || dur === 'h') ? 8 : 6;
          const startRad = noteheadW(startNote?.duration);
          const endRad   = endNL ? noteheadW(endNote?.duration) : startRad;

          // Ties always bow on the notehead side (opposite stem)
          const bowAbove = (startNL.stemDir ?? 1) < 0; // stem down → bow up
          const bowDir   = bowAbove ? -1 : 1;

          // Base arc Y at notehead center, offset for bow direction
          let baseY = bowAbove
            ? Math.min(startNL.y, endNL ? endNL.y : startNL.y) - 3
            : Math.max(startNL.y, endNL ? endNL.y : startNL.y) + 3;

          // Collision avoidance: lift tie over accidentals / dots
          const hasLeftAcc  = startNote?.accidental || (startNote?.extraPitches || []).some(ep => ep.accidental);
          const hasRightAcc = endNote?.accidental || (endNote?.extraPitches || []).some(ep => ep.accidental);
          const hasDot = startNote?.dots || endNote?.dots;
          let yOffset = 0;
          if (hasLeftAcc || hasRightAcc)  yOffset += 5 * bowDir;
          if (hasDot)                       yOffset += 3 * bowDir;

          const arcY = baseY + yOffset;
          const startX = startNL.x + startRad;    // right edge of start notehead
          const endX   = endNL ? (endNL.x - endRad) : (findStaveLayout(mi, si)?.w || startX + 40);

          if (endNL) {
            // Normal same-system tie
            drawArc(startX, endX, arcY, bowAbove, 10, '#333', arcY, 2.2);
          } else {
            // Cross-system tie: draw partial arc to end of system
            const sl = findStaveLayout(mi, si);
            if (sl) {
              drawArc(startX, sl.x + sl.w - 4, arcY, bowAbove, 8, '#333', arcY, 2);
            }
          }
        });
      });
    });
    globalSI += part.staves.length;
  });

  // ── Slurs ─────────────────────────────────────────────────────────
  (score.slurs || []).forEach(slur => {
    const startNL = findNoteVF(slur.startMi, slur.si, slur.startNi);
    const endNL   = findNoteVF(slur.endMi,   slur.si, slur.endNi);
    if (!startNL) return;

    const staveObj = getStaveBySI(slur.si);
    const startNote = staveObj?.measures[slur.startMi]?.notes[slur.startNi];
    const endNote   = endNL ? staveObj?.measures[slur.endMi]?.notes[slur.endNi] : null;

    const noteheadW = (dur) => (dur === 'w' || dur === 'h') ? 8 : 6;
    const startRad = noteheadW(startNote?.duration);
    const endRad   = endNL ? noteheadW(endNote?.duration) : startRad;

    // Slur bows on the notehead side — opposite to stems
    const startUp = (startNL.stemDir ?? 1) > 0;
    const endUp   = endNL ? (endNL.stemDir ?? 1) > 0 : startUp;
    const bowAbove = startUp && endUp ? false
                   : !startUp && !endUp ? true
                   : !startUp; // mixed: follow start note
    const bowDir = bowAbove ? -1 : 1;

    // Asymmetric Y when start and end pitches differ
    const startY = startNL.y;
    const endY   = endNL ? endNL.y : startY;
    const dy = Math.abs(endY - startY);
    let baseY;
    if (bowAbove) {
      baseY = Math.min(startY, endY) - 4 - dy * 0.15;
    } else {
      baseY = Math.max(startY, endY) + 4 + dy * 0.15;
    }

    // Collision avoidance
    const hasLeftAcc  = startNote?.accidental || (startNote?.extraPitches || []).some(ep => ep.accidental);
    const hasRightAcc = endNote?.accidental || (endNote?.extraPitches || []).some(ep => ep.accidental);
    if (hasLeftAcc || hasRightAcc) baseY += 6 * bowDir;

    const startX = startNL.x + startRad + 2;
    const endX   = endNL ? (endNL.x - endRad - 2) : (findStaveLayout(slur.endMi, slur.si)?.w || startX + 60);
    const span   = Math.abs(endX - startX);
    const bowDepth = Math.min(22, Math.max(10, span * 0.18));

    if (endNL) {
      drawArc(startX, endX, baseY, bowAbove, bowDepth, '#333', baseY, 2.6);
    } else {
      // Cross-system slur: partial arc
      const sl = findStaveLayout(slur.startMi, slur.si);
      if (sl) drawArc(startX, sl.x + sl.w - 4, baseY, bowAbove, Math.min(bowDepth, 12), '#333', baseY, 2);
    }
  });

  // ── Hairpins ──────────────────────────────────────────────────────
  (score.hairpins || []).forEach(hp => {
    const startNL = findNoteVF(hp.startMi, hp.si, hp.startNi);
    const endNL   = findNoteVF(hp.endMi,   hp.si, hp.endNi);
    if (!startNL || !endNL) return;
    const sl = findStaveLayout(hp.startMi, hp.si);
    if (!sl) return;
    const y  = sl.bottomY + 10;
    const x1 = startNL.x;
    const x2 = endNL.x;
    drawHairpin(ctx, x1, x2, y, hp.type === 'cresc');
  });

  // ── Articulations ─────────────────────────────────────────────────
  // Most articulations are VF.Articulation modifiers (attached in buildVFNotes).
  // Only trill needs an SVG overlay — VexFlow 3 has no built-in trill modifier.
  score.parts.forEach((part, pi) => {
    let gsi = 0;
    for (let p = 0; p < pi; p++) gsi += score.parts[p].staves.length;
    part.staves.forEach((stave, localSI) => {
      const si = gsi + localSI;
      stave.measures.forEach((measure, mi) => {
        measure.notes.forEach((note, ni) => {
          if (note.articulation !== 'trill') return;
          const nl = findNoteVF(mi, si, ni);
          if (!nl) return;
          const svgEl2 = document.getElementById('score-svg').querySelector('svg');
          const el = document.createElementNS('http://www.w3.org/2000/svg','text');
          const refY = (nl.stemTipY !== undefined) ? Math.min(nl.stemTipY, nl.y) : nl.y;
          el.setAttribute('x', nl.x);
          el.setAttribute('y', refY - 8);
          el.setAttribute('text-anchor','middle');
          el.setAttribute('font-size','12');
          el.setAttribute('font-family','var(--pauta-font-sans)');
          el.setAttribute('fill','#222');
          el.setAttribute('pointer-events','none');
          el.textContent = 'tr~';
          svgEl2.appendChild(el);
        });
      });
    });
  });

  // ── Tempo markings ────────────────────────────────────────────────
  if (APP.showTempoOnScore && score.parts[0]) {
    score.parts[0].staves[0].measures.forEach((measure, mi) => {
      if (!measure.tempo) return;
      const sl = findStaveLayout(mi, 0);
      if (!sl) return;
      const svgEl2 = document.getElementById('score-svg').querySelector('svg');
      // Italic tempo name
      const nameEl = document.createElementNS('http://www.w3.org/2000/svg','text');
      nameEl.setAttribute('x', sl.x + 2);
      nameEl.setAttribute('y', sl.y - 6);
      nameEl.setAttribute('text-anchor','start');
      nameEl.setAttribute('font-family','var(--pauta-font-sans)');
      nameEl.setAttribute('font-size','16');
      nameEl.setAttribute('font-weight','bold');
      nameEl.setAttribute('font-style','italic');
      nameEl.setAttribute('fill','#111');
      nameEl.setAttribute('pointer-events','none');
      nameEl.textContent = measure.tempo.name;
      svgEl2.appendChild(nameEl);
      // BPM
      const bpmEl = document.createElementNS('http://www.w3.org/2000/svg','text');
      const nameW = measure.tempo.name.length * 8.5;
      bpmEl.setAttribute('x', sl.x + 4 + nameW);
      bpmEl.setAttribute('y', sl.y - 6);
      bpmEl.setAttribute('text-anchor','start');
      bpmEl.setAttribute('font-family','var(--pauta-font-sans)');
      bpmEl.setAttribute('font-size','16');
      bpmEl.setAttribute('fill','#111');
      bpmEl.setAttribute('pointer-events','none');
      bpmEl.textContent = `♩= ${measure.tempo.bpm}`;
      svgEl2.appendChild(bpmEl);
    });
  }
  // Dynamics are now VF.Annotation modifiers (attached in buildVFNotes).
}

// Draw a slur/tie arc as a cubic bezier — more natural curve than quadratic.
// above=true bows upward, above=false bows downward.
function drawArc(x1, x2, y1, above, bowDepth, color='#333', endY, thickness=1.5) {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl) return;
  const ey  = endY !== undefined ? endY : y1;
  const bow = above ? -Math.abs(bowDepth) : Math.abs(bowDepth);
  const dx  = x2 - x1;
  // Distance-scaled control-point offset: shorter ties get gentler curves,
  // longer slurs get deeper, more graceful arcs.
  const cpScale = Math.min(0.35, Math.max(0.22, 80 / (dx || 80)));
  const cx1 = x1 + dx * cpScale;
  const cx2 = x2 - dx * cpScale;
  const cy1 = y1 + bow * 1.15;
  const cy2 = ey + bow * 1.15;

  // Build a filled shape for variable thickness (thicker in the middle,
  // thinner at the ends) — closer to professional engraving.
  if (thickness > 1.8) {
    const steps = 24;
    let topPts = [], botPts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      // Cubic bezier point
      const px = mt*mt*mt*x1 + 3*mt*mt*t*cx1 + 3*mt*t*t*cx2 + t*t*t*x2;
      const py = mt*mt*mt*y1 + 3*mt*mt*t*cy1 + 3*mt*t*t*cy2 + t*t*t*ey;
      // Derivative for normal
      const dpx = 3*mt*mt*(cx1-x1) + 6*mt*t*(cx2-cx1) + 3*t*t*(x2-cx2);
      const dpy = 3*mt*mt*(cy1-y1) + 6*mt*t*(cy2-cy1) + 3*t*t*(ey-cy2);
      const len = Math.sqrt(dpx*dpx + dpy*dpy) || 1;
      const nx = -dpy / len;
      const ny =  dpx / len;
      const halfW = thickness * (0.55 + 0.45 * Math.sin(t * Math.PI));
      topPts.push(`${px + nx*halfW},${py + ny*halfW}`);
      botPts.push(`${px - nx*halfW},${py - ny*halfW}`);
    }
    const d = `M ${topPts[0]} L ${topPts.slice(1).join(' L ')} L ${botPts.slice().reverse().join(' L ')} Z`;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', d);
    path.setAttribute('fill', color);
    path.setAttribute('pointer-events', 'none');
    svgEl.appendChild(path);
  } else {
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${ey}`);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(thickness));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('pointer-events', 'none');
    svgEl.appendChild(path);
  }
}

// Draw hairpin (crescendo or diminuendo)
function drawHairpin(ctx, x1, x2, y, isCresc) {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl) return;
  const spread = 5; // professional engraving uses tighter opening than 7
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  const d = isCresc
    ? `M ${x1},${y} L ${x2},${y - spread} M ${x1},${y} L ${x2},${y + spread}`
    : `M ${x1},${y - spread} L ${x2},${y} M ${x1},${y + spread} L ${x2},${y}`;
  path.setAttribute('d', d);
  path.setAttribute('stroke', '#222');
  path.setAttribute('stroke-width', '1.3');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('pointer-events', 'none');
  svgEl.appendChild(path);
}

// Draw dynamic text marking — aligned to note x, below staff, clear of hairpins
// Middle line MIDI pitch per clef (above → stem down, below → stem up)
const MIDDLE_LINE = { treble: 71, bass: 50, alto: 60, percussion: 60 }; // B4, D3, C4, C4

function stemDir(pitch, clef) {
  // Above middle line → stem down (-1), below → stem up (1), on → down by convention
  const mid = MIDDLE_LINE[clef] || 71;
  return pitch >= mid ? VF.Stem.DOWN : VF.Stem.UP;
}

// Pre-calculate stem directions for every note in a measure,
// applying majority-vote within each beam group so they all go the same way.
function calcStemDirections(notes, clef, ts, si) {
  // Single-line rhythm staff: always stems up
  const staveObj = getStaveBySI(si);
  if (staveObj && staveObj.singleLine) return notes.map(() => VF.Stem.UP);

  const beamable  = ['8','16','32'];
  const beatSize  = 4 / ts.den;
  const groupSize = (ts.num % 3 === 0 && ts.num > 3) ? beatSize * 3 : beatSize;

  // First pass: per-note natural direction
  const dirs = notes.map(n =>
    n.type === 'rest' ? VF.Stem.UP : stemDir(n.pitch, clef)
  );

  // Second pass: override beam groups with majority direction
  let gIdx = [], gBeats = 0;

  const flushGroup = () => {
    if (gIdx.length >= 2) {
      const downVotes = gIdx.filter(i => dirs[i] === VF.Stem.DOWN).length;
      const majority  = downVotes >= gIdx.length - downVotes ? VF.Stem.DOWN : VF.Stem.UP;
      gIdx.forEach(i => { dirs[i] = majority; });
    }
    gIdx = []; gBeats = 0;
  };

  notes.forEach((n, i) => {
    const beats = durBeats(n.duration, n.dots, n.tuplet);
    if (n.type !== 'rest' && beamable.includes(n.duration)) {
      // Flush if tuplet group changes
      if (gIdx.length > 0) {
        const prev = notes[gIdx[gIdx.length - 1]];
        if (prev?.tuplet?.groupId !== n.tuplet?.groupId) flushGroup();
      }
      gIdx.push(i);
      gBeats += beats;
    } else {
      flushGroup();
    }
    if (gBeats >= groupSize - 0.001) flushGroup();
  });
  flushGroup();

  return dirs;
}

// Map percussion MIDI pitch to VexFlow staff position + notehead.
// General MIDI percussion mapping with sensible staff placements.
function _percussionLinePos(midi) {
  // Bass drum family (low on staff, below or bottom line)
  if (midi >= 35 && midi <= 37) return { key: 'f/4', notehead: 'normal' };
  // Snare (middle line)
  if (midi >= 38 && midi <= 40) return { key: 'c/5', notehead: 'normal' };
  // Hand clap / side stick
  if (midi === 39) return { key: 'c/5', notehead: 'x' };
  if (midi === 37) return { key: 'c/5', notehead: 'x' };
  // Hi-hat family (above staff, X notehead)
  if (midi >= 42 && midi <= 46) return { key: 'g/5', notehead: 'x' };
  // Toms (on staff, different lines)
  if (midi === 41 || midi === 43) return { key: 'a/4', notehead: 'normal' }; // low-mid tom
  if (midi === 45 || midi === 47) return { key: 'b/4', notehead: 'normal' }; // mid tom
  if (midi === 48 || midi === 50) return { key: 'd/5', notehead: 'normal' }; // high tom
  // Crash / ride (above staff, X notehead)
  if (midi >= 49 && midi <= 53) return { key: 'a/5', notehead: 'x' };
  // Cowbell / triangle
  if (midi === 56) return { key: 'b/5', notehead: 'triangle' };
  // Default: map linearly to staff range
  const line = Math.max(0, Math.min(8, Math.round((midi - 30) / 5)));
  const keys = ['g/3','a/3','b/3','c/4','d/4','e/4','f/4','g/4','a/4'];
  return { key: keys[line] || 'c/5', notehead: 'normal' };
}

function buildVFNotes(notes, clef, mi, si, dirs, isBW, isBR=false) {
  const ks            = getResolvedKeySig(mi, si);
  const keyAccMap     = getKeyAccidentals(ks);
  const measureAccState = {};
  Object.assign(measureAccState, keyAccMap);

  const ts   = resolvedTimeSig(mi, si);
  if (!dirs) dirs = calcStemDirections(notes, clef, ts, si);

  return notes.reduce((arr, note, ni) => {
    try {
      let vfNote;

      const staveObj = getStaveBySI(si);
      const isSingleLine = staveObj && staveObj.singleLine;

      if (note.type === 'rest') {
        let restKey;
        if (clef === 'percussion') restKey = isSingleLine ? 'd/5' : 'd/4';
        else if (clef === 'bass') restKey = note.duration === 'w' ? 'f/3' : 'd/3';
        else if (clef === 'alto') restKey = note.duration === 'w' ? 'e/4' : 'c/4';
        else if (clef === 'tenor') restKey = note.duration === 'w' ? 'c/4' : 'a/3';
        else restKey = note.duration === 'w' ? 'd/5' : 'b/4';
        const durStr  = note.duration + (note.dots ? 'd' : '') + 'r';
        vfNote = new VF.StaveNote({ keys: [restKey], duration: durStr, clef });
        if (isSingleLine) vfNote.setKeyLine(0, 3);
        if (note.dots) { vfSafe(() => vfNote.addDot(0), 'restDot'); }

      } else {
        // ── Percussion ────────────────────────────────────────────
        if (clef === 'percussion') {
          const durStr = note.duration + (note.dots ? 'd' : '');
          vfNote = new VF.StaveNote({
            keys: ['b/4'],
            duration: durStr,
            clef: 'percussion',
            stem_direction: dirs[ni] || VF.Stem.UP
          });
          if (isSingleLine) {
            // Single-line rhythm staff: normal notehead on the middle line
            vfNote.setKeyLine(0, 2);
            vfSafe(() => vfNote.setNoteHead('N', 0), 'percNotehead');
          } else {
            const pos = _percussionLinePos(note.pitch);
            const nhType = pos.notehead === 'x' ? 'x' :
                           pos.notehead === 'diamond' ? 'D' :
                           pos.notehead === 'triangle' ? 'T' : 'N';
            vfSafe(() => vfNote.setNoteHead(nhType, 0), 'percNotehead');
          }
          if (note.dots) { vfSafe(() => vfNote.addDot(0), 'percDot'); }
          arr.push(vfNote);
          return arr;
        }
        const pc  = note.pitch % 12;
        const oct = Math.floor(note.pitch / 12) - 1;

        // Determine whether the key signature already provides this accidental
        // so we can suppress redundant symbols (e.g. no flat on Eb in Eb major).
        // Key sig stores accidentals on the NATURAL pc (e.g. km[5]='#' for F#,
        // km[4]='b' for Eb), so for F# (pc=6) we check km[5]; for Bb (pc=10)
        // we check km[11].
        const keySigCovers = (pc, acc) => {
          if (!acc) return false;
          if (acc === '#' && measureAccState[(pc + 11) % 12] === '#') return true;
          if (acc === 'b' && measureAccState[(pc + 1) % 12] === 'b' ) return true;
          return false;
        };

        let showAcc = note.accidental;
        if (!showAcc) {
          const currentState = measureAccState[pc];
          const keyDefault   = keyAccMap[pc];
          if (!DIATONIC_PCS.has(pc)) {
            if (currentState !== '#' && currentState !== 'b') {
              showAcc = ks < 0 ? 'b' : '#';
            }
          } else {
            // Only show natural if the current accidental differs from the key
            // signature default (i.e. a previous note in this measure altered it).
            if ((currentState === '#' || currentState === 'b') && currentState !== keyDefault) showAcc = 'n';
          }
        }
        // Suppress accidentals already in the key signature
        if (showAcc && keySigCovers(pc, showAcc)) showAcc = null;

        // Derive the diatonic letter from the accidental direction:
        // flat  → the letter is the diatonic note ONE SEMITONE ABOVE (e.g. Bb: pc=10, look up pc+1=11=B)
        // sharp → the letter is the diatonic note ONE SEMITONE BELOW (e.g. F#: pc=6, look up pc-1=5=F)
        // natural/none → use pc directly
        let diaName;
        if (showAcc === 'b') {
          diaName = NOTE_NAMES[PC_TO_DIA[(pc + 1) % 12]];
        } else if (showAcc === '#') {
          diaName = NOTE_NAMES[PC_TO_DIA[(pc + 11) % 12]];
        } else if (showAcc === 'n') {
          diaName = NOTE_NAMES[PC_TO_DIA[pc]];
        } else {
          // No explicit accidental — check if key signature provides one.
          if (keyAccMap[pc] === 'b') {
            diaName = NOTE_NAMES[PC_TO_DIA[(pc + 1) % 12]];
          } else if (keyAccMap[pc] === '#') {
            diaName = NOTE_NAMES[PC_TO_DIA[(pc + 11) % 12]];
          } else if (!DIATONIC_PCS.has(pc)) {
            // Key sig stores on the NATURAL pc (e.g. Eb→km[4]='b', so pc=3
            // looks up km[(3+1)%12]=km[4]). Direction matches key-signature flavour.
            if (ks < 0 && keyAccMap[(pc + 1) % 12] === 'b')
              diaName = NOTE_NAMES[PC_TO_DIA[(pc + 1) % 12]];
            else if (ks > 0 && keyAccMap[(pc + 11) % 12] === '#')
              diaName = NOTE_NAMES[PC_TO_DIA[(pc + 11) % 12]];
            else
              diaName = NOTE_NAMES[PC_TO_DIA[pc]];
          } else {
            diaName = NOTE_NAMES[PC_TO_DIA[pc]];
          }
        }

        // Also fix extra pitches diaName for same reason
        const extraDiaName = (ep) => {
          const epc = ep.pitch % 12;
          if (ep.accidental === 'b') return NOTE_NAMES[PC_TO_DIA[(epc + 1) % 12]];
          if (ep.accidental === '#') return NOTE_NAMES[PC_TO_DIA[(epc + 11) % 12]];
          if (ep.accidental === 'n') return NOTE_NAMES[PC_TO_DIA[epc]];
          if (keyAccMap[epc] === 'b') return NOTE_NAMES[PC_TO_DIA[(epc + 1) % 12]];
          if (keyAccMap[epc] === '#') return NOTE_NAMES[PC_TO_DIA[(epc + 11) % 12]];
          // Key sig may store accidental on the natural PC (e.g. F#→km[5]='#')
          if (!DIATONIC_PCS.has(epc)) {
            if (ks < 0 && keyAccMap[(epc + 1) % 12] === 'b')
              return NOTE_NAMES[PC_TO_DIA[(epc + 1) % 12]];
            if (ks > 0 && keyAccMap[(epc + 11) % 12] === '#')
              return NOTE_NAMES[PC_TO_DIA[(epc + 11) % 12]];
          }
          return NOTE_NAMES[PC_TO_DIA[epc]];
        };

        // Build chord keys: primary pitch + any extra pitches
        // Always include accidental in the key string so VexFlow places the
        // notehead on the correct staff line, even when the accidental is
        // suppressed from display by the key signature.
        let keyStr;
        if (showAcc === '#')      keyStr = `${diaName}#/${oct}`;
        else if (showAcc === 'b') keyStr = `${diaName}b/${oct}`;
        else if (showAcc === 'n') keyStr = `${diaName}/${oct}`;
        else if (keyAccMap[pc] === '#') keyStr = `${diaName}#/${oct}`;
        else if (keyAccMap[pc] === 'b') keyStr = `${diaName}b/${oct}`;
        else                      keyStr = `${diaName}/${oct}`;

        const allKeys = [keyStr];
        if (note.extraPitches && note.extraPitches.length) {
          note.extraPitches.forEach(ep => {
            const eoct = Math.floor(ep.pitch / 12) - 1;
            const edia = extraDiaName(ep);
            if (ep.accidental === '#')      allKeys.push(`${edia}#/${eoct}`);
            else if (ep.accidental === 'b') allKeys.push(`${edia}b/${eoct}`);
            else                            allKeys.push(`${edia}/${eoct}`);
          });
        }
        // Sort keys by pitch so VexFlow stacks them correctly
        allKeys.sort((a, b) => {
          const parsePitch = k => {
            const m = k.match(/([a-g])(#|b)?\/(\d+)/i);
            if (!m) return 0;
            const pc = NAME_TO_PC[m[1].toUpperCase()] + (m[2]==='#'?1:m[2]==='b'?-1:0);
            return parseInt(m[3]) * 12 + pc;
          };
          return parsePitch(a) - parsePitch(b);
        });

        const durStr = note.duration + (note.dots ? 'd' : '');
        vfNote = new VF.StaveNote({
          keys: allKeys,
          duration: durStr,
          clef,
          stem_direction: dirs[ni]
        });

        // ── Assignment mode placeholders ────────────────────────
        if (APP.assignmentMode && _isInAssignmentRange(mi) && note.type === 'note') {
          const asgn = APP.currentAssignment;
          const hiddenSet = new Set(asgn?.hidden || ['pitch']);
          const ans = APP.score?.studentAnswers?.[asgn?.id]?.notes?.[mi]?.[ni];
          const isFirstNote = asgn?.hints?.showFirstNote && ni === 0;
          if (hiddenSet.has('pitch') && !isFirstNote && (!ans || ans.pitch == null)) {
            // Unanswered: grey diamond placeholder
            vfSafe(() => vfNote.setNoteHead('D', 0), 'asgnPlaceholder');
            vfNote.setStyle({ fillStyle: '#bbb', strokeStyle: '#999' });
          }
          if (ans && ans.pitch != null) {
            // Answered: tint green/red based on correctness
            const target = note.pitch;
            const isCorrect = ans.pitch === target;
            if (isCorrect) {
              vfNote.setStyle({ fillStyle: '#4caf50', strokeStyle: '#388e3c' });
            } else {
              vfNote.setStyle({ fillStyle: 'var(--pauta-error)', strokeStyle: '#c05040' });
            }
          }
        }

        // Add accidentals for primary pitch
        if (showAcc) {
          vfSafe(() => vfNote.addAccidental(0, new VF.Accidental(showAcc)), 'accidental');
        }
        // Add accidentals for extra pitches
        if (note.extraPitches) {
          note.extraPitches.forEach((ep, ei) => {
            const epc = ep.pitch % 12;
            if (ep.accidental && !keySigCovers(epc, ep.accidental)) {
              vfSafe(() => vfNote.addAccidental(ei + 1, new VF.Accidental(ep.accidental)), 'extraAccidental');
            }
          });
        }
        if (note.dots) { vfSafe(() => vfNote.addDot(0), 'noteDot'); }

        measureAccState[pc] = showAcc === 'n' ? null : (showAcc || measureAccState[pc] || null);
      }

      // ── VexFlow modifiers (attached before Formatter runs) ──────────
      // By attaching BEFORE format(), VexFlow accounts for modifier space in layout.
      if (note.type === 'note' || note.type === 'rest') {

        // Articulation — VexFlow 3 type codes:
        //   staccato='a.'  accent='a>'  tenuto='a-'  marcato='a^'  fermata='ao'  staccatissimo='av'
        const ARTIC_VF_MAP = {
          staccato:'a.', accent:'a>', tenuto:'a-', marcato:'a^',
          fermata:'ao',  staccatissimo:'av',
        };
        // Articulation — VexFlow built-in, supports compound (e.g. "staccato+tenuto")
        if (note.articulation) {
          const parts = note.articulation.includes('+')
            ? note.articulation.split('+').filter(p => ARTIC_VF_MAP[p])
            : (ARTIC_VF_MAP[note.articulation] ? [note.articulation] : []);
          parts.forEach((artType, i) => {
            try {
              const art = new VF.Articulation(ARTIC_VF_MAP[artType]);
              // Fermata and marcato always above the note
              if (artType === 'fermata' || artType === 'marcato') {
                art.setPosition(VF.Modifier.Position.ABOVE);
              }
              vfNote.addArticulation(0, art);
            } catch(e) { console.warn('VF.Articulation:', e.message); }
          });
        }

        // Lyric — rendered as direct SVG text in renderLyrics() below

        // Chord symbol — VF.Annotation above
        if (note.type === 'note' && note.chordSymbol) {
          vfSafe(() => {
            const sym = note.chordSymbol
              .replace(/bb/g,'𝄫').replace(/##/g,'𝄪')
              .replace(/#/g,'♯').replace(/b(?=[^a-zA-Z]|$)/g,'♭');
            const cann = new VF.Annotation(sym);
            cann.setFont("'Helvetica Neue',Helvetica,Arial,sans-serif", 14, 'bold');
            cann.setVerticalJustification(VF.Annotation.VerticalJustify.TOP);
            cann.setJustification(VF.TextJustification.CENTER);
            vfNote.addAnnotation(0, cann);
          }, 'chordSymbol');
        }

        // Dynamic — VF.Annotation below, serif italic
        if (note.type === 'note' && note.dynamic) {
          vfSafe(() => {
            const dann = new VF.Annotation(note.dynamic);
            dann.setFont('Georgia, "Times New Roman", serif', 16, 'bold');
            dann.setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);
            dann.setJustification(VF.TextJustification.LEFT);
            vfNote.addAnnotation(0, dann);
          }, 'dynamic');
        }

        // Fingering — VF.Annotation above, small sans-serif
        if (note.type === 'note' && note.fingering) {
          vfSafe(() => {
            const finn = new VF.Annotation(note.fingering);
            finn.setFont("'Helvetica Neue',Helvetica,Arial,sans-serif", 12, 'bold');
            finn.setVerticalJustification(VF.Annotation.VerticalJustify.TOP);
            finn.setJustification(VF.TextJustification.CENTER);
            vfNote.addAnnotation(0, finn);
          }, 'fingering');
        }
      }

      // Colour: selection → teal, voice 2 → coral, BW → colour+black stem, BR → normal+black stem
      if (isNoteSelected(mi, si, ni)) {
        vfNote.setStyle({ fillStyle: 'var(--pauta-primary)', strokeStyle: 'var(--pauta-primary)' });
      } else if ((note.voice||1) === 2) {
        vfNote.setStyle({ fillStyle: '#f07860', strokeStyle: '#f07860' });
      } else if (isBW && note.type === 'note') {
        const col = boomwhackerColor(note.pitch);
        vfNote.setStyle({ fillStyle: col, strokeStyle: '#000', lineWidth: 1.5 });
      } else if (isBR && note.type === 'note') {
        vfNote.setStyle({ fillStyle: '#000', strokeStyle: '#000', lineWidth: 1.5 });
      }

      arr.push(vfNote);
    } catch(e) { console.warn('Note err:', note, e.message); }
    return arr;
  }, []);
}

// Build beams — notes already have correct stem_direction from calcStemDirections
function buildBeams(vfNotes, notes, ts) {
  const beamable  = ['8','16','32'];
  const beams     = [];
  let   group     = [];
  let   groupVFNotes = [];
  let   groupBeats = 0;
  const beatSize  = 4 / ts.den;
  const groupSize = (ts.num % 3 === 0 && ts.num > 3) ? beatSize * 3 : beatSize;

  const flushGroup = () => {
    if (group.length >= 2) {
      // Calculate slope from first to last notehead y position
      // VexFlow beam slope is in staff-position units; we approximate from noteheads
      const beam = new VF.Beam(group);
      // Limit beam slope to ±0.5 staff spaces per note for cleaner engraving
      // VexFlow handles this internally but we ensure the group is correct
      beams.push(beam);
    }
    group = []; groupVFNotes = []; groupBeats = 0;
  };

  notes.forEach((note, i) => {
    const vf    = vfNotes[i];
    if (!vf) return;
    const beats = durBeats(note.duration, note.dots, note.tuplet);

    if (note.type !== 'rest' && beamable.includes(note.duration)) {
      // Flush if tuplet group changes (tuplet notes must stay in same beam)
      if (group.length > 0) {
        const prev = groupVFNotes[groupVFNotes.length - 1]?.note;
        if (prev?.tuplet?.groupId !== note.tuplet?.groupId) flushGroup();
      }
      group.push(vf);
      groupVFNotes.push({vf, note});
      groupBeats += beats;
    } else {
      flushGroup();
    }
    if (groupBeats >= groupSize - 0.001) flushGroup();
  });
  flushGroup();
  return beams;
}

// ── Tuplets ───────────────────────────────────────────────────────
// Group consecutive vfNotes by their tuplet.groupId and build VF.Tuplet objects.
function buildTuplets(vfNotes, notes) {
  const groups = new Map(); // groupId → [{vfn, note}]
  notes.forEach((n, i) => {
    if (!n.tuplet || !vfNotes[i]) return;
    const id = n.tuplet.groupId;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(vfNotes[i]);
  });
  const result = [];
  groups.forEach((grpNotes, id) => {
    if (grpNotes.length < 2) return;
    try {
      // VexFlow 3: Tuplet(notes, opts)
      // ratioed:false → shows just "3" not "3:2"
      // location: VF.Tuplet.LOCATION_TOP (1) or LOCATION_BOTTOM (-1)
      const t = new VF.Tuplet(grpNotes, {
        num_notes: grpNotes.length,
        ratioed:   false,
        bracketed: true,
        location:  VF.Tuplet.LOCATION_TOP,
      });
      result.push(t);
    } catch(e) { console.warn('Tuplet err:', e.message); }
  });
  return result;
}

// ── Navigation Markers (segno, coda, Fine, D.C., D.S.) ──────────
function renderNavigationMarkers() {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl || !APP.score) return;
  const measures = APP.score.parts[0].staves[0].measures;
  measures.forEach((m, mi) => {
    const sl = APP.staveLayout.find(l => l.mi === mi && l.si === 0);
    if (!sl) return;
    const y = sl.topLineY - 14;
    const x = sl.x + 2;
    if (m.segno) {
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor','start');
      t.setAttribute('font-size','18'); t.setAttribute('fill','#111');
      t.setAttribute('font-family','var(--pauta-font-sans)');
      t.setAttribute('pointer-events','none');
      t.textContent = '𝄋'; svgEl.appendChild(t);
    }
    if (m.coda) {
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor','start');
      t.setAttribute('font-size','18'); t.setAttribute('fill','#111');
      t.setAttribute('font-family','var(--pauta-font-sans)');
      t.setAttribute('pointer-events','none');
      t.textContent = '𝄌'; svgEl.appendChild(t);
    }
    if (m.fine) {
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor','start');
      t.setAttribute('font-size','12'); t.setAttribute('font-weight','bold');
      t.setAttribute('font-style','italic');
      t.setAttribute('font-family','var(--pauta-font-sans)');
      t.setAttribute('fill','#111'); t.setAttribute('pointer-events','none');
      t.textContent = 'Fine'; svgEl.appendChild(t);
    }
    const dcLabel = m.dc ? 'D.C.' : null;
    const dsLabel = m.ds ? 'D.S.' : null;
    const jmpLabel = dcLabel || dsLabel;
    if (jmpLabel) {
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x + (m.coda || m.segno ? 22 : 0));
      t.setAttribute('y', y);
      t.setAttribute('text-anchor','start');
      t.setAttribute('font-size','11'); t.setAttribute('font-weight','bold');
      t.setAttribute('font-style','italic');
      t.setAttribute('font-family','var(--pauta-font-sans)');
      t.setAttribute('fill','#111'); t.setAttribute('pointer-events','none');
      t.textContent = jmpLabel; svgEl.appendChild(t);
    }
  });
}

// ── Playback Order Builder ───────────────────────────────────────
// Builds a flat array of measure indices in play order, handling
// repeat barlines, D.C., D.S., segno, coda, and Fine markers.
function buildPlaybackOrder(score) {
  const refM = score.parts[0].staves[0].measures;
  const nM = refM.length;
  // Collect marker positions
  let segnoIdx = -1, codaIdx = -1, fineIdx = -1;
  for (let i = 0; i < nM; i++) {
    const m = refM[i];
    if (m.segno) segnoIdx = i;
    if (m.coda)  codaIdx = i;
    if (m.fine)  fineIdx = i;
  }
  // Step 1: linear order with repeat barlines expanded
  let order = [];
  let i = 0;
  while (i < nM) {
    order.push(i);
    const m = refM[i];
    if ((m.barline === 'repeat_end' || m.barline === 'repeat_both') && i > 0) {
      let found = -1;
      for (let j = order.length - 2; j >= 0; j--) {
        const pM = refM[order[j]];
        if (pM.barline === 'repeat_begin' || pM.barline === 'repeat_both') { found = order[j]; break; }
      }
      if (found >= 0) {
        for (let k = found; k <= i; k++) order.push(k);
      }
    }
    i++;
  }
  // Step 2: Build result from base order
  const result = [...order];

  // Check for D.C. or D.S. and expand with the appropriate sections
  const hasDC = refM.some(m => m.dc);
  const hasDS = refM.some(m => m.ds);

  if (hasDC) {
    const endAt = fineIdx >= 0 ? fineIdx : nM - 1;
    for (let k = 0; k <= endAt; k++) result.push(k);
  }

  if (hasDS && segnoIdx >= 0) {
    const endAt = fineIdx >= 0 ? fineIdx : nM - 1;
    for (let k = segnoIdx; k <= endAt; k++) result.push(k);
  }

  // Step 3: Coda section — append measures after coda marker
  if (codaIdx >= 0 && (hasDC || hasDS)) {
    for (let k = codaIdx + 1; k < nM; k++) result.push(k);
  }
  return result;
}

// ── Lyric click handler attachment ───────────────────────────────
// VF.Annotation renders <text> elements that we can't attach handlers to
// during buildVFNotes. After draw, we scan SVG text nodes near lyric
// note positions and wire up double-click to open the inline editor.
function renderLyricClickHandlers() {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl || !APP.score) return;

  // Build a list of lyric positions
  const lyricPositions = [];
  let gsi = 0;
  APP.score.parts.forEach(part => {
    part.staves.forEach((stave, localSI) => {
      const si = gsi + localSI;
      stave.measures.forEach((measure, mi) => {
        measure.notes.forEach((note, ni) => {
          if (!note.lyric) return;
          const nl = APP.noteLayout.find(l=>l.mi===mi&&l.si===si&&l.ni===ni);
          const sl = APP.staveLayout.find(l=>l.mi===mi&&l.si===si);
          if (!nl||!sl) return;
          lyricPositions.push({ mi, si, ni, x: nl.x, y: sl.bottomY + 32, text: note.lyric.text });
        });
      });
    });
    gsi += part.staves.length;
  });
  if (lyricPositions.length === 0) return;

  // Scan all SVG text elements for those near a lyric position
  const textEls = svgEl.querySelectorAll('text');
  textEls.forEach(el => {
    // Skip elements we've already wired
    if (el.dataset.lyricWired) return;
    const content = el.textContent?.trim();
    if (!content) return;

    let bbox;
    try { bbox = el.getBBox(); } catch(e) { console.warn('[Pauta]', e.message); return; }
    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;

    // Find matching lyric position
    const RADIUS = 30;
    let best = null, bestDist = RADIUS;
    lyricPositions.forEach(lp => {
      if (lp.text !== content) return;
      const d = Math.hypot(cx - lp.x, cy - lp.y);
      if (d < bestDist) { bestDist = d; best = lp; }
    });
    if (!best) return;

    el.dataset.lyricWired = '1';
    el.style.cursor = 'pointer';

    let _tapT = 0;
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      const now = Date.now();
      if (now - _tapT < 380) {
        APP.selectedMeasure = best.mi; APP.selectedStaff = best.si; APP.selectedNoteIdx = best.ni; APP.selStartIdx = -1;
        openInlineLyricEditor(best.mi, best.si, best.ni);
      }
      _tapT = now;
    });
    el.addEventListener('dblclick', ev => {
      ev.stopPropagation();
      APP.selectedMeasure = best.mi; APP.selectedStaff = best.si; APP.selectedNoteIdx = best.ni; APP.selStartIdx = -1;
      openInlineLyricEditor(best.mi, best.si, best.ni);
    });
  });
}


// ── Recorder fingering SVG diagram ───────────────────────────────
// Display: thumb indicator on the left + 7 front tone holes.
// Holes 1-5 are single circles.  Holes 6-7 are double holes, each
// shown as two smaller circles side by side (musicplayonline.com style).
// Fingering data uses 10 positions: '0'(thumb) '1'-'5'(single holes)
// '6'(6a) '7'(6b) '8'(7a) '9'(7b).  'X' = pinched (half-open) thumb.
// Covered = solid dark fill.  Open = transparent ring (cream page shows
// through centre) with thick dark outline.  Pinched thumb = top-half filled.
const RECORDER_HOLES = [
  [ '0', 4,  5,   4.0, 3.0, true  ],  // thumb — oval, wide
  [ '1', 15, 9,   4.0, 3.5, true  ],  // single — oval
  [ '2', 15, 15.5, 4.0, 3.5, true  ],
  [ '3', 15, 22,  4.0, 3.5, true  ],
  [ '4', 15, 28.5, 4.0, 3.5, true  ],
  [ '5', 15, 35,  4.0, 3.5, true  ],
  [ '6a', 13.5, 41.5, 2.8, 2.8, true ],  // double-hole 6 — left
  [ '6b', 16.5, 41.5, 2.8, 2.8, true ],  // double-hole 6 — right
  [ '7a', 13.5, 48,  2.8, 2.8, true ],  // double-hole 7 — left
  [ '7b', 16.5, 48,  2.8, 2.8, true ],  // double-hole 7 — right
];

function renderRecorderFingSVG(fing, cx, cy, scale) {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('transform', `translate(${cx},${cy}) scale(${scale})`);
  g.setAttribute('pointer-events', 'none');

  const covered = new Set(fing.split(''));
  const thumbPinched = covered.has('X');

  function isHoleCovered(holeId) {
    if (holeId === '6a') return covered.has('6');
    if (holeId === '6b') return covered.has('7');
    if (holeId === '7a') return covered.has('8');
    if (holeId === '7b') return covered.has('9');
    return covered.has(holeId);
  }

  for (const [id, hx, hy, rx, ry, isEllipse] of RECORDER_HOLES) {
    const isCovered = isHoleCovered(id);
    const el = document.createElementNS(ns, isEllipse ? 'ellipse' : 'circle');
    el.setAttribute('cx', hx);
    el.setAttribute('cy', hy);
    if (isEllipse) {
      el.setAttribute('rx', rx);
      el.setAttribute('ry', ry);
    } else {
      el.setAttribute('r', rx);
    }
    if (isCovered) {
      el.setAttribute('fill', '#222');
      el.setAttribute('stroke', 'none');
    } else {
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', '#222');
      el.setAttribute('stroke-width', '1.4');
    }
    g.appendChild(el);
  }

  // Pinched thumb: top-half filled semi-ellipse over the thumb hole
  if (thumbPinched) {
    const semi = document.createElementNS(ns, 'path');
    semi.setAttribute('d', 'M 1,4 A 3.0,2.0 0 0,1 7,4 Z');
    semi.setAttribute('fill', '#222');
    semi.setAttribute('stroke', 'none');
    g.appendChild(semi);
  }

  return g;
}

// ── Shared Diagram Helpers ───────────────────────────────────────
// Shared SVG primitives used by recorder, woodwind, and brass diagram renderers.

const NS_SVG = 'http://www.w3.org/2000/svg';

function parseFing(fingArr, altIndex) {
  if (typeof fingArr === 'string') fingArr = [fingArr];
  const fing = (fingArr?.length > 0 && fingArr[altIndex]) ? fingArr[altIndex] : '';
  const covered = new Set();
  const halfHole = new Set();
  // Recorder format: characters are hole numbers ('0'-'9') and 'X' (pinched thumb)
  //   Each character appears at most once (unique hole numbers)
  // Woodwind/brass format: characters are states ('0'=open, '1'=covered, '2'=half-hole)
  //   Characters repeat (e.g. '111000111001')
  const hasUniqueChars = new Set(fing).size === fing.length;
  const isRecorder = fing.length > 0 && hasUniqueChars && /^[0-9X]+$/.test(fing);
  if (isRecorder) {
    for (let i = 0; i < fing.length; i++) {
      const c = fing[i];
      if (c === 'X') halfHole.add(0);
      else if (c >= '0' && c <= '9') covered.add(parseInt(c));
    }
  } else {
    for (let i = 0; i < fing.length; i++) {
      if (fing[i] === '1') covered.add(i);
      else if (fing[i] === '2') halfHole.add(i);
    }
  }
  return { fingArr, fing, covered, halfHole };
}

function diagNoteName(parent, text, x, y, opts) {
  if (!text) return;
  const el = document.createElementNS(NS_SVG, 'text');
  el.setAttribute('x', x); el.setAttribute('y', y);
  el.setAttribute('text-anchor', opts?.anchor || 'middle');
  el.setAttribute('font-size', opts?.size || '9');
  el.setAttribute('font-weight', '700');
  el.setAttribute('fill', opts?.fill || '#555');
  el.setAttribute('font-family', opts?.family || 'var(--pauta-font-sans)');
  if (opts?.flipY) el.setAttribute('transform', `translate(${x},${y}) scale(1,-1) translate(${-x},${-y})`);
  el.textContent = text;
  parent.appendChild(el);
}

function diagAltOverlay(parent, containerType, fingArr, altIndex, w, h, updateFn, opts) {
  if (fingArr.length <= 1) return;
  const overlay = document.createElementNS(NS_SVG, 'rect');
  overlay.setAttribute('x', opts?.x || '0'); overlay.setAttribute('y', opts?.y || '0');
  overlay.setAttribute('width', w); overlay.setAttribute('height', h);
  overlay.setAttribute('fill', 'transparent');
  overlay.setAttribute('pointer-events', 'auto');
  overlay.setAttribute('cursor', 'pointer');
  overlay.addEventListener('click', e => {
    e.stopPropagation();
    const container = e.target.closest(`[data-instr-type="${containerType}"]`);
    if (!container) return;
    const max = parseInt(container.getAttribute('data-fing-count') || '1');
    let idx = parseInt(container.getAttribute('data-fing-index') || '0');
    idx = (idx + 1) % max;
    container.setAttribute('data-fing-index', idx);
    updateFn();
  });
  parent.appendChild(overlay);
  const altText = document.createElementNS(NS_SVG, 'text');
  const tx = opts?.tx || w - 4; const ty = opts?.ty || h - 4;
  altText.setAttribute('x', tx); altText.setAttribute('y', ty);
  altText.setAttribute('text-anchor', 'end');
  altText.setAttribute('font-size', opts?.fontSize || '5');
  altText.setAttribute('fill', '#998a70');
  altText.setAttribute('font-family', 'var(--pauta-font-sans)');
  if (opts?.flipY) altText.setAttribute('transform', `translate(${tx},${ty}) scale(1,-1) translate(${-tx},${-ty})`);
  altText.textContent = `\u21BB ${altIndex + 1}/${fingArr.length}`;
  parent.appendChild(altText);
}

function diagHighlight(parent, cx, cy, r, isPlaying) {
  const hi = document.createElementNS(NS_SVG, 'circle');
  hi.setAttribute('cx', cx - r * 0.25); hi.setAttribute('cy', cy - r * 0.25);
  hi.setAttribute('r', r * 0.32);
  hi.setAttribute('fill', isPlaying ? 'rgba(255,90,74,0.45)' : 'rgba(255,255,255,0.25)');
  hi.setAttribute('stroke', 'none');
  parent.appendChild(hi);
}

function diagHalfPad(parent, cx, cy, r, isPlaying) {
  const pad = document.createElementNS(NS_SVG, 'path');
  pad.setAttribute('d', `M ${cx - r*0.9} ${cy} A ${r*0.9} ${r*0.9} 0 0 1 ${cx + r*0.9} ${cy} L ${cx + r*0.9} ${cy - r*0.9} L ${cx - r*0.9} ${cy - r*0.9} Z`);
  pad.setAttribute('fill', isPlaying ? '#ff5a4a' : '#222');
  pad.setAttribute('stroke', isPlaying ? '#e04030' : '#222');
  pad.setAttribute('stroke-width', '0.4');
  parent.appendChild(pad);
}

function diagActiveFill(isPlaying) { return isPlaying ? '#ff5a4a' : 'var(--pauta-primary)'; }
function diagActiveStroke(isPlaying) { return isPlaying ? '#e04030' : 'var(--pauta-primary)'; }

// ── Large Baroque Recorder Diagram ─────────────────────────────
function renderLargeRecorder(fingArr, type = 'soprano', altIndex = 0, noteName = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('pointer-events', 'none');

  const pf = parseFing(fingArr, altIndex);
  fingArr = pf.fingArr; const fing = pf.fing;

  // Scale wrapper for external placement compatibility
  const inner = document.createElementNS(ns, 'g');
  inner.setAttribute('transform', 'scale(0.35)');

  // All circles same size. Right column: 1-2-3-4-5-6b-7b.
  // Left column: T beside 1, 6a beside 6b, 7a beside 7b.
  const CX_R = 24.8;         // right-column x
  const CX_L = -3.2;         // left-column x (d=28 from CX_R — double gap)
  const R = 14.0;            // all circles
  const DY = 44;             // vertical spacing
  const Y0 = -80;            // top row y (higher on page)

  // "Fingering" label
  const titleEl = document.createElementNS(ns, 'text');
  titleEl.setAttribute('x', '11'); titleEl.setAttribute('y', '-130');
  titleEl.setAttribute('text-anchor', 'middle');
  titleEl.setAttribute('style', 'font-family:var(--pauta-font-sans);font-size:12px;font-weight:600;fill:#888;pointer-events:none');
  titleEl.setAttribute('transform', 'translate(11,-130) scale(1,-1) translate(-11,130)');
  titleEl.textContent = 'Fingering';
  inner.appendChild(titleEl);

  const SVG_HOLES = [
    [ 'T',  CX_L, Y0,          ],
    [ '1',  CX_R, Y0,          ],
    [ '2',  CX_R, Y0 - DY,     ],
    [ '3',  CX_R, Y0 - DY*2,   ],
    [ '4',  CX_R, Y0 - DY*3,   ],
    [ '5',  CX_R, Y0 - DY*4,   ],
    [ '6a', CX_L, Y0 - DY*5,   ],
    [ '6b', CX_R, Y0 - DY*5,   ],
    [ '7a', CX_L, Y0 - DY*6,   ],
    [ '7b', CX_R, Y0 - DY*6,   ],
  ];

  // Horizontal separator between left hand (3) and right hand (4)
  const sepY = Y0 - 2.5 * DY;  // midpoint between hole 3 and 4
  const sep = document.createElementNS(ns, 'line');
  sep.setAttribute('x1', '-20'); sep.setAttribute('y1', sepY);
  sep.setAttribute('x2', '42');  sep.setAttribute('y2', sepY);
  sep.setAttribute('stroke', '#222'); sep.setAttribute('stroke-width', '2');
  inner.appendChild(sep);

  const covered = pf.covered;
  const halfHole = pf.halfHole;

  function isCov(id) {
    if (id === 'T')  return covered.has(0);
    if (id === '6a') return covered.has(6);
    if (id === '6b') return covered.has(7);
    if (id === '7a') return covered.has(8);
    if (id === '7b') return covered.has(9);
    return covered.has(parseInt(id));
  }

  const lblSt = 'font-family:var(--pauta-font-sans);font-size:10px;font-weight:600;fill:#222;text-anchor:middle;pointer-events:none';
  for (const [id, hx, hy] of SVG_HOLES) {
    const cov = isCov(id);
    const dr = cov ? R * 1.2 : R;
    const el = document.createElementNS(ns, 'circle');
    el.setAttribute('cx', hx); el.setAttribute('cy', hy); el.setAttribute('r', dr);
    if (cov) {
      el.setAttribute('fill', '#222');
      el.setAttribute('stroke', 'none');
    } else {
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', '#222');
      el.setAttribute('stroke-width', '4');
    }
    inner.appendChild(el);

    if (id === 'T' && halfHole.has(0)) diagHalfPad(inner, hx, hy, dr, APP.playing);

    // Label centered above right-column hole for double pairs (6, 7)
    const isLeftSub = id === '6a' || id === '7a';
    const lx = isLeftSub ? CX_R : hx;
    const ly = hy - dr - 20;
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', lx); lbl.setAttribute('y', ly);
    lbl.setAttribute('style', lblSt);
    lbl.setAttribute('transform', `translate(${lx},${ly}) scale(1,-1) translate(${-lx},${-ly})`);
    lbl.textContent = isLeftSub ? id[0] : id;
    inner.appendChild(lbl);
  }

  g.appendChild(inner);

  // ── Note name ─────────────────────────────────────────────────
  diagNoteName(inner, noteName, 25, -60, { size: '11', flipY: true });

  // ── Alternate-fingering click overlay ─────────────────────────
  diagAltOverlay(inner, 'recorder', fingArr, altIndex, 36, 280, updateRecorderDiagram, { x: '12', y: '-460', tx: '38', ty: '-240', fontSize: '8', flipY: true });

  g.appendChild(inner);

  return g;
}

function updateDiagram(type, renderFn, fingeringFn, defaultName, opts) {
  const els = document.querySelectorAll(`[data-instr-type="${type}"]`);
  if (!els.length || !APP.score) return;
  const mi = APP.selectedMeasure;
  const ni = APP.selectedNoteIdx;
  const empty = () => {
    els.forEach(el => {
      el.innerHTML = '';
      const name = opts?.nameAttr ? el.getAttribute(opts.nameAttr) || defaultName : defaultName;
      const fresh = renderFn([''], name, 0, '', opts?.extra?.(name) ?? false);
      while (fresh.firstChild) el.appendChild(fresh.firstChild);
      el.setAttribute('data-fing-index', '0');
      el.setAttribute('data-fing-count', '1');
      el.setAttribute('data-last-pitch', '');
    });
  };
  if (mi < 0 || ni < 0) { empty(); return; }
  let si = APP.selectedStaff;
  let note = null;
  for (const part of APP.score.parts) {
    for (let s = 0; s < part.staves.length; s++) {
      note = part.staves[s].measures[mi]?.notes[ni];
      if (note) break;
    }
    if (note) break;
  }
  if (!note || note.type !== 'note') {
    els.forEach(el => {
      el.innerHTML = '';
      const name = opts?.nameAttr ? el.getAttribute(opts.nameAttr) || defaultName : defaultName;
      const fresh = renderFn([''], name, 0, '', opts?.extra?.(name) ?? false);
      while (fresh.firstChild) el.appendChild(fresh.firstChild);
    });
    return;
  }
  const name = opts?.nameAttr ? els[0].getAttribute(opts.nameAttr) || defaultName : defaultName;
  const pitch = note.pitch;
  const fingArr = fingeringFn(pitch, name);
  const lastPitch = els[0].getAttribute('data-last-pitch') || '';
  let altIndex = 0;
  if (lastPitch === String(pitch)) {
    altIndex = parseInt(els[0].getAttribute('data-fing-index') || '0');
    if (altIndex >= fingArr.length) altIndex = 0;
  }
  const ks = si >= 0 ? getResolvedKeySig(mi, si) : 0;
  const noteName = noteLabelForPitch(pitch, ks, note.accidental || null, 'letter');
  els.forEach(el => {
    el.innerHTML = '';
    const fresh = renderFn(fingArr, name, altIndex, noteName, opts?.extra?.(name, pitch) ?? false);
    while (fresh.firstChild) el.appendChild(fresh.firstChild);
    el.setAttribute('data-fing-index', String(altIndex));
    el.setAttribute('data-fing-count', String(fingArr.length));
    el.setAttribute('data-last-pitch', String(pitch));
  });
}

function updateRecorderDiagram() {
  updateDiagram('recorder', renderLargeRecorder, recorderFingeringForPitch, 'soprano',
    { nameAttr: 'data-recorder-type' });
}
function updateWoodwindDiagram() {
  updateDiagram('woodwind', renderWoodwindDiagram, woodwindFingeringForPitch, 'flute',
    { nameAttr: 'data-instr-name',
      extra: (n, p) => (n === 'clarinet' && p >= 67) || (n === 'sax' && p >= 72) });
}
function updateBrassDiagram() {
  updateDiagram('brass', renderBrassDiagram, brassFingeringForPitch, 'trumpet',
    { nameAttr: 'data-instr-name' });
}

// ── Woodwind Diagram ─────────────────────────────────────────────
// Improved instrument diagrams with realistic key-cup visuals,
// staggered LH/RH positions, hand labels, and instrument-specific
// body shapes.
// fing: string of '1' (pressed) / '0' (open) per key position.
// type: 'flute', 'clarinet', 'sax', 'oboe', 'bassoon'

// Each spec: [viewW, viewH, bodyPath, fill, [pos0..pos7], keyR]
// pos: [x, y, label, hand]  hand: 'L' / 'R' / 'T'(thumb)
const WOODWIND_SPEC = {
  flute: {
    w:260, h:70,
    // Single closed path: head-joint cap → tube body → foot-joint end cap
    body:'M 6,37 Q 5,31 9,29 L 240,29 Q 246,29 249,31 L 249,43 Q 246,45 240,45 L 9,45 Q 5,43 6,37 Z',
    fill:'url(#ww-flute-grad)', stroke:'#b8a080',
    keys:[
      // [x,   y,  label, hand, isAux]
      [ 24, 55, 'Th',  'T', true ],   // 0  thumb B key (below tube)
      [ 41, 55, 'B♭',  'T', true ],   // 1  Bb lever (below tube)
      [ 67, 37, 'L1',  'L', false],   // 2  left index
      [ 85, 37, 'L2',  'L', false],   // 3  left middle
      [103, 37, 'L3',  'L', false],   // 4  left ring
      [117, 18, 'G♯',  'L', true ],   // 5  G♯ key (above tube)
      [130, 37, 'R1',  'R', false],   // 6  right index
      [148, 37, 'R2',  'R', false],   // 7  right middle
      [165, 37, 'R3',  'R', false],   // 8  right ring
      [186, 55, 'E♭',  'R', true ],   // 9  E♭/D♯ key (below tube)
      [202, 48, 'C',   'R', true ],   // 10 low C key (foot joint, upper)
      [202, 62, 'C♯',  'R', true ],   // 11 C♯ key (foot joint, lower)
    ],
    r:5.5, hR:6.3, smR:3.5,
  },
  clarinet: {
    w:120, h:270,
    body: 'M 52,6 L 46,6 Q 44,2 46,0 L 48,-2 Q 52,-4 54,0 L 56,6 L 56,22 Q 52,24 52,24 Z M 52,24 L 60,24 L 60,115 L 52,115 Z M 52,115 L 62,115 L 62,190 L 54,190 Z M 53,190 L 62,190 Q 66,210 72,235 L 38,235 Q 44,210 53,190 Z M 36,234 Q 30,238 28,244 L 82,244 Q 80,238 74,234 Z',
    fill:'url(#ww-clarinet-grad)', stroke:'#a09070',
    keys:[
      [30,34,'Reg','T',true],  // 0  register key (left thumb, above thumb hole)
      [54,58,'Th','T'],        // 1  thumb hole
      [54,78,'L1','L'],        // 2  left index
      [54,98,'L2','L'],        // 3  left middle
      [54,118,'L3','L'],       // 4  left ring
      [60,148,'R1','R'],       // 5  right index
      [60,168,'R2','R'],       // 6  right middle
      [60,188,'R3','R'],       // 7  right ring
      [72,208,'R4','R'],       // 8  right pinky
    ], r:5.2, hR:5.8,
  },
  sax: {
    w:160, h:280,
    body: 'M 62,8 Q 72,0 78,-2 L 82,-2 Q 86,0 84,4 Q 78,12 72,18 L 64,26 Q 60,30 60,36 L 60,55 L 68,55 L 68,38 Q 64,38 64,36 Z M 60,55 L 68,55 L 68,155 Q 68,175 56,195 Q 44,215 32,235 L 100,235 Q 92,218 82,202 Q 72,186 68,165 L 68,155 Z M 36,234 Q 30,238 28,244 L 104,244 Q 102,238 96,234 Z',
    fill:'url(#ww-sax-grad)', stroke:'#a09070',
    keys:[
      [55,58,'L1','L'],[55,80,'L2','L'],[55,102,'L3','L'],[46,122,'G♯','L'],
      [62,144,'R1','R'],[62,166,'R2','R'],[62,188,'R3','R'],[74,206,'C','R'],
      [88,155,'B♭','R'],[88,175,'C','R'],     // Side keys (right side)
      [38,42,'D','L'],[38,60,'E♭','L'],[38,78,'F','L'],  // Palm keys (left palm)
      [74,222,'B♭','R'],[74,238,'B','R'],    // Low pinky keys (right)
    ], r:5.5, hR:6,
  },
  oboe: {
    w:140, h:280,
    body: 'M 54,10 L 48,10 Q 46,4 48,2 L 50,0 Q 54,-2 56,2 L 58,10 L 58,28 Q 56,30 54,30 Z M 54,30 L 64,30 L 64,115 L 54,115 Z M 54,115 L 66,115 L 66,175 Q 62,186 56,195 L 50,204 L 78,204 L 72,195 Q 66,186 64,175 L 64,115 Z M 52,204 Q 48,208 46,214 L 82,214 Q 80,208 76,204 Z',
    fill:'url(#ww-oboe-grad)', stroke:'#a09070',
    keys:[
      [57,55,'L1','L'],[57,78,'L2','L'],[57,101,'L3','L'],[48,121,'L4','L'],
      [63,145,'R1','R'],[63,168,'R2','R'],[63,191,'R3','R'],[74,210,'R4','R'],
      [42,121,'F','L'],[78,155,'B♭','R'],[74,226,'B♭','R'],  // Left F, Side B♭, Low B♭
    ], r:5, hR:5.5,
  },
  bassoon: {
    w:150, h:280,
    body: 'M 46,10 Q 38,4 32,0 L 28,-2 L 98,-2 L 94,0 Q 88,4 80,10 L 80,115 Q 80,128 74,144 Q 68,160 62,172 L 56,182 L 60,188 L 66,178 Q 72,166 76,152 L 78,136 Q 82,142 86,136 L 86,115 Z M 30,-2 Q 26,-6 30,-8 L 96,-8 Q 100,-6 96,-2 Z M 78,6 L 84,-2 L 88,-6 L 84,-6 L 78,0 Z M 56,186 Q 52,194 50,200 L 70,200 Q 68,194 64,186 Z',
    fill:'url(#ww-bassoon-grad)', stroke:'#a09070',
    keys:[
      [52,52,'L1','L'],[52,76,'L2','L'],[52,100,'L3','L'],[44,122,'L4','L'],
      [60,148,'R1','R'],[60,172,'R2','R'],[60,196,'R3','R'],[72,218,'R4','R'],
    ], r:5, hR:5.5,
  },
};

function renderWoodwindDiagram(fingArr, type, altIndex = 0, noteName = '', regActive = false) {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');

  const pf = parseFing(fingArr, altIndex);
  fingArr = pf.fingArr; const fing = pf.fing;
  const pressed = pf.covered;

  // ── Yamaha-style simplified clarinet diagram ──────────────────
  if (type === 'clarinet') {
    const w = 110, h = 400;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('pointer-events', 'none');

    const CX = 72;       // main hole column center
    const LX = 22;       // side key column center
    const R = 9;         // main hole radius
    const SR = 5;        // small key radius
    const DY = 38;       // vertical spacing
    const Y0 = 50;       // first hole Y
    const lblStyle = 'font-family:var(--pauta-font-sans);font-size:7px;font-weight:600;fill:#555;text-anchor:start;pointer-events:none';

    // Main tone holes: Th (index 1), L1-L3 (2-4), R1-R4 (8-11)
    const MAIN_HOLES = [
      [1, 'Th', 0], [2, '1', 1], [3, '2', 2], [4, '3', 3],
    ];
    const RH_HOLES = [
      [8, '1', 0], [9, '2', 1], [10, '3', 2], [11, '4', 3],
    ];

    // Side keys: Reg(0), G#(7), Eb(5), C#(6)
    const SIDE_KEYS = [
      [0, 'Reg', 0, 'circle'],   // index, label, row offset, shape
      [7, 'G#', 1, 'circle'],
      [5, 'Eb', 6.3, 'rect'],
      [6, 'C#', 7.7, 'circle'],
    ];

    function drawHole(cx, cy, r, isCovered, shape) {
      if (shape === 'rect') {
        const el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', cx - 4); el.setAttribute('y', cy - 7);
        el.setAttribute('width', 8); el.setAttribute('height', 14);
        el.setAttribute('rx', 2);
        el.setAttribute('fill', isCovered ? (APP.playing ? '#ff5a4a' : '#222') : 'none');
        el.setAttribute('stroke', '#222');
        el.setAttribute('stroke-width', isCovered ? '0' : '1.5');
        svg.appendChild(el);
      } else {
        const el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r);
        el.setAttribute('fill', isCovered ? (APP.playing ? '#ff5a4a' : '#222') : 'none');
        el.setAttribute('stroke', '#222');
        el.setAttribute('stroke-width', isCovered ? '0' : '1.5');
        svg.appendChild(el);
      }
    }

    // Draw main LH holes
    MAIN_HOLES.forEach(([idx, label, row]) => {
      const cy = Y0 + row * DY;
      drawHole(CX, cy, R, pressed.has(idx));
      const lbl = document.createElementNS(ns, 'text');
      lbl.setAttribute('x', CX + R + 5); lbl.setAttribute('y', cy + 2.5);
      lbl.setAttribute('style', lblStyle);
      lbl.textContent = label;
      svg.appendChild(lbl);
    });

    // Separator between LH and RH
    const sepY = Y0 + 4 * DY + DY/2;
    const sep = document.createElementNS(ns, 'line');
    sep.setAttribute('x1', CX - R - 8); sep.setAttribute('y1', sepY);
    sep.setAttribute('x2', CX + R + 22); sep.setAttribute('y2', sepY);
    sep.setAttribute('stroke', '#999'); sep.setAttribute('stroke-width', '1');
    svg.appendChild(sep);

    // Draw RH holes
    RH_HOLES.forEach(([idx, label, row]) => {
      const cy = Y0 + (4 + 1 + row) * DY;
      drawHole(CX, cy, R, pressed.has(idx));
      const lbl = document.createElementNS(ns, 'text');
      lbl.setAttribute('x', CX + R + 5); lbl.setAttribute('y', cy + 2.5);
      lbl.setAttribute('style', lblStyle);
      lbl.textContent = label;
      svg.appendChild(lbl);
    });

    // Draw side keys
    SIDE_KEYS.forEach(([idx, label, rowOffset, shape]) => {
      const cy = Y0 + rowOffset * DY;
      const isCovered = idx === 0 ? regActive : pressed.has(idx);
      const r2 = shape === 'rect' ? 0 : SR;
      drawHole(LX, cy, idx === 0 ? 4 : r2, isCovered, shape);
      const lbl = document.createElementNS(ns, 'text');
      lbl.setAttribute('x', LX + (idx === 0 ? 4 : SR) + 4);
      lbl.setAttribute('y', cy + 2.5);
      lbl.setAttribute('style', lblStyle);
      lbl.textContent = label;
      svg.appendChild(lbl);
    });

    // "LH" / "RH" labels
    const lhLbl = document.createElementNS(ns, 'text');
    lhLbl.setAttribute('x', CX); lhLbl.setAttribute('y', Y0 - 14);
    lhLbl.setAttribute('style', 'font-family:var(--pauta-font-sans);font-size:6px;font-weight:700;fill:#999;text-anchor:middle;pointer-events:none');
    lhLbl.textContent = 'LH';
    svg.appendChild(lhLbl);
    const rhLbl = document.createElementNS(ns, 'text');
    rhLbl.setAttribute('x', CX); rhLbl.setAttribute('y', sepY + 14);
    rhLbl.setAttribute('style', 'font-family:var(--pauta-font-sans);font-size:6px;font-weight:700;fill:#999;text-anchor:middle;pointer-events:none');
    rhLbl.textContent = 'RH';
    svg.appendChild(rhLbl);

    // Note name
    diagNoteName(svg, noteName, w / 2, 16);

    // Alternate-fingering overlay
    diagAltOverlay(svg, 'woodwind', fingArr, altIndex, w, h, updateWoodwindDiagram,
      { tx: w - 6, ty: h - 6 });

    g.appendChild(svg);
    return g;
  }

  const spec = WOODWIND_SPEC[type] || WOODWIND_SPEC.clarinet;
  const {w, h, body:bodyD, fill, stroke:bodyStroke, keys, r, hR} = spec;
  const isFlute = type === 'flute';

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('pointer-events', 'none');

  // ── Gradient defs ─────────────────────────────────────────────
  const defs = document.createElementNS(ns, 'defs');
  const mkGrad = (id, stops) => {
    const g = document.createElementNS(ns, 'linearGradient');
    g.setAttribute('id', id); g.setAttribute('x1', '0%'); g.setAttribute('y1', '0%');
    g.setAttribute('x2', '100%'); g.setAttribute('y2', '0%');
    stops.forEach(([off, col]) => {
      const s = document.createElementNS(ns, 'stop');
      s.setAttribute('offset', off); s.setAttribute('stop-color', col);
      g.appendChild(s);
    });
    defs.appendChild(g);
  };
  mkGrad('ww-flute-grad',  [['0%','#e8ddd0'],['30%','#f5f0e8'],['50%','#e8ddd0'],['70%','#ddd0c0'],['100%','#c8b8a8']]);
  mkGrad('ww-clarinet-grad',[['0%','#d8c8b0'],['25%','#e8dcc8'],['50%','#d8c8b0'],['75%','#c8b8a0'],['100%','#b0a088']]);
  mkGrad('ww-sax-grad',    [['0%','#d0c0a8'],['30%','#e0d4c0'],['50%','#d0c0a8'],['70%','#c0b098'],['100%','#a89880']]);
  mkGrad('ww-oboe-grad',   [['0%','#c8b898'],['25%','#d8ccb8'],['50%','#c8b898'],['75%','#b8a888'],['100%','#a89878']]);
  mkGrad('ww-bassoon-grad',[['0%','#c0b090'],['25%','#d0c4a8'],['50%','#c0b090'],['75%','#b0a080'],['100%','#a09070']]);
  svg.appendChild(defs);

  // ── Register / Octave key ─────────────────────────────────────
  if (type === 'clarinet' || type === 'sax') {
    const [rx, ry] = type === 'clarinet' ? [46, 28] : [55, 34];
    const rR = 3.8;
    const regRing = document.createElementNS(ns, 'circle');
    regRing.setAttribute('cx', rx); regRing.setAttribute('cy', ry);
    regRing.setAttribute('r', rR);
    regRing.setAttribute('fill', regActive ? (APP.playing ? '#ff5a4a' : '#3a3028') : '#e8e0d4');
    regRing.setAttribute('stroke', '#998a70');
    regRing.setAttribute('stroke-width', '0.7');
    svg.appendChild(regRing);
    if (regActive) {
      diagHighlight(svg, rx, ry, rR, APP.playing);
    }
    const regLbl = document.createElementNS(ns, 'text');
    regLbl.setAttribute('x', rx); regLbl.setAttribute('y', ry + rR + 7);
    regLbl.setAttribute('style', 'font-family:var(--pauta-font-sans);font-size:7px;font-weight:700;fill:#8a7a60;text-anchor:middle;pointer-events:none');
    regLbl.textContent = type === 'clarinet' ? 'Reg' : 'Oct';
    svg.appendChild(regLbl);
  }

  // ── Keywork ───────────────────────────────────────────────────
  const halfHole = pf.halfHole;

  const regionBounds = {};
  const keyLabelStyle = 'font-family:var(--pauta-font-sans);font-size:7px;font-weight:700;fill:#8a7a60;text-anchor:middle;pointer-events:none';

  keys.forEach(([kx, ky, label, hand, isAux], i) => {
    const isP = pressed.has(i);
    const isH = halfHole.has(i);
    // Flute auxiliary keys (thumb levers + pinky pads) use a smaller radius
    // and render as lever pads rather than tone holes.
    const isFluteAux = isFlute && !!isAux;
    const baseR = isFluteAux ? (spec.smR || 3.5) : r;
    const ringR  = isFluteAux ? baseR + 0.7 : hR;

    if (!regionBounds[hand]) regionBounds[hand] = {minY: ky, maxY: ky};
    else {
      if (ky < regionBounds[hand].minY) regionBounds[hand].minY = ky;
      if (ky > regionBounds[hand].maxY) regionBounds[hand].maxY = ky;
    }

    // Connecting arm: flute aux keys to tube edge (thumb keys above, pinky keys below)
    if (isFluteAux) {
      const tubeEdgeY = ky < 37 ? 29 : 45;          // tube top / bottom
      const keyEdgeY  = ky < 37 ? ky + baseR : ky - baseR;
      const arm = document.createElementNS(ns, 'line');
      arm.setAttribute('x1', kx); arm.setAttribute('y1', keyEdgeY);
      arm.setAttribute('x2', kx); arm.setAttribute('y2', tubeEdgeY);
      arm.setAttribute('stroke', bodyStroke); arm.setAttribute('stroke-width', '0.7');
      svg.appendChild(arm);
    }

    // Outer key-cup ring — main tone holes only (aux keys have no cup ring)
    if (!isFluteAux) {
      const ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('cx', kx); ring.setAttribute('cy', ky);
      ring.setAttribute('r', isP ? baseR : ringR);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#998a70');
      ring.setAttribute('stroke-width', '1.1');
      svg.appendChild(ring);
    }

    if (isP) {
      // ── Pressed: dark pad ────────────────────────────────────
      const pad = document.createElementNS(ns, 'circle');
      pad.setAttribute('cx', kx); pad.setAttribute('cy', ky);
      pad.setAttribute('r', isFluteAux ? baseR * 0.85 : baseR * 0.78);
      pad.setAttribute('fill', APP.playing ? '#ff5a4a' : '#3a3028');
      pad.setAttribute('stroke', APP.playing ? '#e04030' : '#222');
      pad.setAttribute('stroke-width', isFluteAux ? '0.5' : '0.6');
      svg.appendChild(pad);
      if (!isFluteAux) diagHighlight(svg, kx, ky, baseR, APP.playing);
    } else if (isH && !isFluteAux) {
      // ── Half-hole (main tone holes only) ─────────────────────
      const hole = document.createElementNS(ns, 'circle');
      hole.setAttribute('cx', kx); hole.setAttribute('cy', ky);
      hole.setAttribute('r', baseR * 0.65);
      hole.setAttribute('fill', fill);
      hole.setAttribute('stroke', bodyStroke);
      hole.setAttribute('stroke-width', '0.5');
      svg.appendChild(hole);
      const innerHole = document.createElementNS(ns, 'circle');
      innerHole.setAttribute('cx', kx); innerHole.setAttribute('cy', ky);
      innerHole.setAttribute('r', baseR * 0.38);
      innerHole.setAttribute('fill', '#8a7a60');
      svg.appendChild(innerHole);
      diagHalfPad(svg, kx, ky, baseR * 0.65, APP.playing);
    } else if (isFluteAux) {
      // ── Open aux key: silver lever pad (not a tone hole) ─────
      const pad = document.createElementNS(ns, 'circle');
      pad.setAttribute('cx', kx); pad.setAttribute('cy', ky);
      pad.setAttribute('r', baseR);
      pad.setAttribute('fill', '#cec8c0');
      pad.setAttribute('stroke', '#998a70');
      pad.setAttribute('stroke-width', '0.8');
      svg.appendChild(pad);
    } else {
      // ── Open main tone hole ───────────────────────────────────
      const hole = document.createElementNS(ns, 'circle');
      hole.setAttribute('cx', kx); hole.setAttribute('cy', ky);
      hole.setAttribute('r', baseR * 0.65);
      hole.setAttribute('fill', fill);
      hole.setAttribute('stroke', bodyStroke);
      hole.setAttribute('stroke-width', '0.5');
      svg.appendChild(hole);
      const innerHole = document.createElementNS(ns, 'circle');
      innerHole.setAttribute('cx', kx); innerHole.setAttribute('cy', ky);
      innerHole.setAttribute('r', baseR * 0.38);
      innerHole.setAttribute('fill', '#8a7a60');
      svg.appendChild(innerHole);
    }

    // Key arm (vertical instruments — clarinet, sax, oboe, bassoon)
    if (!isFlute && hand !== 'T') {
      const cxLine = hand === 'L' ? (type==='bassoon'? 57 : 60) : (type==='bassoon'? 65 : 63);
      const arm = document.createElementNS(ns, 'line');
      arm.setAttribute('x1', kx); arm.setAttribute('y1', ky);
      arm.setAttribute('x2', cxLine); arm.setAttribute('y2', ky);
      arm.setAttribute('stroke', bodyStroke);
      arm.setAttribute('stroke-width', '0.5');
      arm.setAttribute('stroke-dasharray', '1.2,1.2');
      svg.appendChild(arm);
    }

    // ── Key label ─────────────────────────────────────────────
    const lbl = document.createElementNS(ns, 'text');
    lbl.setAttribute('x', kx);
    let lblY;
    if (isFluteAux && ky < 37) {
      lblY = ky + baseR + 3;    // thumb keys: label in gap between key and tube
    } else if (isFluteAux) {
      lblY = ky + baseR + 5;    // pinky keys: label below
    } else {
      lblY = isFlute ? ky + baseR + 8 : ky + baseR + 7;
    }
    lbl.setAttribute('y', lblY);
    lbl.setAttribute('style', keyLabelStyle);
    lbl.textContent = label;
    svg.appendChild(lbl);
  });

  // ── Note name ────────────────────────────────────────────────
  diagNoteName(svg, noteName, w / 2, isFlute ? 8 : 12);

  // ── Alternate-fingering click overlay ─────────────────────────
  diagAltOverlay(svg, 'woodwind', fingArr, altIndex, w, h, updateWoodwindDiagram,
    isFlute ? {} : { tx: w - 6, ty: h - 6 });

  g.appendChild(svg);
  return g;
}

// ── Brass Diagram ─────────────────────────────────────────────────
// Improved valve indicators with metallic cup visuals, body silhouettes,
// note name display, and alternate fingering cycling.
// fingArr: array of valve strings (or single string), or slide position '1'-'7'
// type: 'trumpet', 'horn', 'trombone', 'euphonium', 'tuba'
function renderBrassDiagram(fingArr, type, altIndex = 0, noteName = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');

  const pf = parseFing(fingArr, altIndex);
  fingArr = pf.fingArr; const fing = pf.fing;

  const isTrombone = type === 'trombone';
  const isHorn = type === 'horn';
  const has4Valves = isHorn;
  const nValves = has4Valves ? 4 : 3;

  const w = isTrombone ? 200 : 110;
  const h = isTrombone ? 80 : 190;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', w); svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('pointer-events', 'none');

  // ── Gradient defs ─────────────────────────────────────────────
  const defs = document.createElementNS(ns, 'defs');
  const mkGrad = (id, stops, x2='100%') => {
    const g = document.createElementNS(ns, 'linearGradient');
    g.setAttribute('id', id); g.setAttribute('x1', '0%'); g.setAttribute('y1', '0%');
    g.setAttribute('x2', x2); g.setAttribute('y2', '0%');
    stops.forEach(([off, col]) => {
      const s = document.createElementNS(ns, 'stop');
      s.setAttribute('offset', off); s.setAttribute('stop-color', col);
      g.appendChild(s);
    });
    defs.appendChild(g);
  };
  mkGrad('brass-tube-grad', [['0%','#d4c4a8'],['20%','#f0e8d8'],['50%','#e0d4c0'],['80%','#d0c4a8'],['100%','#c0b090']]);
  mkGrad('brass-bell-grad',  [['0%','#c8b898'],['30%','#e8dcc8'],['70%','#d8ccb8'],['100%','#b8a888']]);
  svg.appendChild(defs);

  // ── Note name ──────────────────────────────────────────────
  diagNoteName(svg, noteName, w / 2, isTrombone ? 14 : 18, { size: isTrombone ? '9' : '10' });

  if (isTrombone) {
    // Trombone: horizontal slide positions 1-7
    const slidePos = parseInt(fing) || 1;
    const startX = 16;
    const endX = w - 16;
    const spacing = (endX - startX) / 6;
    const cy = 40;

    // Position markers
    for (let i = 1; i <= 7; i++) {
      const x = startX + (i - 1) * spacing;
      const isActive = i === slidePos;

      // Outer ring
      const outer = document.createElementNS(ns, 'circle');
      outer.setAttribute('cx', x); outer.setAttribute('cy', cy);
      outer.setAttribute('r', isActive ? 11 : 8);
      outer.setAttribute('fill', 'none');
      outer.setAttribute('stroke', isActive ? (APP.playing ? '#e04030' : 'var(--pauta-primary)') : '#d0c8b8');
      outer.setAttribute('stroke-width', isActive ? 2 : 1);
      svg.appendChild(outer);

      // Main circle
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', x); circle.setAttribute('cy', cy);
      circle.setAttribute('r', isActive ? 9 : 6);
      circle.setAttribute('fill', isActive ? (APP.playing ? '#ff5a4a' : 'var(--pauta-primary)') : '#fff');
      circle.setAttribute('stroke', isActive ? (APP.playing ? '#e04030' : 'var(--pauta-primary)') : '#d0c8b8');
      circle.setAttribute('stroke-width', isActive ? 2 : 1.5);
      svg.appendChild(circle);

      // Metallic highlight
      if (isActive) {
        diagHighlight(svg, x, cy, 9, APP.playing);
      }

      // Position number
      const num = document.createElementNS(ns, 'text');
      num.setAttribute('x', x); num.setAttribute('y', cy + 3);
      num.setAttribute('text-anchor', 'middle');
      num.setAttribute('font-size', isActive ? '10' : '9');
      num.setAttribute('font-weight', isActive ? '700' : '500');
      num.setAttribute('fill', isActive ? '#fff' : '#888');
      num.setAttribute('font-family', 'var(--pauta-font-sans)');
      num.textContent = String(i);
      svg.appendChild(num);
    }

  } else {
    // Valve instruments: vertical column of metallic valve buttons
    const pressed = new Set();
    for (let i = 0; i < fing.length; i++) {
      if (fing[i] === '1') pressed.add(i);
    }

    const circleR = 16;
    const spacing = 40;
    const startX = w / 2;
    const startY = 35;

    for (let vi = 0; vi < nValves; vi++) {
      const cy = startY + vi * spacing;
      let valveNum, valveLabel, isP;

      if (isHorn && has4Valves) {
        if (vi < 3) {
          valveNum = 3 - vi;
          valveLabel = String(valveNum);
          isP = pressed.has(valveNum - 1);
        } else {
          valveNum = 4;
          valveLabel = 'T';
          isP = pressed.has(3);
        }
      } else {
        valveNum = nValves - vi;
        valveLabel = String(valveNum);
        isP = pressed.has(valveNum - 1);
      }

      // Outer ring (shadow)
      const outer = document.createElementNS(ns, 'circle');
      outer.setAttribute('cx', startX); outer.setAttribute('cy', cy);
      outer.setAttribute('r', circleR + 2);
      outer.setAttribute('fill', 'none');
      outer.setAttribute('stroke', isP ? (APP.playing ? '#ff5a4a' : 'var(--pauta-primary)') : '#e0d8c8');
      outer.setAttribute('stroke-width', isP ? 2 : 1);
      svg.appendChild(outer);

      // Main cup circle
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', startX); circle.setAttribute('cy', cy);
      circle.setAttribute('r', circleR);
      circle.setAttribute('fill', isP ? (APP.playing ? '#ff5a4a' : 'var(--pauta-primary)') : '#fff');
      circle.setAttribute('stroke', isP ? (APP.playing ? '#e04030' : 'var(--pauta-primary)') : '#d0c8b8');
      circle.setAttribute('stroke-width', 1.5);
      svg.appendChild(circle);

      // Inner cup ring (metallic)
      const inner = document.createElementNS(ns, 'circle');
      inner.setAttribute('cx', startX); inner.setAttribute('cy', cy);
      inner.setAttribute('r', circleR * 0.7);
      inner.setAttribute('fill', 'none');
      inner.setAttribute('stroke', isP ? (APP.playing ? '#e04030' : '#a04520') : '#c8c0b8');
      inner.setAttribute('stroke-width', '0.8');
      svg.appendChild(inner);

      // 3D highlight
      const hi = document.createElementNS(ns, 'circle');
      hi.setAttribute('cx', startX - 3); hi.setAttribute('cy', cy - 3);
      hi.setAttribute('r', circleR * 0.3);
      hi.setAttribute('fill', isP ? (APP.playing ? 'rgba(255,90,74,0.4)' : 'rgba(255,255,255,0.25)') : 'rgba(255,255,255,0.35)');
      hi.setAttribute('stroke', 'none');
      svg.appendChild(hi);

      // Valve number
      const num = document.createElementNS(ns, 'text');
      num.setAttribute('x', startX); num.setAttribute('y', cy + 4);
      num.setAttribute('text-anchor', 'middle');
      num.setAttribute('font-size', '12');
      num.setAttribute('font-weight', '700');
      num.setAttribute('fill', isP ? '#fff' : '#888');
      num.setAttribute('font-family', 'var(--pauta-font-sans)');
      num.textContent = valveLabel;
      svg.appendChild(num);
    }
  }

  // ── Alternate-fingering click overlay ──────────────────────
  diagAltOverlay(svg, 'brass', fingArr, altIndex, w, h, updateBrassDiagram);

  g.appendChild(svg);
  return g;
}

// ── Large-stave Notehead Post-processing ─────────────────────────
// Handles both Boomwhacker and Beginning Recorder noteheads.
// Uses position-primary matching: iterates over known note positions
// and finds the nearest suitable path by geometry (not colour), so it
// is robust against VexFlow changing how it paints fills.
function renderBWNoteheads() {
  const svgEl = document.getElementById('score-svg').querySelector('svg');
  if (!svgEl || !APP.score) return;

  // Build lookup sets: which global SIs are BW / BR?
  const bwSIs = new Set(), brSIs = new Set();
  let gsi = 0;
  APP.score.parts.forEach(part => {
    const instr = instrByName(part.instrument || part.name);
    part.staves.forEach((_, s) => {
      if (instr?.boomwhacker)      bwSIs.add(gsi + s);
      if (instr?.beginnerRecorder) brSIs.add(gsi + s);
      gsi++;
    });
  });
  if (bwSIs.size === 0 && brSIs.size === 0) return;

  const bwNotes = APP.noteLayout.filter(nl => bwSIs.has(nl.si));
  const brNotes = APP.noteLayout.filter(nl => brSIs.has(nl.si));
  if (bwNotes.length === 0 && brNotes.length === 0) return;

  const HIT_RADIUS = 22;

  // Build a cached array of eligible paths with their bounding boxes once.
  // An eligible path is one whose bounding box looks like a notehead:
  //   • width  ≥ 4 px   (filters out hairlines)
  //   • height ≥ 3 px   (filters out horizontal ledger lines)
  //   • aspect ratio ≤ 3  (filters out long stems / barlines)
  const eligiblePaths = [];
  svgEl.querySelectorAll('path').forEach(path => {
    let bbox;
    try { bbox = path.getBBox(); } catch(e) { console.warn('[Pauta]', e.message); return; }
    if (bbox.width < 4 || bbox.height < 3) return;
    if (bbox.width / bbox.height > 3 || bbox.height / bbox.width > 3) return;
    eligiblePaths.push({
      path,
      cx: bbox.x + bbox.width  / 2,
      cy: bbox.y + bbox.height / 2,
    });
  });

  // For each note position find the closest eligible path and style it.
  const claimedPaths = new Set();

  function styleNearest(noteList, styleFn) {
    noteList.forEach(nl => {
      const m = getMeasureBySI(nl.si, nl.mi);
      const n = m?.notes[nl.ni];
      if (!n || n.type !== 'note') return;

      let best = null, bestDist = HIT_RADIUS;
      eligiblePaths.forEach(ep => {
        if (claimedPaths.has(ep.path)) return;
        const d = Math.hypot(ep.cx - nl.x, ep.cy - nl.y);
        if (d < bestDist) { bestDist = d; best = ep; }
      });
      if (!best) return;
      claimedPaths.add(best.path);
      styleFn(best.path, best.cx, best.cy, n);
    });
  }

  // Boomwhacker: add black outline + 10% scale
  styleNearest(bwNotes, (path, cx, cy) => {
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('transform', `translate(${cx},${cy}) scale(1.1) translate(${-cx},${-cy})`);
  });

  // Beginner Recorder: 10% scale only
  styleNearest(brNotes, (path, cx, cy) => {
    path.setAttribute('transform', `translate(${cx},${cy}) scale(1.1) translate(${-cx},${-cy})`);
  });
}

// Resolve the correct diatonic letter for a note, respecting accidental and key signature
function noteLetter(n, ks) {
  const pc = n.pitch % 12;
  const acc = n.accidental;
  if (acc === 'b') return NOTE_NAMES[PC_TO_DIA[(pc + 1) % 12]].toUpperCase();
  if (acc === '#') return NOTE_NAMES[PC_TO_DIA[(pc + 11) % 12]].toUpperCase();
  if (acc === 'n') return NOTE_NAMES[PC_TO_DIA[pc]].toUpperCase();
  if (ks < 0 && !DIATONIC_PCS.has(pc)) {
    return NOTE_NAMES[PC_TO_DIA[(pc + 1) % 12]].toUpperCase();
  }
  if (ks > 0 && !DIATONIC_PCS.has(pc)) {
    return NOTE_NAMES[PC_TO_DIA[(pc + 11) % 12]].toUpperCase();
  }
  return NOTE_NAMES[PC_TO_DIA[pc]].toUpperCase();
}

// ── Assign rendering functions to RENDER namespace ─────────
[renderScore, scrollToSelectedMeasure, renderSelection,
 positionAllDiagrams, updateRecorderDiagram, updateWoodwindDiagram,
 updateBrassDiagram, _runBootSelfCheck
].forEach(fn => { RENDER[fn.name] = fn; });

// ═══════════════════════════════════════════════════════════════════
// MODULE 5: Input & Controls
// ═══════════════════════════════════════════════════════════════════
