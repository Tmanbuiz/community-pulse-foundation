/* =========================================================
   COMMUNITY PULSE FOUNDATION - EDITABLE CONTENT
   =========================================================
   This file contains all the content that can be easily
   updated by an admin. Just edit the text and images below.
   ========================================================= */

const siteData = {
  // ==================== OBJECTIVES ====================
  objectives: [
    {
      icon: "🤝",
      title: { en: "Foster Friendship & Belonging", fr: "Favoriser l'amitié et l'appartenance" },
      text: {
        en: "Build meaningful connections among newcomers and long-term residents across New Brunswick.",
        fr: "Créer des liens significatifs entre les nouveaux arrivants et les résidents de longue date au Nouveau-Brunswick."
      }
    },
    {
      icon: "🕊️",
      title: { en: "Promote Peace & Understanding", fr: "Promouvoir la paix et la compréhension" },
      text: {
        en: "Encourage mutual respect and dialogue across cultural, racial, and faith communities.",
        fr: "Encourager le respect mutuel et le dialogue entre les communautés culturelles, raciales et religieuses."
      }
    },
    {
      icon: "📢",
      title: { en: "Highlight Community Stories", fr: "Mettre en valeur les histoires communautaires" },
      text: {
        en: "Celebrate achievements, growth, and stories of resilience from people across the province.",
        fr: "Célébrer les réussites, la croissance et les histoires de résilience des gens de la province."
      }
    },
    {
      icon: "💬",
      title: { en: "Safe Digital Space", fr: "Espace numérique sécuritaire" },
      text: {
        en: "Provide a welcoming platform for conversations on life, faith, relationships, business, and personal development.",
        fr: "Offrir une plateforme accueillante pour des conversations sur la vie, la foi, les relations, les affaires et le développement personnel."
      }
    },
    {
      icon: "🌉",
      title: { en: "Bridge Communities", fr: "Relier les communautés" },
      text: {
        en: "Connect communities, schools, and organizations through storytelling and meaningful outreach.",
        fr: "Relier les communautés, les écoles et les organisations par le biais de récits et de sensibilisation significative."
      }
    }
  ],

  // ==================== PROGRAMS ====================
  programs: [
    {
      id: "podcast",
      image: "assets/images/podcast-setup.jpg",
      title: { en: "Personality Show / Podcast", fr: "Émission de personnalité / Balado" },
      subtitle: { en: "The Big Conversation", fr: "La Grande Conversation" },
      description: {
        en: "Featuring inspiring individuals making a positive impact. Real people. Real talk. Real impact. Covering family values, career success, immigration journeys, faith, relationships, and more.",
        fr: "Mettant en vedette des personnes inspirantes qui ont un impact positif. Des gens réels. Des conversations authentiques. Un impact réel. Couvrant les valeurs familiales, la réussite professionnelle, les parcours d'immigration, la foi, les relations et plus encore."
      }
    },
    {
      id: "outreach",
      image: "assets/images/volunteers-packing.jpg",
      title: { en: "Community Service & Outreach", fr: "Service communautaire et sensibilisation" },
      subtitle: { en: "Supporting Neighbors in Need", fr: "Soutenir nos voisins dans le besoin" },
      description: {
        en: "Volunteer drives, newcomer support, food bank collaborations, charity campaigns, and targeted support for the homeless and families in need across Fredericton and beyond.",
        fr: "Campagnes de bénévolat, soutien aux nouveaux arrivants, collaborations avec les banques alimentaires, campagnes de charité et soutien ciblé pour les personnes sans abri et les familles dans le besoin à Fredericton et ailleurs."
      }
    },
    {
      id: "family",
      image: "assets/images/family-talk.jpg",
      title: { en: "Relationship & Family Talk", fr: "Discussions sur les relations et la famille" },
      subtitle: { en: "Strengthening Homes", fr: "Renforcer les foyers" },
      description: {
        en: "Conversations on family life, multicultural relationships, parenting, and building healthy homes in a diverse society.",
        fr: "Conversations sur la vie familiale, les relations multiculturelles, la parentalité et la construction de foyers sains dans une société diversifiée."
      }
    },
    {
      id: "health",
      image: "assets/images/hero-community.jpg",
      title: { en: "Community Health Talk", fr: "Discussions sur la santé communautaire" },
      subtitle: { en: "Wellness for All", fr: "Le bien-être pour tous" },
      description: {
        en: "Health awareness and wellness education sessions designed to support the physical and mental well-being of community members.",
        fr: "Séances de sensibilisation à la santé et d'éducation au bien-être conçues pour soutenir le bien-être physique et mental des membres de la communauté."
      }
    },
    {
      id: "children",
      image: "assets/images/family-talk.jpg",
      title: { en: "Children’s Corner", fr: "Le coin des enfants" },
      subtitle: { en: "Nurturing the Next Generation", fr: "Nourrir la prochaine génération" },
      description: {
        en: "Storytelling, moral lessons, and creative activities designed to inspire and educate children in a safe and engaging environment.",
        fr: "Contes, leçons morales et activités créatives conçues pour inspirer et éduquer les enfants dans un environnement sécuritaire et engageant."
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
