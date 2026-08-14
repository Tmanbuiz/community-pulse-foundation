# The Community Pulse Foundation – Official Website

Professional bilingual (English / French) website for **The Community Pulse Foundation Inc.**

---

## Features

- Fully bilingual with one-click language switcher (EN / FR)
- Responsive design (desktop, tablet, mobile)
- Clean modern design matching the organization branding
- Editable content (team members, events, programs) in a single easy-to-edit file
- Volunteer registration linked to your JotForm
- Donate section with Interac e-Transfer instructions
- Real photos from advocacy visit and outreach materials
- Ready for free hosting on Cloudflare Pages via GitHub

---

## How to Deploy (GitHub → Cloudflare Pages)

### 1. Create a GitHub Repository
1. Go to [github.com](https://github.com) and create a new repository (example name: `community-pulse-foundation`)
2. Upload **all the files** in this folder to the repository (or push via Git)

### 2. Connect to Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **Create application** → **Pages** → **Connect to Git**
3. Select your GitHub repository
4. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/` (or leave empty)
5. Click **Save and Deploy**

Your site will be live in about 1–2 minutes at a free `*.pages.dev` address.  
You can later connect your own custom domain.

---

## Site Manager (admin.html)

Everything that changes often is now editable from a web form at
**yoursite.com/admin.html** — no code, no re-deploy. Five tabs:

| Tab | What you control |
|---|---|
| **Pages** | Extra pages with their own web address, optional banner photo, and a menu link |
| **Programs** | The programme cards on the home page — name, tagline, description, photo |
| **Events** | Past and upcoming outreaches — date, location, summary, full details, photo |
| **Team** | Members, roles, bios and headshots |
| **Site text** | Headline, contact email, phone, location, e-Transfer address, volunteer form link |

Every item has English and French fields. Leave French blank and visitors
see the English version. Photos upload straight from your phone or computer.

### One-time setup

1. **Create the database** — sign up free at [supabase.com](https://supabase.com), click **New project**, pick a region close to New Brunswick
2. **Create the tables** — Supabase → **SQL Editor** → **New query**, paste all of `supabase-setup.sql`, click **Run**. This also creates the photo storage bucket
3. **Connect the site** — Supabase → **Project Settings → API**, copy the **Project URL** and the **publishable / anon** key into `assets/js/supabase-config.js`
4. **Create your login** — Supabase → **Authentication → Users → Add user**, tick *Auto Confirm User*
5. **Lock it down** — Supabase → **Authentication → Providers → Email**, turn **off** "Allow new users to sign up"
6. Push to GitHub — Cloudflare Pages redeploys automatically

### Everyday use

1. Go to `yoursite.com/admin.html` and sign in
2. Pick a tab, click **Add new** or **Edit**
3. Fill in the fields, choose a photo if you want one
4. Click **Save** — the live site updates immediately

Anything you leave empty in the database keeps using the built-in content
from `assets/js/data.js`, so nothing disappears while you fill things in.

### Writing content

Type normally. A blank line starts a new paragraph.
Start a line with `##` for a heading, or `-` for a bullet point.

### Photos

- Uploads go to the `site-images` bucket in Supabase (1 GB free)
- JPG or PNG up to 5 MB; landscape photos look best
- Team headshots are cropped to a circle, so centre the face

### Is it safe?

The publishable key is designed to be public. Row Level Security means
visitors can only read published items — creating, editing and deleting
all require your admin login. Use a long password, since `admin.html` is
a guessable address.

---

## How to Edit Content (Admin)

Almost all text and data that changes often is located in one file:

**`assets/js/data.js`**

### To update Team Members
Open `assets/js/data.js` and edit the `team` array:

```js
team: [
  {
    name: "Full Name",
    role: { en: "English Title", fr: "Titre français" },
    bio: {
      en: "Short English bio...",
      fr: "Courte bio en français..."
    },
    image: null
  }
]
```

### To update Past Events / Outreaches
Edit the `events` array in the same file.

### To update Programs
Edit the `programs` array.

After making changes, just commit and push to GitHub — Cloudflare will automatically redeploy the site.

---

## File Structure

```
community-pulse/
├── index.html              ← Main page
├── page.html               ← Displays admin-created pages
├── admin.html              ← Admin login + page builder
├── supabase-setup.sql      ← Run once in Supabase
├── README.md
└── assets/
    ├── css/
    │   └── styles.css
    ├── js/
    │   ├── data.js         ← EDIT THIS for team, events, programs
    │   ├── supabase-config.js  ← Your database keys go here
    │   ├── dynamic-pages.js
    │   └── script.js
    └── images/
        ├── logo-clean.jpg
        ├── team-advocacy.jpg
        ├── outreach-poster.jpg
        └── ...
```

---

## Contact

**Email:** info@thecommunitypulsefoundation.ca  
**Phone:** 506 995 0119 / 506 282 5901  
**Location:** Fredericton, New Brunswick, Canada

---

Built with care for The Community Pulse Foundation.

---

Designed by **WianTribe Inc.**
