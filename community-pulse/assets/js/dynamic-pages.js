/* =========================================================
   ADMIN-CREATED PAGES
   ---------------------------------------------------------
   Pulls pages from the database and adds them to the menu.
   Nothing here needs editing — pages are managed in admin.html
   ========================================================= */

let cpfMenuPages = [];

/* ---------- Turn the admin's plain text into safe HTML ---------- */
function cpfEscape(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cpfFormatBody(text) {
  const blocks = cpfEscape(text).split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return "";

      if (lines.every((l) => l.startsWith("- "))) {
        return (
          "<ul>" +
          lines.map((l) => `<li>${l.slice(2)}</li>`).join("") +
          "</ul>"
        );
      }
      if (lines[0].startsWith("## ")) {
        const heading = `<h2>${lines[0].slice(3)}</h2>`;
        const rest = lines.slice(1).join("<br>");
        return rest ? heading + `<p>${rest}</p>` : heading;
      }
      return `<p>${lines.join("<br>")}</p>`;
    })
    .join("");
}

/* ---------- Menu ---------- */
async function cpfLoadMenuPages() {
  if (!window.cpfDb) return;

  const { data, error } = await cpfDb
    .from("pages")
    .select("slug, title_en, title_fr, menu_order")
    .eq("published", true)
    .eq("show_in_menu", true)
    .order("menu_order", { ascending: true });

  if (error) {
    console.warn("Could not load menu pages:", error.message);
    return;
  }

  cpfMenuPages = data || [];
  cpfRenderMenuPages();
}

function cpfRenderMenuPages() {
  const nav = document.getElementById("nav");
  if (!nav || !cpfMenuPages.length) return;

  nav.querySelectorAll(".nav-page-link").forEach((el) => el.remove());

  const donateLink = nav.querySelector(".nav-donate");
  const lang = typeof currentLang !== "undefined" ? currentLang : "en";

  cpfMenuPages.forEach((page) => {
    const a = document.createElement("a");
    a.className = "nav-link nav-page-link";
    a.href = `page.html?slug=${encodeURIComponent(page.slug)}`;
    a.dataset.titleEn = page.title_en;
    a.dataset.titleFr = page.title_fr || page.title_en;
    a.textContent = lang === "fr" ? a.dataset.titleFr : a.dataset.titleEn;

    if (donateLink) nav.insertBefore(a, donateLink);
    else nav.appendChild(a);
  });

  // Mobile menu should close on these links too
  const btn = document.getElementById("mobileMenuBtn");
  nav.querySelectorAll(".nav-page-link").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      if (btn) btn.classList.remove("active");
    });
  });
}

function cpfUpdateMenuLanguage(lang) {
  document.querySelectorAll(".nav-page-link").forEach((a) => {
    a.textContent = lang === "fr" ? a.dataset.titleFr : a.dataset.titleEn;
  });
}

/* ---------- Keep menu labels in sync with the EN / FR switcher ---------- */
if (typeof window.setLanguage === "function") {
  const cpfBaseSetLanguage = window.setLanguage;
  window.setLanguage = function (lang) {
    cpfBaseSetLanguage(lang);
    cpfUpdateMenuLanguage(lang);
    if (typeof cpfRenderPage === "function") cpfRenderPage(lang);
  };
}

document.addEventListener("DOMContentLoaded", cpfLoadMenuPages);
