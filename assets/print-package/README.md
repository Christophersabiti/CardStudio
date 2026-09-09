# Print template assets

`reference-v1` reconstructs the supplied reference composition using generated front/back artwork, two angled placements, and a hand-held placement. The template is deterministic: all names, contacts, QR modules, and logos are rendered from saved card data. No original personal details are present in these assets.

- `NotoSans-Regular.ttf`, `NotoSans-Bold.ttf`: Noto Project fonts under the SIL Open Font License; see `OFL.txt`. Retrieved from the notofonts/noto-fonts repository via jsDelivr. Text is outlined for identical PDF/SVG output.
- `hand-scene.png`: created with the built-in image generation tool on September 9, 2026. The blank card surface is replaced by code and a fixed foreground-occlusion mask preserves the thumb. No per-download image generation or API key is required.

Generation prompt:

> Use case: product-mockup. Generate a reusable photorealistic blank card mockup asset, landscape 1536x1024. Neutral medium gray studio background. A dark brown adult right hand enters from the right edge and pinches the far right edge of a completely blank white landscape PVC business card with rounded corners. The entire card is front facing, flat parallel to camera, no perspective, no rotation. Card occupies rectangle x=160 y=220 to x=1200 y=876 approximately, ratio 85.6:54. Thumb overlaps ONLY the rightmost 12% of the card, low at its bottom-right corner; leave central 85% unobscured. Soft studio lighting, realistic skin and fingernails. No text, no symbols, no logos, no QR, no other cards, no labels, no watermark. This will be used as a fixed scene with actual card artwork placed on top programmatically.

The generation produced slightly different card bounds; the compositor records the observed bounds and thumb contour in `lib/print-package/render.ts`. The image is a presentation asset, not print artwork. Its original generated copy remains at the tool output location; this repository copy is the runtime dependency.
