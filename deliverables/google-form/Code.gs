/**
 * Card Studio — individual digital business card intake.
 * Paste into Code.gs at script.google.com and run createCardStudioForm.
 * Then convert the two attachment placeholders to File upload in Forms.
 * See SETUP.md. No deployment, API key, or advanced service is required.
 */
const CARD_STUDIO = {
  title: 'Card Studio — Request your digital business card',
  propertyKey: 'CARD_STUDIO_INTAKE_FORM_ID',
  phoneSlots: 3,
  emailSlots: 2,
  websiteSlots: 2,
  photoTitle: 'Profile picture attachment',
  logoTitle: 'Business / organization logo attachment'
};

function createCardStudioForm() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const existing = properties.getProperty(CARD_STUDIO.propertyKey);
    if (existing) {
      const saved = FormApp.openById(existing);
      logLinks_(saved);
      console.log('Existing form retained. Rerunning does not duplicate or overwrite questions.');
      return saved.getEditUrl();
    }

    // New forms remain unpublished until the owner completes the attachments.
    const form = FormApp.create(CARD_STUDIO.title, false);
    properties.setProperty(CARD_STUDIO.propertyKey, form.getId());
    properties.setProperty('CARD_STUDIO_BUILD_STATE', 'BUILDING');
    form.setDescription(
      'Tell us what you would like on your digital business card. Complete one response per person. ' +
      'Use the spelling, capitalization and contact details you want displayed. ' +
      'Leave optional fields blank if you do not want them included.\n\n' +
      'Card details and supplied images are intended for your shareable card and may be visible to anyone who receives its link or QR code. ' +
      'Your delivery email and production notes are for handling this request and are not card content. ' +
      'Google sign-in is required to attach files. Estimated time: 5–10 minutes.'
    );
    form.setProgressBar(true);
    form.setShuffleQuestions(false);
    form.setCollectEmail(false);
    form.setPublishingSummary(false);
    form.setConfirmationMessage('Thank you! Your digital business card request has been received. We will use your delivery email if we need clarification or to share your card.');

    form.addSectionHeaderItem().setTitle('1. Your request and identity')
      .setHelpText('Write names exactly as they should appear on your card.');
    text_(form, 'Delivery email', 'Where should we send your finished card or questions? This is not displayed on the card unless you also enter it under card email addresses.', true, 'email');
    text_(form, 'First name', 'Your given name(s), for example Jane.', true);
    text_(form, 'Last name', 'Your surname / family name, for example Doe. Leave blank if you use a single name.');
    text_(form, 'Designation / Job title', 'Your professional title, for example Product Manager, Founder or Consultant.');
    text_(form, 'Company / Organization', 'The business or organization name to display. Independent professionals may enter their trading name.');

    section_(form, '2. Contact numbers', 'Only add numbers you want on the card. Use international format, for example +256 772 123456. Add a type for each number you supply.');
    for (let i = 1; i <= CARD_STUDIO.phoneSlots; i++) {
      form.addListItem().setTitle('Phone ' + i + ' — type')
        .setHelpText('Choose the label for phone ' + i + '; leave blank if no number is supplied.')
        .setChoiceValues(['CELL', 'WORK', 'HOME', 'WHATSAPP', 'OTHER']);
      text_(form, 'Phone ' + i + ' — number', 'Include + and the country code. CELL means mobile. For extensions, use Additional phone numbers.', false, 'phone');
    }
    paragraph_(form, 'Additional phone numbers', 'Need more numbers? Enter one per line as TYPE | NUMBER, for example WORK | +256 414 123456 ext 12. Types: CELL, WORK, HOME, WHATSAPP, OTHER.');

    section_(form, '3. Card email addresses and websites', 'These details will appear on your card. List your preferred contact first.');
    for (let i = 1; i <= CARD_STUDIO.emailSlots; i++) {
      text_(form, 'Card email ' + i, 'An email address to display, for example jane@example.com.', false, 'email');
    }
    paragraph_(form, 'Additional card email addresses', 'Enter any further email addresses, one per line.');
    for (let i = 1; i <= CARD_STUDIO.websiteSlots; i++) {
      text_(form, 'Website ' + i, 'Full website, portfolio or booking link, starting with https://.', false, 'url');
    }
    paragraph_(form, 'Additional websites', 'Enter further full links starting with https://, one per line.');

    section_(form, '4. Social media profiles', 'Optional. Paste full profile links starting with https://, rather than only usernames. Only completed profiles will be included.');
    [
      ['LinkedIn', 'https://www.linkedin.com/in/your-name'],
      ['X (Twitter)', 'https://x.com/yourname'],
      ['YouTube', 'https://www.youtube.com/@yourchannel'],
      ['Instagram', 'https://www.instagram.com/yourname'],
      ['TikTok', 'https://www.tiktok.com/@yourname'],
      ['Facebook', 'https://www.facebook.com/yourpage'],
      ['WhatsApp', 'https://wa.me/256772123456 — use country code and digits only in the link, without + or spaces'],
      ['GitHub', 'https://github.com/yourname']
    ].forEach(function (social) {
      text_(form, social[0] + ' profile URL', 'Example: ' + social[1], false, 'url');
    });

    section_(form, '5. Personal details', 'Add context that helps people understand who you are and what you do.');
    text_(form, 'Location', 'City and country, for example Kampala, Uganda. Enter only the location you want displayed.');
    paragraph_(form, 'Tagline / short bio', 'A brief introduction or value statement, for example Helping teams build better products. One or two short sentences works best.');
    text_(form, 'Role / membership line', 'An affiliation or membership, for example Member, PMI Uganda Chapter. This is separate from your job title.');

    section_(form, '6. Profile picture and logo', 'Attach the images you want showcased. A square headshot works best; a transparent PNG is best for a logo. Each attachment allows one image up to 10 MB. Leave an attachment blank if you do not want to supply it.');
    // Google does not expose a supported addFileUploadItem method.
    // Owner: convert these two Short answer items to File upload before publishing.
    text_(form, CARD_STUDIO.photoTitle, 'Upload a clear, well-lit headshot as JPG or PNG. A square image of at least 420 × 420 pixels is recommended. Keep your face centered with space around it for cropping. One image, maximum 10 MB.');
    text_(form, CARD_STUDIO.logoTitle, 'Upload the logo you are authorized to use, preferably a transparent PNG. It replaces the brand badge in the card corner and appears small, so use a simple, readable version. One image, maximum 10 MB. Optional.');
    paragraph_(form, 'Image / logo instructions', 'Optional instructions for cropping, background or logo use. If you have no photo or logo, you can say so here.');

    section_(form, '7. Appearance and final instructions', 'Share any preferences for preparation of your card.');
    form.addListItem().setTitle('Card color preference')
      .setHelpText('Optional preparation preference. Colors depend on the active Card Studio brand. Leave blank to use the default secondary color.')
      .setChoiceValues(['Default / secondary brand color', 'Primary brand color', 'Accent brand color', 'Ink / dark']);
    paragraph_(form, 'Additional instructions', 'Any spelling notes, ordering preferences or special requests? These notes are for the person preparing the card and are not displayed.');
    form.addCheckboxItem().setTitle('Confirm your details and permission')
      .setHelpText('Review your entries before submitting. Only card content will be used on the shareable card; delivery details and production notes are for managing this request.')
      .setChoiceValues(['I confirm these details are correct, I have permission to use the supplied images and logo, and I authorize creation of a shareable digital business card using the card details I provided.'])
      .setRequired(true);

    const spreadsheet = SpreadsheetApp.create('Card Studio — Business card requests');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
    properties.setProperty('CARD_STUDIO_BUILD_STATE', 'COMPLETE');
    logLinks_(form);
    console.log('REQUIRED: Convert both attachment questions to File upload (Images, 1 file, 10 MB). Then review and publish from Google Forms.');
    return form.getEditUrl();
  } finally {
    lock.releaseLock();
  }
}

/** Run after converting the upload questions. Reports readiness; does not publish. */
function checkCardStudioForm() {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty(CARD_STUDIO.propertyKey);
  if (!id) throw new Error('Run createCardStudioForm first.');
  const form = FormApp.openById(id);
  logLinks_(form);
  if (properties.getProperty('CARD_STUDIO_BUILD_STATE') !== 'COMPLETE') {
    throw new Error('The build did not finish. See SETUP.md for recovery instructions.');
  }
  [CARD_STUDIO.photoTitle, CARD_STUDIO.logoTitle].forEach(function (title) {
    const matches = form.getItems().filter(function (item) { return item.getTitle() === title; });
    if (matches.length !== 1 || matches[0].getType().toString() !== 'FILE_UPLOAD') {
      throw new Error('Convert the question "' + title + '" to File upload in the form editor. Keep its title unchanged.');
    }
  });
  console.log('Both file-upload questions are present. Manually confirm Images only, 1 file and 10 MB for each, test a submission, and publish in Forms.');
}

function section_(form, title, help) {
  form.addPageBreakItem().setTitle(title).setHelpText(help);
}

function text_(form, title, help, required, validation) {
  const item = form.addTextItem().setTitle(title).setHelpText(help).setRequired(Boolean(required));
  if (validation) {
    const rule = FormApp.createTextValidation();
    if (validation === 'email') rule.requireTextIsEmail().setHelpText('Enter a valid email address, for example jane@example.com.');
    if (validation === 'url') rule.requireTextIsUrl().setHelpText('Enter a full URL starting with https://.');
    if (validation === 'phone') rule.requireTextMatchesPattern('^\\+[0-9][0-9 ()-]{5,24}$').setHelpText('Start with + and your country code. Use digits, spaces, parentheses or hyphens.');
    item.setValidation(rule.build());
  }
  return item;
}

function paragraph_(form, title, help) {
  return form.addParagraphTextItem().setTitle(title).setHelpText(help).setRequired(false);
}

function logLinks_(form) {
  console.log('Edit form: ' + form.getEditUrl());
  console.log('Respondent link (usable after publishing): ' + form.getPublishedUrl());
  if (form.getDestinationId()) console.log('Responses: https://docs.google.com/spreadsheets/d/' + form.getDestinationId() + '/edit');
}
