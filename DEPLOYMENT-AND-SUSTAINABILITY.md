# Cadence website — deployment, logic & long-term editing

This is a plain-language guide to getting the site live and keeping it editable as the team and content change. No prior infra knowledge assumed.

---

## 1. What this site actually is right now

It's a **single self-contained page** (`Public website.dc.html`) — all the screens (Home, Story, How It Works, Technology, Roadmap, Team, Contact) live in one file and switch via in-page navigation, no page reloads. The team photos are filled by **dragging an image onto a slot**; each drop is saved to a small sidecar file so it survives reloads and exports.

Strengths: fast, no database, nothing to maintain. Loads as one file.
Limit: today, **content edits happen in the design tool**, not on the live site. Section 4 covers how to change that if you need non-technical people editing copy.

---

## 2. Deployment — getting it on the internet

Order of effort, lowest first:

1. **Export a standalone HTML file** and host it as a static site. Drop it on **Netlify, Vercel, Cloudflare Pages, or GitHub Pages** — all have free tiers, all give you a URL in minutes. Point a custom domain (e.g. `cadence.health`) at it from the host's dashboard. This is the right first move for a pre-launch / early-access marketing site.
2. **Add a real domain + HTTPS** — handled automatically by any of the hosts above.
3. **The email capture form needs a backend** to actually collect addresses. Right now "Request access" only updates the screen. Wire the form to one of: a form service (**Formspree, Basin, Tally**), an email tool (**Mailchimp, ConvertKit, Loops**), or a tiny serverless function. Pick the email tool you'll actually send from — least glue.

---

## 3. How the logic works (plain version)

- **Navigation** is state in the page: clicking a nav item swaps which section is visible. No router, no server.
- **Forms** are local-only until connected to a backend (see 2.3).
- **Images** persist via a per-slot saved file keyed by a stable ID, so swapping a team photo sticks.
- **Responsive**: layouts collapse to one column and the nav becomes a hamburger menu below ~760px wide.

There's no server-side logic and no user accounts — which is exactly what you want for a marketing site. Keep app logic (the actual product) separate from this site.

---

## 4. Sustainability — editing it over the years

The real question: *when the team changes or copy needs updating, who can do it and how?* Three options, pick based on who'll be editing:

**A. Keep editing in the design tool (today's model).**
Best while the team is small and technical. You edit here, re-export, re-deploy. Team photos and text are all editable. Downside: every change is a re-publish, and only people with access to this project can edit.

**B. Move content into a CMS (recommended once non-technical people edit).**
Put the editable stuff — team members, roadmap items, copy — into a **headless CMS** like **Sanity, Contentful, or Storyblok** (or the simplest: a **Google Sheet** the site reads). A marketing hire or ops person then edits team members in a friendly dashboard, no code. This is the durable answer to "can we edit it in the long run if the team changes." Requires a one-time dev integration.

**C. Hand off to developers as a real codebase.**
If the site grows (blog, localization, gated content), convert it to a small framework project (Next.js/Astro) in a Git repo. Slower to start, but the standard long-term home. There's a developer-handoff export for exactly this.

**Recommendation:** Launch with **A** now (fast, free). Plan to move team/roadmap/copy to **B** before you bring on a non-technical editor — that's the moment the current model starts to hurt.

---

## 5. Is there an admin backend?

**Not today, and you likely don't need one yet.** An "admin backend" really means two separate things:

- **Editing site content** → solved by the CMS in 4B. That *is* your admin panel for the website.
- **Seeing who signed up for early access** → solved by whatever you connect the form to in 2.3; that tool's dashboard is your signup admin.

A custom-built admin panel only becomes worth it if you have logged-in users, dynamic data, or a dashboard product — i.e. the **app**, not this marketing site. Don't build one for the website itself; use the off-the-shelf pieces above.

---

## TL;DR
- **Launch:** export standalone HTML → Netlify/Vercel + custom domain. Hours, not weeks.
- **Email form:** connect to Mailchimp/Formspree before launch or it collects nothing.
- **Long-term editing:** fine in-tool for now; move team/roadmap/copy to a headless CMS (Sanity/Contentful) before a non-technical person owns edits.
- **Admin backend:** none needed for the site — the CMS is your content admin, the email tool is your signup admin. Build a real backend only for the product.
