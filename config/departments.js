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

function subjectKey(name) {
  const k = String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  return ALIASES[k] || k;
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

module.exports = { DEPARTMENT_SUBJECTS, subjectKey, normalizeDepartment, studentTakesSubject };
