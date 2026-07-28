const PDFDocument = require('pdfkit');
const https = require('https');
const http = require('http');

const NAVY = '#1b2a52';
const CRIMSON = '#8f2233';

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
  const logoBuffer = await fetchImageBuffer(schoolLogo);

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
  if (logoBuffer) {
    try { doc.image(logoBuffer, left, headerTop, { fit: [50, 50] }); } catch { /* skip a corrupt/unsupported image */ }
  }
  const titleX = logoBuffer ? left + 60 : left;
  const titleWidth = logoBuffer ? pageWidth - 60 : pageWidth;
  doc.font('Helvetica-Bold').fontSize(17).fillColor(NAVY).text(schoolName.toUpperCase(), titleX, headerTop, { width: titleWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(12).fillColor(CRIMSON).text('STUDENT REPORT CARD', titleX, doc.y, { width: titleWidth, align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).text(
    `School Session: ${result.session?.name || '__________'}        Term: ${result.term}`,
    { align: 'center' }
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
  keyValueTable(doc, info, pageWidth, left);
  doc.moveDown(0.6);

  // --- Academic Performance ---
  sectionTitle(doc, 'ACADEMIC PERFORMANCE', pageWidth, left);
  const cols = [
    { header: 'Subject', width: 0.26 },
    { header: 'CA1(10)', width: 0.08 },
    { header: 'CA2(10)', width: 0.08 },
    { header: 'Assign.(10)', width: 0.1 },
    { header: 'Exam(70)', width: 0.09 },
    { header: 'Total(100)', width: 0.1 },
    { header: 'Grade', width: 0.08 },
    { header: 'Position', width: 0.09 },
    { header: 'Remark', width: 0.12 },
  ];
  const rows = result.scores.map((s) => [
    s.subject?.name || '—', String(s.ca1 ?? 0), String(s.ca2 ?? 0), String(s.assignment ?? 0),
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

  // --- Signatures (Class Teacher / Head Teacher / Parent-Guardian) + School Stamp ---
  maybeNewPage(doc, 130);
  sectionTitle(doc, 'SIGNATURES', pageWidth, left);
  const sigColWidth = pageWidth / 3;
  const sigTop = doc.y;
  ['CLASS TEACHER', 'HEAD TEACHER / PRINCIPAL', 'PARENT / GUARDIAN'].forEach((label, i) => {
    const x = left + i * sigColWidth;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text(label, x, sigTop, { width: sigColWidth - 8 });
    doc.fillColor('#000000').font('Helvetica').fontSize(9);
    doc.text('Signature: ______________________', x, sigTop + 14, { width: sigColWidth - 8 });
    doc.text('Date: ______________________', x, sigTop + 30, { width: sigColWidth - 8 });
  });
  doc.y = sigTop + 50;
  doc.moveDown(0.6);

  // School Stamp circle
  const stampR = 30;
  const stampCX = left + stampR + 4;
  const stampCY = doc.y + stampR;
  doc.circle(stampCX, stampCY, stampR).dash(2, { space: 2 }).stroke('#9aa3b5');
  doc.undash();
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#9aa3b5').text('SCHOOL', stampCX - stampR, stampCY - 8, { width: stampR * 2, align: 'center' });
  doc.text('STAMP', stampCX - stampR, stampCY + 2, { width: stampR * 2, align: 'center' });
  doc.fillColor('#000000');
  doc.font('Helvetica').fontSize(9).text(`Date Issued: ${fmtDate(result.approvedAt)}`, left + stampR * 2 + 20, stampCY - 5);
  doc.y = stampCY + stampR + 10;
  doc.moveDown(0.6);

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
