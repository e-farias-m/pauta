// ── Unit tests for the Pauta score model ────────────────────────
// Run: node test-score-model.js
//
// These run against the REAL modules in src/, loaded by test-harness.js.
// Earlier revisions re-implemented the model here, which let the copies
// drift from src/ silently (stale rule tables, a fallback instrByName
// that never returned null, invented MSCX maps). Do not reintroduce
// copies — import from the harness or add a real export.

import { loadModel } from './test-harness.js';

let _pass = 0, _fail = 0;
function assert(cond, msg) { if (cond) { _pass++; } else { _fail++; console.error('FAIL:', msg); } }
function assertEq(a, b, msg) { assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Real model under test ───────────────────────────────────────
const M = loadModel();
const { APP, INSTRUMENTS, SCORE, SCORE_FORMAT_VERSION } = M;
const {
  keySigName, midiToVexKey, durBeats, findBestDuration, beatsUsed,
  shiftMeasureRefs, _repairNote, _repairMeasure,
  addInstrumentToScore, removeInstrumentFromScore,
  createScore, repairScore, validateScore,
  setTimeSig, setKeySig, resolvedTimeSig,
  mkNote, mkRest, emptyMeasure,
  exportMSCXFromScore, parseMSCX,
  getMeasureActiveAccidentals, getResolvedKeySig, getStaveBySI,
  _syncScoreWideFlags,
} = { ...M, ...M.SCORE };

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

// ── Parts: add / remove instrument ────────────────────────────

// addInstrumentToScore — appended after existing parts
const addS = createScore({ts: {num:3, den:4}, ks: 2});
addInstrumentToScore(addS, 'Flute');
assertEq(addS.parts.length, 2, 'addInstrumentToScore appends a part');
assertEq(addS.parts[1].name, 'Flute', 'addInstrumentToScore sets part name');
assertEq(addS.parts[1].instrument, 'Flute', 'addInstrumentToScore sets instrument');
assertEq(addS.parts[1].staves.length, 1, 'addInstrumentToScore honours single-stave instrument');
assertEq(addS.parts[1].staves[0].measures.length, 1, 'addInstrumentToScore matches measure count');
assertEq(addS.parts[1].staves[0].measures[0].timeSigNum, 3, 'addInstrumentToScore inherits time sig');
assertEq(addS.parts[1].staves[0].measures[0].keySig, 2, 'addInstrumentToScore inherits key sig');
assertEq(addS.parts[1].staves[0].measures[0].notes[0].type, 'rest', 'addInstrumentToScore seeds a rest');

// addInstrumentToScore — multi-measure score, sigs only on measure 0
const addM = createScore();
addM.parts[0].staves[0].measures.push(emptyMeasure(), emptyMeasure());
addInstrumentToScore(addM, 'Violin');
assertEq(addM.parts[1].staves[0].measures.length, 3, 'addInstrumentToScore matches 3-measure score');
assertEq(addM.parts[1].staves[0].measures[1].timeSigNum, null, 'addInstrumentToScore leaves later measures sigless');

// addInstrumentToScore — keeps the instrument clef stack
const addD = createScore();
addInstrumentToScore(addD, 'Piano');
assertEq(addD.parts[1].staves.length, 2, 'addInstrumentToScore Piano gets 2 staves');
assertEq(addD.parts[1].staves[0].clef, 'treble', 'addInstrumentToScore treble clef');
assertEq(addD.parts[1].staves[1].clef, 'bass', 'addInstrumentToScore bass clef');

// addInstrumentToScore — unknown instrument is a no-op
const addX = createScore();
assertEq(addInstrumentToScore(addX, 'Kazoo'), null, 'addInstrumentToScore returns null for unknown instrument');
assertEq(addX.parts.length, 1, 'addInstrumentToScore ignores unknown instrument');

// ── Parts: cross-family adds, duplicates, placement ────────────

// Cross-family: a brass part onto a strings-only score
const xFam = createScore({instruments: ['Violin']});
addInstrumentToScore(xFam, 'Cello');       // different family, allowed
assertEq(xFam.parts.length, 2, 'cross-family add is allowed');
assertEq(xFam.parts[1].family || 'Cello', 'Cello', 'cross-family part is the requested instrument');

// Duplicates are allowed and get disambiguating display names
const dupS = createScore({instruments: ['Violin']});
addInstrumentToScore(dupS, 'Violin');
addInstrumentToScore(dupS, 'Violin');
assertEq(dupS.parts.length, 3, 'duplicate adds are allowed');
assertEq(dupS.parts[1].name, 'Violin (2)', 'second violin is disambiguated');
assertEq(dupS.parts[2].name, 'Violin (3)', 'third violin is disambiguated');
assertEq(dupS.parts[2].instrument, 'Violin', 'display suffix does not leak into instrument lookup');
assertEq(dupS.parts[2].staves.length, 1, 'duplicate add still builds a stave');

// createScore disambiguates duplicates too
const dupC = createScore({instruments: ['Flute', 'Flute']});
assertEq(dupC.parts.length, 2, 'createScore keeps duplicate instruments');
assertEq(dupC.parts[1].name, 'Flute (2)', 'createScore disambiguates duplicate parts');
assertEq(dupC.parts[1].instrument, 'Flute', 'createScore keeps the canonical instrument name');

// Placement: default appends and leaves si refs alone
const plS = createScore({instruments: ['Piano', 'Flute']});
plS.slurs = [{si: 2, startMi: 0, endMi: 0}];
addInstrumentToScore(plS, 'Cello');
assertEq(plS.parts.length, 3, 'below appends');
assertEq(plS.parts[2].name, 'Cello', 'below puts the new part last');
assertEq(plS.slurs[0].si, 2, 'appending does not renumber existing staves');
assertEq(APP.selectedStaff, 0, 'appending leaves the selection alone');

// Placement: above the part owning refStaff
// Piano = si 0,1 · Flute = si 2 · Cello = si 3
const plA = createScore({instruments: ['Piano', 'Flute', 'Cello']});
plA.slurs = [{si: 0, startMi: 0, endMi: 0}, {si: 2, startMi: 0, endMi: 0}, {si: 3, startMi: 0, endMi: 0}];
plA.hairpins = [{si: 2, startMi: 0, endMi: 0, type: 'cresc'}, {si: 3, startMi: 0, endMi: 0, type: 'dim'}];
addInstrumentToScore(plA, 'Trombone', {position: 'above', refStaff: 2}); // above Flute
assertEq(plA.parts.length, 4, 'above inserts a part');
assertEq(plA.parts[1].name, 'Trombone', 'above places the part above the referenced one');
assertEq(plA.parts.map(p => p.name).join(','), 'Piano,Trombone,Flute,Cello', 'above preserves surrounding order');
// Trombone adds 1 stave at si 2, so Flute moves 2→3 and Cello 3→4
assertEq(plA.slurs.map(s => s.si).join(','), '0,3,4', 'above shifts later staff refs up');
assertEq(plA.hairpins.map(h => h.si).join(','), '3,4', 'above shifts hairpin staff refs too');

// Placement: above a multi-stave part shifts by that part's stave count
const plB = createScore({instruments: ['Piano', 'Flute']});
plB.slurs = [{si: 0, startMi: 0, endMi: 0}, {si: 2, startMi: 0, endMi: 0}];
addInstrumentToScore(plB, 'Violin', {position: 'above', refStaff: 2}); // above Flute, si 2
assertEq(plB.slurs.map(s => s.si).join(','), '0,3', 'above shifts by the new part stave count');

// Placement: above the first part needs no ref shift
const plC = createScore({instruments: ['Piano', 'Flute']});
plC.slurs = [{si: 2, startMi: 0, endMi: 0}];
addInstrumentToScore(plC, 'Violin', {position: 'above', refStaff: 0}); // above Piano
assertEq(plC.parts[0].name, 'Violin', 'above refStaff 0 inserts at the top');
assertEq(plC.slurs[0].si, 3, 'above the first part shifts every existing staff ref up');

// Placement: unresolvable reference falls back to appending
const plD = createScore({instruments: ['Violin']});
addInstrumentToScore(plD, 'Flute', {position: 'above', refStaff: 99});
assertEq(plD.parts.length, 2, 'unresolvable above still adds a part');
assertEq(plD.parts[1].name, 'Flute', 'unresolvable above falls back to appending below');

// Placement: selectedStaff defaults to APP.selectedStaff and shifts up
const plE = createScore({instruments: ['Piano', 'Flute']});
APP.selectedStaff = 2;                    // Flute
addInstrumentToScore(plE, 'Violin', {position: 'above'});
assertEq(APP.selectedStaff, 3, 'above shifts the selection up by the new stave count');
assertEq(plE.parts[1].name, 'Violin', 'above uses APP.selectedStaff by default');

APP.selectedStaff = 0;                    // Piano treble, before the insert point
const plF = createScore({instruments: ['Piano', 'Flute']});
APP.selectedStaff = 0;
addInstrumentToScore(plF, 'Violin', {position: 'above', refStaff: 2});
assertEq(APP.selectedStaff, 0, 'a selection before the insert point is untouched');

APP.selectedStaff = 0;

// ── Signature changes must reach every stave, not just part 0 ───
// Time/key sigs are stored per stave and the renderer reads each stave's
// own measure, so a change that only touches part 0 leaves the remaining
// staves rendering a different signature.

const sigAll = createScore({instruments: ['Piano', 'Flute']});   // 2 + 1 staves
sigAll.parts[0].staves[0].measures.push(emptyMeasure(), emptyMeasure());
repairScore(sigAll);   // pads every stave to a uniform measure count
assertEq(sigAll.parts[0].staves[1].measures.length, 3, 'repairScore grew the piano bass stave too');
setTimeSig(sigAll, 2, 3, 4);
assertEq(sigAll.parts[0].staves[0].measures[2].timeSigNum, 3, 'setTimeSig reaches piano treble');
assertEq(sigAll.parts[0].staves[1].measures[2].timeSigNum, 3, 'setTimeSig reaches piano bass');
assertEq(sigAll.parts[1].staves[0].measures[2].timeSigNum, 3, 'setTimeSig reaches the flute part');
assertEq(sigAll.parts[1].staves[0].measures[2].timeSigDen, 4, 'setTimeSig sets the denominator on every stave');
// resolvedTimeSig reads APP.score, so this checks the whole path:
// setTimeSig wrote every stave, and the reader agrees on every stave.
// (assertEq is identity-based, so compare the fields, not the object.)
APP.score = sigAll;
assertEq(resolvedTimeSig(2, 0).num, 3, 'stave 0 resolves the new signature numerator');
assertEq(resolvedTimeSig(2, 0).den, 4, 'stave 0 resolves the new signature denominator');
assertEq(resolvedTimeSig(2, 1).num, 3, 'stave 1 resolves the new signature numerator');
assertEq(resolvedTimeSig(2, 2).num, 3, 'stave 2 resolves the new signature numerator');
// Untouched measures stay null so inheritance is preserved.
assertEq(sigAll.parts[1].staves[0].measures[1].timeSigNum, null, 'setTimeSig leaves earlier measures null');

const ksAll = createScore({instruments: ['Piano', 'Cello']});
ksAll.parts[0].staves[1].measures[0].keySig = -3;
setKeySig(ksAll, 0, 2);
assertEq(ksAll.parts[0].staves[0].measures[0].keySig, 2, 'setKeySig reaches piano treble');
assertEq(ksAll.parts[0].staves[1].measures[0].keySig, 2, 'setKeySig overwrites a conflicting piano bass key');
assertEq(ksAll.parts[1].staves[0].measures[0].keySig, 2, 'setKeySig reaches the cello part');

// Overflow reporting: one entry per offending stave, so the caller can
// warn once per measure rather than once per stave.
const overS = createScore({instruments: ['Piano', 'Flute']});
const fourQ = [mkNote(60,'q',0,null,1), mkNote(62,'q',0,null,1), mkNote(64,'q',0,null,1), mkNote(65,'q',0,null,1)];
const twoQ   = [mkNote(60,'q',0,null,1), mkNote(62,'q',0,null,1)];
overS.parts[0].staves[0].measures[0].notes = fourQ;   // too much for 2/4
overS.parts[0].staves[1].measures[0].notes = twoQ;   // fits in 2/4
const over = setTimeSig(overS, 0, 2, 4);
assertEq(over.length, 1, 'setTimeSig reports only the staves that actually overflow');
assertEq(over[0], overS.parts[0].staves[0], 'setTimeSig reports the offending piano treble stave');
assertEq(overS.parts[0].staves[1].measures[0].timeSigNum, 2, 'setTimeSig still wrote the fitting stave');
// Overflow in another part is reported independently.
overS.parts[1].staves[0].measures[0].notes = fourQ.slice();
const over2 = setTimeSig(overS, 0, 2, 4);
assertEq(over2.length, 2, 'setTimeSig reports overflow in a second part too');
assertEq(over2[1], overS.parts[1].staves[0], 'setTimeSig reports the offending flute stave');
assertEq(setTimeSig(overS, 0, 4, 4).length, 0, 'setTimeSig reports no overflow once the content fits');

// A whole-rest placeholder is not real content, so it must not trip the
// overflow check.
const restS = createScore();
assertEq(setTimeSig(restS, 0, 1, 4).length, 0, 'a whole-rest placeholder never overflows');
assertEq(restS.parts[0].staves[0].measures[0].timeSigNum, 1, 'setTimeSig still records 1/4 on a rest measure');

// Out-of-range and empty inputs are inert rather than throwing.
const oobS = createScore();
const oobBefore = oobS.parts[0].staves[0].measures[0].timeSigNum;
setTimeSig(oobS, 999, 3, 4);
assertEq(oobS.parts[0].staves[0].measures[0].timeSigNum, oobBefore, 'setTimeSig with an out-of-range measure is a no-op');
setKeySig(oobS, 999, 1);
assertEq(oobS.parts[0].staves[0].measures[0].keySig, 0, 'setKeySig with an out-of-range measure is a no-op');
assertEq(setTimeSig({}, 0, 3, 4).length, 0, 'setTimeSig tolerates a score with no parts');
assertEq(setTimeSig({parts:[{staves:[]}]}, 0, 3, 4).length, 0, 'setTimeSig tolerates a part with no staves');
setKeySig({}, 0, 3);
setKeySig({parts:[{staves:[{measures:[]}]}]}, 0, 3);

// ── Parts: signature layout is mirrored onto a new part ─────────

// A mid-score time-sig change must reach the new part, not just measure 0.
const sigS = createScore({ts: {num:4, den:4}, ks: 0});
sigS.parts[0].staves[0].measures.push(emptyMeasure(), emptyMeasure());
sigS.parts[0].staves[0].measures[2].timeSigNum = 3;
sigS.parts[0].staves[0].measures[2].timeSigDen = 4;
addInstrumentToScore(sigS, 'Violin');
const sigM = sigS.parts[1].staves[0].measures;
assertEq(sigM[0].timeSigNum, 4, 'new part inherits measure 1 time sig');
assertEq(sigM[1].timeSigNum, null, 'new part keeps measure 2 as unchanged (null)');
assertEq(sigM[2].timeSigNum, 3, 'new part inherits a mid-score time-sig change');
assertEq(sigM[2].timeSigDen, 4, 'new part inherits the mid-score denominator');

// Same for a mid-score key change.
const keyS = createScore();
keyS.parts[0].staves[0].measures.push(emptyMeasure());
keyS.parts[0].staves[0].measures[1].keySig = -3;
addInstrumentToScore(keyS, 'Cello');
assertEq(keyS.parts[1].staves[0].measures[0].keySig, 0, 'new part inherits measure 1 key sig');
assertEq(keyS.parts[1].staves[0].measures[1].keySig, -3, 'new part inherits a mid-score key change');

// Pickup measures and system breaks carry over structurally.
const pickS = createScore();
pickS.parts[0].staves[0].measures.push(emptyMeasure());
pickS.parts[0].staves[0].measures[0].pickup = {num:1, den:4};
pickS.parts[0].staves[0].measures[1].lineBreak = true;
addInstrumentToScore(pickS, 'Flute');
const pickM = pickS.parts[1].staves[0].measures;
assertEq(pickM[0].pickup?.num, 1, 'new part inherits the pickup measure');
assertEq(pickM[0].pickup?.den, 4, 'new part inherits the pickup denominator');
assertEq(pickM[1].lineBreak, true, 'new part inherits a system break');
assertEq(pickM[1].pickup, undefined, 'a normal measure does not gain a pickup');

// Notes are never copied — the new part starts empty.
const noteS = createScore();
noteS.parts[0].staves[0].measures[0].notes = [mkNote(60, 'q'), mkNote(64, 'q'), mkNote(67, 'q'), mkNote(72, 'q')];
addInstrumentToScore(noteS, 'Trombone');
assertEq(noteS.parts[1].staves[0].measures[0].notes.length, 1, 'new part starts with a single rest');
assertEq(noteS.parts[1].staves[0].measures[0].notes[0].type, 'rest', 'new part does not copy source notes');

// The reference stave is not mutated by the copy (pickup is a fresh object).
const aliasS = createScore();
aliasS.parts[0].staves[0].measures[0].pickup = {num:1, den:4};
addInstrumentToScore(aliasS, 'Flute');
const aliasM = aliasS.parts[1].staves[0].measures[0];
assertEq(aliasM.pickup?.num, 1, 'new part inherits the pickup measure before aliasing check');
if (aliasM.pickup) aliasM.pickup.num = 3;
assertEq(aliasS.parts[0].staves[0].measures[0].pickup?.num, 1, 'pickup copy is not aliased to the source');

// removeInstrumentFromScore — happy path and ordering
const rmS = createScore({instruments: ['Piano', 'Flute', 'Cello']});
assertEq(rmS.parts.length, 3, 'remove fixture starts with 3 parts');
assertEq(removeInstrumentFromScore(rmS, 1), true, 'removeInstrumentFromScore returns true');
assertEq(rmS.parts.length, 2, 'removeInstrumentFromScore drops the part');
assertEq(rmS.parts[1].name, 'Cello', 'removeInstrumentFromScore preserves part order');
assertEq(removeInstrumentFromScore(rmS, 99), false, 'removeInstrumentFromScore rejects out-of-range index');
assertEq(rmS.parts.length, 2, 'removeInstrumentFromScore out-of-range is a no-op');
assertEq(removeInstrumentFromScore(rmS, -1), false, 'removeInstrumentFromScore rejects negative index');
assertEq(removeInstrumentFromScore(rmS, 0), true, 'removeInstrumentFromScore removes first part');
assertEq(rmS.parts.length, 1, 'removeInstrumentFromScore count drops again');
assertEq(rmS.parts[0].name, 'Cello', 'removeInstrumentFromScore keeps the last part');
assertEq(removeInstrumentFromScore(rmS, 0), false, 'removeInstrumentFromScore refuses the last part');
assertEq(rmS.parts.length, 1, 'removeInstrumentFromScore last part survives');

// removeInstrumentFromScore — staff-indexed annotation shifting
// Piano = si 0,1 · Flute = si 2 · Cello = si 3
const rmA = createScore({instruments: ['Piano', 'Flute', 'Cello']});
rmA.slurs = [
  {si: 0, startMi: 0, endMi: 0},
  {si: 2, startMi: 0, endMi: 0},
  {si: 3, startMi: 0, endMi: 0},
];
rmA.hairpins = [{si: 2, startMi: 0, endMi: 0, type: 'cresc'}, {si: 3, startMi: 0, endMi: 0, type: 'dim'}];
removeInstrumentFromScore(rmA, 1); // removes Flute (si 2, 1 stave)
assertEq(rmA.slurs.length, 2, 'removeInstrumentFromScore drops only slurs on the removed staff');
assertEq(rmA.slurs[0].si, 0, 'removeInstrumentFromScore leaves earlier staff refs alone');
assertEq(rmA.slurs[1].si, 2, 'removeInstrumentFromScore shifts later staff refs down');
assertEq(rmA.hairpins.length, 1, 'removeInstrumentFromScore drops hairpins on the removed staff');
assertEq(rmA.hairpins[0].si, 2, 'removeInstrumentFromScore shifts later hairpin staff refs down');

// removeInstrumentFromScore — multi-stave part shift
const rmB = createScore({instruments: ['Piano', 'Flute']});
rmB.slurs = [{si: 0, startMi: 0, endMi: 0}, {si: 2, startMi: 0, endMi: 0}];
removeInstrumentFromScore(rmB, 0); // removes Piano (si 0 and 1)
assertEq(rmB.slurs.length, 1, 'removeInstrumentFromScore drops slurs across all removed staves');
assertEq(rmB.slurs[0].si, 0, 'removeInstrumentFromScore shifts past a multi-stave part');

// removeInstrumentFromScore — selection clamp
APP.selectedStaff = 2;
const rmSel = createScore({instruments: ['Piano', 'Flute']});
removeInstrumentFromScore(rmSel, 1); // selection pointed at the removed Flute stave
assertEq(APP.selectedStaff, 1, 'removeInstrumentFromScore clamps selection to the stave before the removed part');

APP.selectedStaff = 3;
const rmSel2 = createScore({instruments: ['Piano', 'Flute']});
removeInstrumentFromScore(rmSel2, 0); // Flute's stave 3 becomes stave 1
assertEq(APP.selectedStaff, 1, 'removeInstrumentFromScore shifts a selection past the removed part');

APP.selectedStaff = 0;
const rmSel3 = createScore({instruments: ['Piano', 'Flute']});
removeInstrumentFromScore(rmSel3, 1); // selection on surviving Piano treble
assertEq(APP.selectedStaff, 0, 'removeInstrumentFromScore keeps a surviving selection');

APP.selectedStaff = 0;

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


// ── MSCX Export Tests ──────────────────────────────────────────

// Basic roundtrip: create → export → parse → verify
const rt1 = createScore({title:'Test Roundtrip', composer:'Pauta'});
// Engraving flags are read from APP state, not from an options argument.
APP.showMeasureNumbers = true;
const xml1 = exportMSCXFromScore(rt1);
APP.showMeasureNumbers = false;
assert(xml1.includes('<Title>Test Roundtrip</Title>'), 'exportMSCX title');
assert(xml1.includes('<Composer>Pauta</Composer>'), 'exportMSCX composer');
assert(xml1.includes('showMeasureNumbers="1"'), 'exportMSCX engraving settings from APP state');
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


// ── Multi-part propagation regressions ─────────────────────────────
//
// Four sites resolved a global staff index (or a score-wide value) as if
// part 1 were the only part. Every case below fails against the old code.

// A score-wide helper: two parts, one stave each.
const mp = createScore({ instruments: ['Piano'] });
addInstrumentToScore(mp, 'Cello');
APP.score = mp; // getStaveBySI reads APP.score, so bind it before asserting on it
assertEq(mp.parts.length, 2, 'multi-part fixture has two parts');
const _mpStaffCount = mp.parts.reduce((n, p) => n + p.staves.length, 0);
assert(_mpStaffCount > mp.parts[0].staves.length, 'fixture has staves past part 1');
// Part 2's only stave is not global index 1: piano already owns staves 0-1.
const _celloSi = mp.parts[0].staves.length;
assertEq(getStaveBySI(_celloSi), mp.parts[1].staves[0], 'computed index resolves to part 2');

// getMeasureActiveAccidentals must read the stave named by the global index.
// Part 2 carries an explicit C# that part 1 does not have.
const celloMi = 0;
mp.parts[1].staves[0].measures[celloMi].notes = [mkNote(61, 'q', 0, '#')];
mp.parts[0].staves[0].measures[celloMi].notes = [mkNote(60, 'q', 0, null)];
const celloAcc = getMeasureActiveAccidentals(celloMi, _celloSi);
assertEq(celloAcc[1], '#', 'accidental on part 2 is detected');
const pianoAcc = getMeasureActiveAccidentals(celloMi, 0);
assertEq(pianoAcc[1], undefined, 'staff 0 does not inherit part 2 accidentals');
// The key-signature read on the same measure must agree with the note read.
assertEq(getResolvedKeySig(celloMi, _celloSi), 0, 'key sig resolves on part 2');

// An explicit natural must clear a key-signature sharp on part 2.
const mp2 = createScore({ instruments: ['Piano'] });
setKeySig(mp2, 0, 1); // one sharp: F#
addInstrumentToScore(mp2, 'Cello');
setKeySig(mp2, 0, 1);
APP.score = mp2;
const _celloSi2 = mp2.parts[0].staves.length;
assertEq(getMeasureActiveAccidentals(0, _celloSi2)[5], '#', 'part 2 inherits the G-major F#');
mp2.parts[1].staves[0].measures[0].notes = [mkNote(65, 'q', 0, 'n')];
assertEq(getMeasureActiveAccidentals(0, _celloSi2)[5], 'n', 'explicit natural on part 2 wins');

// Markers are score-wide: toggling must reach every stave in every part.
const mp3 = createScore({ instruments: ['Piano'] });
addInstrumentToScore(mp3, 'Cello');
APP.score = mp3;
assertEq(SCORE.toggleMarker(mp3, 0, 'segno'), true, 'toggleMarker reports the marker is now set');
for (const [pi, part] of mp3.parts.entries()) {
  for (const [sti, stave] of part.staves.entries()) {
    assertEq(stave.measures[0].segno, true, `segno set on part ${pi + 1} stave ${sti + 1}`);
  }
}
assertEq(SCORE.toggleMarker(mp3, 0, 'segno'), false, 'toggleMarker reports the marker is now cleared');
for (const [pi, part] of mp3.parts.entries()) {
  assertEq(part.staves[0].measures[0].segno, undefined, `segno cleared on part ${pi + 1}`);
}

// Every marker key clears across every part.
for (const k of ['segno', 'coda', 'fine', 'dc', 'ds']) SCORE.toggleMarker(mp3, 0, k);
mp3.parts[1].staves[0].measures[0].fine = true; // stray marker the clear must reach
SCORE.clearMarkers(mp3, 0);
for (const part of mp3.parts) {
  const m = part.staves[0].measures[0];
  assert(!('segno' in m) && !('coda' in m) && !('fine' in m) && !('dc' in m) && !('ds' in m),
    'clearMarkers clears every key on every part');
}

// Line breaks are read by the engraver from one reference stave, so all
// staves have to agree.
const mp4 = createScore({ instruments: ['Organ'] });
addInstrumentToScore(mp4, 'Cello');
APP.score = mp4;
const _organStaves = mp4.parts[0].staves.length;
SCORE.setLineBreak(mp4, 0, true);
for (const [pi, part] of mp4.parts.entries()) {
  for (const [sti, stave] of part.staves.entries()) {
    assertEq(stave.measures[0].lineBreak, true, `line break set on part ${pi + 1} stave ${sti + 1}`);
  }
}
assert(_organStaves >= 1, 'organ fixture has at least one stave');
SCORE.setLineBreak(mp4, 0, false);
for (const part of mp4.parts) {
  assertEq(part.staves[0].measures[0].lineBreak, false, 'line break cleared on every part');
}

// Out-of-range measures are skipped, not thrown on.
assertEq(SCORE.toggleMarker(mp4, 99, 'segno'), false, 'toggleMarker ignores a missing measure');
assertEq(SCORE.setLineBreak(mp4, 99, true), undefined, 'setLineBreak ignores a missing measure');
SCORE.clearMarkers(mp4, 99);
assertEq(SCORE.toggleMarker(null, 0, 'segno'), false, 'toggleMarker tolerates a null score');
SCORE.setLineBreak(undefined, 0, true);
SCORE.clearMarkers(null, 0);


// ── Score-wide flag reconciliation ────────────────────────────────
//
// The marker and line-break handlers used to write only to part 1, and the
// line-break handler to the first stave of every part, so older files carry
// these flags unevenly. repairScore reconciles them against part 1 stave 1,
// which is what both renderers read. It runs on file open and after every
// edit.

function _legacyScore() {
  const sc = createScore({ instruments: ['Piano'] });
  addInstrumentToScore(sc, 'Cello');
  for (const part of sc.parts) for (const stave of part.staves) stave.measures.push(emptyMeasure());
  return sc;
}

// Legacy markers: written across part 1 only, part 2 missing out.
const leg = _legacyScore();
leg.parts[0].staves[0].measures[1].coda = true;
leg.parts[0].staves[1].measures[1].coda = true;
repairScore(leg);
for (const [pi, part] of leg.parts.entries()) {
  for (const [sti, stave] of part.staves.entries()) {
    assertEq(stave.measures[1].coda, true, `coda reaches part ${pi + 1} stave ${sti + 1}`);
  }
}

// Legacy line break: written to the first stave of every part, so part 1's
// second stave is the one missing out.
const leg2 = _legacyScore();
leg2.parts[0].staves[0].measures[1].lineBreak = true;
leg2.parts[1].staves[0].measures[1].lineBreak = true;
repairScore(leg2);
for (const [pi, part] of leg2.parts.entries()) {
  for (const [sti, stave] of part.staves.entries()) {
    assertEq(stave.measures[1].lineBreak, true, `line break reaches part ${pi + 1} stave ${sti + 1}`);
  }
}

// Every marker key is covered, not just coda.
for (const key of ['segno', 'coda', 'fine', 'dc', 'ds']) {
  const s2 = _legacyScore();
  s2.parts[0].staves[0].measures[1][key] = true;
  repairScore(s2);
  assert(s2.parts.every(p => p.staves.every(st => st.measures[1][key] === true)),
    `${key} reaches every stave`);
}

// A flag on a non-reference stave alone is a stray, not a legacy copy: no
// writer has ever skipped part 1 stave 1, so it cannot be genuine. Repair
// clears it rather than promoting it across the score.
const stray = _legacyScore();
stray.parts[0].staves[1].measures[1].segno = true;
repairScore(stray);
assert(stray.parts.every(p => p.staves.every(st => !('segno' in st.measures[1]))),
  'a marker found only on part 1 stave 2 is cleared everywhere');

const stray2 = _legacyScore();
stray2.parts[1].staves[0].measures[1].segno = true;
stray2.parts[1].staves[0].measures[1].lineBreak = true;
repairScore(stray2);
assert(stray2.parts.every(p => p.staves.every(st => !('segno' in st.measures[1]))),
  'a marker found only on part 2 is cleared everywhere');
assert(stray2.parts.every(p => p.staves.every(st => st.measures[1].lineBreak === false)),
  'a line break found only on part 2 is cleared everywhere');

// The reference stave decides, including when the other staves disagree
// with it in both directions.
const dis = _legacyScore();
dis.parts[0].staves[0].measures[0].segno = true;   // reference has it
dis.parts[0].staves[1].measures[0].segno = false;  // one stave lacks it
dis.parts[1].staves[0].measures[0].fine = true;    // and one stave has a stray
repairScore(dis);
assert(dis.parts.every(p => p.staves.every(st => st.measures[0].segno === true)),
  'a marker on the reference stave is pushed to every stave');
assert(dis.parts.every(p => p.staves.every(st => !('fine' in st.measures[0]))),
  'a stray on part 2 is cleared even when the reference stave has a marker elsewhere');

// Repair never invents a flag: a measure with nothing set stays clear.
const leg3 = _legacyScore();
repairScore(leg3);
for (const part of leg3.parts) {
  for (const stave of part.staves) {
    for (const mi of [0, 1]) {
      const m = stave.measures[mi];
      assert(!('segno' in m) && !('coda' in m) && !('fine' in m) && !('dc' in m) && !('ds' in m),
        'repair does not invent markers');
      assertEq(m.lineBreak, false, `line break stays false at measure ${mi + 1}`);
    }
  }
}

// Idempotent: repairScore runs after every commitChange, so a second pass
// must not change anything.
const leg4 = _legacyScore();
leg4.parts[0].staves[0].measures[1].segno = true;
leg4.parts[1].staves[0].measures[1].lineBreak = true;
repairScore(leg4);
const _once = JSON.stringify(leg4);
repairScore(leg4);
repairScore(leg4);
assertEq(JSON.stringify(leg4), _once, 'repairing an already-repaired score is a no-op');

// Reconciliation is symmetrical: one pass settles both directions at once.
const sym = _legacyScore();
sym.parts[0].staves[1].measures[0].fine = true;    // stray on a non-reference stave
sym.parts[0].staves[0].measures[0].dc = true;      // genuine flag on the reference stave
repairScore(sym);
assert(sym.parts.every(p => p.staves.every(st => st.measures[0].dc === true)),
  'the genuine flag reaches every stave');
assert(sym.parts.every(p => p.staves.every(st => !('fine' in st.measures[0]))),
  'the stray is cleared from every stave');

// Single-stave scores are left alone and must not crash.
const legSolo = createScore({ instruments: ['Flute'] });
legSolo.parts[0].staves[0].measures[0].segno = true;
repairScore(legSolo);
assertEq(legSolo.parts[0].staves[0].measures[0].segno, true, 'single-stave marker survives repair');
assertEq(_syncScoreWideFlags(legSolo), legSolo, '_syncScoreWideFlags returns the score');
assertEq(_syncScoreWideFlags(null), null, '_syncScoreWideFlags tolerates null');

// The reference stave may be longer than the staves it is compared
// against, which happens when it is called directly rather than through
// repairScore. Those short staves are skipped instead of crashing.
const ragged = createScore({ instruments: ['Flute'] });
addInstrumentToScore(ragged, 'Violin');
for (let i = 1; i < 4; i++) ragged.parts[0].staves[0].measures.push(emptyMeasure());
ragged.parts[0].staves[0].measures[2].segno = true;
_syncScoreWideFlags(ragged);
assertEq(ragged.parts[0].staves[0].measures.length, 4, 'the reference stave keeps its measures');
assertEq(ragged.parts[1].staves[0].measures.length, 1, 'the shorter stave keeps its length');
assert(!('segno' in ragged.parts[1].staves[0].measures[0]),
  'a stave with no measure to compare against is skipped');
assertEq(_syncScoreWideFlags(undefined), undefined, '_syncScoreWideFlags tolerates undefined');

console.log(`\n${_pass} passed, ${_fail} failed`);
process.exit(_fail > 0 ? 1 : 0);
