import { SOCIALS } from "./socials";
export type SignatureData = { socials: Record<string, string>; cardUrl: string; name: string; title: string; company: string; email: string; phone: string; website: string; photo: string; link: string; cta: string; color: string; font: string; layout: string };
export const emptySignature: SignatureData = { socials: {}, cardUrl: '', name: '', title: '', company: '', email: '', phone: '', website: '', photo: '', link: '', cta: 'Connect with me', color: '#596b48', font: 'Arial', layout: 'classic' };
export const exampleSignature: SignatureData = { ...emptySignature, name: 'Alex Morgan', title: 'Creative Director', company: 'Studio North', email: 'alex@example.com', phone: '+1 555 010 2040', website: 'https://example.com' };
export function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!)); }
export function safeUrl(value: string) { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
export function signatureHtml(data: SignatureData, assetOrigin = '') {
  const e = escapeHtml;
  const color = /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#596b48';
  const font = ['Arial', 'Georgia', 'Verdana'].includes(data.font) ? data.font : 'Arial';
  const link = (url: string, text: string) => `<a href="${e(url)}" style="color:${color};text-decoration:none">${e(text)}</a>`;
  const lines = [data.email && link(`mailto:${encodeURIComponent(data.email)}`, data.email), data.phone && link(`tel:${data.phone.replace(/[^+\d]/g, '')}`, data.phone), safeUrl(data.website) && link(safeUrl(data.website), data.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))].filter(Boolean);
  const origin = safeUrl(assetOrigin) ? new URL(assetOrigin).origin : '';
  const socialIcons = SOCIALS.filter(social => safeUrl(data.socials?.[social.key] || '')).map(social => `<td style="padding:0 10px 0 0"><a href="${e(safeUrl(data.socials[social.key]))}" title="${e(social.name)}" style="text-decoration:none"><img src="${e(origin)}/signature-icons/${social.key}.png" alt="${e(social.name)}" width="22" height="22" style="display:block;border:0"></a></td>`).join('');
  const socialRow = socialIcons ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px"><tbody><tr>${socialIcons}</tr></tbody></table>` : '';
  const cardUrl = data.cardUrl?.length <= 1000 ? safeUrl(data.cardUrl) : '';
  const qr = cardUrl ? `<div style="padding-top:12px;text-align:center"><a href="${e(cardUrl)}" style="color:${color};text-decoration:none"><img src="${e(origin)}/api/signature-qr?url=${e(encodeURIComponent(cardUrl))}" alt="Scan to save ${e(data.name)}'s contact" width="100" height="100" style="display:block;border:0;margin:0 auto"><span style="display:block;font-size:10px;white-space:nowrap;padding-top:4px">Save my contact</span></a></div>` : '';
  const content = `<strong style="font-size:20px;color:${color}">${e(data.name)}</strong><br><span style="font-size:13px">${e([data.title, data.company].filter(Boolean).join(' · '))}</span><div style="height:12px"></div>${lines.join('<br>')}${safeUrl(data.link) ? `<div style="padding-top:12px;font-weight:bold">${link(safeUrl(data.link), data.cta || 'Connect with me')} &rarr;</div>` : ''}`;
  const photo = safeUrl(data.photo) ? `<img src="${e(safeUrl(data.photo))}" alt="${e(data.name)}" width="76" height="76" style="border-radius:16px;object-fit:cover;display:block;border:0">` : '';
  const media = photo || qr ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr><td align="center">${photo}${qr}</td></tr></tbody></table>` : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:${font},sans-serif;font-size:12px;line-height:1.6;color:#343b39"><tbody>${data.layout === 'stacked' ? `<tr><td style="padding-bottom:12px">${media}</td></tr><tr><td style="border-top:3px solid ${color};padding-top:12px">${content}</td></tr>` : `<tr>${media ? `<td valign="top" style="padding-right:20px">${media}</td>` : ''}<td style="${data.layout !== 'minimal' ? `border-left:3px solid ${color};padding-left:20px;` : ''}">${content}</td></tr>`}${socialRow ? `<tr><td colspan="2">${socialRow}</td></tr>` : ''}</tbody></table>`;
}
