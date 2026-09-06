export type SignatureData = { name: string; title: string; company: string; email: string; phone: string; website: string; photo: string; link: string; cta: string; color: string; font: string; layout: string };
export const emptySignature: SignatureData = { name: '', title: '', company: '', email: '', phone: '', website: '', photo: '', link: '', cta: 'Connect with me', color: '#596b48', font: 'Arial', layout: 'classic' };
export const exampleSignature: SignatureData = { ...emptySignature, name: 'Alex Morgan', title: 'Creative Director', company: 'Studio North', email: 'alex@example.com', phone: '+1 555 010 2040', website: 'https://example.com' };
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!)); }
export function safeUrl(value: string) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
export function signatureHtml(data: SignatureData) {
  const e = escapeHtml;
  const color = /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#596b48';
  const font = ['Arial', 'Georgia', 'Verdana'].includes(data.font) ? data.font : 'Arial';
  const link = (url: string, text: string) => `<a href="${e(url)}" style="color:${color};text-decoration:none">${e(text)}</a>`;
  const lines = [data.email && link(`mailto:${encodeURIComponent(data.email)}`, data.email), data.phone && link(`tel:${data.phone.replace(/[^+\d]/g, '')}`, data.phone), safeUrl(data.website) && link(safeUrl(data.website), data.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))].filter(Boolean);
  const content = `<strong style="font-size:20px;color:${color}">${e(data.name)}</strong><br><span style="font-size:13px">${e([data.title, data.company].filter(Boolean).join(' · '))}</span><div style="height:12px"></div>${lines.join('<br>')}${safeUrl(data.link) ? `<div style="padding-top:12px;font-weight:bold">${link(safeUrl(data.link), data.cta || 'Connect with me')} &rarr;</div>` : ''}`;
  const photo = safeUrl(data.photo) ? `<img src="${e(safeUrl(data.photo))}" alt="${e(data.name)}" width="76" height="76" style="border-radius:16px;object-fit:cover;display:block;border:0">` : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:${font},sans-serif;font-size:12px;line-height:1.6;color:#343b39"><tbody>${data.layout === 'stacked' ? `<tr><td style="padding-bottom:12px">${photo}</td></tr><tr><td style="border-top:3px solid ${color};padding-top:12px">${content}</td></tr>` : `<tr>${photo && data.layout !== 'minimal' ? `<td valign="top" style="padding-right:20px">${photo}</td>` : ''}<td style="${data.layout !== 'minimal' ? `border-left:3px solid ${color};padding-left:20px;` : ''}">${content}</td></tr>`}</tbody></table>`;
}
