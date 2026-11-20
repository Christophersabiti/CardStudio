/** Tools live at short addresses; every other entry is an /explore page. */
const toolPaths: Record<string, string> = { "email-signatures": "/email-signature", "stamp-maker": "/stamp-maker" };
/** Pages for products no longer offered; old links land somewhere useful. */
export const retiredPaths: Record<string, string> = { enterprise: "/pricing", "lead-capture": "/explore/updates", careers: "/explore/about" };
export const featureHref = (slug: string) => toolPaths[slug] || `/explore/${slug}`;
export const featureCopy: Record<
  string,
  { title: string; intro: string; points: string[] }
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
      "Share an event, a place, helpful links, an image or a video with one branded QR code.",
    points: [
      "Add your event details, directions, booking links or media.",
      "Add a caption, with custom colors and center images on eligible plans.",
      "Publish updates behind the same QR. Unpublish when you are done.",
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
  "email-signatures": {
    title: "Make every email feel like you.",
    intro: "Create a signature, customize its design, and install it in your email app.",
    points: ["Add your contact details.", "Choose your layout, font and brand color.", "Copy and install with a guide for your email app."],
  },
  "stamp-maker": {
    title: "A stamp that’s ready when your documents are.",
    intro: "Choose a stamp design, edit the details and date, then download a transparent PNG for your documents.",
    points: ["Start from company, professional and date stamp templates.", "Customize wording, shape, ink, borders and signature artwork.", "Save your design and export a crisp transparent PNG."],
  },
  "print-package": {
    title: "Print-ready cards from your design.",
    intro:
      "Turn a published business card into print-ready files you can send to any printer. Included with Basic and Premium plans.",
    points: [
      "Create and publish your business card first.",
      "Open the card in the studio and choose Print package.",
      "Download the files and share them with your printer.",
    ],
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
      "Next: guided walkthroughs and a simpler account page.",
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
};
