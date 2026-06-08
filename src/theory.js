// ── Pitch / Duration Helpers ─────────────────────────────────────
const THEORY = {}; // Music theory & pitch helpers
const NOTE_NAMES   = ['c','d','e','f','g','a','b'];
const CHROMATIC    = [0,2,4,5,7,9,11];
const PC_TO_DIA    = [0,0,1,1,2,3,3,4,4,5,5,6]; // chromatic pc -> diatonic index
const DUR_BEATS    = {w:4,h:2,q:1,'8':0.5,'16':0.25,'32':0.125,'64':0.0625};
const MSCX_TO_VEX  = {whole:'w',half:'h',quarter:'q',eighth:'8','16th':'16','32nd':'32','64th':'64'};
const VEX_TO_MSCX  = {w:'whole',h:'half',q:'quarter','8':'eighth','16':'16th','32':'32nd','64':'64th'};
const KEY_NAMES    = ['C','G','D','A','E','B','F#','C#'];
const KEY_FLATS    = ['F','Bb','Eb','Ab','Db','Gb','Cb'];

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
  // auto-detect if not diatonic
  if (![0,2,4,5,7,9,11].includes(pc)) return `${name}#/${oct}`;
  return `${name}/${oct}`;
}
function midiAutoAcc(midi) {
  const pc = midi % 12;
  return [0,2,4,5,7,9,11].includes(pc) ? null : '#';
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
function resolvedTimeSig(mIdx, sIdx=0) {
  if (!APP.score) return {num:4,den:4};
  const stave = getStaveBySI(sIdx);
  const measures = stave?.measures || [];
  for (let i = mIdx; i >= 0; i--) {
    const m = measures[i];
    if (m && m.timeSigNum !== null && m.timeSigNum !== undefined)
      return {num:m.timeSigNum, den:m.timeSigDen};
  }
  return {num:4,den:4};
}

// ── Music Theory Utilities ────────────────────────────────────────
// Sharps: F C G D A E B  (pitch classes)
const SHARP_ORDER_PC = [5, 0, 7, 2, 9, 4, 11];
// Flats:  B E A D G C F
const FLAT_ORDER_PC  = [11, 4, 9, 2, 7, 0, 5];
// Diatonic (natural) pitch classes
const DIATONIC_PCS   = new Set([0, 2, 4, 5, 7, 9, 11]);

function getKeyAccidentals(ks) {
  // Returns map: pitch-class -> '#' or 'b' based on key signature
  const map = {};
  if (ks > 0) { for (let i = 0; i < Math.min(ks,7); i++) map[SHARP_ORDER_PC[i]] = '#'; }
  else if (ks < 0) { for (let i = 0; i < Math.min(-ks,7); i++) map[FLAT_ORDER_PC[i]] = 'b'; }
  return map;
}

function getResolvedKeySig(mi, si=0) {
  if (!APP.score) return 0;
  const stave    = getStaveBySI(si);
  const measures = stave?.measures || [];
  for (let i = mi; i >= 0; i--) {
    const m = measures[i];
    if (m && m.keySig !== null && m.keySig !== undefined) return m.keySig;
  }
  return 0;
}

function getResolvedClef(mi, si) {
  const stave = getStaveBySI(si);
  if (!stave) return 'treble';
  const measures = stave.measures || [];
  for (let i = mi; i >= 0; i--) {
    const m = measures[i];
    if (m && m.clef) return m.clef;
  }
  return stave.clef || 'treble';
}

function measureBeatsCapacity(mi, si=0) {
  const stave = getStaveBySI(si);
  const m = stave?.measures?.[mi];
  if (m?.pickup) return m.pickup.num * (4 / m.pickup.den);
  const ts = resolvedTimeSig(mi, si);
  return ts.num * (4 / ts.den); // in quarter-note beats
}

function beatsUsed(notes) {
  return notes.reduce((s, n) => s + durBeats(n.duration, n.dots, n.tuplet), 0);
}

function getMeasureActiveAccidentals(mi, si) {
  // Returns map of pitch-class -> active accidental, accounting for
  // key signature + any accidentals already entered in this measure
  const ks     = getResolvedKeySig(mi, si);
  const active = getKeyAccidentals(ks); // start from key sig
  const notes  = APP.score?.parts[0]?.staves[si]?.measures[mi]?.notes || [];
  notes.forEach(n => {
    if (n.type === 'note') {
      const pc = n.pitch % 12;
      if (n.accidental) {
        active[pc] = n.accidental; // explicit accidental in model
      } else if (!DIATONIC_PCS.has(pc)) {
        active[pc] = ks < 0 ? 'b' : '#'; // match key signature's flavor
      }
    }
  });
  return active;
}

// Is a measure the "full-bar whole rest" placeholder?
function isWholeRestPlaceholder(notes) {
  return notes.length === 1 && notes[0].type === 'rest' && notes[0].duration === 'w';
}

// Decompose a beat duration into the largest rest values that fit
function beatsToBestRestDuration(beats) {
  const options = [
    {dur:'w',beats:4},{dur:'h',beats:2,dot:false},
    {dur:'hd',beats:3,dot:true,base:'h'},
    {dur:'q',beats:1},{dur:'qd',beats:1.5,dot:true,base:'q'},
    {dur:'8',beats:0.5},{dur:'8d',beats:0.75,dot:true,base:'8'},
    {dur:'16',beats:0.25},{dur:'32',beats:0.125}
  ];
  const sorted = options.filter(o => o.beats <= beats + 0.001).sort((a,b) => b.beats - a.beats);
  return sorted[0] || null;
}

// ── Assign theory functions to THEORY namespace ─────────
[keySigName, midiToVexKey, midiAutoAcc, durBeats, findBestDuration, resolvedTimeSig,
 getKeyAccidentals, getResolvedKeySig, getResolvedClef, measureBeatsCapacity, beatsUsed,
 getMeasureActiveAccidentals, isWholeRestPlaceholder, beatsToBestRestDuration
].forEach(fn => { THEORY[fn.name] = fn; });
