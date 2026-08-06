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

## Database + Admin Page Builder (Supabase)

The site now has an optional database so an admin can create new pages
from a web form — no code, no re-deploy. New pages appear in the site menu
automatically.

### One-time setup (about 15 minutes)

1. **Create the database**
   - Sign up free at [supabase.com](https://supabase.com) → **New project**
   - Choose a region close to New Brunswick (e.g. East US)
2. **Create the pages table**
   - In Supabase, open **SQL Editor** → **New query**
   - Paste the whole contents of `supabase-setup.sql` → **Run**
3. **Connect the website**
   - In Supabase go to **Project Settings → API**
   - Copy the **Project URL** and the **anon public** key
   - Paste both into `assets/js/supabase-config.js`
4. **Create the admin login**
   - Supabase → **Authentication → Users → Add user**
   - Enter your email and a strong password (tick "Auto Confirm User")
   - Then **Authentication → Providers → Email** and turn **off** "Allow new users to sign up"
     so nobody else can create an account
5. Commit and push to GitHub — Cloudflare redeploys automatically

### Daily use

- Go to **yoursite.com/admin.html** and sign in
- Fill in the title and content, tick **Published**, click **Save page**
- The page goes live at `page.html?slug=your-page` and shows up in the menu
- Leave **Published** unticked to keep a draft only you can see
- **Menu position** controls the order; untick **Show in the website menu**
  for a page you want to link to manually

### Writing content

Type normally. Blank line = new paragraph.
Start a line with `##` for a heading, or `-` for a bullet point.
French is optional — if you leave it blank, visitors see the English version.

### What is safe to publish

The `anon public` key is meant to be public. Row Level Security in
`supabase-setup.sql` means visitors can only read pages marked Published,
and only a signed-in admin can add, edit or delete anything.

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

**Email:** thecommunitypulsefoundationinc@gmail.com  
**Phone:** 506 995 0119 / 506 282 5901  
**Location:** Fredericton, New Brunswick, Canada

---

Built with care for The Community Pulse Foundation.
