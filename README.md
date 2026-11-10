# Fix the Poster

Ashesi brand training game. Staff sign in with their Ashesi email, judge real campus posters against the brand guidelines, and build up a score. The Brand and Creative Services team manages posters and sees results in the Studio.

## What's in here

| Path | What it does |
| --- | --- |
| `public/` | The website: page, images, and `netlify-adapter.js` (sign-in and data). |
| `netlify/functions/api.js` | Saves and loads posters, scores, names, questions and uploaded images (Netlify Blobs). |
| `netlify/functions/identity-validate.js` | Blocks sign-ups that don't use an allowed email domain. |
| `netlify/functions/identity-signup.js` | Gives the admin role to emails listed as admins. |
| `netlify/functions/config.json` | Admin emails and allowed email domains. |
| `netlify/functions/seed-posters.json` | The five starter posters. Loaded the first time the site runs. |
| `scripts/dev-server.js` | Local testing only. Not deployed. |

## Setup (one time)

1. **GitHub:** this code lives in the `Brand-Game` repository.
2. **Connect it to Netlify.** In the `ashesi-fix-the-poster` project: Project configuration → Build & deploy → Link repository → choose the GitHub repo. No build command is needed; publish directory is `public` (already set in `netlify.toml`).
3. **Turn on sign-in.** Project configuration → Identity → Enable Identity. Then:
   - Registration: **Open** (the validate function limits sign-ups to Ashesi emails).
   - Keep email confirmation on.
   - Optional: under External providers, enable **Google** so staff can sign in with their Ashesi Google accounts (check with IT first).
4. **Admins and allowed domains** are set in `netlify/functions/config.json` (`adminEmails`, `allowedDomains`). Edit it and push to update. The environment variables `ADMIN_EMAILS` and `ALLOWED_DOMAINS` also work and are added on top.
5. **Open access to the site.** Project configuration → Access & security → Visitor access: turn off "Netlify team login" so staff can reach the sign-in page.
6. **Redeploy** (Deploys → Trigger deploy) so the variables take effect.

## Roles

- **Staff**: play, save scores, see the leaderboard, send questions to the brand team.
- **Admins** (anyone in `adminEmails` / `ADMIN_EMAILS`, or given the `admin` role in Identity): plus the Studio to add and edit posters, staff results, CSV export, and questions from staff.

## Local testing

```
npm install
npm run dev
```
Then open http://localhost:8888. The local server fakes sign-in; see the note at the top of `scripts/dev-server.js`.

## Privacy

The site stores each person's name, email, scores and answers. Let staff know their results are visible to the brand team.
