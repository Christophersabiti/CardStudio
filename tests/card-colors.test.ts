import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPalette, contrast, extractLogoColors, mix, resolveCardColors, cardColorVars } from '../lib/card-colors';
import { emptyCard } from '../lib/types';
import { cardSchema, cardDraftSchema } from '../lib/validation';
import { BRANDS } from '../lib/brand';

const pixels = (color: number[], count: number) => Array.from({length: count}, () => color).flat();
test('logo extraction ignores padding and transparency, prefers brand hues, and handles monochrome', () => {
  const source = [...pixels([255,255,255,255],500), ...pixels([0,0,0,0],500), ...pixels([0,0,0,255],100), ...pixels([240,90,20,255],60), ...pixels([40,90,210,255],30)];
  assert.deepEqual(extractLogoColors(source), ['#f05a14','#285ad2']);
  assert.equal(extractLogoColors(pixels([20,20,20,255],100))?.[0], '#141414');
  assert.equal(extractLogoColors(pixels([255,255,255,255],100)), undefined);
  assert.equal(extractLogoColors(pixels([240,10,10,0],100)), undefined);
});
test('new and legacy cards retain fallback; explicit modes and logo removal select the correct palette', () => {
  const card = emptyCard();
  assert.equal(resolveCardColors(card), undefined);
  assert.equal(resolveCardColors({...card, logoColors:['#ff0000','#0000ff']}), undefined);
  assert.deepEqual(resolveCardColors({...card,logo:'existing'},['#ff0000','#0000ff']), ['#ff0000','#0000ff']);
  assert.equal(resolveCardColors({...card,logo:'existing',appearance:{mode:'theme',primary:'#ff0000',secondary:'#0000ff'}},['#ff0000','#0000ff']), undefined);
  assert.deepEqual(resolveCardColors({...card,appearance:{mode:'custom',primary:'#ff0000',secondary:'#0000ff'}}), ['#ff0000','#0000ff']);
});
test('theme metadata survives draft and publication parsing; unsafe CSS and malformed palettes are rejected', () => {
  const card = {...emptyCard(),firstName:'Amina',appearance:{mode:'custom',primary:'#F05A14',secondary:'#285AD2'},logoColors:['#F05A14','#285AD2']};
  for (const schema of [cardSchema,cardDraftSchema]) {
    assert.deepEqual(schema.parse(card).appearance,card.appearance);
    assert.equal(schema.safeParse({...card,appearance:{...card.appearance,primary:'red; background:url(https://evil.test)'}}).success,false);
    assert.equal(schema.safeParse({...card,logoColors:['#ff0000']}).success,false);
    assert.equal(schema.safeParse({...card,appearance:{...card.appearance,mode:'unknown'}}).success,false);
  }
});
test('all generated text roles meet 4.5:1 across gradient samples, including extreme and bright seeds', () => {
  const seeds = ['#ff0000','#00ff00','#0000ff','#ffff00','#ff00ff','#00ffff','#ffffff','#000000','#888888','#f26a21','#822c8e'];
  for (const primary of seeds) for (const secondary of seeds) for (const dark of [false,true]) {
    const p = cardPalette([primary,secondary],dark);
    for (let step=0;step<=10;step++) {
      const bg = mix(p.surfaceStart,p.surfaceEnd,step/10);
      for (const text of [p.ink,p.muted,p.title]) assert.ok(contrast(text,bg)>=4.5, `${primary}/${secondary} ${dark} main ${text}/${bg}`);
      const aside = mix(p.asideStart,p.asideEnd,step/10);
      for (const text of [p.asideText,p.asideMuted]) assert.ok(contrast(text,aside)>=4.5);
    }
    assert.ok(contrast(p.icon,p.iconBg)>=4.5);
    if (!["#ffffff", "#000000", "#888888"].includes(primary)) assert.notEqual(p.surfaceStart,primary);
    assert.notEqual(p.asideStart,primary);
  }
});
test('brand fallback text and icons remain readable in both device appearances', () => {
  for (const brand of Object.values(BRANDS)) for (const dark of [false,true]) {
    const vars = cardColorVars(undefined,brand), scheme = dark?'dark':'light';
    assert.ok(contrast(vars[`--card-title-${scheme}`],dark?'#1d1922':'#ffffff')>=4.5);
    assert.ok(contrast(vars[`--card-icon-${scheme}`],vars[`--card-iconBg-${scheme}`])>=4.5);
  }
});
