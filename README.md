# QA Test Management V1

A Vercel + Supabase starter for Smoke and Sanity test case management.

## Current V1
- Gods & Glory project seeded as GNG
- Test Case CRUD: create new test cases
- Smoke / Sanity / Regression / LQA classification
- Search and type filtering
- PostgreSQL schema for Projects, Test Cases, Test Runs and Test Results
- Storage bucket prepared for QA attachments
- Architecture keeps database independent from Vercel so the project can be moved later

## Setup
1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Add the Supabase project URL and publishable/anon key.
5. Run:
   npm install
   npm run dev
6. Open http://localhost:3000

## Vercel
Import this repository into Vercel and add the same two environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Moving to another AI / developer
The whole project is self-contained. Give the next developer/AI:
- this ZIP/repository
- `README.md`
- `supabase/schema.sql`
- current requirements
- any existing smoke/sanity Excel or CSV

The database is PostgreSQL, not tied to Vercel. This makes migration to another host or AI-assisted development easier.

## Security note
The SQL uses authenticated-user policies for V1. Before production, add proper user roles and team/project permissions. Do not expose Supabase service-role keys in the browser.
