export const navigation = {
  Solutions: [
    [
      "For individuals",
      "A memorable introduction, wherever you meet.",
      "individuals",
    ],
    ["For teams", "Keep your group’s contact details together.", "teams"],
    ["For enterprise", "Explore the next stage of Card Studio.", "enterprise"],
  ],
  Products: [
    [
      "Digital business cards",
      "Your details, beautifully presented.",
      "digital-cards",
    ],
    ["QR sharing", "One scan. A better first impression.", "qr-sharing"],
    ["Group contacts", "A whole team in one shared link.", "group-contacts"],
    ["Event lead capture", "Explore our product roadmap.", "lead-capture"],
    ["Email signatures", "Your brand, in every inbox.", "email-signatures"],
  ],
  Resources: [
    ["Getting started", "From a blank canvas to your first card.", "guides"],
    ["Product updates", "What’s available, and what’s next.", "updates"],
    ["FAQ", "Straight answers to common questions.", "faq"],
  ],
  Company: [
    ["About Card Studio", "Built for the people behind the business.", "about"],
    ["Contact", "Get help with your account.", "contact"],
    ["Careers", "Build better ways to connect.", "careers"],
  ],
} as const;
export const featureCopy: Record<
  string,
  { title: string; intro: string; points: string[]; planned?: boolean }
> = {
  individuals: {
    title: "Your next introduction starts here.",
    intro:
      "Create a digital business card that feels like you. Share your contact details by QR code or a simple link.",
    points: [
      "Make it yours with a photo, logo and contact details.",
      "Save privately while you get the details right.",
      "Publish updates to the same profile link.",
    ],
  },
  teams: {
    title: "One link. Your whole team.",
    intro:
      "Create a contact bundle for a team, event or association. Review the roster before publishing.",
    points: [
      "Import and review group contacts.",
      "Publish only with permission from every member.",
      "Share a downloadable group contact file.",
    ],
  },
  enterprise: {
    title: "A foundation for bigger teams.",
    intro:
      "Organization-wide roles and enterprise integrations are on the roadmap. Today, Card Studio supports owner-managed cards and group contact bundles.",
    points: [
      "Private drafts and explicit publication.",
      "Account-level access controls.",
      "Talk to us about your organization’s needs.",
    ],
    planned: true,
  },
  "digital-cards": {
    title: "A card that keeps up with you.",
    intro:
      "Bring your name, work and contact details together in a profile that’s easy to share.",
    points: [
      "Preview changes as you type.",
      "Download a digital card or vCard.",
      "Keep a stable link when your details change.",
    ],
  },
  "qr-sharing": {
    title: "Make the connection in a scan.",
    intro:
      "Choose an offline contact QR or a profile QR that points to your latest published details.",
    points: [
      "Offline codes contain a fixed copy of your details.",
      "Profile codes open your published card online.",
      "Unpublish to withdraw access to the online profile.",
    ],
  },
  "group-contacts": {
    title: "Bring everyone together.",
    intro: "Share a curated roster as a group contact bundle.",
    points: [
      "Review contact details before sharing.",
      "Keep unpublished changes private.",
      "Remove access by unpublishing the bundle.",
    ],
  },
  "lead-capture": {
    title: "More ways to follow up. Coming next.",
    intro:
      "Event badge scanning, lead capture and CRM synchronization are planned features. They are not included in current subscriptions.",
    points: [
      "Current cards let people save your contact details.",
      "Group bundles support sharing a reviewed roster.",
      "Future lead tools will be announced in product updates.",
    ],
    planned: true,
  },
  "email-signatures": {
    title: "Make every email feel like you.",
    intro: "Create a signature, customize its design, and install it in your email app.",
    points: ["Add your contact details.", "Choose your layout, font and brand color.", "Copy and install with a guide for your email app."],
  },
  guides: {
    title: "Meet your first digital card.",
    intro: "Three simple steps to get started with Card Studio.",
    points: [
      "Open the studio and add your name, contact details and optional images.",
      "Sign in and save a private draft. Review the preview.",
      "Publish when ready, then copy your link or download the QR.",
    ],
  },
  updates: {
    title: "Built today. Growing tomorrow.",
    intro:
      "Card Studio currently supports individual cards, group bundles, QR exports and private cloud drafts.",
    points: [
      "Now: account access, publishing controls and recoverable Trash.",
      "This release: plan usage, trials and billing infrastructure.",
      "Later: expanded QR tools, enterprise roles and integrations.",
    ],
  },
  faq: {
    title: "A few things worth knowing.",
    intro:
      "Your published card opens in a browser. The person receiving it does not need a Card Studio account.",
    points: [
      "Private drafts are visible only to their owner.",
      "Downloaded offline QR codes cannot be updated or revoked.",
      "Plan limits apply to cloud creation; billing shows your current usage.",
      "Paid checkout is available only for enabled plans and a configured payment provider.",
    ],
  },
  about: {
    title: "Good conversations deserve a next step.",
    intro:
      "Card Studio helps professionals share a clear, useful introduction—on a screen, in a meeting or across a team.",
    points: [
      "Start with the essentials.",
      "Share with intention.",
      "Keep your details current.",
    ],
  },
  contact: {
    title: "Let’s help you get connected.",
    intro:
      "For account, billing or card-publishing support, contact the Card Studio administrator.",
    points: [
      "Include the page you were using and the error shown.",
      "For billing, include the order reference from your billing page.",
      "Never include passwords or payment-card details.",
    ],
  },
  careers: {
    title: "Help shape the next introduction.",
    intro:
      "There are no open positions listed at the moment. Check product updates to follow Card Studio’s progress.",
    points: ["Thoughtful design.", "Reliable software.", "Useful connections."],
  },
};
