/** Compare JSON content independently of Postgres JSONB key ordering. */
export function sameContent(a: unknown,b: unknown): boolean {
  function canonical(value:unknown):unknown {
    if(Array.isArray(value))return value.map(canonical);
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
    return value;
  }
  return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
}
