/**
 * Guided walkthroughs, one per tool page. Each step points at an element by CSS
 * selector; steps whose element is not on the page (for example the QR type when
 * editing a group) are skipped. A step without a target shows in the centre.
 */
export interface TourStep {
  target?: string;
  title: string;
  body: string;
}
export interface Tour {
  id: string;
  name: string;
  match: (pathname: string) => boolean;
  steps: TourStep[];
}

export const tours: Tour[] = [
  {
    id: "studio-v1",
    name: "Business card studio",
    match: (p) => p === "/studio",
    steps: [
      { target: '[data-tour="section-1"]', title: "Start with your details", body: "Add your name, photo and contact details. Your draft is kept in this browser as you type, so you can come back to it." },
      { target: "#live-preview", title: "Watch your card update", body: "The preview changes as you type. Try landscape or portrait, and see how it looks in light and dark mode." },
      { target: '[data-tour="qr-type"]', title: "Choose your QR code", body: "An online profile QR always opens your latest published card. An offline QR saves your details straight to a phone, but it can never be changed." },
      { target: '[data-tour="publish"]', title: "Save, then publish", body: "Sign in to save private drafts as often as you like. Nothing is public until you press Publish. After that, updates appear at the same link." },
      { target: '[data-tour="downloads"]', title: "Share it", body: "Save your QR image or a picture of your card, or download the contact file to add to a phone." },
    ],
  },
  {
    id: "qr-studio-v1",
    name: "QR Studio",
    match: (p) => p === "/qr-studio",
    steps: [
      { target: ".qr-type-grid", title: "Pick what the QR opens", body: "A website, an event, a place, a list of links, an image or a video. You can change this before you publish." },
      { target: ".qr-editor .qr-field", title: "Add the details", body: "Give it a clear title and description. This is what people see when they scan." },
      { target: ".qr-tabs", title: "Design and check it", body: "Open QR design to change colours or add a caption. Preview shows the finished page." },
      { target: ".qr-preview", title: "See what people will see", body: "This is the page that opens after a scan. It updates as you edit." },
      { target: ".qr-save-bar", title: "Publish to switch it on", body: "Save a draft any time. Publish to make the QR work. You can update it later without reprinting it, or unpublish to switch it off." },
    ],
  },
  {
    id: "stamp-maker-v1",
    name: "E-stamp maker",
    match: (p) => p === "/stamp-maker",
    steps: [
      { target: ".stamp-toolbar", title: "Start from a template", body: "Use Select template to pick a company seal, signature or date stamp, and choose your ink colour here." },
      { target: ".stamp-design-panel", title: "Shape and border", body: "Name your stamp and choose its shape, colour and border. You can also add elements such as a date or serial number here." },
      { target: ".stamp-preview-panel", title: "Drag to position", body: "Drag any line of text on the stamp to move it. The preview updates as you edit." },
      { target: ".stamp-elements-panel", title: "Edit the words", body: "Change, add or remove text, dates, serial numbers and a signature image." },
      { title: "Save and download", body: "Sign in to save your design to your account, then download a transparent PNG to place on your documents." },
    ],
  },
  {
    id: "email-signature-v1",
    name: "Email signature",
    match: (p) => p === "/email-signature",
    steps: [
      { target: ".sig-editor", title: "Add your details", body: "Fill in your name, role and contact links. Try sample details if you want to see an example first." },
      { target: ".sig-preview-pane", title: "Check the preview", body: "This is how your signature will look at the bottom of an email." },
      { target: ".sig-steps", title: "Three short steps", body: "Details, then design, then install. The last step shows exactly how to add it to Gmail, Outlook or Apple Mail." },
    ],
  },
];

export const tourFor = (pathname: string) => tours.find((t) => t.match(pathname)) || null;

/** Event the Help menu dispatches to replay the current page's walkthrough. */
export const TOUR_EVENT = "card-studio-tour";
