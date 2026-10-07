// ── Loads the REAL Pauta model from src/ for tests ──────────────
//
// The app ships as one concatenated script (see build.js). globals.js
// opens an IIFE at its line 3 that does not close until ui.js, so the
// model modules and the UI share a single scope in production.
//
// We reproduce that scope exactly: wrap globals + theory + instruments
// + notation in an IIFE, close it ourselves, and export the model
// surface. Tests then exercise the same code the browser runs instead
// of a hand-copied mirror that silently drifts.
//
// Rendering/UI/playback are deliberately excluded — they need VexFlow,
// AudioContext and a real layout engine, and they carry no score-model
// logic worth unit testing.

import { Window } from 'happy-dom';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Order matters: these files depend on each other via the shared scope.
const MODEL_MODULES = ['globals.js', 'theory.js', 'instruments.js', 'notation.js'];

/**
 * Evaluate the real model modules and return their internals.
 * @returns {{SCORE:Object, APP:Object, THEORY:Object, INSTRUMENTS:Array,
 *            SCORE_MEASURE_REF_RULES:Array, SCORE_STAFF_REF_KEYS:string[],
 *            VALID_DURATIONS:Set, KIT_CONFIGS:Object,
 *            instrByName:Function, DOMParser:Function}}
 */
export function loadModel() {
  const dom = new Window();
  const source = MODEL_MODULES
    .map(name => readFileSync(join(__dirname, 'src', name), 'utf8'))
    .join('\n');

  // globals.js leaves its IIFE open, so appending lands inside the same
  // scope the later modules use. One closing brace balances the file.
  const wrapped = `${source}
window.__PAUTA_MODEL__ = {
  SCORE, APP, THEORY, INSTRUMENTS,
  SCORE_MEASURE_REF_RULES, SCORE_STAFF_REF_KEYS, VALID_DURATIONS, KIT_CONFIGS,
  SCORE_FORMAT_VERSION, MSCX_TO_VEX, VEX_TO_MSCX,
  // Internals exported for unit testing. Tests should reach for these
  // instead of re-implementing them — that is how the suite drifted.
  instrByName, getStaveBySI, getMeasureBySI, resolvedTimeSig, keySigName,
  durBeats, findBestDuration, beatsUsed, midiToVexKey,
  getMeasureActiveAccidentals, getResolvedKeySig,
  shiftMeasureRefs, _repairNote, _repairMeasure, _syncMeasureCounts,
  _ensureScoreAnnotationArrays, _syncScoreWideFlags,
  _nextPartName, _partIndexForSI, _firstSIOfPart, _shiftStaffRefs,
  _require, _kitInstrumentList,
};
})();`;

  const sandbox = {
    console,
    window: {},
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    DOMParser: makeXMLDOMParser(),
    XMLSerializer: dom.XMLSerializer,
    setTimeout, clearTimeout, Blob, URL,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox.window;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(wrapped, ctx, { filename: 'pauta-model.js' });

  const model = sandbox.window.__PAUTA_MODEL__;
  if (!model) throw new Error('test-harness: model failed to initialise');
  model.DOMParser = dom.DOMParser;
  return model;
}

/** Minimal score harness — a real APP.state reset between tests. */
export function freshAPP() {
  return {
    selectedMeasure: -1,
    selectedStaff: 0,
    selectedNoteIdx: -1,
    selStartIdx: -1,
    inputMode: false,
    chordMode: false,
    markingMode: false,
    exerciseMode: false,
    assignmentMode: false,
    practiceMode: false,
    teachingKit: null,
    teachingKitLevel: 'advanced',
    undoStack: [],
    redoStack: [],
    _lastUndoFP: '',
    score: null,
  };
}

// ── Full application loader ──────────────────────────────────────
//
// loadModel() covers the score model only. The education layer
// (exercise generation, mode guards, undo snapshots) lives in modules
// that need the real page DOM, so loadApp() builds the document from
// src/index.html and evaluates every module in build.js order.
//
// Rendering and audio still cannot run here — there is no VexFlow and no
// AudioContext — but module-level init does run, so any function that
// only touches the DOM or plain objects is genuinely exercised.

export const APP_MODULES = [
  'globals.js', 'theory.js', 'instruments.js', 'notation.js', 'rendering.js', 'input.js',
  'education/exercises.js', 'education/session.js', 'education/kit.js', 'playback.js', 'ui.js',
];

// Names the education tests need. Listed explicitly rather than scraped so
// that a rename in src/ fails the suite instead of silently yielding
// undefined — that silent case is exactly how the mirror drifted.
const APP_EXPORT_NAMES = [
  'APP', 'SCORE', 'AUDIO', 'UI', 'THEORY', 'INSTRUMENTS', 'MODE_RULES', 'KIT_CONFIGS',
  'VALID_DURATIONS', 'NOTE_NAMES', 'CHROMATIC', 'PC_TO_DIA', 'DUR_BEATS',
  'SCORE_MEASURE_REF_RULES', 'SCORE_STAFF_REF_KEYS',
  'EXERCISE_TYPES', 'INTERVAL_NAMES', 'INTERVAL_ALIASES',
  'KEY_SIG_NAMES', 'KEY_SIG_MINOR_NAMES', 'NATURAL_PITCHES',
  'durBeats', '_require', '_validateModeState',
  'pushUndo', 'undo', 'redo',
  '_scoreFingerprint', '_snapshotUIState', '_restoreUIState', '_uiFingerprint',
  '_ensureScoreAnnotationArrays', '_checkInvariants',
  '_intervalMatches', '_kitExerciseRange', '_kitExerciseKeys',
  'generateExercise', '_genNoteId', '_genIntervalId', '_genRhythmRead',
  '_genRhythmWorksheet', '_genMelodyDict', '_genKeySigId',
  '_renderRhythmBeatGrid', 'checkRhythmWorksheet',
  '_renderRhythmCounting', 'getNoteByLayout',
  'applyMarker', 'clearMarker', 'toggleLineBreak',
  'buildPlaybackOrder', 'renderVoltaBrackets', 'yToPitchAccurate',
];

/**
 * Evaluate every module from src/ against the real page DOM.
 * @returns {Object} the exported app surface (see APP_EXPORT_NAMES)
 */
export function loadApp() {
  const dom = new Window({ url: 'http://localhost/' });
  const template = readFileSync(join(__dirname, 'src', 'index.html'), 'utf8')
    .replace('<!-- CSS_INJECT -->', '')
    .replace('<!-- JS_INJECT -->', '');
  dom.document.write(template);
  dom.document.close();

  let source = APP_MODULES
    .map(name => `\n// ─── ${name} ───\n` + readFileSync(join(__dirname, 'src', name), 'utf8'))
    .join('\n');

  // ui.js closes the IIFE that globals.js opened, so the export list has to
  // be spliced in just before that close rather than appended.
  const closeRe = /\}\)\(\);\s*$/;
  if (!closeRe.test(source)) {
    throw new Error('test-harness: expected ui.js to close the IIFE with "})();"');
  }
  source = source.replace(closeRe, '');
  source += `\nwindow.__PAUTA_APP__ = { ${APP_EXPORT_NAMES.join(', ')} };\n})();`;

  const sandbox = {
    console,
    window: dom.window,
    document: dom.document,
    navigator: dom.navigator,
    localStorage: dom.localStorage,
    Node: dom.Node,
    HTMLElement: dom.HTMLElement,
    getComputedStyle: dom.getComputedStyle,
    DOMParser: makeXMLDOMParser(),
    XMLSerializer: dom.XMLSerializer,
    Event: dom.Event,
    CustomEvent: dom.CustomEvent,
    setTimeout, clearTimeout, setInterval, clearInterval, Blob, URL,
    structuredClone,
    requestAnimationFrame: cb => setTimeout(cb, 0),
    cancelAnimationFrame: id => clearTimeout(id),
  };
  sandbox.globalThis = sandbox;
  sandbox.self = dom.window;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(source, ctx, { filename: 'pauta-app.js' });

  const app = dom.window.__PAUTA_APP__;
  if (!app) throw new Error('test-harness: app failed to initialise');

  // Surface a missing/renamed export rather than letting a test call
  // undefined and fail somewhere unrelated.
  const missing = APP_EXPORT_NAMES.filter(n => app[n] === undefined);
  if (missing.length) {
    throw new Error(`test-harness: expected export(s) not found in src/: ${missing.join(', ')}`);
  }
  app.window = dom.window;
  app.document = dom.document;
  app._dom = dom;
  return app;
}

// ── Case-preserving XML DOMParser stand-in ──────────────────────
//
// happy-dom normalises XML case (localName lowercased, tagName
// uppercased). Browsers preserve the source case for XML documents,
// and parseMSCX compares el.localName against capitalised names
// ('Chord', 'Rest', 'Measure'). Substituting happy-dom's parser made
// every import test silently see a score of rests, which is why this
// suite used to carry its own parser.
//
// This shim provides exactly the surface parseMSCX and parseMusicXML
// touch: querySelector / querySelectorAll / localName / tagName /
// children / childNodes / parentNode / getAttribute / textContent /
// firstChild / documentElement. parseMSCX reaches the root with
// querySelector, parseMusicXML reads documentElement, so a document
// without the latter made every MusicXML import throw.
// Tag matching is case-sensitive, as in a browser XML document.
class XNode {
  constructor(tag, attrs, children, text) {
    this.tagName = tag;
    this.nodeName = tag;
    this.localName = tag;               // case preserved: no namespace prefix
    this._attrs = attrs;
    this._children = children;
    this._text = text || '';
    this.parentNode = null;
    this.nodeType = 1;
    this.children = this._children.filter(c => c.nodeType === 1);
    this.childNodes = this._children;
    this._children.forEach(c => { c.parentNode = this; });
  }
  get firstChild() { return this._children[0] || null; }
  getAttribute(k) { return this._attrs[k] ?? null; }
  get textContent() {
    if (this._children.length) return this._children.map(c => c.textContent).join('');
    return this._text;
  }
  _descendants(out = []) {
    for (const c of this.children) { out.push(c); c._descendants(out); }
    return out;
  }
  getElementsByTagName(tag) {
    return this._descendants().filter(e => e.tagName === tag || e.localName === tag);
  }
  querySelectorAll(sel) {
    const d = this._descendants();
    return sel === '*' ? d : d.filter(e => e.tagName === sel || e.localName === sel);
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

class XText {
  constructor(t) { this._text = t; this.nodeType = 3; this.parentNode = null; }
  get textContent() { return this._text; }
}

function parseXMLPreservingCase(str) {
  let i = 0;
  const decode = t => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
                      .replace(/&amp;/g, '&');
  const readUntil = ch => { const s = i; const j = str.indexOf(ch, i); return j === -1 ? [str.slice(s), str.length] : [str.slice(s, j), j]; };
  const readName = () => { const s = i; while (i < str.length && /[a-zA-Z0-9_:.\-]/.test(str[i])) i++; return str.slice(s, i); };
  const ws = () => { while (i < str.length && /\s/.test(str[i])) i++; };

  function parse() {
    const nodes = [];
    while (i < str.length) {
      if (str[i] === '<') {
        if (str.startsWith('<?', i))    { i = str.indexOf('?>', i) + 2; continue; }
        if (str.startsWith('<!--', i))  { i = str.indexOf('-->', i) + 3; continue; }
        if (str.startsWith('<![CDATA[', i)) { const j = str.indexOf(']]>', i); nodes.push(new XText(str.slice(i + 9, j))); i = j + 3; continue; }
        if (str.startsWith('<!', i))    { i = str.indexOf('>', i) + 1; continue; }
        if (str[i + 1] === '/') break;
        i++; ws();
        const tag = readName();
        if (!tag) { i++; continue; }
        ws();
        const attrs = {};
        while (i < str.length && str[i] !== '>' && str[i] !== '/') {
          const k = readName();
          if (!k) break;
          ws();
          if (str[i] === '=') {
            i++; ws();
            if (str[i] === '"' || str[i] === "'") { const q = str[i]; i++; const [v, j] = readUntil(q); attrs[k] = decode(v); i = j + 1; }
            else { const [v, j] = readUntil('>'); attrs[k] = decode(v); i = j; }
          } else attrs[k] = '';
          ws();
        }
        if (str[i] === '/') { i++; ws(); if (str[i] === '>') i++; nodes.push(new XNode(tag, attrs, [])); continue; }
        i++;                                  // consume '>'
        const children = parse();
        ws(); i += 2 + tag.length;            // consume '</tag>'
        nodes.push(new XNode(tag, attrs, children));
      } else {
        const [t, j] = readUntil('<');
        if (t) nodes.push(new XText(decode(t)));
        i = j;
      }
    }
    return nodes;
  }
  return parse().find(n => n.nodeType === 1) || null;
}

/** DOMParser replacement that preserves XML element-name case. */
export function makeXMLDOMParser() {
  return class XMLDOMParser {
    parseFromString(str, _mime) {
      const root = parseXMLPreservingCase(str);
      if (!root) throw new Error('Invalid XML');
      // Document node: same query surface, but firstChild is the root element.
      const doc = {
        nodeType: 9,
        children: [root],
        childNodes: [root],
        firstChild: root,
        documentElement: root,
        _text: '',
        get textContent() { return root ? root.textContent : ''; },
        _descendants: () => root._descendants(),
        getElementsByTagName: (tag) => root.getElementsByTagName(tag),
        querySelectorAll: (sel) => root.querySelectorAll(sel),
        querySelector: (sel) => root.querySelector(sel),
      };
      root.parentNode = doc;
      return doc;
    }
  };
}