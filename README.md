# Lumina LMS

A full-stack Learning Management System (LMS) built from scratch with Node.js, Express, and Vanilla JS. Features role-based access control (admin / teacher / student), a dark design system inspired by Emil Kowalski's aesthetic, and a complete admin dashboard — all running locally with zero external service dependencies.

---

## Features

**Auth & roles**
- Session-based auth (express-session) with JWT stored in localStorage
- Three roles with strict server-side and client-side enforcement: `admin`, `teacher`, `student`
- Role-aware navigation: each role sees only its own panel items in every dropdown and sidebar

**Student experience**
- Course catalog with search, category filters, and grid/list view toggle
- Enrollment tracking with progress bars and completion percentages
- Calendar and schedule views
- Store page with checkout flow

**Teacher experience**
- Dedicated teacher dashboard with course management panels
- Student progress overview and course analytics via Chart.js

**Admin experience**
- Global KPI dashboard (users, courses, enrollments, uptime)
- Real-time system health monitor (CPU, memory, response times, activity log)
- Full user management: create, edit, activate/deactivate, delete with role filters and live search
- Academic reports with Chart.js graphs and exportable CSV per category

**Design system**
- Dark-first, zero-Bootstrap admin: `#09090b` base, Inter typeface, 240px fixed sidebar, 56px sticky topbar
- CSS design tokens for all colors, spacing, and component states
- Shared-border KPI grids for cohesive data displays

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4.18 |
| Auth | express-session + bcryptjs + JWT |
| Frontend | Vanilla HTML / CSS / JS |
| Charts | Chart.js 4 |
| Icons | Font Awesome 6 |
| Typography | Inter (Google Fonts) |
| Testing | Playwright (E2E, WIP) |

---

## Project structure

```
Lumina LMS/
├── server.js              # Express entry point, route mounting, auth middleware
├── routes/
│   ├── auth.js            # POST /auth/login, POST /auth/logout
│   └── chatbot.js         # Local chatbot endpoint
├── js/
│   ├── auth0-config.js    # Role detection by email
│   ├── auth-guard.js      # Client-side page permissions + PAGE_PERMISSIONS map
│   └── courses.js         # Course catalog logic
├── html/
│   ├── login.html
│   ├── admin.html         # Admin dashboard
│   ├── monitoreo.html     # System monitor
│   ├── usuarios.html      # User management
│   ├── reportes.html      # Academic reports
│   ├── docente.html       # Teacher dashboard
│   ├── courses.html       # Course catalog
│   ├── student-courses.html
│   ├── profile.html
│   ├── settings.html
│   ├── calendar.html
│   ├── schedule.html
│   ├── blog.html
│   ├── contact.html
│   ├── cursos-venta.html  # Course store
│   └── checkout.html
├── styles/
└── tests/                 # Playwright E2E specs (WIP)
```

---

## Getting started

```bash
npm install
node server.js
```

Open `http://localhost:5501`

**Demo credentials**

| Role | Email | Password |
|---|---|---|
| Admin | admin@gmail.com | Temporal#123 |
| Teacher | profesor@gmail.com | Temporal#123 |
| Student | estudiante@gmail.com | Temporal#123 |

---

## Page permissions

| Page | Admin | Teacher | Student |
|---|---|---|---|
| admin.html | ✅ | ❌ | ❌ |
| monitoreo.html | ✅ | ❌ | ❌ |
| usuarios.html | ✅ | ❌ | ❌ |
| reportes.html | ✅ | ❌ | ❌ |
| docente.html | ❌ | ✅ | ❌ |
| courses.html | ✅ | ✅ | ✅ |
| index / profile / settings / calendar | ✅ | ✅ | ✅ |

---

## License

[MIT](LICENSE) © 2025 Fernando Acuña
