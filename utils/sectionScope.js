// Splits the two schools' administration. The Principal and Vice
// Principal run Hampsons College (secondary); the Head Teacher runs
// Hampsons Nursery & Primary. Each only ever sees / acts on their own
// section's students, staff, classes and results. Super Admin (and any
// role not listed here) is unrestricted.
const SECTION_BY_ROLE = {
  principal: 'secondary',
  vice_principal: 'secondary',
  head_teacher: 'primary',
};

// 'primary' | 'secondary' | null (null = not section-restricted)
function sectionScopeFor(user) {
  if (!user || user.accountType !== 'staff') return null;
  return SECTION_BY_ROLE[user.staffRole] || null;
}

function canActOnSection(user, section) {
  const scope = sectionScopeFor(user);
  return !scope || scope === section;
}

// Express middleware: forces `?section=` on list endpoints for scoped
// users, overriding anything the client sent.
function forceSectionQuery(req, res, next) {
  const scope = sectionScopeFor(req.user);
  if (scope) req.query.section = scope;
  next();
}

module.exports = { sectionScopeFor, canActOnSection, forceSectionQuery };
