/* =========================================================
   Community Pulse Foundation - Main Script
   ========================================================= */

let currentLang = 'en';

// ==================== TRANSLATIONS ====================
const translations = {
  en: {
    welcomeTitle: "Welcome to The Community Pulse Foundation Inc.",
    welcomeP1: "We believe strong communities are built when individuals and families feel seen, heard, valued, and connected. Through innovative programs, community engagement, digital storytelling, advocacy, and outreach initiatives, we work to promote social cohesion, celebrate diversity, and enhance the well-being of communities across New Brunswick and beyond.",
    welcomeP2: "Our work is guided by the belief that every person has a story, every community has a voice, and every connection has the power to create positive change.",
    aboutP3: "Whether supporting newcomers, amplifying Indigenous voices, empowering youth, strengthening families, or fostering multicultural understanding, we are committed to building bridges that create lasting community resilience and belonging.",
    missionTagline: "Creating Meaningful Community Connections",
    visionTagline: "Connecting People. Inspiring Communities.",
    impactIntro: "The Community Pulse Foundation is committed to:",
    involvedTitle: "Ways to Support Our Mission",
    orgName: "The Community Pulse Foundation",
    tagline: "Connecting People • Celebrating Diversity • Building Stronger Communities",
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
    heroTitle2: "Building Stronger Communities.",
    heroSubtitle: "A registered non-profit dedicated to strengthening communities through connection, inclusion, meaningful dialogue, and positive social impact across New Brunswick and beyond.",
    btnVolunteer: "Become a Volunteer",
    btnDonate: "Donate Now",
    btnLearnMore: "Learn More",
    donateLabel: "Support Our Work",
    donateTitle: "Make a Donation",
    donateText: "Your generous support helps us expand outreach, storytelling, education, and community initiatives that create belonging across New Brunswick. Every contribution makes a real difference.",
    etransferTitle: "Interac e-Transfer",
    etransferText: "Send to:",
    donateContactTitle: "Questions?",
    donateContactText: "Reach us at 506 995 0119 or 506 282 5901",
    btnDonateNow: "Donate Now",
    aboutLabel: "Who We Are",
    aboutTitle: "Building Stronger Communities Together",
    aboutP1: "The Community Pulse Foundation Inc. is a registered non-profit organization incorporated with the Government of New Brunswick, dedicated to strengthening communities through connection, inclusion, meaningful dialogue, and positive social impact. We create opportunities for people from diverse backgrounds to connect, share experiences, access support, and contribute to the growth of their communities.",
    aboutP2: "Our work supports newcomers and immigrant communities, Indigenous peoples, youth and young adults, children and families, seniors, long-term residents, and vulnerable populations — creating welcoming spaces where every voice matters and everyone has the opportunity to belong.",
    missionTitle: "Our Mission",
    missionText: "To create an inclusive and engaging platform that supports newcomers and residents, highlights community achievements, promotes learning, and strengthens relationships through digital storytelling, podcasting, advocacy, education, and community outreach programs.",
    visionTitle: "Our Vision",
    visionText: "To connect, empower, and celebrate individuals and families across New Brunswick and Canada by building bridges of inclusion, dialogue, compassion, and community growth while amplifying diverse voices and experiences.",
    objLabel: "What Guides Our Work",
    objTitle: "Our Core Values",
    progLabel: "Programs & Initiatives",
    progTitle: "Our Community Programs",
    progDesc: "Every programme is built on one belief: every person has a story, every community has a voice, and every connection has the power to create positive change.",
    eventsLabel: "Our Community Impact",
    eventsTitle: "Creating Positive Change Together",
    actionPlanTitle: "Programme Action Plan (June – September)",
    teamLabel: "Our People",
    teamTitle: "Meet the Team",
    teamDesc: "Dedicated individuals working to build stronger, more inclusive and more resilient communities across New Brunswick.",
    teamPhotoCaption: "The Community Pulse Foundation team in the community",
    volLabel: "Get Involved",
    volTitle: "Help Build Stronger Communities",
    volP1: "Community transformation happens when individuals, families, organizations, and volunteers work together. Volunteer with us, partner with us, share your story, support our programs, or simply take part in our events and conversations.",
    volP2: "Newcomers, long-term residents, youth, families — whoever you are, there is a place for you at The Community Pulse Foundation.",
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
    ctaTitle: "Ready to build stronger communities?",
    ctaText: "Join us as we continue building bridges, strengthening relationships, and creating positive change across New Brunswick and beyond.",
    footerTagline: "Connecting People, Celebrating Diversity, Building Stronger Communities.",
    rights: "All rights reserved.",
    footerNote: "A registered non-profit organization in New Brunswick, Canada.",
    poweredBy: "Designed & powered by"
  },
  fr: {
    welcomeTitle: "Bienvenue à La Fondation Community Pulse Inc.",
    welcomeP1: "Nous croyons que les communautés fortes se bâtissent lorsque les individus et les familles se sentent vus, entendus, valorisés et reliés. Par des programmes novateurs, l'engagement communautaire, les récits numériques, le plaidoyer et les initiatives de sensibilisation, nous favorisons la cohésion sociale, célébrons la diversité et améliorons le mieux-être des communautés du Nouveau-Brunswick et d'ailleurs.",
    welcomeP2: "Notre travail est guidé par la conviction que chaque personne a une histoire, chaque communauté a une voix, et chaque lien a le pouvoir de créer un changement positif.",
    aboutP3: "Qu'il s'agisse de soutenir les nouveaux arrivants, d'amplifier les voix autochtones, d'outiller les jeunes, de renforcer les familles ou de favoriser la compréhension multiculturelle, nous nous engageons à bâtir des ponts qui créent une résilience et un sentiment d'appartenance durables.",
    missionTagline: "Créer des liens communautaires significatifs",
    visionTagline: "Relier les gens. Inspirer les communautés.",
    impactIntro: "La Fondation Community Pulse s'engage à :",
    involvedTitle: "Façons de soutenir notre mission",
    orgName: "La Fondation Community Pulse",
    tagline: "Relier les gens • Célébrer la diversité • Bâtir des communautés plus fortes",
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
    heroTitle2: "Bâtir des communautés plus fortes.",
    heroSubtitle: "Un organisme sans but lucratif enregistré, dédié à renforcer les communautés par la connexion, l'inclusion, le dialogue significatif et l'impact social positif, au Nouveau-Brunswick et au-delà.",
    btnVolunteer: "Devenir bénévole",
    btnDonate: "Faire un don",
    btnLearnMore: "En savoir plus",
    donateLabel: "Soutenez notre travail",
    donateTitle: "Faire un don",
    donateText: "Votre généreux soutien nous aide à élargir la sensibilisation, les récits, l'éducation et les initiatives communautaires qui favorisent l'appartenance au Nouveau-Brunswick. Chaque contribution fait une vraie différence.",
    etransferTitle: "Virement Interac",
    etransferText: "Envoyez à :",
    donateContactTitle: "Des questions ?",
    donateContactText: "Contactez-nous au 506 995 0119 ou 506 282 5901",
    btnDonateNow: "Faire un don",
    aboutLabel: "Qui nous sommes",
    aboutTitle: "Bâtir ensemble des communautés plus fortes",
    aboutP1: "La Fondation Community Pulse Inc. est un organisme sans but lucratif enregistré, constitué auprès du gouvernement du Nouveau-Brunswick, dédié à renforcer les communautés par la connexion, l'inclusion, le dialogue significatif et l'impact social positif. Nous créons des occasions pour des personnes de tous horizons de se rencontrer, de partager leurs expériences, d'accéder à du soutien et de contribuer à la croissance de leur communauté.",
    aboutP2: "Notre travail soutient les nouveaux arrivants et les communautés immigrantes, les peuples autochtones, les jeunes et jeunes adultes, les enfants et les familles, les aînés, les résidents de longue date et les populations vulnérables — en créant des espaces accueillants où chaque voix compte et où chacun a la possibilité d'appartenir.",
    missionTitle: "Notre mission",
    missionText: "Créer une plateforme inclusive et engageante qui soutient les nouveaux arrivants et les résidents, met en valeur les réussites communautaires, favorise l'apprentissage et renforce les relations grâce aux récits numériques, à la baladodiffusion, au plaidoyer, à l'éducation et aux programmes de sensibilisation communautaire.",
    visionTitle: "Notre vision",
    visionText: "Relier, autonomiser et célébrer les individus et les familles du Nouveau-Brunswick et du Canada en bâtissant des ponts d'inclusion, de dialogue, de compassion et de croissance communautaire, tout en amplifiant des voix et des expériences diversifiées.",
    objLabel: "Ce qui guide notre travail",
    objTitle: "Nos valeurs fondamentales",
    progLabel: "Programmes et initiatives",
    progTitle: "Nos programmes communautaires",
    progDesc: "Chaque programme repose sur une conviction : chaque personne a une histoire, chaque communauté a une voix, et chaque lien a le pouvoir de créer un changement positif.",
    eventsLabel: "Notre impact communautaire",
    eventsTitle: "Créer ensemble un changement positif",
    actionPlanTitle: "Plan d'action des programmes (juin – septembre)",
    teamLabel: "Notre équipe",
    teamTitle: "Rencontrez l'équipe",
    teamDesc: "Des personnes dévouées qui travaillent à bâtir des communautés plus fortes, plus inclusives et plus résilientes au Nouveau-Brunswick.",
    teamPhotoCaption: "L'équipe de la Fondation Community Pulse dans la communauté",
    volLabel: "S'impliquer",
    volTitle: "Aidez-nous à bâtir des communautés plus fortes",
    volP1: "La transformation communautaire se produit lorsque les individus, les familles, les organismes et les bénévoles travaillent ensemble. Faites du bénévolat, devenez partenaire, partagez votre histoire, soutenez nos programmes ou participez simplement à nos événements et à nos conversations.",
    volP2: "Nouveaux arrivants, résidents de longue date, jeunes, familles — qui que vous soyez, il y a une place pour vous à La Fondation Community Pulse.",
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
    ctaTitle: "Prêt à bâtir des communautés plus fortes ?",
    ctaText: "Joignez-vous à nous alors que nous continuons à bâtir des ponts, à renforcer les relations et à créer un changement positif au Nouveau-Brunswick et au-delà.",
    footerTagline: "Relier les gens, célébrer la diversité, bâtir des communautés plus fortes.",
    rights: "Tous droits réservés.",
    footerNote: "Un organisme sans but lucratif enregistré au Nouveau-Brunswick, Canada.",
    poweredBy: "Conçu et propulsé par"
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
  renderImpactPoints();
  renderGetInvolved();
  
  // Save preference
  cpfSetStoredLang(lang);
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
        <h3>${prog.title[currentLang]}</h3>
        <span class="program-subtitle">${prog.subtitle[currentLang]}</span>
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

function renderImpactPoints() {
  const list = document.getElementById('impactPoints');
  if (!list) return;
  list.innerHTML = siteData.impactPoints.map(p =>
    `<li>${p[currentLang]}</li>`).join('');
}

function renderGetInvolved() {
  const grid = document.getElementById('involvedGrid');
  if (!grid) return;
  grid.innerHTML = siteData.getInvolved.map(w => `
    <div class="involved-card">
      <span class="involved-icon">${w.icon}</span>
      <h4>${w.title[currentLang]}</h4>
      <p>${w.text[currentLang]}</p>
    </div>`).join('');
}

function renderTeam() {
  const grid0 = document.getElementById('teamGrid');
  if (grid0 && (!siteData.team || !siteData.team.length)) { grid0.innerHTML = ''; return; }

  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  
  grid.innerHTML = siteData.team.map(member => `
    <div class="team-card">
      <div class="team-avatar">
        ${member.image
          ? `<img src="${member.image}" alt="${member.name}" loading="lazy" />`
          : `<span>${member.name.charAt(0)}</span>`}
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
    const closeMenu = () => {
      nav.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    };

    btn.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      btn.classList.toggle('active', isOpen);
      btn.setAttribute('aria-expanded', String(isOpen));
    });

    // Close menu when clicking a link
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        closeMenu();
        btn.focus();
      }
    });

    // Close when clicking outside the menu
    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || btn.contains(e.target)) return;
      closeMenu();
    });
  }
}

// ==================== HEADER SCROLL ====================
function initHeaderScroll() {
  const header = document.getElementById('header');
  let ticking = false;

  const applyState = () => {
    header.classList.toggle('scrolled', window.scrollY > 50);
    ticking = false;
  };

  // Set correct state immediately in case the page loads mid-scroll
  applyState();

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(applyState);
      ticking = true;
    }
  }, { passive: true });
}

// ==================== STORAGE (safe in private browsing) ====================
function cpfGetStoredLang() {
  try {
    return localStorage.getItem('cpf-lang');
  } catch (e) {
    return null;
  }
}

function cpfSetStoredLang(lang) {
  try {
    localStorage.setItem('cpf-lang', lang);
  } catch (e) {
    // private browsing / storage disabled — language just won't persist
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  // Year
  document.getElementById('year').textContent = new Date().getFullYear();

  // Language preference — URL (?lang=fr) takes priority so shared French links work
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  const savedLang = (urlLang === 'en' || urlLang === 'fr') ? urlLang : (cpfGetStoredLang() || 'en');
  setLanguage(savedLang);

  // Mobile menu & header
  initMobileMenu();
  initHeaderScroll();
});
