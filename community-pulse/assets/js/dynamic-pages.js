/* =========================================================
   LIVE CONTENT FROM THE DATABASE
   ---------------------------------------------------------
   Pulls pages, programs, events, team members and site text
   from Supabase and puts them on the page. Anything not yet
   in the database falls back to assets/js/data.js.
   Nothing here needs editing — use admin.html.
   ========================================================= */

let cpfMenuPages = [];

/* ---------- helpers ---------- */
function cpfEscape(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cpfFormatBody(text) {
  return cpfEscape(text).split(/\n\s*\n/).map((block) => {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.every(l => l.startsWith("- ")))
      return "<ul>" + lines.map(l => `<li>${l.slice(2)}</li>`).join("") + "</ul>";
    if (lines[0].startsWith("## ")) {
      const h = `<h2>${lines[0].slice(3)}</h2>`;
      const rest = lines.slice(1).join("<br>");
      return rest ? h + `<p>${rest}</p>` : h;
    }
    return `<p>${lines.join("<br>")}</p>`;
  }).join("");
}

// Falls back to English when the French field is empty
const cpfPair = (en, fr) => ({ en: en || "", fr: fr || en || "" });

/* ---------- menu pages ---------- */
async function cpfLoadMenuPages() {
  const { data, error } = await cpfDb.from("pages")
    .select("slug, title_en, title_fr, menu_order")
    .eq("published", true).eq("show_in_menu", true)
    .order("menu_order", { ascending: true });
  if (error) return;
  cpfMenuPages = data || [];
  cpfRenderMenuPages();
}

function cpfRenderMenuPages() {
  const nav = document.getElementById("nav");
  if (!nav || !cpfMenuPages.length) return;
  nav.querySelectorAll(".nav-page-link").forEach(el => el.remove());

  const donate = nav.querySelector(".nav-donate");
  const lang = typeof currentLang !== "undefined" ? currentLang : "en";
  const btn = document.getElementById("mobileMenuBtn");

  cpfMenuPages.forEach(page => {
    const a = document.createElement("a");
    a.className = "nav-link nav-page-link";
    a.href = `page.html?slug=${encodeURIComponent(page.slug)}`;
    a.dataset.titleEn = page.title_en;
    a.dataset.titleFr = page.title_fr || page.title_en;
    a.textContent = lang === "fr" ? a.dataset.titleFr : a.dataset.titleEn;
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      if (btn) btn.classList.remove("active");
    });
    donate ? nav.insertBefore(a, donate) : nav.appendChild(a);
  });
}

function cpfUpdateMenuLanguage(lang) {
  document.querySelectorAll(".nav-page-link").forEach(a => {
    a.textContent = lang === "fr" ? a.dataset.titleFr : a.dataset.titleEn;
  });
}

/* ---------- programs / events / team ---------- */
async function cpfLoadSiteContent() {
  if (typeof siteData === "undefined") return;

  const [programs, events, team] = await Promise.all([
    cpfDb.from("programs").select("*").eq("visible", true).order("sort_order", { ascending: true }),
    cpfDb.from("events").select("*").eq("visible", true).order("sort_order", { ascending: true }),
    cpfDb.from("team").select("*").eq("visible", true).order("sort_order", { ascending: true })
  ]);

  if (programs.data && programs.data.length) {
    siteData.programs = programs.data.map(p => ({
      id: p.id,
      image: p.image_url || "assets/images/hero-community.jpg",
      title: cpfPair(p.title_en, p.title_fr),
      subtitle: cpfPair(p.subtitle_en, p.subtitle_fr),
      description: cpfPair(p.description_en, p.description_fr)
    }));
  }

  if (events.data && events.data.length) {
    siteData.events = events.data.map(e => ({
      id: e.id,
      image: e.image_url || "assets/images/hero-community.jpg",
      date: cpfPair(e.date_en, e.date_fr),
      title: cpfPair(e.title_en, e.title_fr),
      location: cpfPair(e.location_en, e.location_fr),
      summary: cpfPair(e.summary_en, e.summary_fr),
      details: cpfPair(e.details_en, e.details_fr)
    }));
  }

  if (team.data && team.data.length) {
    siteData.team = team.data.map(m => ({
      name: m.name,
      role: cpfPair(m.role_en, m.role_fr),
      bio: cpfPair(m.bio_en, m.bio_fr),
      image: m.image_url || null
    }));
  }

  if (typeof renderPrograms === "function") renderPrograms();
  if (typeof renderEvents === "function") renderEvents();
  if (typeof renderTeam === "function") renderTeam();
}

/* ---------- site text & contact details ---------- */
let cpfSettings = null;

async function cpfLoadSettings() {
  const { data, error } = await cpfDb.from("settings").select("*");
  if (error || !data) return;

  cpfSettings = {};
  data.forEach(s => { cpfSettings[s.key] = { en: s.value_en || "", fr: s.value_fr || s.value_en || "" }; });

  // headline text flows through the existing EN / FR dictionary
  ["heroTitle1", "heroTitle2", "heroSubtitle"].forEach(key => {
    if (!cpfSettings[key] || typeof translations === "undefined") return;
    translations.en[key] = cpfSettings[key].en;
    translations.fr[key] = cpfSettings[key].fr;
  });
  if (cpfSettings.contactPlace && typeof translations !== "undefined") {
    translations.en.locationText = cpfSettings.contactPlace.en;
    translations.fr.locationText = cpfSettings.contactPlace.fr;
  }

  cpfApplySettings();
  if (typeof setLanguage === "function") {
    setLanguage(typeof currentLang !== "undefined" ? currentLang : "en");
  }
}

function cpfApplySettings() {
  if (!cpfSettings) return;
  const set = (el, text, href) => {
    if (!el) return;
    if (text != null) el.textContent = text;
    if (href != null) el.href = href;
  };

  if (cpfSettings.contactEmail) {
    const mail = cpfSettings.contactEmail.en;
    set(document.getElementById("contactEmailLink"), mail, "mailto:" + mail);
  }
  if (cpfSettings.donateEmail) {
    const mail = cpfSettings.donateEmail.en;
    set(document.getElementById("donateEmailLink"), mail, "mailto:" + mail);
  }
  if (cpfSettings.contactPhone) {
    const p = document.getElementById("contactPhoneText");
    if (p) p.innerHTML = cpfEscape(cpfSettings.contactPhone.en).replace(/\s*\/\s*/g, "<br>");
  }
  if (cpfSettings.volunteerForm) {
    document.querySelectorAll(".volunteer-link").forEach(a => { a.href = cpfSettings.volunteerForm.en; });
  }
}

/* ---------- keep everything in sync with the EN / FR switcher ---------- */
if (typeof window.setLanguage === "function") {
  const cpfBase = window.setLanguage;
  window.setLanguage = function (lang) {
    cpfBase(lang);
    cpfUpdateMenuLanguage(lang);
    cpfApplySettings();
    if (typeof cpfRenderPage === "function") cpfRenderPage(lang);
  };
}

/* ---------- start ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!window.cpfDb) return;
  cpfLoadMenuPages();
  cpfLoadSiteContent();
  cpfLoadSettings();
});
