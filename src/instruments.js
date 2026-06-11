// ── Instrument Roster ────────────────────────────────────────────
const INSTRUMENTS = [
  // Recorders
  {name:'Sopranino Recorder', family:'Recorder', staves:['treble'],     osc:'sine',   recorder:true, recorderType:'alto'},
  {name:'Soprano Recorder',   family:'Recorder', staves:['treble'],     osc:'sine',   beginnerRecorder:true, recorder:true, recorderType:'soprano'},
  {name:'Alto Recorder',      family:'Recorder', staves:['treble'],     osc:'sine',   recorder:true, recorderType:'alto'},
  {name:'Tenor Recorder',     family:'Recorder', staves:['treble'],     osc:'sine',   recorder:true, recorderType:'soprano'},
  {name:'Bass Recorder',      family:'Recorder', staves:['bass'],       osc:'sine',   recorder:true, recorderType:'alto'},
  {name:'Great Bass Recorder',family:'Recorder', staves:['bass'],       osc:'sine',   recorder:true, recorderType:'alto'},
  // Brass
  {name:'Trumpet',       family:'Brass',     staves:['treble'],        osc:'square'  },
  {name:'French Horn',   family:'Brass',     staves:['treble'],        osc:'square'  },
  {name:'Trombone',      family:'Brass',     staves:['bass'],          osc:'sawtooth'},
  {name:'Euphonium',     family:'Brass',     staves:['bass'],          osc:'sawtooth'},
  {name:'Tuba',          family:'Brass',     staves:['bass'],          osc:'sawtooth'},
  // Woodwinds
  {name:'Flute',         family:'Woodwinds', staves:['treble'],        osc:'sine'    },
  {name:'Oboe',          family:'Woodwinds', staves:['treble'],        osc:'sine'    },
  {name:'Clarinet',      family:'Woodwinds', staves:['treble'],        osc:'square'  },
  {name:'Alto Sax',      family:'Woodwinds', staves:['treble'],        osc:'square'  },
  {name:'Tenor Sax',     family:'Woodwinds', staves:['treble'],        osc:'square'  },
  {name:'Bassoon',       family:'Woodwinds', staves:['bass'],          osc:'sine'    },
  // Voice
  {name:'Soprano',        family:'Voice',     staves:['treble'],        osc:'sine'    },
  {name:'Mezzo-Soprano',  family:'Voice',     staves:['treble'],        osc:'sine'    },
  {name:'Alto',           family:'Voice',     staves:['treble'],        osc:'sine'    },
  {name:'Tenor',          family:'Voice',     staves:['treble'],        osc:'sine'    },
  {name:'Baritone',       family:'Voice',     staves:['bass'],          osc:'sine'    },
  {name:'Bass',           family:'Voice',     staves:['bass'],          osc:'sine'    },
  // Keyboard
  {name:'Piano',         family:'Keyboard',  staves:['treble','bass'], osc:'triangle'},
  {name:'Organ',         family:'Keyboard',  staves:['treble','bass'], osc:'sine'    },
  {name:'Harpsichord',   family:'Keyboard',  staves:['treble','bass'], osc:'square'  },
  {name:'Celesta',       family:'Keyboard',  staves:['treble'],        osc:'sine'    },
  // Strings
  {name:'Violin',        family:'Strings',   staves:['treble'],        osc:'sawtooth'},
  {name:'Viola',         family:'Strings',   staves:['alto'],          osc:'sawtooth'},
  {name:'Cello',         family:'Strings',   staves:['bass'],          osc:'sawtooth'},
  {name:'Double Bass',   family:'Strings',   staves:['bass'],          osc:'sawtooth'},
  {name:'Guitar',        family:'Strings',   staves:['treble'],        osc:'triangle'},
  {name:'Harp',          family:'Strings',   staves:['treble','bass'], osc:'triangle'},
  // Orff
  {name:'Orff Soprano Glockenspiel', family:'Orff', staves:['treble'],  osc:'sine'    },
  {name:'Orff Alto Glockenspiel',    family:'Orff', staves:['treble'],  osc:'sine'    },
  {name:'Orff Soprano Metallophone', family:'Orff', staves:['treble'],  osc:'triangle'},
  {name:'Orff Alto Metallophone',    family:'Orff', staves:['treble'],  osc:'triangle'},
  {name:'Orff Bass Metallophone',    family:'Orff', staves:['bass'],    osc:'triangle'},
  {name:'Orff Soprano Xylophone',    family:'Orff', staves:['treble'],  osc:'triangle'},
  {name:'Orff Alto Xylophone',       family:'Orff', staves:['treble'],  osc:'triangle'},
  {name:'Orff Bass Xylophone',       family:'Orff', staves:['bass'],    osc:'triangle'},
  {name:'Orff Timpani',              family:'Orff', staves:['bass'],    osc:'sine'    },
  // Percussion
  {name:'Drum Kit',            family:'Percussion', staves:['percussion'], osc:'noise', percussion:true},
  {name:'Snare Drum',          family:'Percussion', staves:['percussion'], osc:'noise', percussion:true},
  {name:'Bass Drum',           family:'Percussion', staves:['percussion'], osc:'noise', percussion:true},
  {name:'Hi-Hat',              family:'Percussion', staves:['percussion'], osc:'noise', percussion:true},
  // Classroom
  {name:'Boomwhacker',          family:'Classroom', staves:['treble'], osc:'sine', boomwhacker:true},
];
// Baroque recorder fingering tables.
// Sub-hole encoding (10 characters):
//   '0' = thumb       '1'-'5' = single holes 1-5
//   '6' = 6a (left)   '7' = 6b (right)   — double-hole pair for hole 6
//   '8' = 7a (left)   '9' = 7b (right)   — double-hole pair for hole 7
//   'X' = pinched (half-open) thumb
// Data from Dolmetsch Baroque fingerings for recorder in C.
const RECORDER_SOPRANO_FINGERINGS = {
  // 1st octave (C4–B4)
  60:'0123456789', 61:'012345678', 62:'01234567',  63:'0123456',
  64:'012345',     65:'0123467', 66:'0123567',   67:'0123',
  68:'012456',     69:'012',       70:'0134',       71:'01',
  // 2nd octave (C5–B5)
  72:'02',         73:'12',        74:'2',          75:'2345678',
  76:'X12345',     77:'X123467',   78:'X1235',      79:'X123',
  80:'X124',       81:'X12',       82:'X1267',      83:'X1245',
  // 3rd octave (C6+)
  84:'X145',
};
// Baroque fingerings for recorder in F (alto, sopranino, bass, great bass)
const RECORDER_ALTO_FINGERINGS = {
  // 1st octave (F4–E5)
  65:'0123456789', 66:'012345678', 67:'01234567',  68:'0123456',
  69:'012345',     70:'012346789', 71:'0123567',   72:'0123',
  73:'012456',     74:'012',       75:'0134',       76:'01',
  // 2nd octave (F5–E6)
  77:'02',         78:'12',        79:'2',          80:'2345678',
  81:'X12345',     82:'X123467',   83:'X1235',      84:'X123',
  85:'X124',       86:'X12',       87:'X1267',      88:'X1245',
  // 3rd octave (F6+)
  89:'X1245',       /* F6 — same as E6 but overblown */
};
// ── Woodwind Fingering Tables ────────────────────────────────────
// Each pitch maps to a string of key states: '1' = pressed/covered, '0' = open.
// Flute: 12 positions — [ThB, Bb, L1, L2, L3, G#, R1, R2, R3, Eb, C#, C]
// ThB = thumb B key  |  Bb = Bb lever  |  G# = left-pinky Ab/G# key
// Eb  = right-pinky D#/Eb key  |  C# = C# trill key  |  C = low C foot key
// Second-register notes use the same physical fingering; the octave is
// determined by embouchure, so both registers share one entry per pitch class.
const FLUTE_FINGERINGS = {
  // ── First register C4–B4 ──────────────────────────────────────
  60:'001110111001', // C4   L1 L2 L3 / R1 R2 R3 + low-C
  61:'001110111010', // C♯4  L1 L2 L3 / R1 R2 R3 + C♯
  62:'001110111000', // D4   L1 L2 L3 / R1 R2 R3
  63:'001110111100', // E♭4  L1 L2 L3 / R1 R2 R3 + Eb
  64:'001110110000', // E4   L1 L2 L3 / R1 R2
  65:'001110100000', // F4   L1 L2 L3 / R1
  66:'001110000000', // F♯4  L1 L2 L3
  67:'001100000000', // G4   L1 L2
  68:'001001000000', // A♭4  L1 + G♯ key
  69:'001000000000', // A4   L1
  70:'011000000000', // B♭4  Bb lever + L1  (one-and-one)
  71:'100000000000', // B4   thumb B key only
  // ── Second register C5–B5 (same keys, different embouchure) ──
  72:'001110111001', // C5
  73:'001110111010', // C♯5
  74:'001110111000', // D5
  75:'001110111100', // E♭5
  76:'001110110000', // E5
  77:'001110100000', // F5
  78:'001110000000', // F♯5
  79:'001100000000', // G5
  80:'001001000000', // A♭5
  81:'001000000000', // A5
  82:'011000000000', // B♭5
  83:'100000000000', // B5
  // ── Third register ────────────────────────────────────────────
  84:'001110110000', // C6  (same keys as E4, third harmonic)
};
// Clarinet: 9 positions [Reg, Th, L1, L2, L3, R1, R2, R3, R4]
// Reg = register key (left thumb) | Th = thumb hole | L1-L3 left hand | R1-R4 right hand
// Register key mirrors thumb state: closed (1) in chalumeau, open (0) in clarion
const CLARINET_FINGERINGS = {
  // ── Chalumeau register (low, register key closed = thumb closed) ──
  59:'111111010', 60:'111110010', 61:'111110000', 62:'111100000',
  63:'111000010', 64:'110000010', 65:'110000000', 66:'110110000',
  // ── Clarion register (middle, register key open = thumb open) ────
  67:'000110010', 68:'000100010', 69:'000000010', 70:'000110000',
  71:'000010000', 72:'000001010', 73:'001110111', 74:'001110011',
  // ── Third register (altissimo) ────────────────────────────────
  75:'001100011', 76:'001000011', 77:'001000011', 78:'001000001',
  79:'001010001', 80:'000110001', 81:'000100001', 82:'000000001',
  83:'000001001', 84:'000001110',
};
// Saxophone: 15 positions [L1, L2, L3, G#, R1, R2, R3, C, sideBb, sideC, palmD, palmEb, palmF, lowBb, lowB]
const SAX_FINGERINGS = {
  60:'111101100000000', 61:'111100100000000', 62:'111100000000000', 63:'111000000000000',
  64:'110000100000000', 65:'100000100000000', 66:'100000000000000', 67:'101100100000000',
  68:'001100100000000', 69:'001000100000000', 70:'000000100000000', 71:'000100100000000',
  72:'111101110000000', 73:'111100110000000', 74:'111000110000000', 75:'110000110000000',
  76:'100000110000000', 77:'100000010000000', 78:'101100010000000', 79:'001100010000000',
  80:'001000010000000', 81:'000000010000000', 82:'000100010000000', 83:'111101100000000',
  84:'111100100000000',
  // Accidentals with explicit key combinations
  61:'111100100000000', // C#/Db
  63:'111000000000000', // D#/Eb
  66:'100000000000000', // F#/Gb
  68:'001100100000000', // G#/Ab
  70:'000000100000000', // A#/Bb
  82:'000100010000000', // C#/Db alt
};
// Oboe: 8 positions [L1, L2, L3, L4, R1, R2, R3, R4]
const OBOE_FINGERINGS = {
  64:'11110110', 65:'11110010', 66:'11110000', 67:'11100000',
  68:'11000010', 69:'10000010', 70:'10000000', 71:'10110010',
  72:'00110010', 73:'00100010', 74:'00000010', 75:'00010010',
  76:'11110111', 77:'11110011', 78:'11100011', 79:'11000011',
  80:'10000011', 81:'10000001', 82:'10110001', 83:'00110001',
  84:'00100001',
};
// Bassoon: 8 positions [L1, L2, L3, L4, R1, R2, R3, R4]
const BASSOON_FINGERINGS = {
  58:'11110110', 59:'11110010', 60:'11110000', 61:'11100000',
  62:'11000010', 63:'10000010', 64:'10000000', 65:'10110010',
  66:'00110010', 67:'00100010', 68:'00000010', 69:'00010010',
  70:'11110111', 71:'11110011', 72:'11100011', 73:'11000011',
  74:'10000011', 75:'10000001', 76:'10110001', 77:'00110001',
  78:'00100001',
};

function woodwindFingeringForPitch(pitch, type) {
  const map = {
    flute: FLUTE_FINGERINGS, clarinet: CLARINET_FINGERINGS,
    sax: SAX_FINGERINGS, oboe: OBOE_FINGERINGS, bassoon: BASSOON_FINGERINGS,
  }[type];
  const entry = map?.[pitch];
  if (!entry) return [''];
  return Array.isArray(entry) ? entry : [entry];
}

// ── Brass Fingering Tables ────────────────────────────────────────
// Valve strings: '0' = open, '1' = pressed for each valve.
// Trumpet: 3 valves. Horn: 3 valves + trigger. Trombone: slide position '1'-'7'.
// Euphonium/Tuba: 3 valves.
const TRUMPET_FINGERINGS = {
  60:'000', 61:'111', 62:'101', 63:'010', 64:'110',
  65:'100', 66:'011', 67:['000','111'], 68:'111', 69:'110',
  70:'100',   71:'010', 72:'000', 73:'111', 74:'100',
  75:'010', 76:'110', 77:'100', 78:'011', 79:'000',
  80:'111', 81:'110', 82:'100', 83:'011', 84:'000',
};
const HORN_FINGERINGS = {
  60:'0000', 61:'0010', 62:'0100', 63:'0000', 64:'0010',
  65:'0100', 66:'0110', 67:'0000', 68:'0010', 69:'0100',
  70:'0000', 71:'0010', 72:'0000', 73:'0010', 74:'0100',
  75:'0000', 76:'0010', 77:'0100', 78:'0110', 79:'0000',
  80:'0010', 81:'0100', 82:'0000', 83:'0010', 84:'0000',
};
const TROMBONE_FINGERINGS = {
  40:'7', 41:'6', 42:'5', 43:'4', 44:'3', 45:'2', 46:'1',
  47:'7', 48:'6', 49:'5', 50:'4', 51:'3', 52:'2', 53:'1',
  54:'7', 55:'4', 56:'3', 57:'2', 58:'1', 59:'3', 60:'2', 61:'1',
  62:'4', 63:'3', 64:'2', 65:'1',
  66:'7', 67:'6', 68:'3', 69:'2', 70:'1', 71:'3', 72:'2', 73:'1',
  74:'4', 75:'3', 76:'2', 77:'1',
  78:'7', 79:'6', 80:'5', 81:'2', 82:'1', 83:'3', 84:'2',
};
const EUPHONIUM_FINGERINGS = {
  // Concert-pitch Bb euphonium (bass clef, 3 valves)
  // Each fingerings fundamental's overtone series:
  // 000 (Bb):  Bb2(46), F3(53), Bb3(58), D4(62)*, F4(65), Ab4(68), Bb4(70)
  // 010 (A):   A2(45),  E3(52), A3(57),  C#4(61), E4(64), G4(67),  A4(69)
  // 100 (Ab):  Ab2(44), Eb3(51),Ab3(56), C4(60),  Eb4(63),Gb4(66), Ab4(68)
  // 110 (G):   G2(43),  D3(50), G3(55),  B3(59),  D4(62),  F4(65),  G4(67)
  // 011 (Gb):  Gb2(42), Db3(49),Gb3(54), Bb3(58), Db4(61), E4(64),  Gb4(66)
  // 101 (F):   F2(41),  C3(48), F3(53),  A3(57),  C4(60),  Eb4(63), F4(65)
  // 111 (E):   E2(40),  B2(47), E3(52),  G#3(56), B3(59),  D4(62),  E4(64)
  40:'111', 41:'101', 42:'011', 43:'110', 44:'100',
  45:'010', 46:'000', 47:'111', 48:'101', 49:'011',
  50:'110', 51:'100', 52:'010', 53:'000', 54:'011',
  55:'110', 56:'100', 57:'010', 58:'000', 59:'110',
  60:'100', 61:'010', 62:'110', 63:'100', 64:'010',
  65:'000', 66:'011', 67:'110', 68:'000', 69:'010',
  70:'000', 71:'110', 72:'100', 73:'010', 74:'000',
  75:'100', 76:'010',
  77:'000', 78:'011', 79:'110', 80:'000', 81:'010',
  82:'000', 83:'110', 84:'100',
};
const TUBA_FINGERINGS = {
  40:'000', 41:'100', 42:'010', 43:'001', 44:'110',
  45:'011', 46:'100', 47:'010', 48:'000', 49:'110',
  50:'100', 51:'010', 52:'000', 53:'100', 54:'010',
  55:'000', 56:'011', 57:'110', 58:'100', 59:'010',
  60:'000', 61:'110', 62:'100', 63:'010', 64:'000',
  65:'011', 66:'110', 67:'100', 68:'010', 69:'000',
  70:'110', 71:'100', 72:'010', 73:'000', 74:'011',
  75:'110', 76:'100',
};

function brassFingeringForPitch(pitch, type) {
  const map = {
    trumpet: TRUMPET_FINGERINGS, horn: HORN_FINGERINGS,
    trombone: TROMBONE_FINGERINGS, euphonium: EUPHONIUM_FINGERINGS,
    tuba: TUBA_FINGERINGS,
  }[type];
  const entry = map?.[pitch];
  if (!entry) return [''];
  return Array.isArray(entry) ? entry : [entry];
}

function recorderFingeringForPitch(pitch, type='soprano') {
  const map = type === 'alto' ? RECORDER_ALTO_FINGERINGS : RECORDER_SOPRANO_FINGERINGS;
  const entry = map[pitch];
  if (!entry) return [''];
  return Array.isArray(entry) ? entry : [entry];
}
/** Resolve a global stave index (si) to its instrument definition. */
function getInstrForSI(si) {
  let idx = 0;
  for (const part of (APP.score?.parts || [])) {
    const instr = instrByName(part.instrument || part.name);
    for (let s = 0; s < part.staves.length; s++) {
      if (idx === si) return instr;
      idx++;
    }
  }
  return null;
}
function recorderTypeForSI(si) { return getInstrForSI(si)?.recorderType || 'soprano'; }
function isAnyRecorderSI(si) { return !!getInstrForSI(si)?.recorder; }
function instrByName(name) {
  return INSTRUMENTS.find(i => i.name === name) || null;
}

// Resolve a global stave index (si) to {stave, part, localSI}
// The render loop uses score.parts.flatMap(p=>p.staves) so si is global
function getStaveBySI(si) {
  let idx = 0;
  for (const part of (APP.score?.parts || [])) {
    for (const stave of part.staves) {
      if (idx === si) return stave;
      idx++;
    }
  }
  return null;
}
function getMeasureBySI(si, mi) {
  const stave = getStaveBySI(si);
  return stave ? stave.measures[mi] : null;
}
// ── Boomwhacker Colors (Chroma-Notes standard) ───────────────────
// Diatonic: C D E F G A B
// Chromatic sharps: C# D# F# G# A#
const BOOMWHACKER_COLORS = {
  0:  '#FF2400', // C  — red
  1:  '#8B0000', // C# — dark red
  2:  '#FF8C00', // D  — orange
  3:  '#CC6000', // D# — dark orange
  4:  '#FFE000', // E  — yellow
  5:  '#00BB00', // F  — green
  6:  '#007700', // F# — dark green
  7:  '#00AAAA', // G  — teal
  8:  '#005599', // G# — dark teal/blue
  9:  '#8800FF', // A  — purple
  10: '#550099', // A# — dark purple
  11: '#FF69B4', // B  — pink
};
function boomwhackerColor(pitch) {
  return BOOMWHACKER_COLORS[pitch % 12] || '#333';
}

// Detect if a global stave index belongs to a Boomwhacker part
function isBoomwhackerSI(si) { return !!getInstrForSI(si)?.boomwhacker; }
// Detect Beginning Recorder
function isBeginnerRecorderSI(si) { return !!getInstrForSI(si)?.beginnerRecorder; }
// Either BW or Beginning Recorder → large stave treatment
function isLargeStaveSI(si) {
  return isBoomwhackerSI(si) || isBeginnerRecorderSI(si);
}
/** @param {{ts?:{num:number,den:number}, ks?:number, instruments?:string[], title?:string, composer?:string}} opts @returns {Score} */