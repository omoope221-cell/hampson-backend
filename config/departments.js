// Senior Secondary (SS1–SS3) departments and the subjects each one takes.
// Used so a subject teacher only sees the students who actually take
// their subject, instead of the whole class.
//
// Subjects are matched by NAME (case/spacing/punctuation-insensitive, with
// a few spelling aliases), so nothing extra has to be set on each subject.

const DEPARTMENT_SUBJECTS = {
  commercial: [
    'English Language', 'Mathematics', 'Citizenship and Heritage Studies', 'Financial Account',
    'Commerce', 'Government', 'Marketing', 'Economics', 'Livestock', 'Digital Technology',
    'Biology', 'Geography', 'Diction',
  ],
  art: [
    'English Language', 'Mathematics', 'Citizenship and Heritage Studies', 'Government',
    'Christian Religion Studies', 'Islamic Religion Studies', 'Yoruba', 'Livestock',
    'Digital Technology', 'Economics', 'Biology', 'Literature in English', 'Diction', 'Music',
  ],
  science: [
    'English Language', 'Mathematics', 'Citizenship and Heritage Studies', 'Biology',
    'Agricultural Science', 'Technical Drawing', 'Further Mathematics', 'Livestock', 'Geography',
    'Physics', 'Chemistry', 'Digital Technology', 'Economics', 'Diction',
  ],
};

// Spelling variants that should count as the same subject.
const ALIASES = {
  english: 'englishlanguage',
  maths: 'mathematics',
  math: 'mathematics',
  furthermaths: 'furthermathematics',
  financialaccounting: 'financialaccount',
  accounting: 'financialaccount',
  christianreligiousstudies: 'christianreligionstudies',
  christianreligiousknowledge: 'christianreligionstudies',
  crs: 'christianreligionstudies',
  islamicreligiousstudies: 'islamicreligionstudies',
  islamicstudies: 'islamicreligionstudies',
  irs: 'islamicreligionstudies',
  citizenshipheritagestudies: 'citizenshipandheritagestudies',
  citizenshipandheritage: 'citizenshipandheritagestudies',
  literature: 'literatureinenglish',
  agriculture: 'agriculturalscience',
  agric: 'agriculturalscience',
  agricscience: 'agriculturalscience',
  digitaltechnologies: 'digitaltechnology',
};

function baseKey(name) {
  const k = String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  return ALIASES[k] || k;
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// The set of canonical keys from the department lists above.
const KNOWN_KEYS = new Set(Object.values(DEPARTMENT_SUBJECTS).flat().map(baseKey));

// Normalised key for a subject name. Tolerates small typos (e.g. someone
// typing "Finanical Account"): a name that isn't an exact match but is
// within 1–2 letters of exactly ONE known subject is treated as that one.
function subjectKey(name) {
  const k = baseKey(name);
  if (KNOWN_KEYS.has(k)) return k;
  const maxDist = k.length >= 8 ? 2 : k.length >= 5 ? 1 : 0;
  if (!maxDist) return k;
  let best = null;
  let bestDist = Infinity;
  let tie = false;
  for (const known of KNOWN_KEYS) {
    const d = editDistance(k, known);
    if (d < bestDist) { best = known; bestDist = d; tie = false; } else if (d === bestDist) tie = true;
  }
  return bestDist <= maxDist && !tie ? best : k;
}

// "Science", "science ", "Sciences", "Arts", "Commerce", "Commercial" → canonical key; '' if unknown/blank.
function normalizeDepartment(raw) {
  const d = String(raw || '').trim().toLowerCase();
  if (!d) return '';
  if (d.startsWith('sci')) return 'science';
  if (d.startsWith('art')) return 'art';
  if (d.startsWith('comm')) return 'commercial';
  return '';
}

const DEPT_KEYS = Object.fromEntries(
  Object.entries(DEPARTMENT_SUBJECTS).map(([dept, names]) => [dept, new Set(names.map(subjectKey))])
);
const ALL_DEPT_SUBJECT_KEYS = new Set(Object.values(DEPT_KEYS).flatMap((s) => [...s]));

// Does this student take this subject?
//  - student with no (recognised) department → yes (can't tell, so never hide them)
//  - subject not in any department's list (e.g. a JSS subject) → yes
//  - otherwise → only if their department offers it
function studentTakesSubject(student, subjectName) {
  const dept = normalizeDepartment(student?.department);
  if (!dept) return true;
  const key = subjectKey(subjectName);
  if (!ALL_DEPT_SUBJECT_KEYS.has(key)) return true;
  return DEPT_KEYS[dept].has(key);
}

// Same rule as studentTakesSubject, but as a MongoDB filter fragment, so
// student lists can be narrowed in the database. null = no narrowing
// (the subject isn't department-specific).
function departmentFilterForSubject(subjectName) {
  const key = subjectKey(subjectName);
  if (!ALL_DEPT_SUBJECT_KEYS.has(key)) return null;
  const or = [{ department: { $in: ['', null] } }]; // no department set → never hidden
  if (DEPT_KEYS.science.has(key)) or.push({ department: /^sci/i });
  if (DEPT_KEYS.art.has(key)) or.push({ department: /^art/i });
  if (DEPT_KEYS.commercial.has(key)) or.push({ department: /^comm/i });
  return { $or: or };
}

// Is this subject on any department's list (i.e. will it be filtered by department)?
function isDepartmentSubject(subjectName) {
  return ALL_DEPT_SUBJECT_KEYS.has(subjectKey(subjectName));
}

module.exports = { isDepartmentSubject, DEPARTMENT_SUBJECTS, subjectKey, normalizeDepartment, studentTakesSubject, departmentFilterForSubject };
