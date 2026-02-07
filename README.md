# RenkFlow V2

Professional ERP & Order Management Platform

## Monorepo Structure

```
RenkFlow V2/
├── apps/              # Applications
│   ├── web/           # Next.js Web App (renkflow-nextjs)
│   ├── mobile/        # React Native Mobile App
│   └── dashboard/     # Dashboard Application
├── packages/          # Shared packages (empty - for future shared code)
├── .github/           # GitHub workflows
├── package.json       # Root monorepo config
└── .gitignore         # Global ignore patterns
```

## Quick Start

```bash
# Web App
npm run dev:web

# Mobile App  
npm run dev:mobile

# Dashboard
npm run build:dashboard
```

## Apps

- **Web**: Next.js 15, TypeScript, Tailwind CSS, Drizzle ORM
- **Mobile**: React Native / Expo
- **Dashboard**: Analytics & Reporting Interface
