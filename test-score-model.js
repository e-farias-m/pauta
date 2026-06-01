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

// ── MSCX I/O helpers (extracted from pauta.html for testing) ─────
const MSCX_TO_VEX  = {whole:'w',half:'h',quarter:'q',eighth:'8','16th':'16','32nd':'32','64th':'64'};
const VEX_TO_MSCX  = {w:'whole',h:'half',q:'quarter','8':'eighth','16':'16th','32':'32nd','64':'64th'};

const ACC_MAP = {'#':'accidentalSharp','b':'accidentalFlat','n':'accidentalNatural'};
const DYN_MAP = {pppp:'pppp',ppp:'ppp',pp:'pp',p:'p',mp:'mp',mf:'mf',f:'f',ff:'ff',fff:'fff',ffff:'ffff',sfz:'sfz',fp:'fp',sfp:'sfp',rfz:'rfz'};

function escXml(t) { return (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function exportMSCXFromScore(s, opts) {
  const showMN = opts?.showMeasureNumbers ?? false;
  const showMMR = opts?.showMultiMeasureRests ?? false;
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<museScore version="4.0">\n  <Score>\n`;
  x += `    <Title>${escXml(s.title)}</Title>\n`;
  if (s.composer) x += `    <Composer>${escXml(s.composer)}</Composer>\n`;
  x += `    <PautaEngravingSettings showMeasureNumbers="${showMN?'1':'0'}" showMultiMeasureRests="${showMMR?'1':'0'}"/>\n`;
  s.parts.forEach((part, pi) => {
    x += `    <Part>\n      <Staff id="${pi+1}"/>\n      <trackName>${escXml(part.name)}</trackName>\n    </Part>\n`;
  });
  const staves = s.parts.flatMap(p => p.staves);
  const gsiOf = (partIdx) => s.parts.slice(0, partIdx).reduce((a,p) => a + p.staves.length, 0);
  staves.forEach((stave, si) => {
    x += `    <Staff id="${si+1}">\n`;
    stave.measures.forEach((m, mi) => {
      let tsNum = m.timeSigNum, tsDen = m.timeSigDen;
      if (tsNum === null || tsNum === undefined) {
        for (let pm = mi - 1; pm >= 0; pm--) {
          const pm_tn = stave.measures[pm]?.timeSigNum;
          const pm_td = stave.measures[pm]?.timeSigDen;
          if (pm_tn !== null && pm_tn !== undefined) { tsNum = pm_tn; tsDen = pm_td; break; }
        }
        if (tsNum === null || tsNum === undefined) { tsNum = 4; tsDen = 4; }
      }
      let measureLen = `${tsNum}/${tsDen}`;
      x += `      <Measure number="${mi+1}" len="${measureLen}">\n`;
      if (mi === 0 || m.clef) {
        const clefVal = m.clef || 'treble';
        x += `        <Clef>\n          <concertClefType>${clefVal}</concertClefType>\n        </Clef>\n`;
      }
      const rm = (s.rehearsalMarks||[]).find(r => r.mi === mi);
      if (rm) x += `        <RehearsalMark>\n          <text>${escXml(rm.label)}</text>\n        </RehearsalMark>\n`;
      if (m.tempo && si === 0) {
        x += `        <Tempo>\n          <tempo>${(m.tempo.bpm/60).toFixed(4)}</tempo>\n`;
        x += `          <text>${escXml(m.tempo.name)}</text>\n        </Tempo>\n`;
      }
      if (m.keySig !== null && m.keySig !== undefined) x += `        <KeySig><accidental>${m.keySig}</accidental></KeySig>\n`;
      if (m.timeSigNum !== null && m.timeSigNum !== undefined) x += `        <TimeSig><sigN>${m.timeSigNum}</sigN><sigD>${m.timeSigDen}</sigD></TimeSig>\n`;
      const voices = {};
      m.notes.forEach(n => { const v = n.voice || 1; if (!voices[v]) voices[v] = []; voices[v].push(n); });
      const writeNoteEl = (n, insideVoice) => {
        const durType = VEX_TO_MSCX[n.duration] || 'quarter';
        const vAttr = insideVoice ? '' : ` voice="${n.voice||1}"`;
        if (n.type === 'rest') {
          x += `          <Rest${vAttr}>\n            <durationType>${durType}</durationType>\n`;
          if (n.dots) x += `            <dots>${n.dots}</dots>\n`;
          x += `          </Rest>\n`;
        } else {
          x += `          <Chord${vAttr}>\n            <durationType>${durType}</durationType>\n`;
          if (n.dots) x += `            <dots>${n.dots}</dots>\n`;
          if (n.dynamic) x += `            <Dynamic>\n              <subtype>${DYN_MAP[n.dynamic]||n.dynamic}</subtype>\n            </Dynamic>\n`;
          if (n.articulation) x += `            <Articulation>\n              <subtype>${escXml(n.articulation)}</subtype>\n            </Articulation>\n`;
          if (n.staffText) x += `            <StaffText>\n              <text>${escXml(n.staffText)}</text>\n            </StaffText>\n`;
          if (n.chordSymbol) x += `            <Harmony>\n              <root>${escXml(n.chordSymbol)}</root>\n            </Harmony>\n`;
          const writeNote = (pitch, acc) => {
            x += `            <Note>\n              <pitch>${pitch}</pitch>\n`;
            if (acc) x += `              <Accidental><subtype>${ACC_MAP[acc]||'accidentalNatural'}</subtype></Accidental>\n`;
            x += `            </Note>\n`;
          };
          writeNote(n.pitch, n.accidental);
          (n.extraPitches||[]).forEach(ep => writeNote(ep.pitch, ep.accidental));
          if (n.lyric) {
            x += `            <Lyrics>\n              <text>${escXml(n.lyric.text)}</text>\n`;
            if (n.lyric.separator === 'dash') x += `              <syllabic>middle</syllabic>\n`;
            x += `            </Lyrics>\n`;
          }
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
    (s.slurs||[]).filter(sl => sl.si === si).forEach(sl => {
      x += `      <Spanner type="Slur">\n        <Slur/>\n`;
      x += `        <next><location><measures>${sl.endMi - sl.startMi}</measures><notes>${sl.endNi - sl.startNi}</notes></location></next>\n`;
      x += `      </Spanner>\n`;
    });
    (s.hairpins||[]).filter(h => h.si === si).forEach(h => {
      const type = h.type === 'cresc' ? '0' : '1';
      x += `      <Spanner type="HairPin">\n        <HairPin><subtype>${type}</subtype></HairPin>\n`;
      x += `        <next><location><measures>${h.endMi - h.startMi}</measures><notes>${h.endNi - h.startNi}</notes></location></next>\n`;
      x += `      </Spanner>\n`;
    });
    x += `    </Staff>\n`;
  });
  x += '  </Score>\n</museScore>';
  return x;
}

function parseMSCX(xmlStr) {
  const {DOMParser} = require('@xmldom/xmldom');
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

  function nq(parent, tag) {
    const els = parent.getElementsByTagName(tag);
    for (let i = 0; i < els.length; i++) { if (els[i].parentNode === parent) return els[i]; }
    const walk = parent.getElementsByTagName(tag);
    return walk.length ? walk[0] : null;
  }
  function nqa(parent, tag) {
    return Array.from(parent.getElementsByTagName(tag));
  }
  function txt(parent, tag) {
    const el = nq(parent, tag);
    return el ? el.textContent.trim() : null;
  }

  const score = createScore();
  let metaTitle = '', metaComposer = '';
  const metaTags = doc.getElementsByTagName('metaTag');
  for (let i = 0; i < metaTags.length; i++) {
    const mt = metaTags[i];
    const name = mt.getAttribute('name');
    if (name === 'workTitle') metaTitle = mt.textContent.trim();
    if (name === 'composer') metaComposer = mt.textContent.trim();
  }
  score.title    = metaTitle || txt(doc,'Title') || 'Untitled Score';
  score.composer = metaComposer || txt(doc,'Composer') || '';
  const mps = nq(doc, 'PautaEngravingSettings');
  if (mps) {
    score.showMeasureNumbers    = mps.getAttribute('showMeasureNumbers') === '1';
    score.showMultiMeasureRests = mps.getAttribute('showMultiMeasureRests') === '1';
  }
  score.parts = [];

  const staffEls = nqa(doc, 'Staff');
  // Filter to top-level Staff elements (direct children of Score)
  const topStaffs = staffEls.filter(s => s.parentNode && s.parentNode.tagName === 'Score');
  const useStaffs = topStaffs.length ? topStaffs : staffEls;
  if (!useStaffs.length) return score;

  const stavesByPart = [];
  let curTimeSigNum=4, curTimeSigDen=4, curKeySig=0, clefType = 'treble';
  let anyStaffHadMeasures = false;

  function parseMeasureEls(mEls, si, $stavesByPart, $score) {
    const out = [];
    let firstMeasure = true;
    mEls.forEach(mEl => {
      const measure = { timeSigNum: null, timeSigDen: null, keySig: null, lineBreak: false, notes: [] };
      const clefEl = (() => { const cp = nq(mEl, 'Clef'); return cp ? (nq(cp, 'concertClefType') || nq(cp, 'clefType')) : null; })();
      if (clefEl) { const ct = clefEl.textContent.trim().toLowerCase(); clefType = ct.includes('bass') ? 'bass' : 'treble'; }
      const kEl = nq(mEl, 'KeySig');
      if (kEl) { const accEl = nq(kEl, 'accidental') || nq(kEl, 'atonal'); curKeySig = accEl ? (parseInt(accEl.textContent)||0) : 0; measure.keySig = curKeySig; }
      if (firstMeasure && measure.keySig === null) measure.keySig = 0;
      const tEl = nq(mEl, 'TimeSig');
      if (tEl) { const n = nq(tEl, 'sigN'); const d = nq(tEl, 'sigD'); if (n && d) { curTimeSigNum = parseInt(n.textContent)||4; curTimeSigDen = parseInt(d.textContent)||4; measure.timeSigNum = curTimeSigNum; measure.timeSigDen = curTimeSigDen; } }
      if (firstMeasure && measure.timeSigNum === null) { measure.timeSigNum = curTimeSigNum; measure.timeSigDen = curTimeSigDen; }

      let curVoiceNum = 1;
      const children = Array.from(mEl.childNodes).filter(n => n.nodeType === 1);
      children.forEach(el => {
        const tag = el.tagName;
        if (tag === 'voice') {
          curVoiceNum = parseInt(el.getAttribute('num') || '1');
          Array.from(el.childNodes).filter(n => n.nodeType === 1).forEach(child => parseNoteEl(child, curVoiceNum));
          return;
        }
        parseNoteEl(el, 1);
      });

      function parseNoteEl(el, voiceNum) {
        const tag = el.tagName;
        if (tag === 'Rest') {
          const dur = MSCX_TO_VEX[txt(el,'durationType')||'quarter'] || 'q';
          const dots = parseInt(txt(el,'dots')||'0') || 0;
          measure.notes.push(mkRest(dur, dots, voiceNum));
        } else if (tag === 'Chord') {
          const dur = MSCX_TO_VEX[txt(el,'durationType')||'quarter'] || 'q';
          const dots = parseInt(txt(el,'dots')||'0') || 0;
          const noteEls = nqa(el, 'Note');
          if (!noteEls.length) return;
          const firstNoteEl = noteEls[0];
          const pitch = parseInt(txt(firstNoteEl,'pitch')||'60') || 60;
          const acc = parseAccidental(firstNoteEl);
          const note = mkNote(pitch, dur, dots, acc, voiceNum);
          noteEls.slice(1).forEach(ne => {
            const ep = parseInt(txt(ne,'pitch')||'60') || 60;
            const ea = parseAccidental(ne);
            if (!note.extraPitches) note.extraPitches = [];
            note.extraPitches.push({pitch: ep, accidental: ea});
          });
          if (nq(firstNoteEl, 'Tie')) note.tieToNext = true;
          const dynEl = nq(el, 'Dynamic');
          if (dynEl) { const sub = txt(dynEl,'subtype') || ''; if (DYN_MAP[sub]) note.dynamic = sub; }
          const artEl = nq(el, 'Articulation');
          if (artEl) note.articulation = txt(artEl,'subtype') || null;
          measure.notes.push(note);
        }
      }

      function parseAccidental(el) {
        const accParent = nq(el, 'Accidental');
        const accSub = accParent ? txt(accParent, 'subtype') : (txt(el,'accidentalType') || '');
        if (accSub.includes('Sharp')) return '#'; if (accSub.includes('Flat')) return 'b'; if (accSub.includes('Natural')) return 'n'; return null;
      }

      const rmEl = nq(mEl, 'RehearsalMark');
      if (rmEl) { const rmText = txt(rmEl,'text') || ''; if (rmText && $score.rehearsalMarks) { $score.rehearsalMarks.push({mi: out.length, label: rmText}); } }
      const tempoEl = nq(mEl, 'Tempo');
      if (tempoEl && $stavesByPart.length === 0) {
        const bpmRaw = parseFloat(txt(tempoEl,'tempo') || '2');
        const bpm = Math.round(bpmRaw * 60);
        const name = txt(tempoEl,'text') || '';
        if (!measure.tempo) measure.tempo = {name, bpm};
      }
      if (!measure.notes.length) measure.notes.push(mkRest('w'));
      out.push(measure);
      firstMeasure = false;
    });
    return out;
  }

  useStaffs.forEach((staffEl, si) => {
    const staffMeasures = Array.from(staffEl.childNodes).filter(n => n.nodeType === 1 && n.tagName === 'Measure');
    if (staffMeasures.length) anyStaffHadMeasures = true;
    const measures = parseMeasureEls(staffMeasures, si, stavesByPart, score);
    const staffClef = measures.length && staffMeasures.length ? clefType : (si % 2 === 0 ? 'treble' : 'bass');
    stavesByPart.push({clef: staffClef, measures});
  });

  if (!anyStaffHadMeasures) {
    const allMeasures = Array.from(doc.getElementsByTagName('Measure'));
    if (allMeasures.length) {
      stavesByPart.forEach(s => { s.measures = parseMeasureEls(allMeasures, 0, stavesByPart, score); });
    }
  }

  const realStaves = stavesByPart.filter(s => s.measures.length > 0);
  if (realStaves.length) { stavesByPart.length = 0; stavesByPart.push(...realStaves); }
  const maxMeasures = Math.max(...stavesByPart.map(s => s.measures.length));
  if (maxMeasures > 0) {
    stavesByPart.forEach(s => { while (s.measures.length < maxMeasures) s.measures.push(emptyMeasure()); });
  }

  let partName = 'Piano';
  const partEl = nq(doc, 'Part');
  if (partEl) partName = txt(partEl, 'trackName') || txt(partEl, 'partName') || txt(partEl, 'longName') || 'Piano';
  score.parts = [{ name: partName, staves: stavesByPart.length ? stavesByPart : createScore().parts[0].staves }];
  if (!score.slurs) score.slurs = [];
  if (!score.hairpins) score.hairpins = [];
  if (!score.rehearsalMarks) score.rehearsalMarks = [];
  if (!score.staffTexts) score.staffTexts = [];
  return score;
}

// ── MSCX Export Tests ──────────────────────────────────────────

// Basic roundtrip: create → export → parse → verify
const rt1 = createScore({title:'Test Roundtrip', composer:'Pauta'});
const xml1 = exportMSCXFromScore(rt1, {showMeasureNumbers: true});
assert(xml1.includes('<Title>Test Roundtrip</Title>'), 'exportMSCX title');
assert(xml1.includes('<Composer>Pauta</Composer>'), 'exportMSCX composer');
assert(xml1.includes('showMeasureNumbers="1"'), 'exportMSCX engraving settings');
assert(xml1.includes('<concertClefType>treble</concertClefType>'), 'exportMSCX treble clef');
assert(xml1.includes('<concertClefType>treble</concertClefType>'), 'exportMSCX treble clef');
assert(xml1.includes('<durationType>whole</durationType>'), 'exportMSCX whole rest');

// Export with note content
const rt2 = createScore({title:'Notes'});
rt2.parts[0].staves[0].measures[0].notes = [
  mkNote(60, 'q', 0, null, 1),
  mkNote(64, 'q', 0, '#', 1),
  mkRest('h', 0, 1),
];
const xml2 = exportMSCXFromScore(rt2);
assert(xml2.includes('<pitch>60</pitch>'), 'exportMSCX note pitch');
assert(xml2.includes('<pitch>64</pitch>'), 'exportMSCX note pitch 64');
assert(xml2.includes('accidentalSharp'), 'exportMSCX sharp accidental');
assert(xml2.includes('<durationType>quarter</durationType>'), 'exportMSCX quarter note');
assert(xml2.includes('<durationType>half</durationType>'), 'exportMSCX half rest');

// Export with dotted note
const rt3 = createScore({title:'Dots'});
rt3.parts[0].staves[0].measures[0].notes = [mkNote(67, 'h', 1, null, 1), mkNote(71, 'q', 0, null, 1)];
const xml3 = exportMSCXFromScore(rt3);
assert(xml3.includes('<dots>1</dots>'), 'exportMSCX dotted note');

// Export XML escaping
const rt4 = createScore({title:'A & B < C > "D"'});
const xml4 = exportMSCXFromScore(rt4);
assert(xml4.includes('A &amp; B &lt; C &gt; &quot;D&quot;'), 'exportMSCX escapes XML');

// Export with dynamic
const rt5 = createScore({title:'Dyn'});
rt5.parts[0].staves[0].measures[0].notes = [
  {...mkNote(60, 'q', 0, null, 1), dynamic: 'mf'},
];
const xml5 = exportMSCXFromScore(rt5);
assert(xml5.includes('<Dynamic>'), 'exportMSCX dynamic element');
assert(xml5.includes('<subtype>mf</subtype>'), 'exportMSCX mf dynamic');

// Export with key/time signature
const rt6 = createScore({title:'Keys', ts: {num: 3, den: 4}, ks: 2});
const xml6 = exportMSCXFromScore(rt6);
assert(xml6.includes('<sigN>3</sigN>'), 'exportMSCX time sig num');
assert(xml6.includes('<sigD>4</sigD>'), 'exportMSCX time sig den');
assert(xml6.includes('<accidental>2</accidental>'), 'exportMSCX key sig');

// Export with slurs and hairpins
const rt7 = createScore({title:'Slurs'});
rt7.slurs = [{si: 0, startMi: 0, startNi: 0, endMi: 1, endNi: 2}];
rt7.hairpins = [{si: 0, startMi: 0, startNi: 1, endMi: 2, endNi: 0, type: 'cresc'}];
rt7.parts[0].staves[0].measures.push(emptyMeasure());
rt7.parts[0].staves[0].measures.push(emptyMeasure());
rt7.parts[0].staves[1].measures.push(emptyMeasure());
rt7.parts[0].staves[1].measures.push(emptyMeasure());
const xml7 = exportMSCXFromScore(rt7);
assert(xml7.includes('type="Slur"'), 'exportMSCX slur spanner');
assert(xml7.includes('type="HairPin"'), 'exportMSCX hairpin spanner');
assert(xml7.includes('<subtype>0</subtype>'), 'exportMSCX crescendo type');

// ── MSCX Import Tests ──────────────────────────────────────────

const minimalXML = `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="4.0">
  <Score>
    <Title>Import Test</Title>
    <Composer>Test Author</Composer>
    <PautaEngravingSettings showMeasureNumbers="1" showMultiMeasureRests="0"/>
    <Part><Staff id="1"/><trackName>Piano</trackName></Part>
    <Staff id="1">
      <Measure number="1" len="4/4">
        <Clef><concertClefType>treble</concertClefType></Clef>
        <TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>
        <KeySig><accidental>0</accidental></KeySig>
        <voice num="1">
          <Chord>
            <durationType>quarter</durationType>
            <Note><pitch>60</pitch></Note>
          </Chord>
          <Chord>
            <durationType>quarter</durationType>
            <Note><pitch>64</pitch><Accidental><subtype>accidentalSharp</subtype></Accidental></Note>
          </Chord>
          <Rest>
            <durationType>half</durationType>
          </Rest>
        </voice>
      </Measure>
    </Staff>
  </Score>
</museScore>`;

const imported = parseMSCX(minimalXML);
assert(imported, 'parseMSCX returns score');
assertEq(imported.title, 'Import Test', 'parseMSCX title');
assertEq(imported.composer, 'Test Author', 'parseMSCX composer');
assert(imported.parts.length > 0, 'parseMSCX has parts');
assert(imported.parts[0].staves.length > 0, 'parseMSCX has staves');
assert(imported.parts[0].staves[0].measures.length > 0, 'parseMSCX has measures');

const impNotes = imported.parts[0].staves[0].measures[0].notes;
assertEq(impNotes.length, 3, 'parseMSCX note count');
assertEq(impNotes[0].type, 'note', 'parseMSCX first is note');
assertEq(impNotes[0].pitch, 60, 'parseMSCX C4 pitch');
assertEq(impNotes[0].duration, 'q', 'parseMSCX quarter duration');
assertEq(impNotes[1].pitch, 64, 'parseMSCX E4 pitch');
assertEq(impNotes[1].accidental, '#', 'parseMSCX sharp accidental');
assertEq(impNotes[2].type, 'rest', 'parseMSCX third is rest');
assertEq(impNotes[2].duration, 'h', 'parseMSCX half rest');

// ── Roundtrip: create → export → parse → verify ──────────────────
const rtScore = createScore({title:'Roundtrip Test', composer:'Bot'});
rtScore.parts[0].staves[0].measures[0].notes = [
  mkNote(60, 'q', 0, null, 1),
  mkNote(64, 'q', 0, '#', 1),
  mkNote(67, 'q', 0, null, 1),
  mkNote(72, 'q', 0, 'b', 1),
];
const rtXml = exportMSCXFromScore(rtScore);
const rtParsed = parseMSCX(rtXml);
assertEq(rtParsed.title, 'Roundtrip Test', 'roundtrip title');
assertEq(rtParsed.parts[0].staves[0].measures[0].notes.length, 4, 'roundtrip note count');
assertEq(rtParsed.parts[0].staves[0].measures[0].notes[0].pitch, 60, 'roundtrip C4');
assertEq(rtParsed.parts[0].staves[0].measures[0].notes[1].accidental, '#', 'roundtrip sharp');
assertEq(rtParsed.parts[0].staves[0].measures[0].notes[3].accidental, 'b', 'roundtrip flat');

// ── Summary ────────────────────────────────────────────────────
console.log(`\n${_pass} passed, ${_fail} failed`);
process.exit(_fail > 0 ? 1 : 0);
