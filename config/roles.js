/**
 * Central role & permission registry.
 *
 * ACCOUNT TYPES (each with its own dedicated login route — see
 * loginPathFor below):
 *   super_admin | staff | parent | primary_student | secondary_student
 *
 * STAFF ROLES (sub-roles once accountType === 'staff'):
 *   super_admin, principal, vice_principal, head_teacher, teacher,
 *   accountant, bursar, registrar, ict_admin, librarian, hostel_master,
 *   receptionist
 *
 * PERMISSIONS are simple string keys, grouped by module. A staff user's
 * effective permissions = default permissions for their staffRole,
 * further restricted/extended by an explicit `permissions` array set by
 * the Super Admin (see User model).
 */

const ACCOUNT_TYPES = ['super_admin', 'staff', 'parent', 'primary_student', 'secondary_student'];

const STAFF_ROLES = [
  'super_admin',
  'principal',
  'vice_principal',
  'head_teacher',
  'teacher',
  'accountant',
  'bursar',
  'registrar',
  'ict_admin',
  'librarian',
  'hostel_master',
  'receptionist',
];

const MODULES = [
  'students', 'staff', 'parents', 'classes', 'subjects', 'attendance',
  'results', 'timetable', 'fees', 'payments', 'announcements',
  'events', 'assignments', 'library', 'hostel', 'transport', 'complaints',
  'messages', 'notifications', 'reports', 'audit_logs', 'roles',
  'settings', 'backup',
];

const ACTIONS = ['view', 'create', 'update', 'delete', 'approve'];

// Build "module.action" permission strings, e.g. "students.view"
function perms(moduleList, actionList = ACTIONS) {
  const out = [];
  for (const m of moduleList) for (const a of actionList) out.push(`${m}.${a}`);
  return out;
}

const ALL_PERMISSIONS = perms(MODULES);

// Default permission sets per staff role. Super admin gets everything.
const DEFAULT_STAFF_PERMISSIONS = {
  super_admin: ALL_PERMISSIONS,
  principal: perms(MODULES, ['view', 'approve']).concat(
    perms(['announcements', 'events', 'complaints', 'reports'], ACTIONS)
  ),
  vice_principal: perms(
    ['students', 'staff', 'classes', 'attendance', 'results', 'timetable', 'announcements', 'events', 'complaints', 'reports'],
    ['view', 'update', 'approve']
  ),
  head_teacher: perms(
    ['students', 'classes', 'subjects', 'attendance', 'results', 'timetable', 'assignments'],
    ['view', 'create', 'update']
  ),
  teacher: perms(
    ['students', 'attendance', 'assignments', 'results', 'timetable', 'messages'],
    ['view', 'create', 'update']
  ).concat(perms(['subjects', 'classes'], ['view']))
    .concat(perms(['fees'], ['view', 'create', 'update', 'delete']))
    // A teacher who happens to be the Class Teacher for one of their
    // classes (Class.classTeacher — a per-class assignment, not a
    // separate staffRole) needs to reach the approve/publish endpoint.
    // resultController still checks, per result, whether this specific
    // staff member is actually that class's Class Teacher — a Subject
    // Teacher with no class-teacher assignment gets a 403 there even
    // though the RBAC gate lets the request through.
    // Same pattern for fees: feeController checks Class.classTeacher
    // before letting a create/update/delete through — a teacher who
    // isn't a Class Teacher for any class gets 403'd there, even though
    // this permission grant lets the request past the route gate.
    .concat(perms(['results'], ['approve'])),
  accountant: perms(['fees', 'payments', 'reports'], ['view', 'create', 'update']).concat(
    perms(['students', 'parents'], ['view'])
  ),
  bursar: perms(['fees', 'payments', 'reports', 'settings'], ['view', 'create', 'update', 'approve']),
  registrar: perms(['students', 'staff', 'parents', 'classes'], ['view', 'create', 'update']),
  ict_admin: perms(['settings', 'backup', 'roles', 'audit_logs'], ['view', 'create', 'update', 'delete']).concat(
    perms(MODULES, ['view'])
  ),
  librarian: perms(['library'], ['view', 'create', 'update', 'delete']).concat(perms(['students'], ['view'])),
  hostel_master: perms(['hostel'], ['view', 'create', 'update', 'delete']).concat(perms(['students'], ['view'])),
  receptionist: perms(['complaints', 'announcements'], ['view', 'create']).concat(
    perms(['students', 'parents', 'staff'], ['view'])
  ),
};

// The dedicated login route for each account type (frontend/src/utils/roles.js
// has the client-side mirror of this — kept in sync manually since they run
// in separate runtimes).
function loginPathFor(accountType) {
  switch (accountType) {
    case 'super_admin':
      return '/admin/login';
    case 'staff':
      return '/staff/login';
    case 'parent':
      return '/parent/login';
    case 'primary_student':
    case 'secondary_student':
      return '/student/login';
    default:
      return '/login';
  }
}

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  staff: 'Staff',
  parent: 'Parent',
  primary_student: 'Primary Student',
  secondary_student: 'Secondary Student',
};

module.exports = {
  ACCOUNT_TYPES,
  STAFF_ROLES,
  MODULES,
  ACTIONS,
  ALL_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  loginPathFor,
  ROLE_LABELS,
};
