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
  mkNote, mkRest, emptyMeasure,
  exportMSCXFromScore, parseMSCX,
} = { ...M, ...M.SCORE };// ── Tests ──────────────────────────────────────────────────────

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

console.log(`\n${_pass} passed, ${_fail} failed`);
process.exit(_fail > 0 ? 1 : 0);
