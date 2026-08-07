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
        en: "The Community Pulse Foundation paid an advocacy visit to the Office of MP David Myles to discuss immigration challenges affecting international students, temporary foreign workers, and immigrant families in New Brunswick.",
        fr: "La Fondation Community Pulse a effectué une visite de plaidoyer au bureau du député David Myles pour discuter des défis d'immigration touchant les étudiants internationaux, les travailleurs étrangers temporaires et les familles immigrantes au Nouveau-Brunswick."
      },
      details: {
        en: "Representing the Foundation were Mr. Opeyemi Oguntomi, Mr. Philip, and Miss Miracle. Discussions focused on English language testing requirements, Post-Graduation Work Permit challenges, delays in the Atlantic Immigration Program, and the need for greater employer awareness. The Chief of Staff commended the Foundation’s work and welcomed the invitation for the MP to appear on the Community Podcast.",
        fr: "La Fondation était représentée par M. Opeyemi Oguntomi, M. Philip et Mlle Miracle. Les discussions ont porté sur les exigences de tests de langue, les défis liés au permis de travail postdiplôme, les retards dans le Programme d'immigration de l'Atlantique et la nécessité d'une plus grande sensibilisation des employeurs. Le chef de cabinet a félicité le travail de la Fondation et a accueilli favorablement l'invitation du député à participer au balado communautaire."
      }
    },
    {
      id: "homeless-drive",
      date: { en: "June 2025", fr: "Juin 2025" },
      title: {
        en: "Fredericton Homeless Kitchen & Shelter Support Drive",
        fr: "Campagne de soutien à la cuisine et à l'abri pour sans-abri de Fredericton"
      },
      location: { en: "Fredericton, NB", fr: "Fredericton, N.-B." },
      image: "assets/images/outreach-poster.jpg",
      summary: {
        en: "A community donation drive organized to support the Fredericton homeless kitchen and shelter with food, clothing, hygiene products, and household items.",
        fr: "Une collecte de dons organisée pour soutenir la cuisine et l'abri pour sans-abri de Fredericton avec de la nourriture, des vêtements, des produits d'hygiène et des articles ménagers."
      },
      details: {
        en: "The Foundation called on the community to donate non-perishable food, gently used clothing, hygiene items, blankets, and household supplies. Donations were distributed to newcomers and families in need within the community.",
        fr: "La Fondation a invité la communauté à faire don d'aliments non périssables, de vêtements en bon état, de produits d'hygiène, de couvertures et de fournitures ménagères. Les dons ont été distribués aux nouveaux arrivants et aux familles dans le besoin."
      }
    }
  ],

  // ==================== TEAM MEMBERS ====================
  // Easy to edit: just add, remove or update objects below
  team: [
    {
      name: "Opeyemi Oguntomi",
      role: { en: "Founder & Lead Advocate", fr: "Fondateur et défenseur principal" },
      bio: {
        en: "Passionate about community building and newcomer integration. Led the advocacy visit to the Office of MP David Myles and continues to champion immigrant families across New Brunswick.",
        fr: "Passionné par le développement communautaire et l'intégration des nouveaux arrivants. A dirigé la visite de plaidoyer au bureau du député David Myles et continue de défendre les familles immigrantes au Nouveau-Brunswick."
      },
      image: null // uses group photo
    },
    {
      name: "Philip",
      role: { en: "Community Outreach Lead", fr: "Responsable de la sensibilisation communautaire" },
      bio: {
        en: "Dedicated to connecting people and organizing meaningful community service initiatives that support families and individuals in need.",
        fr: "Dédié à relier les gens et à organiser des initiatives de service communautaire significatives qui soutiennent les familles et les individus dans le besoin."
      },
      image: null
    },
    {
      name: "Miracle",
      role: { en: "Communications & Engagement", fr: "Communications et engagement" },
      bio: {
        en: "Focused on storytelling, community engagement, and creating spaces where every voice can be heard and valued.",
        fr: "Axée sur le storytelling, l'engagement communautaire et la création d'espaces où chaque voix peut être entendue et valorisée."
      },
      image: null
    }
  ]
};
