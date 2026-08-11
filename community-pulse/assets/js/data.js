/* =========================================================
   COMMUNITY PULSE FOUNDATION - EDITABLE CONTENT
   =========================================================
   This file contains all the content that can be easily
   updated by an admin. Just edit the text and images below.
   ========================================================= */

const siteData = {
  // ==================== CORE VALUES ====================
  objectives: [
    {
      icon: "\ud83e\udec2",
      title: { en: "Inclusion", fr: "Inclusion" },
      text: {
        en: "We believe everyone deserves to feel welcomed, respected, and valued.",
        fr: "Nous croyons que chacun mérite de se sentir accueilli, respecté et valorisé."
      }
    },
    {
      icon: "\ud83c\udfd8\ufe0f",
      title: { en: "Community", fr: "Communauté" },
      text: {
        en: "We build relationships that strengthen belonging and collective responsibility.",
        fr: "Nous bâtissons des relations qui renforcent l'appartenance et la responsabilité collective."
      }
    },
    {
      icon: "\ud83c\udf0d",
      title: { en: "Diversity", fr: "Diversité" },
      text: {
        en: "We celebrate different cultures, experiences, perspectives, and identities.",
        fr: "Nous célébrons les différentes cultures, expériences, perspectives et identités."
      }
    },
    {
      icon: "\ud83c\udf31",
      title: { en: "Empowerment", fr: "Autonomisation" },
      text: {
        en: "We create opportunities for individuals and communities to grow and thrive.",
        fr: "Nous créons des occasions pour les individus et les communautés de grandir et de s'épanouir."
      }
    },
    {
      icon: "\ud83e\udd1d",
      title: { en: "Collaboration", fr: "Collaboration" },
      text: {
        en: "We work together with individuals, organizations, and partners to create meaningful impact.",
        fr: "Nous travaillons avec des individus, des organismes et des partenaires pour créer un impact significatif."
      }
    }
  ],

  // ==================== COMMUNITY IMPACT COMMITMENTS ====================
  impactPoints: [
    { en: "Strengthening social connections across New Brunswick",
      fr: "Renforcer les liens sociaux partout au Nouveau-Brunswick" },
    { en: "Supporting newcomer integration and belonging",
      fr: "Soutenir l'intégration et l'appartenance des nouveaux arrivants" },
    { en: "Promoting diversity, inclusion, and intercultural understanding",
      fr: "Promouvoir la diversité, l'inclusion et la compréhension interculturelle" },
    { en: "Creating leadership opportunities for youth",
      fr: "Créer des occasions de leadership pour les jeunes" },
    { en: "Supporting families and community well-being",
      fr: "Soutenir les familles et le mieux-être communautaire" },
    { en: "Building stronger and more resilient communities",
      fr: "Bâtir des communautés plus fortes et plus résilientes" },
    { en: "Amplifying voices through storytelling and advocacy",
      fr: "Amplifier les voix par le récit et le plaidoyer" }
  ],

  // ==================== WAYS TO GET INVOLVED ====================
  getInvolved: [
    {
      icon: "\ud83e\udd1d",
      title: { en: "Volunteer With Us", fr: "Faire du bénévolat" },
      text: {
        en: "Share your skills, time, and passion to support community initiatives.",
        fr: "Partagez vos compétences, votre temps et votre passion pour soutenir les initiatives communautaires."
      }
    },
    {
      icon: "\ud83e\udd1d",
      title: { en: "Partner With Us", fr: "Devenir partenaire" },
      text: {
        en: "Collaborate with us to create meaningful programs and community impact.",
        fr: "Collaborez avec nous pour créer des programmes significatifs et un impact communautaire."
      }
    },
    {
      icon: "\ud83c\udf99\ufe0f",
      title: { en: "Share Your Story", fr: "Partager votre histoire" },
      text: {
        en: "Your experiences can inspire and connect others.",
        fr: "Vos expériences peuvent inspirer et rapprocher les autres."
      }
    },
    {
      icon: "\ud83d\udc9a",
      title: { en: "Support Our Programs", fr: "Soutenir nos programmes" },
      text: {
        en: "Help us expand outreach, storytelling, and community initiatives.",
        fr: "Aidez-nous à élargir la sensibilisation, les récits et les initiatives communautaires."
      }
    },
    {
      icon: "\ud83c\udf1f",
      title: { en: "Participate", fr: "Participer" },
      text: {
        en: "Join our events, conversations, and community activities.",
        fr: "Joignez-vous à nos événements, conversations et activités communautaires."
      }
    }
  ],

  // ==================== PROGRAMS ====================
  programs: [
    {
      id: "podcast",
      image: "assets/images/podcast-setup.jpg",
      title: { en: "Community Personality Show & Podcast", fr: "\u00c9mission et balado Personnalit\u00e9 communautaire" },
      subtitle: { en: "Sharing Stories. Inspiring Change.", fr: "Partager des histoires. Inspirer le changement." },
      description: {
        en: "We highlight individuals creating positive change within their communities. Through interviews, storytelling, and meaningful conversations, we celebrate achievements and inspire leadership, resilience, and social responsibility. Guests include community leaders, youth changemakers, newcomer success stories, Indigenous voices, entrepreneurs, and volunteers.",
        fr: "Nous mettons en lumi\u00e8re des personnes qui cr\u00e9ent un changement positif dans leur communaut\u00e9. Par des entrevues, des r\u00e9cits et des conversations significatives, nous c\u00e9l\u00e9brons les r\u00e9ussites et inspirons le leadership, la r\u00e9silience et la responsabilit\u00e9 sociale. Nos invit\u00e9s comprennent des leaders communautaires, de jeunes acteurs de changement, des nouveaux arrivants, des voix autochtones, des entrepreneurs et des b\u00e9n\u00e9voles."
      }
    },
    {
      id: "outreach",
      image: "assets/images/volunteers-packing.jpg",
      title: { en: "Community Service & Outreach", fr: "Service communautaire et sensibilisation" },
      subtitle: { en: "Serving Communities Through Action", fr: "Servir la communaut\u00e9 par l'action" },
      description: {
        en: "Communities become stronger when people support and care for one another. Our outreach creates practical support systems and opportunities to take part: volunteer engagement programs, newcomer support, food bank collaborations, charity campaigns, community resource navigation, social inclusion programs, and seasonal outreach activities.",
        fr: "Les communaut\u00e9s se renforcent lorsque les gens s'entraident. Notre travail cr\u00e9e des syst\u00e8mes de soutien concrets et des occasions de participer : programmes de b\u00e9n\u00e9volat, soutien aux nouveaux arrivants, collaborations avec les banques alimentaires, campagnes de charit\u00e9, orientation vers les ressources, programmes d'inclusion sociale et activit\u00e9s saisonni\u00e8res."
      }
    },
    {
      id: "family",
      image: "assets/images/family-talk.jpg",
      title: { en: "Relationship & Family Conversations", fr: "Conversations sur les relations et la famille" },
      subtitle: { en: "Strengthening Families. Building Healthy Relationships.", fr: "Renforcer les familles. B\u00e2tir des relations saines." },
      description: {
        en: "Families are the foundation of strong communities. Through conversations, education, and community discussions we explore family relationships, parenting support, marriage and partnerships, intercultural relationships, family wellness, and communication and conflict resolution.",
        fr: "Les familles sont le fondement de communaut\u00e9s fortes. Par des conversations, de l'\u00e9ducation et des discussions communautaires, nous abordons les relations familiales, le soutien \u00e0 la parentalit\u00e9, le mariage et les partenariats, les relations interculturelles, le bien-\u00eatre familial ainsi que la communication et la r\u00e9solution de conflits."
      }
    },
    {
      id: "health",
      image: "assets/images/hero-community.jpg",
      title: { en: "Community Health Talk", fr: "Discussions sur la sant\u00e9 communautaire" },
      subtitle: { en: "Promoting Health, Wellness, and Awareness", fr: "Promouvoir la sant\u00e9, le bien-\u00eatre et la sensibilisation" },
      description: {
        en: "Healthier communities are created through awareness, education, and access to reliable information. We bring together healthcare professionals, community leaders, and people with lived experience around physical health awareness, mental health education, preventive healthcare, community wellness, and health equity and accessibility.",
        fr: "Des communaut\u00e9s en meilleure sant\u00e9 se b\u00e2tissent par la sensibilisation, l'\u00e9ducation et l'acc\u00e8s \u00e0 une information fiable. Nous r\u00e9unissons des professionnels de la sant\u00e9, des leaders communautaires et des personnes ayant un v\u00e9cu autour de la sant\u00e9 physique, de la sant\u00e9 mentale, des soins pr\u00e9ventifs, du mieux-\u00eatre collectif et de l'\u00e9quit\u00e9 en sant\u00e9."
      }
    },
    {
      id: "children",
      image: "assets/images/family-talk.jpg",
      title: { en: "Children's Corner", fr: "Le coin des enfants" },
      subtitle: { en: "Inspiring Young Minds Through Learning and Creativity", fr: "Inspirer les jeunes esprits par l'apprentissage et la cr\u00e9ativit\u00e9" },
      description: {
        en: "Children are the future of every community. The Children's Corner offers storytelling sessions, educational activities, character development lessons, creative challenges, cultural learning, and family-friendly entertainment. Every child deserves the chance to learn, grow, express themselves, and thrive.",
        fr: "Les enfants sont l'avenir de chaque communaut\u00e9. Le coin des enfants propose des s\u00e9ances de contes, des activit\u00e9s \u00e9ducatives, des le\u00e7ons sur le d\u00e9veloppement du caract\u00e8re, des d\u00e9fis cr\u00e9atifs, des apprentissages culturels et des divertissements familiaux. Chaque enfant m\u00e9rite d'apprendre, de grandir, de s'exprimer et de s'\u00e9panouir."
      }
    }
  ],

  // ==================== EVENTS / PAST OUTREACHES ====================
  events: [
    {
      id: "advocacy-mp",
      date: { en: "2025", fr: "2025" },
      title: {
        en: "Advocacy Visit to the Office of MP David Myles",
        fr: "Visite de plaidoyer au bureau du député David Myles"
      },
      location: { en: "Fredericton–Oromocto", fr: "Fredericton–Oromocto" },
      image: "assets/images/team-advocacy.jpg",
      summary: {
        en: "The Community Pulse Foundation team recently paid an advocacy visit to the Office of MP David Myles to discuss key immigration challenges affecting international students, temporary foreign workers, and immigrant families in New Brunswick.",
        fr: "L'équipe de la Fondation Community Pulse a récemment effectué une visite de plaidoyer au bureau du député David Myles pour discuter des principaux défis d'immigration touchant les étudiants internationaux, les travailleurs étrangers temporaires et les familles immigrantes au Nouveau-Brunswick."
      },
      details: {
        en: "The Community Pulse Foundation remains committed to amplifying community voices, promoting inclusion, and advocating for fair and accessible immigration pathways for newcomers in New Brunswick.",
        fr: "La Fondation Community Pulse demeure engagée à amplifier les voix communautaires, à promouvoir l'inclusion et à défendre des voies d'immigration justes et accessibles pour les nouveaux arrivants au Nouveau-Brunswick."
      }
    },
    {
      id: "homeless-drive",
      date: { en: "June 2025", fr: "Juin 2025" },
      title: {
        en: "Fredericton Homeless Kitchen & Shelter Outreach",
        fr: "Sensibilisation auprès de la cuisine et de l'abri pour sans-abri de Fredericton"
      },
      location: { en: "Fredericton, NB", fr: "Fredericton, N.-B." },
      image: "assets/images/outreach-poster.jpg",
      summary: {
        en: "As part of our periodic community outreach, the Community Pulse Foundation supported the Fredericton homeless kitchen and shelter by collecting and donating essential items, including food, clothing, hygiene products, blankets, and household supplies.",
        fr: "Dans le cadre de notre sensibilisation communautaire périodique, la Fondation Community Pulse a soutenu la cuisine et l'abri pour sans-abri de Fredericton en recueillant et en donnant des articles essentiels : nourriture, vêtements, produits d'hygiène, couvertures et fournitures ménagères."
      },
      details: {
        en: "Through initiatives like this, we continue to support people and families in need and strengthen compassion, connection, and community support.",
        fr: "Grâce à des initiatives comme celle-ci, nous continuons à soutenir les personnes et les familles dans le besoin et à renforcer la compassion, les liens et l'entraide communautaire."
      }
    }
  ],

  // ==================== TEAM MEMBERS ====================
  // Easy to edit: just add, remove or update objects below
  team: [
    // Nobody is listed on the website right now.
    // Add people in the Site Manager (Team tab) and they appear here automatically.
    // You can also hard-code someone below:
    // { name: "Full Name",
    //   role: { en: "Role", fr: "Rôle" },
    //   bio:  { en: "Short bio", fr: "Courte bio" },
    //   image: null }
  ]
};
