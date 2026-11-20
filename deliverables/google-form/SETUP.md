# Card Studio Google Form

## Create the form

1. Open https://script.google.com and create a **New project**. Name it **Card Studio Intake**.
2. Replace the contents of **Code.gs** with the complete contents of the supplied **Code.gs** file. Save.
3. Select **createCardStudioForm** in the function dropdown and click **Run**. Authorize access to Google Forms and Sheets using the account that should own the form and responses.
4. Open the **Edit form** link in the execution log. The script creates an unpublished form and a linked Google spreadsheet in your account. No web app deployment or API keys are needed.
5. Complete the attachment setup below, then run **checkCardStudioForm** to verify that both upload question types are present.
6. In Google Forms, review the questions and upload limits. Use **Publish** and choose the intended responder audience. For external clients, allow the appropriate external audience if your Workspace policy permits it. Copy the respondent link from Forms.
7. Submit a trial response through that link using a respondent account, including a photo and logo. Check **Responses** and the linked spreadsheet for the answers and file links before distributing the form.

## Required attachment setup

Google Forms does not support creating file-upload questions through Apps Script or the Forms API. The script therefore creates two short-answer placeholders with the final question titles and descriptions. These are not functional attachments until converted.

In section **6. Profile picture and logo**, change each of these questions from **Short answer** to **File upload**, and accept Google's file-upload notice:

| Question | Allowed file type | Maximum files | Maximum size | Required |
| --- | --- | --- | --- | --- |
| Profile picture attachment | Image | 1 | 10 MB | Off |
| Business / organization logo attachment | Image | 1 | 10 MB | Off |

Keep the titles and descriptions. Enable **Allow only specific file types**, then select **Image**. JPG/PNG are the recommended formats in the descriptions; Google's Image setting may accept other image formats too. Both uploads are optional, consistent with Card Studio. You can turn **Required** on if your service requires either asset.

File uploads require respondents to sign in to Google. Uploaded files are stored in the form owner's Google Drive. Keep the form in My Drive: file-upload questions are not supported for forms in shared drives, and Workspace policies may further restrict uploads or external responses. The script does not make uploaded files public.

## Included fields and Card Studio mapping

Based on `components/BuilderForm.tsx`, `lib/types.ts`, and `lib/socials.ts` in this project. This intake is for one person's card; the separate team-card CSV flow is outside its scope.

| Form data | Card Studio field |
| --- | --- |
| First name; last name | `firstName`; `lastName` |
| Designation / Job title | `title` |
| Company / Organization | `organization` |
| Three phone/type pairs plus additional numbers | `phones[]`: `type`, `value` |
| Two card emails plus additional emails | `emails[]` |
| Two websites plus additional websites | `websites[]` |
| LinkedIn | `socials.linkedin` |
| X (Twitter) | `socials.twitter` |
| YouTube | `socials.youtube` |
| Instagram | `socials.instagram` |
| TikTok | `socials.tiktok` |
| Facebook | `socials.facebook` |
| WhatsApp profile link | `socials.whatsapp` |
| GitHub | `socials.github` |
| Location | `location` |
| Tagline / short bio | `tagline` |
| Role / membership line | `role` |
| Profile picture attachment | `photo` after upload through Card Studio |
| Business / organization logo attachment | `logo` after upload through Card Studio |
| Default / secondary brand color | `accent: "secondary"` |
| Primary brand color | `accent: "primary"` |
| Accent brand color | `accent: "accent"` |
| Ink / dark | `accent: "ink"` |

The model contains `accent`, but the current builder does not expose a color selector. The form records color preference as a preparation instruction; collecting it does not implement color switching in the application.

Delivery email, image instructions, additional instructions and confirmation are intake-only fields. Keep them out of public card content. First name, delivery email and confirmation are required. Other details are optional so respondents can omit details they do not want displayed; last name is optional for people using a single name.

Google Forms has no repeatable “Add another” control. This form uses numbered fields plus multiline overflow fields so people can provide more entries. Email, URL and numbered phone questions have validation. Overflow paragraphs require review; check each extra address/link and ensure every supplied phone has a type before entering it in Card Studio.

## Processing requests

The linked spreadsheet collects responses automatically, including links to attachments after upload questions are configured. This script does **not** create or publish cards in the Card Studio app, send email, or sync data to its database.

To prepare a card, enter the supplied public details in Card Studio and upload the downloaded photo and logo using its existing upload controls. Card Studio resizes photos to a maximum dimension of 420 pixels and logos to 160 pixels. Do not paste Google Drive attachment links directly into card image fields; they are not public image URLs.

## Reruns and recovery

Running **createCardStudioForm** again returns the existing form links without duplicating or overwriting questions. Settings in `CARD_STUDIO` affect only the initial build; edit an existing form in Google Forms.

If creation fails partway through, the saved form ID prevents accidental duplicate creation. Open the logged form to inspect it. To deliberately rebuild, first confirm the incomplete form has no real responses, then remove `CARD_STUDIO_INTAKE_FORM_ID` and `CARD_STUDIO_BUILD_STATE` in **Project Settings → Script properties**, and rerun creation. This creates a new form; it does not delete any old form or spreadsheet. If there are real responses, retain that form and repair it manually instead.

## Verification and references

The supplied script was checked for JavaScript syntax locally. Google authorization, actual form creation and upload submission must be verified in your Google account using the steps above.

- [Google Apps Script Form reference](https://developers.google.com/apps-script/reference/forms/form)
- [Google Forms API: file-upload creation is unsupported](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#fileuploadquestion)
- [Google's file-upload setup example](https://developers.google.com/apps-script/samples/automations/upload-files)
