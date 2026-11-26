# Third-Party Notices — Pauta

This file lists third-party materials used by Pauta. The application itself is licensed under the Preludio Proprietary Software Licence (PPSL) — see `LICENSE`. Third-party materials remain subject to their own licences.

Audit date: 2026-11-25.

## 1. Fonts

### Bravura (music font)

- Package: `@vexflow-fonts/bravura@1.0.2`.
- Embedded as a base64 WOFF2 font in `src/styles/main.css:3-7` (copied into `pauta.html:722-725`) and also referenced from jsDelivr. VexFlow additionally embeds Bravura glyph metrics and outlines.
- Copyright © 2019 Steinberg Media Technologies GmbH, with Reserved Font Name "Bravura".
- Licence: SIL Open Font License 1.1 (full text below).
- The copyright notice and full OFL text must accompany every copy of the font, including the embedded copy in `pauta.html`. This file supplies that notice; it must be distributed alongside the application.

### Outfit (UI font)

- Loaded from the Google Fonts CSS API in `src/index.html:13-15` (copied into `pauta.html:13-15`).
- Copyright 2021 The Outfit Project Authors (https://github.com/Outfitio/Outfit-Fonts).
- Licence: SIL Open Font License 1.1 (full text below).
- Font files are fetched from Google at runtime and are not bundled. If you self-host them for offline use, ship this notice and the font files together.

## 2. Runtime-loaded libraries

These libraries are loaded from pinned CDN URLs at runtime, not compiled into `pauta.html`. The loader in `src/ui.js:2587-2632` stores fetched script text in the browser Cache API and executes it from `blob:` URLs.

| Library | Version | Licence | Used for |
| --- | --- | --- | --- |
| JSZip | 3.10.1 | MIT (we elect the MIT branch of its dual MIT/GPLv3 licence) | Zip export |
| VexFlow | 3.0.9 | MIT (code) + Bravura glyph data under OFL 1.1 | Music notation rendering |
| html2canvas | 1.4.1 | MIT | Rendering images for PDF export |
| jsPDF | 2.5.1 | MIT | PDF export |
| lamejs | 1.2.1 | LGPL-3.0 | MP3 export |

### MIT notices

- **JSZip** — Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso. MIT (full text below). JSZip 3.10.1 is dual-licensed MIT **or** GPLv3; Pauta uses the MIT branch.
- **VexFlow** — "Vex Flow - A JavaScript library for rendering music notation. Copyright (c) 2010 Mohit Muthanna Cheppudira". MIT (full text below).
- **html2canvas** — Copyright (c) 2012 Niklas von Hertzen. MIT (full text below). See https://html2canvas.hertzen.com.
- **jsPDF** — Copyright (c) 2010-2021 James Hall, yWorks GmbH, Lukas Holländer, Aras Abbasi, Aaron Spike et al. MIT (full text below). The jsPDF bundle also contains third-party notices retained by its authors: a colour parser by Stoyan Stefanov ("Use it if you like it"), an MD5 implementation by Joseph Myers (modified by Owen Leong; the licence is not specified by the original author), and FPDF-derived RC4 code. Pauta does not use jsPDF's `pdfobjectnewwindow` output path.

### LGPL notice — lamejs

- lamejs 1.2.1 wraps LAME 3.98.4 and is licensed under **LGPL-3.0**. Full licence text: https://www.gnu.org/licenses/lgpl-3.0.txt
- It is loaded on demand from unpkg/jsDelivr and cached locally; it is **not** bundled into `pauta.html`.
- **Decision required before commercial release:** keep MP3 export (with LGPL notice, source-access information for the library, and confirmation that it is never bundled), or replace the encoder with a permissively licensed alternative, or remove MP3 export. See also the note in section 6.

## 3. Data and inspiration credits

- Recorder fingering data — `src/instruments.js:69` credits "Data from Dolmetsch Baroque fingerings for recorder in C." Retain this credit.
- Rhythm workout — `src/education/session.js:2169` notes "inspired by rhythmrandomizer.com". This is an idea credit, not copied code; verify no text or assets were copied from that site.
- A traced rest-glyph path appears at `src/index.html:303` and `src/education/kit.js:1461` (outline coordinates beginning `M 531.098,74.847`). Its provenance is unverified and it may be derived from a music font such as Bravura. **Verify its origin**; if derived from Bravura, the OFL notice above applies.

## 4. Images

- `favicon.png` and `pauta_logo_hires.png` — created for Pauta (commits `0b05944`, `3d06f5f`). No copyright metadata is embedded in the PNG chunks. Confirm they were produced in-house; no third-party attribution currently exists.
- Two small inline SVG chevron icons in `src/design-system.css:460,811` — simple original shapes.

## 5. Development dependencies (not shipped)

`package.json` lists `happy-dom@15.11.7` (MIT) and `jszip@3.10.1` (MIT/GPLv3) as dev dependencies, with transitive packages under MIT, BSD-2-Clause and ISC. These are used only by the test harness (`test-harness.js`, `test-interactions.js`) and are **not** included in `pauta.html` or the deployed Pages artifact. `.opencode/` contains editor tooling with its own licences (Apache-2.0, MIT, ISC, AFL-2.1/BSD-3-Clause); it is not part of the application.

## 6. Pending items before commercial release

1. Distribute this file with the application so the Bravura OFL notice accompanies the embedded font.
2. Decide the treatment of lamejs (LGPL-3.0) described above.
3. Verify the provenance of the traced rest-glyph path and the two PNG images; replace or attribute if third-party.
4. If you self-host Outfit for fully offline use, ship the OFL notice and font files.
5. Keep CDN URLs pinned and re-check licences on any upgrade.

## 7. Licence texts

### SIL Open Font License 1.1

Copyright © 2019 Steinberg Media Technologies GmbH, with Reserved Font Name "Bravura"

Copyright 2021 The Outfit Project Authors (https://github.com/Outfitio/Outfit-Fonts)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

### MIT License

The following copyright notices apply to the MIT-licensed libraries listed in section 2.

Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso (JSZip)
Copyright (c) 2010 Mohit Muthanna Cheppudira (VexFlow)
Copyright (c) 2012 Niklas von Hertzen (html2canvas)
Copyright (c) 2010-2021 James Hall, yWorks GmbH, Lukas Holländer, Aras Abbasi, Aaron Spike et al. (jsPDF)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

### LGPL-3.0

lamejs 1.2.1 is licensed under the GNU Lesser General Public License, version 3. The full text is available at https://www.gnu.org/licenses/lgpl-3.0.txt and should be included with the library if it is ever bundled or redistributed with Pauta.
