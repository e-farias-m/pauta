// ── Unit tests for Pauta score model (pure functions) ──────────
// Run: node test-score-model.js

let _pass = 0, _fail = 0;
function assert(cond, msg) { if (cond) { _pass++; } else { _fail++; console.error('FAIL:', msg); } }
function assertEq(a, b, msg) { assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Extract constants & functions from pauta.html ──────────────
const NOTE_NAMES   = ['c','d','e','f','g','a','b'];
const CHROMATIC    = [0,2,4,5,7,9,11];
const PC_TO_DIA    = [0,0,1,1,2,3,3,4,4,5,5,6];
const KEY_NAMES    = ['C','G','D','A','E','B','F#','C#'];
const KEY_FLATS    = ['F','Bb','Eb','Ab','Db','Gb','Cb'];
const DUR_BEATS    = {w:4,h:2,q:1,'8':0.5,'16':0.25,'32':0.125,'64':0.0625};

function keySigName(ks) {
  if (ks === 0) return 'C';
  if (ks > 0)   return KEY_NAMES[Math.min(ks,7)] || 'C';
  return KEY_FLATS[Math.min(-ks,7)-1] || 'F';
}

function midiToVexKey(midi, acc) {
  const oct = Math.floor(midi / 12) - 1;
  const pc  = midi % 12;
  const dia = PC_TO_DIA[pc];
  const name = NOTE_NAMES[dia];
  if (acc === '#') return `${name}#/${oct}`;
  if (acc === 'b') return `${name}b/${oct}`;
  if (![0,2,4,5,7,9,11].includes(pc)) return `${name}#/${oct}`;
  return `${name}/${oct}`;
}

function durBeats(dur, dots, tuplet) {
  let v = DUR_BEATS[dur] || 1;
  if (dots) v *= 1.5;
  if (tuplet) v = v * tuplet.den / tuplet.num;
  return v;
}

function findBestDuration(beats) {
  const CANDIDATES = [
    {dur:'w', dots:0, beats:4},
    {dur:'h', dots:1, beats:3},
    {dur:'h', dots:0, beats:2},
    {dur:'q', dots:1, beats:1.5},
    {dur:'q', dots:0, beats:1},
    {dur:'8', dots:1, beats:0.75},
    {dur:'8', dots:0, beats:0.5},
    {dur:'16', dots:1, beats:0.375},
    {dur:'16', dots:0, beats:0.25},
    {dur:'32', dots:1, beats:0.1875},
    {dur:'32', dots:0, beats:0.125},
    {dur:'64', dots:1, beats:0.09375},
    {dur:'64', dots:0, beats:0.0625},
  ];
  for (const c of CANDIDATES) {
    if (c.beats <= beats + 0.001) return c;
  }
  return null;
}

function beatsUsed(notes) {
  return notes.reduce((s, n) => s + durBeats(n.duration, n.dots, n.tuplet), 0);
}

const SCORE_FORMAT_VERSION = 1;
const VALID_DURATIONS = new Set(['w', 'h', 'q', '8', '16', '32', '64']);
const SCORE_MEASURE_REF_RULES = [
  { key: 'voltas',         range: true,  start: 'startMi', end: 'endMi' },
  { key: 'slurs',          range: true,  start: 'startMi', end: 'endMi' },
  { key: 'hairpins',       range: true,  start: 'startMi', end: 'endMi' },
  { key: 'ottavas',        range: true,  start: 'startMi', end: 'endMi' },
  { key: 'glissandos',     range: true,  start: 'startMi', end: 'endMi' },
  { key: 'rehearsalMarks', range: false, field: 'mi' },
  { key: 'staffTexts',     range: false, field: 'mi' },
];

function mkNote(pitch, dur, dots=0, acc=null, voice=1) {
  return {type:'note', pitch, duration:dur, dots, accidental:acc, voice};
}
function mkRest(dur, dots=0, voice=1) {
  return {type:'rest', duration:dur, dots, voice};
}
function emptyMeasure() {
  return {timeSigNum:null, timeSigDen:null, keySig:null, lineBreak:false, notes:[mkRest('w')]};
}

const INSTRUMENTS = [
  {name:'Piano', family:'Keyboards', staves:['treble','bass'], osc:'piano'},
];
function instrByName(name) {
  return INSTRUMENTS.find(i => i.name === name) || INSTRUMENTS[0];
}

function createScore(opts={}) {
  const ts = opts.ts || {num:4,den:4};
  const ks = opts.ks || 0;
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
          slurs:[], hairpins:[], rehearsalMarks:[], staffTexts:[], voltas:[], ottavas:[], glissandos:[], parts};
}

function _ensureScoreAnnotationArrays(score) {
  for (const rule of SCORE_MEASURE_REF_RULES) {
    if (!Array.isArray(score[rule.key])) score[rule.key] = [];
  }
  return score;
}

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

function _repairMeasure(m) {
  if (!m || typeof m !== 'object') return emptyMeasure();
  if (!Array.isArray(m.notes) || !m.notes.length) m.notes = [mkRest('w')];
  else m.notes = m.notes.map(n => _repairNote(n, n?.voice || 1));
  if (m.lineBreak !== true) m.lineBreak = false;
  return m;
}

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
    if (!part.osc) part.osc = instrByName(part.instrument).osc;
    part.staves.forEach(stave => {
      if (!stave.clef) stave.clef = 'treble';
      if (!Array.isArray(stave.measures)) stave.measures = [];
      while (stave.measures.length < maxM) stave.measures.push(emptyMeasure());
      stave.measures = stave.measures.map(_repairMeasure);
    });
  });
  return maxM;
}

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

// ── Tests ──────────────────────────────────────────────────────

// keySigName
assertEq(keySigName(0), 'C', 'keySigName(0)');
assertEq(keySigName(1), 'G', 'keySigName(1)');
assertEq(keySigName(2), 'D', 'keySigName(2)');
assertEq(keySigName(-1), 'F', 'keySigName(-1)');
assertEq(keySigName(-2), 'Bb', 'keySigName(-2)');
assertEq(keySigName(-3), 'Eb', 'keySigName(-3)');

// midiToVexKey
assertEq(midiToVexKey(60, null), 'c/4', 'midiToVexKey C4');
assertEq(midiToVexKey(61, '#'), 'c#/4', 'midiToVexKey C#4');
assertEq(midiToVexKey(69, null), 'a/4', 'midiToVexKey A4');

// durBeats
assertEq(durBeats('w', 0), 4, 'durBeats whole');
assertEq(durBeats('h', 0), 2, 'durBeats half');
assertEq(durBeats('q', 0), 1, 'durBeats quarter');
assertEq(durBeats('8', 0), 0.5, 'durBeats eighth');
assertEq(durBeats('q', 1), 1.5, 'durBeats quarter dotted');
assertEq(durBeats('h', 1), 3, 'durBeats half dotted');
assertEq(durBeats('q', 0, {num:3, den:2}), 2/3, 'durBeats triplet');

// findBestDuration
assertEq(findBestDuration(4).dur, 'w', 'findBest 4 beats');
assertEq(findBestDuration(3).dur, 'h', 'findBest 3 beats');
assertEq(findBestDuration(2).dur, 'h', 'findBest 2 beats');
assertEq(findBestDuration(1).dur, 'q', 'findBest 1 beat');
assertEq(findBestDuration(0.5).dur, '8', 'findBest 0.5 beats');
assertEq(findBestDuration(0.25).dur, '16', 'findBest 0.25 beats');
assert(findBestDuration(0.01) === null, 'findBest too small');

// beatsUsed
assertEq(beatsUsed([mkRest('q'), mkRest('q')]), 2, 'beatsUsed 2 quarters');
assertEq(beatsUsed([mkRest('w')]), 4, 'beatsUsed whole');
assertEq(beatsUsed([mkRest('h', 1)]), 3, 'beatsUsed dotted half');

// createScore
const s1 = createScore();
assertEq(s1.title, 'Untitled Score', 'createScore default title');
assertEq(s1.scoreVersion, SCORE_FORMAT_VERSION, 'createScore version');
assertEq(s1.parts.length, 1, 'createScore 1 part');
assertEq(s1.parts[0].staves.length, 2, 'createScore piano 2 staves');
assertEq(s1.slurs.length, 0, 'createScore empty slurs');

const s2 = createScore({instruments: ['Piano'], ts: {num:3, den:4}});
assertEq(s2.parts[0].staves[0].measures[0].timeSigNum, 3, 'createScore 3/4');

// repairScore
const broken = {title: '', parts: []};
const repaired = repairScore(broken);
assertEq(repaired.title, 'Untitled Score', 'repairScore fixes empty title');
assert(repaired.parts.length > 0, 'repairScore adds parts');

const withBadNote = createScore();
withBadNote.parts[0].staves[0].measures[0].notes = [{type:'note', pitch: 999, duration:'x'}];
repairScore(withBadNote);
assertEq(withBadNote.parts[0].staves[0].measures[0].notes[0].duration, 'q', 'repairScore fixes bad duration');
assertEq(withBadNote.parts[0].staves[0].measures[0].notes[0].pitch, 120, 'repairScore clamps pitch');

// validateScore
const valid = validateScore(createScore());
assert(valid.ok, 'validateScore valid score');

const invalid = validateScore({parts: []});
assert(!invalid.ok, 'validateScore empty parts');
assertEq(invalid.fatal, 'Score has no parts', 'validateScore fatal msg');

// shiftMeasureRefs — insert
const s3 = createScore();
s3.slurs = [{startMi: 2, endMi: 4}];
s3.rehearsalMarks = [{mi: 3}];
shiftMeasureRefs(s3, 2, 'insert');
assertEq(s3.slurs[0].startMi, 3, 'shiftMeasureRefs insert slur start');
assertEq(s3.slurs[0].endMi, 5, 'shiftMeasureRefs insert slur end');
assertEq(s3.rehearsalMarks[0].mi, 4, 'shiftMeasureRefs insert rehearsal');

// shiftMeasureRefs — delete
const s4 = createScore();
s4.slurs = [{startMi: 1, endMi: 3}, {startMi: 2, endMi: 5}];
s4.rehearsalMarks = [{mi: 2}];
shiftMeasureRefs(s4, 2, 'delete');
assertEq(s4.slurs.length, 1, 'shiftMeasureRefs delete removes matching slur');
assertEq(s4.slurs[0].startMi, 1, 'shiftMeasureRefs delete slur start');
assertEq(s4.slurs[0].endMi, 2, 'shiftMeasureRefs delete slur end (bumped down)');
assertEq(s4.rehearsalMarks.length, 0, 'shiftMeasureRefs delete removes matching rehearsal');

// _repairNote
const badNote = _repairNote({pitch: 999, duration: 'invalid'});
assertEq(badNote.pitch, 120, '_repairNote clamps high pitch');
assertEq(badNote.duration, 'q', '_repairNote fixes bad duration');

const restNote = _repairNote(null);
assertEq(restNote.type, 'rest', '_repairNote null becomes rest');

// _repairMeasure
const badMeasure = _repairMeasure({});
assert(badMeasure.notes.length > 0, '_repairMeasure empty gets rest');

// ── Summary ────────────────────────────────────────────────────
console.log(`\n${_pass} passed, ${_fail} failed`);
process.exit(_fail > 0 ? 1 : 0);
