// Build the submission's design-intent .docx from the Markdown source.
//
// The competition wants this artifact text-only, in .docx, under 500 words, and
// carrying no identifying information — which includes the document metadata,
// not just the prose. So creator/lastModifiedBy are written empty rather than
// left for the toolchain to fill in with the machine's user name.
//
//   npm install docx        (one-off, not vendored — this never ships in the zip)
//   node tools/make-docx.js docs/design-intent.md docs/design-intent.docx
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');

const SRC = process.argv[2];
const OUT = process.argv[3];

const md = fs.readFileSync(SRC, 'utf8');
const lines = md.split('\n');

let title = 'Design Intent';
const blocks = [];
let buf = [];
for (const line of lines) {
  if (line.startsWith('# ')) { title = line.slice(2).trim(); continue; }
  if (line.trim() === '') { if (buf.length) { blocks.push(buf.join(' ')); buf = []; } continue; }
  buf.push(line.trim());
}
if (buf.length) blocks.push(buf.join(' '));

// Split a paragraph into bold / italic / plain runs.
function runs(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), size: 22 }));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, size: 22 }));
    else out.push(new TextRun({ text: tok.slice(1, -1), italics: true, size: 22 }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), size: 22 }));
  return out;
}

const doc = new Document({
  creator: '', description: '', title: '', lastModifiedBy: '',
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 } } },   // US Letter
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 260 },
        children: [new TextRun({ text: title, bold: true, size: 30 })],
      }),
      ...blocks.map((b) => new Paragraph({
        spacing: { after: 190, line: 280 },
        children: runs(b),
      })),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, buf.length, 'bytes');
});
