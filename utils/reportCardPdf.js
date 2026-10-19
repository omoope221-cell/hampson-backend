const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const NAVY = '#1b2a52';
const CRIMSON = '#8f2233';

// Same address/contact block on every report card, whichever section the
// student is in.
const SCHOOL_ADDRESS = '17, Ilo-Awela Road, By Toll-Gate, Ota, Ogun State';
const SCHOOL_PHONES = '09065074217, 08101611363';
const SCHOOL_EMAIL = 'hampsonsschool@gmail.com';

// Header branding per section. Secondary students get Hampsons College
// and its logo (bundled at backend/assets so it never depends on a
// remote URL). Primary students get the Nursery & Primary name; no
// primary-specific logo has been supplied, so none is drawn for them —
// drop one at backend/assets/hampsons-primary-logo.png and it'll be
// picked up automatically.
const BRANDING = {
  secondary: { name: 'HAMPSONS COLLEGE', logoFile: 'hampsons-college-logo.png', stampFile: 'hampsons-college-stamp.png' },
  primary: { name: 'HAMPSONS NURSERY & PRIMARY SCHOOL', logoFile: 'hampsons-primary-logo.png', stampFile: 'hampsons-primary-stamp.png' },
};

function loadLocalLogo(file) {
  try {
    const full = path.join(__dirname, '..', 'assets', file);
    return fs.existsSync(full) ? fs.readFileSync(full) : null;
  } catch {
    return null;
  }
}

const AFFECTIVE_LABELS = {
  punctuality: 'Punctuality', neatness: 'Neatness', honesty: 'Honesty', respect: 'Respect',
  leadership: 'Leadership', cooperation: 'Cooperation', initiative: 'Initiative',
  responsibility: 'Responsibility', selfControl: 'Self-Control',
};
const PSYCHOMOTOR_LABELS = {
  handwriting: 'Handwriting', creativity: 'Creativity', drawing: 'Drawing', sports: 'Sports',
  musicalSkills: 'Musical Skills', practicalSkills: 'Practical Skills', communication: 'Communication',
};

function overallGrade(average) {
  if (average >= 80) return 'A';
  if (average >= 70) return 'B';
  if (average >= 60) return 'C';
  if (average >= 50) return 'D';
  if (average >= 40) return 'E';
  return 'F';
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '________________');

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Best-effort fetch of the school logo (stored as a remote Cloudinary
// URL) so it can be embedded in the PDF. Never blocks/fails the PDF if
// the logo can't be fetched — the report card still renders fine without it.
function fetchImageBuffer(url) {
  return new Promise((resolve) => {
    if (!url || !/^https?:\/\//.test(url)) return resolve(null);
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 4000 }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Streams a PDF report card for one Result document directly to `res`
// (an Express response). `result` must already be populated: student,
// class, session, scores.subject, and class.classTeacher.
async function streamReportCard(res, { result, schoolName, schoolLogo, schoolMotto }) {
  const section = result.student?.section || result.class?.section;
  const branding = BRANDING[section];
  // Known section → fixed branding + bundled logo. Anything else falls
  // back to the old behaviour (site settings name + remote logo).
  const displayName = branding ? branding.name : String(schoolName || '').toUpperCase();
  const logoBuffer = branding ? loadLocalLogo(branding.logoFile) : await fetchImageBuffer(schoolLogo);
  // Section stamp (college stamp for secondary; primary's own file once
  // it's dropped into backend/assets) and the student's passport photo.
  const stampBuffer = branding ? loadLocalLogo(branding.stampFile) : null;
  const photoBuffer = await fetchImageBuffer(result.student?.passportPhoto);

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${(result.student.firstName + '-' + result.student.lastName + '-report-card').replace(/\s+/g, '-')}.pdf"`
  );
  doc.pipe(res);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  // --- Header ---
  const headerTop = doc.y;
  const logoSize = 62;
  if (logoBuffer) {
    try { doc.image(logoBuffer, left, headerTop, { fit: [logoSize, logoSize] }); } catch { /* skip a corrupt/unsupported image */ }
  }
  const titleX = logoBuffer ? left + logoSize + 8 : left;
  const titleWidth = logoBuffer ? pageWidth - (logoSize + 8) * 2 : pageWidth; // symmetric so the text stays centred on the page
  const textX = logoBuffer ? left + logoSize + 8 : left;
  doc.font('Helvetica-Bold').fontSize(17).fillColor(NAVY).text(displayName, textX, headerTop, { width: titleWidth, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor('#333333');
  doc.text(SCHOOL_ADDRESS, textX, doc.y + 1, { width: titleWidth, align: 'center' });
  doc.text(`Tel: ${SCHOOL_PHONES}`, textX, doc.y, { width: titleWidth, align: 'center' });
  doc.text(`Email: ${SCHOOL_EMAIL}`, textX, doc.y, { width: titleWidth, align: 'center' });
  doc.y = Math.max(doc.y, headerTop + (logoBuffer ? logoSize : 0)) + 6;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(CRIMSON).text('STUDENT REPORT CARD', left, doc.y, { width: pageWidth, align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).text(
    `School Session: ${result.session?.name || '__________'}        Term: ${result.term}`,
    left, doc.y, { width: pageWidth, align: 'center' }
  );
  doc.moveDown(0.7);

  // --- Student Information ---
  sectionTitle(doc, 'STUDENT INFORMATION', pageWidth, left);
  const info = [
    ['Student Name', `${result.student.firstName} ${result.student.lastName}`],
    ['Admission No.', result.student.admissionNumber || '—'],
    ['Class', result.class?.name || '—'],
    ['Arm', result.class?.arm || '—'],
    ['Gender', result.student.gender ? result.student.gender[0].toUpperCase() + result.student.gender.slice(1) : '—'],
    ['Date of Birth', result.student.dateOfBirth ? fmtDate(result.student.dateOfBirth) : '—'],
    ['Attendance', result.attendance?.totalDays ? `${result.attendance.daysPresent ?? 0} / ${result.attendance.totalDays} Days` : '—'],
    ['Class Teacher', result.class?.classTeacher ? `${result.class.classTeacher.firstName} ${result.class.classTeacher.lastName}` : '—'],
  ];
  // Passport photo box on the right so whoever opens the card can see
  // whose result it is. Falls back to an empty labelled frame when the
  // student has no photo uploaded yet.
  const photoW = 78;
  const photoH = 94;
  const photoX = left + pageWidth - photoW;
  const infoTop = doc.y;
  keyValueTable(doc, info, pageWidth - photoW - 12, left);
  const infoBottom = doc.y;
  doc.rect(photoX, infoTop, photoW, photoH).lineWidth(0.8).stroke('#9aa3b5');
  let photoDrawn = false;
  if (photoBuffer) {
    try { doc.image(photoBuffer, photoX + 1, infoTop + 1, { fit: [photoW - 2, photoH - 2], align: 'center', valign: 'center' }); photoDrawn = true; } catch { /* unsupported image — show the empty frame */ }
  }
  if (!photoDrawn) {
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#9aa3b5').text('PASSPORT', photoX, infoTop + photoH / 2 - 8, { width: photoW, align: 'center' });
    doc.text('PHOTO', photoX, infoTop + photoH / 2 + 2, { width: photoW, align: 'center' });
    doc.fillColor('#000000');
  }
  doc.lineWidth(1);
  doc.y = Math.max(infoBottom, infoTop + photoH + 2);
  doc.moveDown(0.6);

  // --- Academic Performance ---
  sectionTitle(doc, 'ACADEMIC PERFORMANCE', pageWidth, left);
  const cols = [
    { header: 'Subject', width: 0.30 },
    { header: 'CA(30)', width: 0.11 },
    { header: 'Exam(70)', width: 0.12 },
    { header: 'Total(100)', width: 0.12 },
    { header: 'Grade', width: 0.09 },
    { header: 'Position', width: 0.10 },
    { header: 'Remark', width: 0.16 },
  ];
  const rows = result.scores.map((s) => [
    s.subject?.name || '—', String(s.ca1 ?? 0),
    String(s.exam ?? 0), String(s.total ?? 0), s.grade || '—', s.position ? ordinal(s.position) : '—', s.remark || '—',
  ]);
  gridTable(doc, cols, rows, pageWidth, left);
  doc.moveDown(0.6);

  // --- Result Summary ---
  sectionTitle(doc, 'RESULT SUMMARY', pageWidth, left);
  keyValueTable(doc, [
    ['Total Score', String(result.totalScore ?? 0)],
    ['Average Score', String(result.average ?? 0)],
    ['Grade', overallGrade(result.average || 0)],
    ['Overall Position', result.positionInClass ? `${ordinal(result.positionInClass)} of ${result.classSize || '—'} Students` : '—'],
    ['Next Term Begins', result.nextTermBegins ? fmtDate(result.nextTermBegins) : '__________'],
  ], pageWidth, left);
  doc.moveDown(0.6);

  // --- Grade Scale (static reference) ---
  sectionTitle(doc, 'GRADE SCALE', pageWidth, left);
  gridTable(doc, [
    { header: 'Score', width: 0.34 }, { header: 'Grade', width: 0.33 }, { header: 'Remark', width: 0.33 },
  ], [
    ['80 – 100', 'A', 'Excellent'], ['70 – 79', 'B', 'Very Good'], ['60 – 69', 'C', 'Good'],
    ['50 – 59', 'D', 'Fair'], ['40 – 49', 'E', 'Pass'], ['0 – 39', 'F', 'Fail'],
  ], pageWidth, left);
  doc.moveDown(0.6);

  maybeNewPage(doc);

  // --- Affective Domain ---
  sectionTitle(doc, 'AFFECTIVE DOMAIN (Rating 1–5)', pageWidth, left);
  ratingTable(doc, AFFECTIVE_LABELS, result.affectiveDomain, pageWidth, left);
  doc.moveDown(0.6);

  // --- Psychomotor Domain ---
  sectionTitle(doc, 'PSYCHOMOTOR DOMAIN (Rating 1–5)', pageWidth, left);
  ratingTable(doc, PSYCHOMOTOR_LABELS, result.psychomotorDomain, pageWidth, left);
  doc.moveDown(0.6);

  maybeNewPage(doc);

  // --- Comments ---
  sectionTitle(doc, 'COMMENTS', pageWidth, left);
  doc.font('Helvetica-Bold').fontSize(9).text("Class Teacher's Comment:");
  doc.font('Helvetica').fontSize(9).text(result.teacherComment || '__________________________________________________');
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(9).text("Head Teacher / Principal's Comment:");
  doc.font('Helvetica').fontSize(9).text(result.principalComment || '__________________________________________________');
  doc.moveDown(0.8);

  // --- Head Teacher / Principal + School Stamp ---
  const stampW = 130;
  const stampH = 100;
  maybeNewPage(doc, stampH + 40);
  sectionTitle(doc, section === 'primary' ? 'HEAD TEACHER' : section === 'secondary' ? 'PRINCIPAL' : 'HEAD TEACHER / PRINCIPAL', pageWidth, left);
  const sigTop = doc.y + 4;
  doc.font('Helvetica').fontSize(9).fillColor('#000000').text('Date: ______________________', left, sigTop + 30, { width: pageWidth - stampW - 20 });
  const stampX = left + pageWidth - stampW;
  if (stampBuffer) {
    try { doc.image(stampBuffer, stampX, sigTop, { fit: [stampW, stampH], align: 'right', valign: 'top' }); } catch { /* skip an unreadable stamp */ }
  } else {
    // No stamp file for this section yet — keep an empty frame so one can be stamped by hand.
    const r = 30;
    doc.circle(stampX + stampW - r - 4, sigTop + r + 4, r).dash(2, { space: 2 }).stroke('#9aa3b5');
    doc.undash();
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#9aa3b5').text('SCHOOL', stampX + stampW - r * 2 - 4, sigTop + r - 4, { width: r * 2, align: 'center' });
    doc.text('STAMP', stampX + stampW - r * 2 - 4, sigTop + r + 6, { width: r * 2, align: 'center' });
    doc.fillColor('#000000');
  }
  doc.y = sigTop + stampH + 6;
  doc.x = left;
  doc.moveDown(0.4);

  // --- Report Card Status ---
  sectionTitle(doc, 'REPORT CARD STATUS', pageWidth, left);
  keyValueTable(doc, [
    ['Promoted to', result.promotedTo || '__________'],
    ['Next Class', result.nextClass || '__________'],
  ], pageWidth, left);

  // --- Motto footer ---
  if (schoolMotto) {
    doc.moveDown(1);
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(CRIMSON).text(`"${schoolMotto}"`, { align: 'center' });
    doc.fillColor('#000000');
  }

  doc.end();
}

function maybeNewPage(doc, reserve = 140) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - reserve) doc.addPage();
}

function sectionTitle(doc, title, pageWidth, left) {
  maybeNewPage(doc);
  const barHeight = 16;
  const y = doc.y;
  doc.rect(left, y, pageWidth, barHeight).fill(NAVY);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text(title, left + 6, y + 4, { width: pageWidth - 12 });
  doc.fillColor('#000000');
  doc.y = y + barHeight + 6;
}

function keyValueTable(doc, rows, pageWidth, left) {
  const labelWidth = pageWidth * 0.32;
  doc.font('Helvetica').fontSize(9);
  rows.forEach(([label, value]) => {
    const y = doc.y;
    doc.font('Helvetica-Bold').text(label, left, y, { width: labelWidth });
    doc.font('Helvetica').text(String(value), left + labelWidth, y, { width: pageWidth - labelWidth });
    doc.moveDown(0.15);
  });
}

function gridTable(doc, cols, rows, pageWidth, left) {
  const rowHeight = 16;
  let x = left;
  let y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8);
  cols.forEach((c) => {
    doc.rect(x, y, c.width * pageWidth, rowHeight).fillAndStroke('#e7eaf2', '#cccccc');
    doc.fillColor('#000000').text(c.header, x + 2, y + 4, { width: c.width * pageWidth - 4 });
    x += c.width * pageWidth;
  });
  y += rowHeight;
  doc.font('Helvetica').fontSize(8);
  rows.forEach((row) => {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.y;
    }
    x = left;
    row.forEach((cell, i) => {
      doc.rect(x, y, cols[i].width * pageWidth, rowHeight).stroke('#cccccc');
      doc.text(String(cell), x + 2, y + 4, { width: cols[i].width * pageWidth - 4 });
      x += cols[i].width * pageWidth;
    });
    y += rowHeight;
  });
  doc.y = y;
}

function ratingTable(doc, labels, values, pageWidth, left) {
  const cols = [{ header: 'Trait', width: 0.7 }, { header: 'Rating (1-5)', width: 0.3 }];
  const rows = Object.entries(labels).map(([key, label]) => [label, values?.[key] != null ? String(values[key]) : '—']);
  gridTable(doc, cols, rows, pageWidth, left);
}

module.exports = { streamReportCard, overallGrade };
