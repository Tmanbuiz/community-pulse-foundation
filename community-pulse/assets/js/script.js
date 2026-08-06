/* =========================================================
   Community Pulse Foundation - Main Script
   ========================================================= */

let currentLang = 'en';

// ==================== TRANSLATIONS ====================
const translations = {
  en: {
    orgName: "The Community Pulse Foundation",
    tagline: "Connecting People • Building Community",
    navHome: "Home",
    navAbout: "About",
    navPrograms: "Programs",
    navEvents: "Events",
    navTeam: "Team",
    navVolunteer: "Get Involved",
    navContact: "Contact",
    navDonate: "Donate",
    heroBadge: "Non-Profit • New Brunswick",
    heroTitle1: "Connecting People.",
    heroTitle2: "Building Community.",
    heroSubtitle: "A community-centered organization dedicated to fostering inclusion, belonging, and resilience among newcomers, families, youth, and long-term residents across New Brunswick.",
    btnVolunteer: "Become a Volunteer",
    btnDonate: "Donate Now",
    btnLearnMore: "Learn More",
    donateLabel: "Support Our Work",
    donateTitle: "Make a Donation",
    donateText: "Your generous support helps us continue community outreach, newcomer support, food drives, and programs that build belonging across New Brunswick. Every contribution makes a real difference.",
    etransferTitle: "Interac e-Transfer",
    etransferText: "Send to:",
    donateContactTitle: "Questions?",
    donateContactText: "Reach us at 506 995 0119 or 506 282 5901",
    btnDonateNow: "Donate Now",
    aboutLabel: "Who We Are",
    aboutTitle: "About The Community Pulse Foundation",
    aboutP1: "The Community Pulse Foundation was formally incorporated this year with the Government of New Brunswick. We are a non-profit, community-centered organization committed to enhancing social unity, promoting inclusion, and improving the well-being of individuals and families across the province.",
    aboutP2: "Our work focuses on strengthening connection, belonging, and community resilience among newcomers, Indigenous peoples, long-term residents, youth, families, and marginalized populations.",
    missionTitle: "Our Mission",
    missionText: "To foster friendship, belonging, and collaboration among newcomers and residents while promoting love, peace, and mutual understanding across cultural, racial, and faith communities.",
    visionTitle: "Our Vision",
    visionText: "A stronger, more connected, and inclusive New Brunswick where every individual and family feels a true sense of belonging and has the opportunity to thrive.",
    objLabel: "What Guides Us",
    objTitle: "Our Core Objectives",
    progLabel: "What We Do",
    progTitle: "Our Core Programs",
    progDesc: "Our programs support social connection and promote mental and emotional well-being, helping to reduce loneliness and anxiety across communities.",
    eventsLabel: "Our Impact",
    eventsTitle: "Past Outreaches & Initiatives",
    actionPlanTitle: "Programme Action Plan (June – September)",
    teamLabel: "Our People",
    teamTitle: "Meet the Team",
    teamDesc: "Dedicated individuals working to build stronger and more inclusive communities across New Brunswick.",
    teamPhotoCaption: "Advocacy visit to the Office of MP David Myles (Fredericton–Oromocto)",
    volLabel: "Join Us",
    volTitle: "Get Involved",
    volP1: "Whether you want to volunteer, support our outreach drives, share your story on our podcast, or simply connect with others, there is a place for you at The Community Pulse Foundation.",
    volP2: "We welcome newcomers, long-term residents, youth, families, and anyone who believes in building a more inclusive and caring New Brunswick.",
    benefit1: "Make real community impact",
    benefit2: "Meet people from diverse backgrounds",
    benefit3: "Grow your skills and network",
    btnRegister: "Register as a Volunteer",
    contactLabel: "Reach Out",
    contactTitle: "Contact Us",
    emailLabel: "Email",
    phoneLabel: "Phone",
    locationLabel: "Location",
    locationText: "Fredericton, New Brunswick, Canada",
    ctaTitle: "Ready to make a difference?",
    ctaText: "Join our volunteer team or reach out to partner with us on community initiatives.",
    footerTagline: "Connecting People, Celebrating Diversity, Building Community.",
    rights: "All rights reserved.",
    footerNote: "A registered non-profit organization in New Brunswick, Canada."
  },
  fr: {
    orgName: "La Fondation Community Pulse",
    tagline: "Relier les gens • Bâtir la communauté",
    navHome: "Accueil",
    navAbout: "À propos",
    navPrograms: "Programmes",
    navEvents: "Événements",
    navTeam: "Équipe",
    navVolunteer: "S'impliquer",
    navContact: "Contact",
    navDonate: "Faire un don",
    heroBadge: "Organisme sans but lucratif • Nouveau-Brunswick",
    heroTitle1: "Relier les gens.",
    heroTitle2: "Bâtir la communauté.",
    heroSubtitle: "Un organisme centré sur la communauté dédié à favoriser l'inclusion, l'appartenance et la résilience parmi les nouveaux arrivants, les familles, les jeunes et les résidents de longue date au Nouveau-Brunswick.",
    btnVolunteer: "Devenir bénévole",
    btnDonate: "Faire un don",
    btnLearnMore: "En savoir plus",
    donateLabel: "Soutenez notre travail",
    donateTitle: "Faire un don",
    donateText: "Votre généreux soutien nous aide à poursuivre le travail de sensibilisation communautaire, le soutien aux nouveaux arrivants, les collectes alimentaires et les programmes qui favorisent le sentiment d'appartenance au Nouveau-Brunswick. Chaque contribution fait une vraie différence.",
    etransferTitle: "Virement Interac",
    etransferText: "Envoyez à :",
    donateContactTitle: "Des questions ?",
    donateContactText: "Contactez-nous au 506 995 0119 ou 506 282 5901",
    btnDonateNow: "Faire un don",
    aboutLabel: "Qui nous sommes",
    aboutTitle: "À propos de La Fondation Community Pulse",
    aboutP1: "La Fondation Community Pulse a été formellement constituée cette année auprès du gouvernement du Nouveau-Brunswick. Nous sommes un organisme sans but lucratif centré sur la communauté, engagé à renforcer l'unité sociale, à promouvoir l'inclusion et à améliorer le bien-être des individus et des familles à travers la province.",
    aboutP2: "Notre travail vise à renforcer les liens, le sentiment d'appartenance et la résilience communautaire parmi les nouveaux arrivants, les peuples autochtones, les résidents de longue date, les jeunes, les familles et les populations marginalisées.",
    missionTitle: "Notre mission",
    missionText: "Favoriser l'amitié, l'appartenance et la collaboration entre les nouveaux arrivants et les résidents, tout en promouvant l'amour, la paix et la compréhension mutuelle entre les communautés culturelles, raciales et religieuses.",
    visionTitle: "Notre vision",
    visionText: "Un Nouveau-Brunswick plus fort, plus connecté et plus inclusif où chaque individu et chaque famille ressent un véritable sentiment d'appartenance et a la possibilité de s'épanouir.",
    objLabel: "Ce qui nous guide",
    objTitle: "Nos objectifs principaux",
    progLabel: "Ce que nous faisons",
    progTitle: "Nos programmes principaux",
    progDesc: "Nos programmes soutiennent les liens sociaux et favorisent le bien-être mental et émotionnel, contribuant à réduire la solitude et l'anxiété dans les communautés.",
    eventsLabel: "Notre impact",
    eventsTitle: "Initiatives et actions passées",
    actionPlanTitle: "Plan d'action des programmes (juin – septembre)",
    teamLabel: "Notre équipe",
    teamTitle: "Rencontrez l'équipe",
    teamDesc: "Des personnes dévouées qui travaillent à bâtir des communautés plus fortes et plus inclusives au Nouveau-Brunswick.",
    teamPhotoCaption: "Visite de plaidoyer au bureau du député David Myles (Fredericton–Oromocto)",
    volLabel: "Rejoignez-nous",
    volTitle: "S'impliquer",
    volP1: "Que vous souhaitiez faire du bénévolat, soutenir nos campagnes de sensibilisation, partager votre histoire dans notre balado ou simplement vous connecter avec d'autres, il y a une place pour vous à La Fondation Community Pulse.",
    volP2: "Nous accueillons les nouveaux arrivants, les résidents de longue date, les jeunes, les familles et toute personne qui croit en la construction d'un Nouveau-Brunswick plus inclusif et bienveillant.",
    benefit1: "Avoir un impact communautaire réel",
    benefit2: "Rencontrer des personnes de divers horizons",
    benefit3: "Développer vos compétences et votre réseau",
    btnRegister: "S'inscrire comme bénévole",
    contactLabel: "Contactez-nous",
    contactTitle: "Nous joindre",
    emailLabel: "Courriel",
    phoneLabel: "Téléphone",
    locationLabel: "Emplacement",
    locationText: "Fredericton, Nouveau-Brunswick, Canada",
    ctaTitle: "Prêt à faire une différence ?",
    ctaText: "Rejoignez notre équipe de bénévoles ou contactez-nous pour collaborer à des initiatives communautaires.",
    footerTagline: "Relier les gens, célébrer la diversité, bâtir la communauté.",
    rights: "Tous droits réservés.",
    footerNote: "Un organisme sans but lucratif enregistré au Nouveau-Brunswick, Canada."
  }
};

// ==================== LANGUAGE FUNCTIONS ====================
function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  
  // Update buttons
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('lang-fr').classList.toggle('active', lang === 'fr');
  
  // Update all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
  
  // Re-render dynamic sections
  renderObjectives();
  renderPrograms();
  renderEvents();
  renderTeam();
  
  // Save preference
  localStorage.setItem('cpf-lang', lang);
}

// ==================== RENDER FUNCTIONS ====================
function renderObjectives() {
  const grid = document.getElementById('objectivesGrid');
  if (!grid) return;
  
  grid.innerHTML = siteData.objectives.map(obj => `
    <div class="objective-card">
      <div class="obj-icon">${obj.icon}</div>
      <h3>${obj.title[currentLang]}</h3>
      <p>${obj.text[currentLang]}</p>
    </div>
  `).join('');
}

function renderPrograms() {
  const grid = document.getElementById('programsGrid');
  if (!grid) return;
  
  grid.innerHTML = siteData.programs.map(prog => `
    <div class="program-card">
      <div class="program-image">
        <img src="${prog.image}" alt="${prog.title[currentLang]}" loading="lazy" />
      </div>
      <div class="program-content">
        <span class="program-subtitle">${prog.subtitle[currentLang]}</span>
        <h3>${prog.title[currentLang]}</h3>
        <p>${prog.description[currentLang]}</p>
      </div>
    </div>
  `).join('');
}

function renderEvents() {
  const list = document.getElementById('eventsList');
  if (!list) return;
  
  list.innerHTML = siteData.events.map(event => `
    <article class="event-card">
      <div class="event-image">
        <img src="${event.image}" alt="${event.title[currentLang]}" loading="lazy" />
      </div>
      <div class="event-content">
        <div class="event-meta">
          <span class="event-date">${event.date[currentLang]}</span>
          <span class="event-location">${event.location[currentLang]}</span>
        </div>
        <h3>${event.title[currentLang]}</h3>
        <p class="event-summary">${event.summary[currentLang]}</p>
        <p class="event-details">${event.details[currentLang]}</p>
      </div>
    </article>
  `).join('');
}

function renderTeam() {
  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  
  grid.innerHTML = siteData.team.map(member => `
    <div class="team-card">
      <div class="team-avatar">
        <span>${member.name.charAt(0)}</span>
      </div>
      <h3>${member.name}</h3>
      <p class="team-role">${member.role[currentLang]}</p>
      <p class="team-bio">${member.bio[currentLang]}</p>
    </div>
  `).join('');
}

// ==================== MOBILE MENU ====================
function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const nav = document.getElementById('nav');
  
  if (btn && nav) {
    btn.addEventListener('click', () => {
      nav.classList.toggle('open');
      btn.classList.toggle('active');
    });
    
    // Close menu when clicking a link
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        btn.classList.remove('active');
      });
    });
  }
}

// ==================== HEADER SCROLL ====================
function initHeaderScroll() {
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  // Year
  document.getElementById('year').textContent = new Date().getFullYear();
  
  // Language preference
  const savedLang = localStorage.getItem('cpf-lang') || 'en';
  setLanguage(savedLang);
  
  // Mobile menu & header
  initMobileMenu();
  initHeaderScroll();
});
