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
      icon: "🫂",
      title: { en: "Inclusion", fr: "Inclusion" },
      text: {
        en: "We believe everyone deserves to feel welcomed, respected, and valued.",
        fr: "Nous croyons que chacun mérite de se sentir accueilli, respecté et valorisé."
      }
    },
    {
      icon: "🏘️",
      title: { en: "Community", fr: "Communauté" },
      text: {
        en: "We build relationships that strengthen belonging and collective responsibility.",
        fr: "Nous bâtissons des relations qui renforcent l'appartenance et la responsabilité collective."
      }
    },
    {
      icon: "🌍",
      title: { en: "Diversity", fr: "Diversité" },
      text: {
        en: "We celebrate different cultures, experiences, perspectives, and identities.",
        fr: "Nous célébrons les différentes cultures, expériences, perspectives et identités."
      }
    },
    {
      icon: "🌱",
      title: { en: "Empowerment", fr: "Autonomisation" },
      text: {
        en: "We create opportunities for individuals and communities to grow and thrive.",
        fr: "Nous créons des occasions pour les individus et les communautés de grandir et de s'épanouir."
      }
    },
    {
      icon: "🤝",
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
      icon: "🤝",
      title: { en: "Volunteer", fr: "Faire du bénévolat" },
      text: {
        en: "Give your time and skills where they can make a practical difference.",
        fr: "Offrez votre temps et vos compétences là où ils peuvent faire une réelle différence."
      },
      link: "get-involved.html?type=volunteer"
    },
    {
      icon: "📦",
      title: { en: "Donate Items", fr: "Faire don d'articles" },
      text: {
        en: "Support identified outreach needs with useful, requested items.",
        fr: "Soutenez nos besoins de sensibilisation avec des articles utiles et demandés."
      },
      link: "get-involved.html?type=items"
    },
    {
      icon: "💳",
      title: { en: "Financial Support", fr: "Soutien financier" },
      text: {
        en: "Help fund community outreach, logistics and program delivery.",
        fr: "Aidez à financer la sensibilisation communautaire, la logistique et la prestation de programmes."
      },
      link: "get-involved.html?type=financial"
    },
    {
      icon: "💬",
      title: { en: "Connect With Us", fr: "Communiquer avec nous" },
      text: {
        en: "Ask a question, share an idea or tell us about a community need.",
        fr: "Posez une question, partagez une idée ou parlez-nous d'un besoin communautaire."
      },
      link: "get-involved.html?type=question"
    }
  ],

  // ==================== PROGRAMS ====================
  programs: [
    {
      id: "podcast",
      image: "assets/images/podcast-setup.jpg",
      status: { en: "Active", fr: "Actif" },
      audience: { en: "Community members & storytellers", fr: "Membres de la communauté et conteurs" },
      title: { en: "Community Personality Show & Podcast", fr: "Émission et balado Personnalité communautaire" },
      subtitle: { en: "Sharing Stories. Inspiring Change.", fr: "Partager des histoires. Inspirer le changement." },
      description: {
        en: "We highlight individuals creating positive change within their communities. Through interviews, storytelling, and meaningful conversations, we celebrate achievements and inspire leadership, resilience, and social responsibility. Guests include community leaders, youth changemakers, newcomer success stories, Indigenous voices, entrepreneurs, and volunteers.",
        fr: "Nous mettons en lumière des personnes qui créent un changement positif dans leur communauté. Par des entrevues, des récits et des conversations significatives, nous célébrons les réussites et inspirons le leadership, la résilience et la responsabilité sociale. Nos invités comprennent des leaders communautaires, de jeunes acteurs de changement, des nouveaux arrivants, des voix autochtones, des entrepreneurs et des bénévoles."
      }
    },
    {
      id: "outreach",
      image: "assets/images/volunteers-packing.jpg",
      status: { en: "Active", fr: "Actif" },
      audience: { en: "Newcomers & families in need", fr: "Nouveaux arrivants et familles dans le besoin" },
      title: { en: "Community Service & Outreach", fr: "Service communautaire et sensibilisation" },
      subtitle: { en: "Serving Communities Through Action", fr: "Servir la communauté par l'action" },
      description: {
        en: "Communities become stronger when people support and care for one another. Our outreach creates practical support systems and opportunities to take part: volunteer engagement programs, newcomer support, food bank collaborations, charity campaigns, community resource navigation, social inclusion programs, and seasonal outreach activities.",
        fr: "Les communautés se renforcent lorsque les gens s'entraident. Notre travail crée des systèmes de soutien concrets et des occasions de participer : programmes de bénévolat, soutien aux nouveaux arrivants, collaborations avec les banques alimentaires, campagnes de charité, orientation vers les ressources, programmes d'inclusion sociale et activités saisonnières."
      }
    },
    {
      id: "family",
      image: "assets/images/family-talk.jpg",
      status: { en: "Active", fr: "Actif" },
      audience: { en: "Families & couples", fr: "Familles et couples" },
      title: { en: "Relationship & Family Conversations", fr: "Conversations sur les relations et la famille" },
      subtitle: { en: "Strengthening Families. Building Healthy Relationships.", fr: "Renforcer les familles. Bâtir des relations saines." },
      description: {
        en: "Families are the foundation of strong communities. Through conversations, education, and community discussions we explore family relationships, parenting support, marriage and partnerships, intercultural relationships, family wellness, and communication and conflict resolution.",
        fr: "Les familles sont le fondement de communautés fortes. Par des conversations, de l'éducation et des discussions communautaires, nous abordons les relations familiales, le soutien à la parentalité, le mariage et les partenariats, les relations interculturelles, le bien-être familial ainsi que la communication et la résolution de conflits."
      }
    },
    {
      id: "health",
      image: "assets/images/hero-community.jpg",
      status: { en: "Active", fr: "Actif" },
      audience: { en: "Community members", fr: "Membres de la communauté" },
      title: { en: "Community Health Talk", fr: "Discussions sur la santé communautaire" },
      subtitle: { en: "Promoting Health, Wellness, and Awareness", fr: "Promouvoir la santé, le bien-être et la sensibilisation" },
      description: {
        en: "Healthier communities are created through awareness, education, and access to reliable information. We bring together healthcare professionals, community leaders, and people with lived experience around physical health awareness, mental health education, preventive healthcare, community wellness, and health equity and accessibility.",
        fr: "Des communautés en meilleure santé se bâtissent par la sensibilisation, l'éducation et l'accès à une information fiable. Nous réunissons des professionnels de la santé, des leaders communautaires et des personnes ayant un vécu autour de la santé physique, de la santé mentale, des soins préventifs, du mieux-être collectif et de l'équité en santé."
      }
    },
    {
      id: "children",
      image: "assets/images/family-talk.jpg",
      status: { en: "Active", fr: "Actif" },
      audience: { en: "Children & families", fr: "Enfants et familles" },
      title: { en: "Children's Corner", fr: "Le coin des enfants" },
      subtitle: { en: "Inspiring Young Minds Through Learning and Creativity", fr: "Inspirer les jeunes esprits par l'apprentissage et la créativité" },
      description: {
        en: "Children are the future of every community. The Children's Corner offers storytelling sessions, educational activities, character development lessons, creative challenges, cultural learning, and family-friendly entertainment. Every child deserves the chance to learn, grow, express themselves, and thrive.",
        fr: "Les enfants sont l'avenir de chaque communauté. Le coin des enfants propose des séances de contes, des activités éducatives, des leçons sur le développement du caractère, des défis créatifs, des apprentissages culturels et des divertissements familiaux. Chaque enfant mérite d'apprendre, de grandir, de s'exprimer et de s'épanouir."
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
