// Creates any Senior Secondary subject (from config/departments.js) that
// doesn't exist yet, as a Secondary-section subject. Matching is by name,
// so "Maths"/"Mathematics" or "Financial Accounting"/"Financial Account"
// are NOT duplicated. Does nothing unless you pass --apply.
//
//   node scripts/addSeniorSubjects.js           (preview only)
//   node scripts/addSeniorSubjects.js --apply   (create the missing ones)
require('dotenv').config();
const mongoose = require('mongoose');
const Subject = require('../models/Subject');
const { DEPARTMENT_SUBJECTS, subjectKey } = require('../config/departments');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await Subject.find().select('name code');
  const haveKeys = new Set(existing.map((s) => subjectKey(s.name)));
  const usedCodes = new Set(existing.map((s) => s.code));

  const wanted = new Map(); // key -> display name (first spelling wins)
  Object.values(DEPARTMENT_SUBJECTS).flat().forEach((n) => { if (!wanted.has(subjectKey(n))) wanted.set(subjectKey(n), n); });

  const toCreate = [...wanted.entries()].filter(([k]) => !haveKeys.has(k)).map(([, name]) => name);
  console.log(toCreate.length ? `${apply ? 'Creating' : 'Would create'}: ${toCreate.join(', ')}` : 'All senior subjects already exist.');

  if (apply) {
    for (const name of toCreate) {
      let code = `${name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-SS`;
      for (let i = 2; usedCodes.has(code); i++) code = `${name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-SS${i}`;
      usedCodes.add(code);
      await Subject.create({ name, code, section: 'secondary' });
    }
  } else if (toCreate.length) console.log('Re-run with --apply to create them.');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
