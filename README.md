# Hampsons Group of School — School Management System API

Production-oriented REST API for a **private** school management system.
There is no public-facing content — every route except `/api/v1/auth/login`
requires a valid access token.

## Stack
Node.js · Express · MongoDB (Mongoose) · JWT (access + refresh) · bcrypt · Multer

## Getting started

```bash
cp .env.example .env      # then fill in real secrets
npm install
npm run seed               # creates the first Super Admin account + current session
npm run dev                 # nodemon, http://localhost:5000
```

The seed script prints the Super Admin's temporary credentials — log in once
and change the password immediately.

## Folder structure

```
backend/
  config/        db connection, RBAC/permission registry
  models/        Mongoose schemas
  controllers/   route handlers
  routes/        Express routers, mounted under /api/v1
  middleware/    auth, rbac, error handling, uploads, rate limiting
  utils/         tokens, pagination/filter/search helper, audit log, seed
  uploads/       student passports & staff photos (gitignored)
```

## Authentication flow

1. `POST /api/v1/auth/login` — body: `{ accountType, identifier, password }`.
   `accountType` is one of `staff | parent | primary_student | secondary_student`
   (this is what the frontend's role-selector screen sends). Returns a
   short-lived **access token** in the JSON body and sets an httpOnly
   **refresh token** cookie.
2. Send the access token as `Authorization: Bearer <token>` on every
   subsequent request.
3. When the access token expires (401), call `POST /api/v1/auth/refresh`
   (cookie is sent automatically) to get a new one.
4. `POST /api/v1/auth/logout` clears the refresh cookie.

## RBAC model

- **Account types**: `super_admin, staff, parent, primary_student, secondary_student`.
- **Staff sub-roles**: `principal, vice_principal, head_teacher, teacher,
  accountant, bursar, registrar, ict_admin, librarian, hostel_master,
  receptionist` (`config/roles.js`).
- Each staff sub-role has a **default permission set** (`module.action`
  strings, e.g. `fees.create`). The Super Admin can override any staff
  member's permissions individually via
  `PATCH /api/v1/users/:id/permissions`.
- Route-level guards: `middleware/rbac.js` exposes `restrictTo(...accountTypes)`,
  `restrictToStaffRole(...roles)` and `requirePermission(...perms)`.
- Row-level scoping (a parent only ever sees their own children, a teacher
  only their assigned classes, a student only themselves) is enforced
  inside the relevant controllers, not just at the route layer.

## Key business rules encoded in the API

- Results are **hidden from students/parents until approved**
  (`Result.status: draft → submitted → approved`); only Super Admin /
  roles with `results.approve` can approve.
- A parent has exactly one account that can be linked to many children,
  across Primary and Secondary sections (`Parent.children[]`).
- Student/staff/parent accounts can only be created by a Super Admin via
  `/api/v1/users/*`, which atomically creates the `User` auth record and
  its linked profile document in a transaction.
- Every state-changing admin action is written to `AuditLog`.

## Production checklist before deploying
- Set strong, unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.
- Put MongoDB behind auth, enable TLS.
- Run behind a reverse proxy (nginx) that terminates HTTPS.
- Point `CLIENT_URL` at your deployed frontend origin (CORS).
- Review `RATE_LIMIT_*` values for your expected traffic.
- Swap local disk uploads for S3/Cloud Storage if deploying on ephemeral
  infrastructure.
