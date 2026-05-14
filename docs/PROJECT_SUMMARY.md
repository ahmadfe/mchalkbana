# Uppsala Halkbana — Project Summary

> Full-stack booking platform for a Swedish driving school offering Risk 1 / Risk 2 courses approved by Transportstyrelsen. Multilingual (Swedish / English).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.5 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS (custom Swedish flag colors: `#003DA5` blue, yellow) |
| i18n | next-intl (sv/en), locale-prefixed routing `/sv/...` `/en/...` |
| ORM | Prisma 5 |
| Database (prod) | Neon PostgreSQL |
| Database (local) | SQLite (`prisma/dev.db`) |
| Auth | JWT via `jose`, stored in httpOnly cookie (`token`), bcryptjs for hashing |
| Email | Resend |
| File storage | Vercel Blob |
| Payments | Swish (Swedish mobile payments) |
| Messaging | WhatsApp integration |
| Deployment | Vercel (connected to GitHub) |
| Repo | https://github.com/ahmadfe/mchalkbana (branch: main) |

---

## Database Models (prisma/schema.prisma)

- **User** — students, admins, school users. Roles: `student`, `admin`, `school`. Has language preference, hidden flag.
- **School** — driving school locations with contact info.
- **Course** — course definitions (Risk 1, Risk 2, Combo). Bilingual titles (sv/en), vehicle type, behörighet (license class).
- **SchoolCoursePrice** — per-school custom pricing for courses.
- **Session** — scheduled instances of a course at a school. Has seat limits, visibility, combo linking (Risk1+Risk2 sessions linked together).
- **SessionSchoolAllocation** — how many seats a school has allocated per session.
- **Booking** — student or guest booking a session. Supports registered users and guests (name/personnummer/phone/email). Has reminder tracking fields.
- **Payment** — payment record per booking (Swish provider).
- **Settings** — key/value store for app-wide settings.
- **CourseGroup** — grouping of courses.
- **WhatsappNumber** — admin/school WhatsApp numbers.
- **WhatsappConversation** — stateful WhatsApp conversation tracking.
- **InfoCard** — CMS-managed homepage cards (image, video, buttons, sort order).

---

## Project Structure

```
src/
  app/
    [locale]/           # All user-facing pages (locale-prefixed)
      page.tsx          # Home
      courses/          # Course listing
      courses-preview/  # Course preview (used in admin/sharing)
      about/
      contact/
      faq/
      riskutbildning/
      login/
      register/
      dashboard/        # Student dashboard
      checkout/         # Booking checkout (?session=ID)
      admin/            # Admin panel
      school/           # School user panel
      preview/
    api/
      auth/             # register, login, logout, me
      sessions/         # GET (with filters), [id]
      bookings/         # GET, POST, [id] PATCH cancel, [id]/pay
      admin/            # stats, bookings, courses, sessions, settings
      school/           # School-specific API routes
      calendar/         # Calendar data
      contact/          # Contact form
      email/            # Email endpoints
      info-cards/       # CMS info cards CRUD
      settings/         # App settings
      swish/            # Swish payment webhooks/callbacks
      whatsapp/         # WhatsApp webhook
  components/
    Navbar.tsx
    Footer.tsx
    SessionCard.tsx
    FaqSection.tsx
    HomeCardsSection.tsx
    LanguageSwitch.tsx
    CookieBanner.tsx
    MetaPixel.tsx
  lib/
    auth.ts             # signToken, verifyToken, getAuthUser, getAuthUserFromRequest
    db.ts               # Prisma client singleton
    email.ts            # Resend email sending
    swish.ts            # Swish payment logic
    whatsapp-auth.ts    # WhatsApp auth helpers
    types.ts            # Shared TypeScript types
    mockData.ts         # Legacy mock data (kept but pages use real API)
    cities.ts           # Swedish cities list
  context/
    AuthContext.tsx     # useAuth() hook (client-side)
  middleware.ts         # next-intl locale routing middleware
messages/               # i18n translation files (sv.json, en.json)
prisma/
  schema.prisma
  seed.ts               # Demo data seeder
  migrations/
```

---

## Authentication

- JWT stored in httpOnly cookie named `token`
- Server-side: `getAuthUser()` reads from Next.js cookies
- API routes: `getAuthUserFromRequest()` reads from request headers
- Roles: `student`, `admin`, `school`
- Demo accounts (seeded):
  - Student: `student@test.se` / `password123`
  - Admin: `admin@test.se` / `password123`

---

## Key Features

- **Course booking** — students browse sessions, book, and pay via Swish
- **Guest booking** — no account required, captures name/personnummer/phone/email
- **Combo courses** — Risk 1 + Risk 2 sessions linked together as a package
- **School user role** — schools can manage their own sessions and bookings, have custom pricing
- **Admin panel** — full management of courses, sessions, bookings, schools, settings
- **Email reminders** — booking confirmation and reminders via Resend
- **WhatsApp integration** — stateful conversation bot for bookings/info
- **Swish payments** — Swedish mobile payment integration
- **Calendar view** — session calendar for students and admins
- **InfoCards CMS** — admin-managed homepage cards
- **Bilingual** — full Swedish/English support via next-intl
- **Meta Pixel** — Facebook/Meta analytics tracking

---

## DNS & Email Setup

| Service | Purpose |
|---|---|
| Vercel DNS | Manages domain `uppsalahalkbana.se` (nameservers: ns1/ns2.vercel-dns.com) |
| one.com | Email hosting for `info@uppsalahalkbana.se` |
| Resend | Transactional email sending from the app |

**MX Records (set in Vercel DNS):**
- `mx01.one.com` priority 10
- `mx02.one.com` priority 20

**SPF Record (set in one.com DNS):**
- `v=spf1 include:_custspf.one.com ~all`

---

## Local Development

```bash
# Node.js is at C:\Program Files\nodejs\ — must add to PATH in bash
export PATH="/c/Program Files/nodejs:$PATH" && npm run dev
# Runs on http://localhost:3000
```

**Environment variables needed (`.env`):**
```
DATABASE_URL=file:./prisma/dev.db          # local SQLite
# or for prod:
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://...               # Neon direct URL
JWT_SECRET=your-secret
```

---

## Deployment

- **Platform:** Vercel, auto-deploys from GitHub `main` branch
- **Build command:** `npx prisma migrate deploy && next build`
- **Env vars on Vercel:** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, Resend API key, Swish credentials
- SQLite does NOT work on Vercel — production must use PostgreSQL (Neon)
- After schema changes: `npx prisma db push` + push to GitHub

---

## Important Notes for Any Agent

- Always use locale-prefixed routes: `/sv/...` or `/en/...`
- `next.config.ts` is NOT supported in Next.js 14.2.5 — use `next.config.mjs`
- Prisma client is a singleton in `src/lib/db.ts`
- After any schema change, run `prisma db push` and redeploy
- `mockData.ts` still exists but is legacy — pages fetch from real API
- Node.js PATH must be set manually in bash on this Windows machine
