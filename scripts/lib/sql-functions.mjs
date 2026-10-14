/**
 * Master-map function extraction from comment-stripped SQL. Keeps non-public schema names so private
 * RLS helpers receive ownership rather than disappearing from the map. Pattern matching, not SQL parsing.
 * @sideEffects None; CREATE/DROP events update individual live signatures in source order.
 */
function argumentTypes(parameters) {
  const parts = []; let start = 0, depth = 0, quote = false;
  for (let i = 0; i < parameters.length; i++) {
    const c = parameters[i];
    if (c === "'") { if (quote && parameters[i + 1] === "'") i++; else quote = !quote; }
    else if (!quote && c === '(') depth++;
    else if (!quote && c === ')') depth--;
    else if (!quote && depth === 0 && c === ',') { parts.push(parameters.slice(start, i)); start = i + 1; }
  }
  parts.push(parameters.slice(start));
  const builtins = new Set(['text','uuid','boolean','bool','integer','int','int2','int4','int8','smallint','bigint','real','float4','float8','double','numeric','decimal','money','varchar','character','char','bpchar','timestamp','timestamptz','time','timetz','date','interval','json','jsonb','bytea','record','anyelement','anyarray']);
  const aliases = { bool: 'boolean', int: 'integer', int2: 'smallint', int4: 'integer', int8: 'bigint', float4: 'real', float8: 'double precision', decimal: 'numeric', timestamptz: 'timestamp with time zone', timestamp: 'timestamp without time zone', 'character varying': 'varchar', bpchar: 'character' };
  return parts.flatMap(part => {
    let value = part.trim().toLowerCase(); if (!value || /^out\s/.test(value)) return [];
    value = value.replace(/^(?:inout|in|variadic)\s+/, '').replace(/\s+(?:default\b|=)[\s\S]*$/, '').trim();
    const tokens = value.split(/\s+/), first = tokens[0].replace(/\([^)]*\)|\[\]/g, '');
    if (tokens.length > 1 && !builtins.has(first) && !first.includes('.')) tokens.shift(); // Input name is not part of signature identity.
    value = tokens.join(' ').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    const array = value.endsWith('[]') ? '[]' : '', base = array ? value.slice(0, -2) : value;
    return [(aliases[base] ?? base) + array];
  }).join(',');
}
export function sqlFunctionBodies(sql) {
  const signatures = new Map();
  // A CREATE match consumes its body, so DROP text inside that body cannot become an outer DDL event.
  const events = /\bcreate\s+(?:or\s+replace\s+)?function\s+(\w+)\.(\w+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?\$\$([\s\S]*?)\$\$|\bdrop\s+function\s+(?:if\s+exists\s+)?(\w+)\.(\w+)\s*\(([\s\S]*?)\)\s*(?:cascade|restrict)?\s*;/gi;
  for (const match of sql.matchAll(events)) {
    const created = match[1] !== undefined, schema = (created ? match[1] : match[5]).toLowerCase();
    const simple = (created ? match[2] : match[6]).toLowerCase(), name = schema === 'public' ? simple : `${schema}.${simple}`;
    const signature = `${schema}.${simple}(${argumentTypes(created ? match[3] : match[7])})`;
    if (created) signatures.set(signature, { name, body: match[4] });
    else signatures.delete(signature);
  }
  const bodies = new Map();
  for (const { name, body } of signatures.values()) bodies.set(name, `${bodies.get(name) ?? ''}\n${body}`);
  return bodies;
}
