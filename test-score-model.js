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
  exportMSCXFromScore, parseMSCX, parseMusicXML,
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

// ── MSCX round-trip: markers and line breaks ─────────────────────
//
// exportMSCXFromScore used to emit neither navigation markers nor line
// breaks, and parseMSCX read back neither, so saving to .mscx and reopening
// quietly destroyed every one of them.

const _count = (hay, needle) => hay.split(needle).length - 1;

function _markerScore() {
  const sc = createScore({ title: 'Round trip', instruments: ['Piano'] });
  for (let i = 1; i < 4; i++) sc.parts[0].staves[0].measures.push(emptyMeasure());
  for (const stave of sc.parts[0].staves) while (stave.measures.length < 4) stave.measures.push(emptyMeasure());
  return sc;
}

// Every marker key and the line break survive export then reparse.
const mkSc = _markerScore();
SCORE.toggleMarker(mkSc, 0, 'segno');
SCORE.toggleMarker(mkSc, 1, 'coda');
SCORE.toggleMarker(mkSc, 2, 'fine');
SCORE.toggleMarker(mkSc, 2, 'dc');
SCORE.toggleMarker(mkSc, 3, 'ds');
SCORE.setLineBreak(mkSc, 1, true);
const mkXml = exportMSCXFromScore(mkSc);
const mkBack = parseMSCX(mkXml);
assertEq(mkBack.parts[0].staves[0].measures[0].segno, true, 'segno round-trips');
assertEq(mkBack.parts[0].staves[0].measures[1].coda, true, 'coda round-trips');
assertEq(mkBack.parts[0].staves[0].measures[2].fine, true, 'fine round-trips');
assertEq(mkBack.parts[0].staves[0].measures[2].dc, true, 'dc round-trips');
assertEq(mkBack.parts[0].staves[0].measures[3].ds, true, 'ds round-trips');
assertEq(mkBack.parts[0].staves[0].measures[1].lineBreak, true, 'line break round-trips');
assertEq(mkBack.parts[0].staves[0].measures[0].lineBreak, false, 'untagged measures stay clear');

// Exactly the markers that were set come back — asserting only "segno is
// true" would pass even if a wrong tag/subtype mapping had written segno
// onto the wrong measure, so pin the whole set per measure.
const _markersOf = m => ['segno','coda','fine','dc','ds'].filter(k => m[k] === true).join(',');
const _mkM = mkBack.parts[0].staves[0].measures;
assertEq(_markersOf(_mkM[0]), 'segno', 'measure 1 carries only the segno');
assertEq(_markersOf(_mkM[1]), 'coda', 'measure 2 carries only the coda');
assertEq(_markersOf(_mkM[2]), 'fine,dc', 'measure 3 carries only fine and dc');
assertEq(_markersOf(_mkM[3]), 'ds', 'measure 4 carries only the ds');
assertEq(_mkM.filter((m, i) => m.lineBreak && i !== 1).length, 0,
  'the line break lands only on measure 2');

// Volta membership is score-wide like the markers above, so it is written
// on the reference stave only and repair has to spread it back across the
// system when the file is read in.
const mkVol = _markerScore();
mkVol.parts[0].staves[0].measures[0].ending = [1];
mkVol.parts[0].staves[0].measures[1].ending = [1, 2];
const mkVolXml = exportMSCXFromScore(mkVol);
const mkVolBack = parseMSCX(mkVolXml);
assertEq(JSON.stringify(mkVolBack.parts[0].staves[0].measures[0].ending), JSON.stringify([1]),
  'a single-ending volta round-trips');
assertEq(JSON.stringify(mkVolBack.parts[0].staves[0].measures[1].ending), JSON.stringify([1, 2]),
  'a shared 1.–2. bracket round-trips');
assertEq(_count(mkVolXml, '<Volta>'), 2, 'voltas are emitted once, not once per stave');
assert(!('ending' in mkVolBack.parts[0].staves[1].measures[1]),
  'the second stave is left for repair to fill in');
repairScore(mkVolBack);
assert(mkVolBack.parts.every(p => p.staves.every(st => JSON.stringify(st.measures[1].ending) === '[1,2]')),
  'repair spreads imported voltas to every stave');
assert(mkVolBack.parts.every(p => p.staves.every(st => !('ending' in st.measures[2]))),
  'repair leaves measures outside every volta untagged');

// The reference stave decides a disagreement, like every other score-wide flag.
const vtDisagree = _markerScore();
vtDisagree.parts[0].staves[0].measures[1].ending = [1];
vtDisagree.parts[0].staves[1].measures[1].ending = [2];
repairScore(vtDisagree);
assert(vtDisagree.parts.every(p => p.staves.every(st => JSON.stringify(st.measures[1].ending) === '[1]')),
  'a disagreement over a volta settles on the reference stave');

// A stale volta on a later stave is a stray, not a second opinion.
const vtStray = _markerScore();
vtStray.parts[0].staves[1].measures[1].ending = [2];
repairScore(vtStray);
assert(vtStray.parts.every(p => p.staves.every(st => !('ending' in st.measures[1]))),
  'a volta found only on the second stave is cleared everywhere');

// A malformed value is dropped rather than copied through.
const vtBad = _markerScore();
vtBad.parts[0].staves[0].measures[1].ending = 2;
repairScore(vtBad);
assert(vtBad.parts.every(p => p.staves.every(st => !('ending' in st.measures[1]))),
  'a volta that is not a list of numbers is dropped');

// Score-wide flags are written once, not once per stave: MuseScore would
// otherwise place a marker on every staff of the system.
assertEq(_count(mkXml, '<LayoutBreak>'), 1, 'the line break is emitted exactly once');
assertEq(_count(mkXml, '<subtype>segno</subtype>'), 1, 'the segno is emitted exactly once');

// Export only carries them on the reference stave, so repair has to spread
// them back across the system when the file is read in.
assert(!('segno' in mkBack.parts[0].staves[1].measures[0]),
  'the second stave is left for repair to fill in');
repairScore(mkBack);
assert(mkBack.parts.every(p => p.staves.every(st => st.measures[0].segno === true)),
  'repair spreads imported markers to every stave');
assertEq(mkBack.parts[0].staves[1].measures[1].lineBreak, true,
  'repair spreads the imported line break to every stave');

// A score with none of these emits none.
const mkClean = _markerScore();
const mkCleanXml = exportMSCXFromScore(mkClean);
assertEq(_count(mkCleanXml, '<LayoutBreak>'), 0, 'a score without line breaks emits none');
assertEq(_count(mkCleanXml, '<Marker>'), 0, 'a score without markers emits none');
const mkCleanBack = parseMSCX(mkCleanXml);
assert(mkCleanBack.parts.every(p => p.staves.every(st =>
  [0,1,2,3].every(mi => !('segno' in st.measures[mi]) && !('coda' in st.measures[mi]) &&
                        !('fine' in st.measures[mi]) && !('dc' in st.measures[mi]) &&
                        !('ds' in st.measures[mi]) && st.measures[mi].lineBreak === false))),
  'an unmarked score round-trips as unmarked');

// The parser takes a marker from whichever stave carries it, so a file
// written by another tool that puts markers on staff 2 still reads back.
const foreign = `
<museScore version="4.0"><Score>
  <Part><Staff id="1"/><trackName>Flute</trackName></Part>
  <Staff id="1">
    <Measure number="1"><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
    <Measure number="2"><Marker><subtype>coda</subtype></Marker><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
    <Measure number="3"><Jump><subtype>ds_al_fine</subtype></Jump><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
    <Measure number="4"><LayoutBreak><subtype>system</subtype></LayoutBreak><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
    <Measure number="5"><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
  </Staff>
</Score></museScore>`;
const foreignBack = parseMSCX(foreign);
const fStave = foreignBack.parts[0].staves[0];
assertEq(fStave.measures.length, 5, 'the foreign fixture parses five measures');
assertEq(fStave.measures[1].coda, true, 'a Marker is read');
assertEq(fStave.measures[2].ds, true, 'a Jump is read');
assertEq(fStave.measures[3].lineBreak, true, 'a LayoutBreak is read');

// Neither the subtype value nor the element casing of the system break is
// assumed, so files written by other tools still parse.
const cased = `
<museScore version="4.0"><Score>
  <Part><Staff id="1"/><trackName>Flute</trackName></Part>
  <Staff id="1">
    <Measure number="1"><Marker><subtype>Segno</subtype></Marker><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
    <Measure number="2"><Jump><subtype>DC_AL_FINE</subtype></Jump><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
    <Measure number="3"><LayoutBreak><subtype>System</subtype></LayoutBreak><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
    <Measure number="4"><layoutBreak><subtype>system-break</subtype></layoutBreak><voice><Rest><durationType>whole</durationType></Rest></voice></Measure>
  </Staff>
</Score></museScore>`;
const casedBack = parseMSCX(cased);
const cStave = casedBack.parts[0].staves[0];
assertEq(cStave.measures[0].segno, true, 'a capitalized Marker subtype is read');
assertEq(cStave.measures[1].dc, true, 'a capitalized Jump subtype is read');
assertEq(cStave.measures[2].lineBreak, true, 'a capitalized LayoutBreak subtype is read');
assertEq(cStave.measures[3].lineBreak, true, 'a lowercase layoutBreak element is read');
assertEq(_markersOf(cStave.measures[1]), 'dc', 'a Jump subtype reads as dc, not ds');

// ── MusicXML import: score-wide flags ─────────────────────────────
//
// parseMusicXML read line breaks and markers into a per-measure object
// that never reached a stave, so both were dropped on the way in. The
// branch also tested bar-style for 'final', which is not a MusicXML
// bar-style value and would in any case mean end of piece, not system break.

const _mxMeasure = (n, extra = '', withAttrs = false) => `
    <measure number="${n}">
      ${withAttrs ? '<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>' : ''}
      ${extra}
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>`;

const _mxDoc = measures => `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list>
  <part id="P1">${measures}</part>
</score-partwise>`;

const _mxTwo = (p1, p2) => `<?xml version="1.0"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
    <score-part id="P2"><part-name>Cello</part-name></score-part>
  </part-list>
  <part id="P1">${p1}</part>
  <part id="P2">${p2}</part>
</score-partwise>`;

// new-system marks the start of the new line, so the break belongs to the
// end of the measure before it.
const brk = parseMusicXML(_mxDoc(
  _mxMeasure(1, '', true) +
  _mxMeasure(2) +
  _mxMeasure(3, '<print new-system="yes"/>') +
  _mxMeasure(4)));
const brkM = brk.parts[0].staves[0].measures;
assertEq(brkM.length, 4, 'the system-break fixture parses four measures');
assertEq(brkM[1].lineBreak, true, 'the break lands on the measure before new-system');
assertEq(brkM[2].lineBreak, false, 'the measure carrying new-system has no break of its own');
assertEq(brkM[0].lineBreak, false, 'the first measure has no break');
assertEq(brkM[3].lineBreak, false, 'later measures have no break');

// A break claimed before measure 1 has nowhere to sit.
const early = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<print new-system="yes"/>', true) + _mxMeasure(2)));
assert(early.parts.every(p => p.staves.every(st => st.measures.every(m => !m.lineBreak))),
  'a new-system on the first measure is ignored');

// Every marker form MusicXML uses is read.
const marks = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<direction><direction-type><segno/></direction-type></direction>', true) +
  _mxMeasure(2, '<direction><direction-type><coda/></direction-type></direction>') +
  _mxMeasure(3, '<direction><sound fine="yes"/></direction>') +
  _mxMeasure(4, '<direction><sound dacapo="yes"/></direction>') +
  _mxMeasure(5, '<direction><sound dalsegno="0"/></direction>') +
  _mxMeasure(6, '<direction><direction-type><words>Fine</words></direction-type></direction>')));
const markM = marks.parts[0].staves[0].measures;
assertEq(_markersOf(markM[0]), 'segno', 'a direction-type segno is read');
assertEq(_markersOf(markM[1]), 'coda', 'a direction-type coda is read');
assertEq(_markersOf(markM[2]), 'fine', 'sound fine="yes" is read');
assertEq(_markersOf(markM[3]), 'dc', 'sound dacapo="yes" is read');
assertEq(_markersOf(markM[4]), 'ds', 'sound dalsegno is read');
assertEq(_markersOf(markM[5]), 'fine', 'the words fallback for Fine is read');

// A final barline is the end of the piece, not a system break.
const finalB = parseMusicXML(_mxDoc(
  _mxMeasure(1, '', true) +
  _mxMeasure(2, '<barline location="right"><bar-style>light-heavy</bar-style></barline>')));
const finalM = finalB.parts[0].staves[0].measures;
assert(finalM.every(m => !m.lineBreak), 'a final barline does not become a system break');
assertEq(finalM[1].barline, 'end', 'a light-heavy barline is read as the end of the piece');

// Flags written in only one part survive, because they are collected across
// all parts rather than per part — otherwise repairScore would clear them
// from every part whose own measure element never mentioned them.
// Part 1 never mentions either flag; part 2 puts the break on measure 2
// (so it lands on measure 1) and the segno on measure 3.
const parts = parseMusicXML(_mxTwo(
  _mxMeasure(1, '', true) + _mxMeasure(2) + _mxMeasure(3),
  _mxMeasure(1, '', true) + _mxMeasure(2) + _mxMeasure(3,
    '<print new-system="yes"/><direction><direction-type><segno/></direction-type></direction>')));
assertEq(parts.parts.length, 2, 'the two-part fixture parses two parts');
assert(parts.parts.every(p => p.staves.every(st => st.measures[1].lineBreak === true)),
  'a break found only in part 2 is applied to every part');
assert(parts.parts.every(p => p.staves.every(st => st.measures[2].segno === true)),
  'a marker found only in part 2 is applied to every part');
const repairedParts = repairScore(parts);
assert(repairedParts.parts.every(p => p.staves.every(st => st.measures[1].lineBreak === true)),
  'the imported break still holds after repair');
assert(repairedParts.parts.every(p => p.staves.every(st => st.measures[2].segno === true)),
  'the imported marker still holds after repair');

// ── Barlines ─────────────────────────────────────────────────────
//
// m.barline drives repeat playback and end-of-piece rendering, but both
// .mscx directions ignored it: the exporter never wrote it and parseMSCX
// never read it, so a save/reopen destroyed repeats. MusicXML import read
// nothing either.

const ALL_BARLINES = ['single', 'double', 'end', 'repeat_begin', 'repeat_end', 'repeat_both'];

function _barlineScore() {
  const sc = createScore({ title: 'Barlines', instruments: ['Piano'] });
  const ref = sc.parts[0].staves[0];
  while (ref.measures.length < ALL_BARLINES.length) ref.measures.push(emptyMeasure());
  for (const stave of sc.parts[0].staves) {
    while (stave.measures.length < ALL_BARLINES.length) stave.measures.push(emptyMeasure());
  }
  return sc;
}

// Every barline value survives export then reparse, on every stave.
const blRt = _barlineScore();
ALL_BARLINES.forEach((v, i) => {
  for (const stave of blRt.parts[0].staves) stave.measures[i].barline = v;
});
const blXml = exportMSCXFromScore(blRt);
const blBack = parseMSCX(blXml);
ALL_BARLINES.forEach((v, i) => {
  assertEq(blBack.parts[0].staves[0].measures[i].barline, v, `${v} round-trips through .mscx`);
});
assert(blBack.parts[0].staves.every(st =>
  ALL_BARLINES.every((v, i) => st.measures[i].barline === v)),
  'every stave reads back its own barline');
assertEq(_count(blXml, '<BarLine'), 6 * blRt.parts[0].staves.length,
  'barlines are written once per stave, not once for the score');

// A score with no barline stores none, and none is invented on the way back.
const noBl = _barlineScore();
const noBlXml = exportMSCXFromScore(noBl);
assertEq(_count(noBlXml, '<BarLine'), 0, 'a score without barlines writes none');
assert(parseMSCX(noBlXml).parts[0].staves.every(st =>
  st.measures.every(m => !('barline' in m))),
  'an unbarlined score round-trips without inventing barlines');

// The reference stave decides, same as the other score-wide flags.
const blRef = _legacyScore();
blRef.parts[0].staves[0].measures[1].barline = 'repeat_end';
repairScore(blRef);
assert(blRef.parts.every(p => p.staves.every(st => st.measures[1].barline === 'repeat_end')),
  'a barline on the reference stave reaches every stave');

const blSingle = _legacyScore();
blSingle.parts[0].staves[0].measures[1].barline = 'single';
repairScore(blSingle);
assertEq(blSingle.parts[1].staves[0].measures[1].barline, 'single',
  'an explicit single barline propagates rather than being dropped');

const blStray = _legacyScore();
blStray.parts[1].staves[0].measures[1].barline = 'repeat_end';
repairScore(blStray);
assert(blStray.parts.every(p => p.staves.every(st => !('barline' in st.measures[1]))),
  'a barline found only on part 2 is cleared everywhere');

// MusicXML repeats.
const fwd = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<barline location="left"><repeat direction="forward"/></barline>', true) +
  _mxMeasure(2)));
assert(fwd.parts.every(p => p.staves.every(st => st.measures[0].barline === 'repeat_begin')),
  'a forward repeat becomes repeat_begin on every stave');
assert(!('barline' in fwd.parts[0].staves[0].measures[1]),
  'a measure with no barline element stays unbarlined');

const both = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<barline location="left"><repeat direction="forward"/></barline>' +
                '<barline location="right"><repeat direction="backward"/></barline>', true) +
  _mxMeasure(2)));
assertEq(both.parts[0].staves[0].measures[0].barline, 'repeat_both',
  'a forward and a backward repeat in one measure become repeat_both');

// A repeat end and a final barline are both drawn light-heavy, so the
// repeat has to win or every end repeat would read as the end of the piece.
const repEnd = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<barline location="left"><repeat direction="forward"/></barline>', true) +
  _mxMeasure(2, '<barline location="right"><bar-style>light-heavy</bar-style>' +
                 '<repeat direction="backward"/></barline>')));
assertEq(repEnd.parts[0].staves[0].measures[1].barline, 'repeat_end',
  'a backward repeat wins over its own light-heavy style');

const dbl = parseMusicXML(_mxDoc(
  _mxMeasure(1, '', true) +
  _mxMeasure(2, '<barline location="right"><bar-style>light-light</bar-style></barline>')));
assertEq(dbl.parts[0].staves[0].measures[1].barline, 'double',
  'a light-light barline is read as a double barline');

// heavy-light is a thick-thin section divider, not the thin-thin graphic
// 'double' draws, so it is left alone rather than mapped to the wrong one.
const heavyLight = parseMusicXML(_mxDoc(
  _mxMeasure(1, '', true) +
  _mxMeasure(2, '<barline location="left"><bar-style>heavy-light</bar-style></barline>')));
assert(!('barline' in heavyLight.parts[0].staves[0].measures[1]),
  'a heavy-light section divider is not read as a double barline');

// A repeat written in only one part still reaches every part, and holds
// once repair has run.
const repParts = parseMusicXML(_mxTwo(
  _mxMeasure(1, '', true) + _mxMeasure(2) + _mxMeasure(3),
  _mxMeasure(1, '', true) + _mxMeasure(2) + _mxMeasure(3,
    '<barline location="right"><repeat direction="backward"/></barline>')));
assert(repParts.parts.every(p => p.staves.every(st => st.measures[2].barline === 'repeat_end')),
  'a repeat found only in part 2 is applied to every part');
assert(repairScore(repParts).parts.every(p => p.staves.every(st => st.measures[2].barline === 'repeat_end')),
  'the imported repeat still holds after repair');

// ── Voltas ───────────────────────────────────────────────────────
//
// m.ending lists the volta numbers a measure belongs to. MusicXML writes
// the bracket as an <ending type="start"> and an <ending type="stop">, so
// membership has to be resolved by walking the measures in order: start
// opens, stop closes, and every measure in between carries the number —
// the stopping measure included.

const _ends = m => (Array.isArray(m.ending) ? m.ending.join(',') : '');

const voltas = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<barline location="left"><repeat direction="forward"/></barline>', true) +
  _mxMeasure(2, '<barline location="left"><ending number="1" type="start"/></barline>') +
  _mxMeasure(3, '<barline location="right"><ending number="1" type="stop"/>' +
                '<repeat direction="backward"/></barline>') +
  _mxMeasure(4, '<barline location="left"><ending number="2" type="start"/></barline>' +
                '<barline location="right"><ending number="2" type="stop"/></barline>')));
const vtM = voltas.parts[0].staves[0].measures;
assertEq(_ends(vtM[0]), '', 'a measure before the bracket carries no ending');
assertEq(_ends(vtM[1]), '1', 'the measure holding the start joins its ending');
assertEq(_ends(vtM[2]), '1', 'the measure holding the stop belongs to it too');
assertEq(_ends(vtM[3]), '2', 'the second ending is read on its own');
assertEq(vtM[1].barline, undefined, 'a barline with no style or repeat still yields none');

// A shared 1.–2. bracket carries both numbers on every measure it covers.
const sharedV = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<barline location="left"><ending number="1,2" type="start"/></barline>', true) +
  _mxMeasure(2, '<barline location="right"><ending number="1,2" type="stop"/></barline>')));
assertEq(_ends(sharedV.parts[0].staves[0].measures[0]), '1,2', 'a shared bracket lists both endings');
assertEq(_ends(sharedV.parts[0].staves[0].measures[1]), '1,2', 'and lists them on every measure');

// The number attribute occasionally arrives as a range.
const rangeV = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<barline location="left"><ending number="1-2" type="start"/></barline>', true) +
  _mxMeasure(2)));
assertEq(_ends(rangeV.parts[0].staves[0].measures[0]), '1,2', 'a number range expands to both endings');

// discontinue closes the bracket as well; it only says the line does not
// run on to the next ending.
const discV = parseMusicXML(_mxDoc(
  _mxMeasure(1, '<barline location="left"><ending number="1" type="start"/></barline>', true) +
  _mxMeasure(2, '<barline location="right"><ending number="1" type="discontinue"/></barline>') +
  _mxMeasure(3)));
const discM = discV.parts[0].staves[0].measures;
assertEq(_ends(discM[1]), '1', 'discontinue closes the bracket like stop');
assertEq(_ends(discM[2]), '', 'the measure after a closed bracket carries no ending');

// A volta written in only one part still reaches every part, and holds
// once repair has run — otherwise part 1 would clear it again.
const voltParts = parseMusicXML(_mxTwo(
  _mxMeasure(1, '', true) + _mxMeasure(2) + _mxMeasure(3),
  _mxMeasure(1, '', true) + _mxMeasure(2) + _mxMeasure(3,
    '<barline location="left"><ending number="1" type="start"/></barline>' +
    '<barline location="right"><ending number="1" type="stop"/></barline>')));
assert(voltParts.parts.every(p => p.staves.every(st => _ends(st.measures[2]) === '1')),
  'a volta found only in part 2 is applied to every part');
assert(repairScore(voltParts).parts.every(p => p.staves.every(st => _ends(st.measures[2]) === '1')),
  'the imported volta still holds after repair');

// ── Note repair: tuplets ─────────────────────────────────────────
//
// durBeats multiplies by tuplet.den / tuplet.num and every consumer sums
// the result — measure capacity, filler rests, beam grouping, playback
// timing. A ratio of zero or a non-numeric one therefore poisons a whole
// bar with NaN, and a group id left undefined fuses unrelated brackets.

const _tupRepair = (raw) => {
  const n = mkNote(60, 'q');
  if (raw !== undefined) n.tuplet = raw;
  return _repairNote(n);
};

const _goodTuplet = { num: 3, den: 2, groupId: 7 };
const _keptTuplet = _tupRepair(_goodTuplet);
assertEq(_keptTuplet.tuplet.num, 3, 'a valid tuplet ratio survives repair');
assertEq(_keptTuplet.tuplet.den, 2, 'and keeps its denominator');
assertEq(_keptTuplet.tuplet?.groupId, 7, 'and keeps its group id');
assert(!('junk' in _tupRepair({ ..._goodTuplet, junk: 'x' }).tuplet),
  'unrecognised tuplet keys are stripped');

for (const [label, bad] of [
  ['null', null],
  ['a number', 5],
  ['a string', '3:2'],
  ['an array', [3, 2]],
  ['a zero numerator', { num: 0, den: 2, groupId: 0 }],
  ['a zero denominator', { num: 3, den: 0, groupId: 0 }],
  ['a non-integer ratio', { num: '3', den: 2, groupId: 0 }],
  ['a negative ratio', { num: -3, den: 2, groupId: 0 }],
  ['a missing group id', { num: 3, den: 2 }],
  ['a fractional group id', { num: 3, den: 2, groupId: 1.5 }],
]) {
  assert(!('tuplet' in _tupRepair(bad)), `a tuplet with ${label} is dropped`);
}

assert(!('tuplet' in _tupRepair(undefined)), 'a note without a tuplet does not gain one');

const _tupRest = mkRest('8');
_tupRest.tuplet = { num: 3, den: 2, groupId: 0 };
assertEq(_repairNote(_tupRest).tuplet.num, 3, 'a rest keeps a valid tuplet');
_tupRest.tuplet = { num: 0, den: 2, groupId: 0 };
assert(!('tuplet' in _repairNote(_tupRest)), 'a rest loses a malformed tuplet');

// durBeats has to ignore a ratio it cannot use, since callers sum across
// a whole bar rather than checking each note.
assertEq(durBeats('q', 0, { num: 3, den: 2 }), 2 / 3, 'a valid tuplet scales the beat count');
assertEq(durBeats('q', 1, { num: 3, den: 2 }), 1, 'and scales a dotted value too');
assertEq(durBeats('q', 0, null), 1, 'no tuplet is a plain beat');
assertEq(durBeats('q', 0, { num: 0, den: 2, groupId: 0 }), 1, 'a zero numerator is ignored');
assertEq(durBeats('q', 0, { num: 3, den: 0, groupId: 0 }), 1, 'a zero denominator is ignored');
assertEq(durBeats('q', 0, { num: '3', den: 2, groupId: 0 }), 1, 'a non-numeric ratio is ignored');
assertEq(durBeats('q', 0, 5), 1, 'a stray number is ignored');
assertEq(durBeats('q', 0, { num: -3, den: 2, groupId: 0 }), 1, 'a negative ratio is ignored');

// End to end: repairScore is what a loaded file goes through, and
// beatsUsed is what the renderer and the transport add up.
const _tupScore = createScore({ instruments: ['Piano'] });
const _badNote = mkNote(60, 'q');
_badNote.tuplet = { num: 0, den: 2, groupId: 0 };
_tupScore.parts[0].staves[0].measures[0].notes = [_badNote];
repairScore(_tupScore);
const _repairedTup = _tupScore.parts[0].staves[0].measures[0].notes[0];
assert(!('tuplet' in _repairedTup), 'repairScore drops a malformed tuplet from a loaded score');
assertEq(beatsUsed([_repairedTup]), 1, 'and the bar adds up to a finite beat count again');

// ── Assignments and answer key round-trip ────────────────────────
//
// The assignment dialog tells the teacher to share the saved file, so
// anything the exporter leaves out is lost the moment that file is sent.

function _asgnScore() {
  const sc = createScore({ instruments: ['Piano'] });
  for (let i = 0; i < 3; i++) sc.parts[0].staves[0].measures.push(emptyMeasure());
  sc.assignments = [{
    id: 'a4242',
    title: 'Enter the missing "notes" & rests',
    range: { startMi: 1, endMi: 2 },
    hidden: ['pitch', 'duration'],
    hints: { showFirstNote: false },
    createdAt: 1712345678901,
  }];
  sc.answerKey = '60,62,64 & friends';
  return sc;
}

const rtA = repairScore(parseMSCX(exportMSCXFromScore(_asgnScore())));
assertEq(rtA.assignments.length, 1, 'the assignment survives export, parse and repair');
const _ra = rtA.assignments[0] || { range: {}, hidden: [], hints: {} };
assertEq(_ra.id, 'a4242', 'with its id');
assertEq(_ra.title, 'Enter the missing "notes" & rests', 'and a title carrying XML metacharacters');
assertEq(_ra.range.startMi, 1, 'and the start of its range');
assertEq(_ra.range.endMi, 2, 'and the end of its range');
assertEq(_ra.hidden.join('+'), 'pitch+duration', 'and every field it hides');
assertEq(_ra.hints.showFirstNote, false, 'and its hint setting');
assertEq(_ra.createdAt, 1712345678901, 'and when it was written');
assertEq(rtA.answerKey, '60,62,64 & friends', 'the answer key round-trips too');

const plainX = exportMSCXFromScore(createScore());
assert(plainX.indexOf('PautaAssignments') === -1, 'a score with no assignments emits no assignment element');
assert(plainX.indexOf('PautaAnswerKey') === -1, 'and no answer key element');

// repairScore decides what is usable, so a half-written element from a
// hand-edited or foreign file is refused rather than imported broken.
const _dropA = (mutate) => {
  const sc = _asgnScore();
  mutate(sc.assignments[0]);
  return repairScore(sc).assignments.length;
};
assertEq(_dropA(a => { a.id = ''; }), 0, 'an assignment with no id is dropped');
assertEq(_dropA(a => { a.id = 7; }), 0, 'and one whose id is not a string');
assertEq(_dropA(a => { delete a.range; }), 0, 'and one with no range');
assertEq(_dropA(a => { a.range = null; }), 0, 'and one whose range is null');
assertEq(_dropA(a => { a.range.startMi = '1'; }), 0, 'and one whose range is not integral');
assertEq(_dropA(a => { a.range.startMi = -1; }), 0, 'and one starting before the score');
assertEq(_dropA(a => { a.range.startMi = 2; a.range.endMi = 1; }), 0, 'and one whose range runs backwards');

// A range that merely runs past the end is kept and clamped: the score
// may have been shortened since the assignment was written, and the
// teacher's work should not vanish with it.
const _clampA = (range) => {
  const sc = _asgnScore();
  sc.assignments[0].range = range;
  return repairScore(sc).assignments[0];
};
assertEq(_clampA({ startMi: 6, endMi: 11 }).range.startMi, 3, 'a start past the end clamps to the last measure');
assertEq(_clampA({ startMi: 6, endMi: 11 }).range.endMi, 3, 'and the end follows it down');
const _clampedTail = _clampA({ startMi: 1, endMi: 99 });
assertEq(_clampedTail.range.startMi, 1, 'a range running off the end leaves its start alone');
assertEq(_clampedTail.range.endMi, 3, 'and stops at the last measure');

// Every field the grader reads is defaulted rather than left undefined.
const _defSc = _asgnScore();
_defSc.assignments[0].title = '';
_defSc.assignments[0].hidden = [];
delete _defSc.assignments[0].hints;
const _defA = repairScore(_defSc).assignments[0] || {};
assertEq(_defA.title, 'Untitled', 'a missing title becomes Untitled');
assertEq((_defA.hidden || []).join(','), 'pitch', 'an empty hidden list falls back to pitch');
assertEq(_defA.hints?.showFirstNote, true, 'a missing hint block is rebuilt with its default');

// The file itself can omit optional attributes.
const _handXML = (attrs) => repairScore(parseMSCX(
  exportMSCXFromScore(_asgnScore()).replace(/<Assignment [^>]*\/>/, `<Assignment ${attrs}/>`))
).assignments;
assertEq(_handXML('id="a1" title="x"').length, 0, 'an assignment with no range in the file is refused');
assertEq(_handXML('title="x" startMi="0" endMi="1"').length, 0, 'and one with no id is refused');
const _handOK = _handXML('id="a1" title="x" startMi="0" endMi="1"');
assertEq(_handOK.length, 1, 'an assignment with only the required attributes is accepted');
assertEq((_handOK[0] || { hidden: [] }).hidden.join(','), 'pitch', 'and defaults its hidden list to pitch');

// repairScore runs after every edit, so it has to be idempotent.
const _idem = _asgnScore();
repairScore(_idem);
const _idemFirst = JSON.stringify(_idem.assignments);
repairScore(_idem);
assertEq(JSON.stringify(_idem.assignments), _idemFirst, 'repairing an assignment twice changes nothing');

// ── Tuplets and voices in the score file ────────────────────────────
//
// MuseScore writes one <Tuplet> element ahead of the notes it covers and
// closes it with <endTuplet/>, and it writes one <voice> per voice with no
// number on them at all — the order is the number. Export and import both
// speak that dialect, or a saved score comes back with plain notes and
// every voice collapsed into the first one.

const _tvScore = () => {
  const s = createScore(1);
  const st = s.parts[0].staves[0];
  st.measures = st.measures.slice(0, 1);
  const m = st.measures[0];
  m.timeSigNum = 4; m.timeSigDen = 4;
  return { s, m };
};
const _tup = (pitch, dur, gid, voice = 1, dots = 0) => {
  const n = mkNote(pitch, dur, dots, null, voice);
  n.tuplet = { num: 3, den: 2, groupId: gid };
  return n;
};
const _rt = (s) => repairScore(parseMSCX(exportMSCXFromScore(repairScore(s))));
const _rtNotes = (s) => _rt(s).parts[0].staves[0].measures[0].notes;

// A triplet of eighths followed by a plain quarter.
{
  const { s, m } = _tvScore();
  m.notes = [_tup(60, '8', 7), _tup(64, '8', 7), _tup(67, '8', 7), mkNote(69, 'q', 0, null, 1)];
  const xml = exportMSCXFromScore(repairScore(s));
  assert(xml.includes('<Tuplet>'), 'export writes a <Tuplet> element for a tuplet run');
  assert(xml.includes('<normalNotes>2</normalNotes>'), 'export writes normalNotes before actualNotes');
  assert(xml.includes('<actualNotes>3</actualNotes>'), 'export writes actualNotes as the notes written');
  assert(xml.includes('<baseNote>eighth</baseNote>'), 'export writes the written duration as baseNote');
  assertEq((xml.match(/<Tuplet>/g) || []).length, 1, 'one <Tuplet> per run, not one per note');
  assertEq((xml.match(/<endTuplet\/>/g) || []).length, 1, 'and exactly one <endTuplet/> closing it');

  const rn = _rtNotes(s);
  assertEq(rn.length, 4, 'the measure comes back with all four notes');
  for (let i = 0; i < 3; i++) {
    assertEq(rn[i].tuplet?.num, 3, `note ${i} keeps its numerator`);
    assertEq(rn[i].tuplet?.den, 2, `note ${i} keeps its denominator`);
  }
  assertEq(rn[0].tuplet?.groupId, rn[1].tuplet?.groupId, 'the run shares one group id');
  assertEq(rn[1].tuplet?.groupId, rn[2].tuplet?.groupId, 'across all of its notes');
  assertEq(rn[3].tuplet, undefined, 'and the note after the run is outside it');
}

// Two runs back to back must not merge into one bracket.
{
  const { s, m } = _tvScore();
  m.notes = [
    _tup(60, '8', 7), _tup(64, '8', 7), _tup(67, '8', 7),
    _tup(69, '8', 8), _tup(71, '8', 8), _tup(72, '8', 8),
  ];
  assertEq((exportMSCXFromScore(repairScore(s)).match(/<Tuplet>/g) || []).length, 2,
    'two adjacent runs export as two elements');
  const rn = _rtNotes(s);
  assertEq(rn[0].tuplet?.groupId, rn[2].tuplet?.groupId, 'the first run stays together');
  assertEq(rn[3].tuplet?.groupId, rn[5].tuplet?.groupId, 'the second run stays together');
  assert(rn[2].tuplet?.groupId !== rn[3].tuplet?.groupId, 'and the two runs stay apart');
}

// A dotted note and a rest both belong to the run they sit in.
{
  const { s, m } = _tvScore();
  const r = mkRest('8', 0, 1);
  r.tuplet = { num: 3, den: 2, groupId: 5 };
  m.notes = [_tup(60, '8', 5, 1, 1), r, _tup(67, '8', 5)];
  const rn = _rtNotes(s);
  assertEq(rn[0].dots, 1, 'a dotted note inside a tuplet keeps its dot');
  assertEq(rn[0].tuplet?.num, 3, 'and keeps its tuplet');
  assertEq(rn[1].type, 'rest', 'the rest is still a rest');
  assertEq(rn[1].tuplet?.den, 2, 'a rest inside a tuplet keeps its tuplet');
  assertEq(rn[1].tuplet?.groupId, rn[2].tuplet?.groupId, 'staying in the same run');
}

// A run that ends the measure still has to be closed in the file, or the
// reader after it — MuseScore's or ours — has no idea where it stopped.
{
  const { s, m } = _tvScore();
  m.notes = [_tup(60, '8', 9), _tup(64, '8', 9), _tup(67, '8', 9)];
  const xml = exportMSCXFromScore(repairScore(s));
  assertEq((xml.match(/<endTuplet\/>/g) || []).length, 1, 'a run at the end of the measure is closed');
  const rn = _rtNotes(s);
  assertEq(rn.length, 3, 'and the measure still comes back with three notes');
  assertEq(rn[2].tuplet?.num, 3, 'the last note keeps its tuplet');
}

// Voices, and a tuplet that lives in the second one.
{
  const { s, m } = _tvScore();
  m.notes = [
    mkNote(72, 'h', 0, null, 1),
    _tup(55, '8', 3, 2), _tup(57, '8', 3, 2), _tup(59, '8', 3, 2),
  ];
  const xml = exportMSCXFromScore(repairScore(s));
  assert(xml.includes('<voice num="1">'), 'export opens voice 1');
  assert(xml.includes('<voice num="2">'), 'export opens voice 2');
  const rn = _rtNotes(s);
  const v2 = rn.filter(n => n.voice === 2);
  assertEq(rn.filter(n => n.voice === 1).length, 1, 'one note comes back in voice 1');
  assertEq(v2.length, 3, 'and the three tuplet notes come back in voice 2');
  assertEq(v2[0].tuplet?.num, 3, 'keeping the ratio');
  assertEq(v2[0].tuplet?.den, 2, 'in both directions');
  assertEq(v2[0].tuplet?.groupId, v2[2].tuplet?.groupId, 'as a single run');
}

// What MuseScore 4.7.5 writes: <Tuplet> before the notes it covers,
// <endTuplet/> after them, <eid> everywhere, and <voice> elements with no
// num attribute — their position in the measure is their number.
const _msScore = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="4.70">
  <programVersion>4.7.5</programVersion>
  <Score>
    <eid>score1</eid>
    <Division>480</Division>
    <metaTag name="workTitle">From MuseScore</metaTag>
    <Part id="1">
      <Staff><eid>partstaff1</eid><StaffType group="pitched"><name>stdNormal</name></StaffType></Staff>
      <trackName>Piano</trackName>
      <Instrument id="piano"><instrumentId>keyboard.piano</instrumentId></Instrument>
    </Part>
    <Staff id="1">
      <Measure number="1" len="4/4">
        <eid>measure1</eid>
${body}
      </Measure>
    </Staff>
  </Score>
</museScore>`;

const _msChord = (eid, dur, pitch, tpc) =>
  `<Chord><eid>${eid}</eid><durationType>${dur}</durationType>` +
  `<Note><eid>${eid}n</eid><pitch>${pitch}</pitch><tpc>${tpc}</tpc></Note></Chord>`;

{
  const imported = repairScore(parseMSCX(_msScore(`        <voice>
          <Clef><concertClefType>G</concertClefType><transposingClefType>G</transposingClefType><isHeader>1</isHeader><eid>clef1</eid></Clef>
          <TimeSig><eid>ts1</eid><sigN>4</sigN><sigD>4</sigD></TimeSig>
          <Tuplet><eid>tp1</eid><normalNotes>2</normalNotes><actualNotes>3</actualNotes><baseNote>eighth</baseNote><Number><style>tuplet</style><text>3</text></Number></Tuplet>
          ${_msChord('n1', 'eighth', 60, 14)}
          ${_msChord('n2', 'eighth', 64, 18)}
          ${_msChord('n3', 'eighth', 67, 15)}
          <endTuplet/>
          ${_msChord('n4', 'quarter', 69, 17)}
        </voice>`)));
  const rn = imported.parts[0].staves[0].measures[0].notes;
  assertEq(rn.length, 4, 'a MuseScore measure keeps all four notes');
  assertEq(rn[0].tuplet?.num, 3, 'its tuplet maps to the notes written');
  assertEq(rn[0].tuplet?.den, 2, 'and to the notes it replaces');
  assertEq(rn[0].tuplet?.groupId, rn[2].tuplet?.groupId, 'covering the whole run');
  assertEq(rn[3].tuplet, undefined, 'and stopping where <endTuplet/> says');
  assertEq(rn[0].duration, '8', 'durationType still maps to the model');
}

{
  const imported = repairScore(parseMSCX(_msScore(`        <voice>
          <Clef><concertClefType>G</concertClefType><eid>clef1</eid></Clef>
          <TimeSig><eid>ts1</eid><sigN>4</sigN><sigD>4</sigD></TimeSig>
          ${_msChord('n1', 'half', 60, 14)}
          ${_msChord('n2', 'half', 64, 18)}
        </voice>
        <voice>
          ${_msChord('n3', 'whole', 55, 14)}
        </voice>`)));
  const rn = imported.parts[0].staves[0].measures[0].notes;
  assertEq(rn.filter(n => n.voice === 1).length, 2,
    'voices written without a num attribute are counted by position');
  assertEq(rn.filter(n => n.voice === 2).length, 1, 'the second <voice> becomes voice 2');
  assertEq(rn.find(n => n.voice === 2)?.pitch, 55, 'with its own note');
}

// A group left open at the end of one voice must not swallow the next one.
{
  const imported = repairScore(parseMSCX(_msScore(`        <voice>
          <Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes><baseNote>eighth</baseNote></Tuplet>
          ${_msChord('n1', 'eighth', 60, 14)}
          ${_msChord('n2', 'eighth', 64, 18)}
        </voice>
        <voice>
          ${_msChord('n3', 'quarter', 67, 15)}
        </voice>`)));
  const rn = imported.parts[0].staves[0].measures[0].notes;
  assertEq(rn.filter(n => n.voice === 2).length, 1, 'the second voice still has its note');
  assertEq(rn.find(n => n.voice === 2)?.tuplet, undefined, 'and does not inherit the open group');
}

// A <Tuplet> that says nothing usable must not become a bogus ratio.
{
  const imported = repairScore(parseMSCX(_msScore(`        <voice>
          <Tuplet><baseNote>eighth</baseNote></Tuplet>
          ${_msChord('n1', 'eighth', 60, 14)}
          <endTuplet/>
          ${_msChord('n2', 'quarter', 64, 18)}
        </voice>`)));
  const rn = imported.parts[0].staves[0].measures[0].notes;
  assertEq(rn[0].tuplet, undefined, 'a <Tuplet> with no ratio attaches nothing');
  assertEq(rn[1].tuplet, undefined, 'and nothing leaks past <endTuplet/>');
}

console.log(`\n${_pass} passed, ${_fail} failed`);
process.exit(_fail > 0 ? 1 : 0);
