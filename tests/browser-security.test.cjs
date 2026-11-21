// Static browser boundaries; no network, Spotify account or real credentials.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function meta(html,name){
  const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'';
  const tags=[...head.matchAll(/<meta\b[^>]*>/gi)].map(match=>Object.fromEntries([...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute=>[attribute[1].toLowerCase(),attribute[2]])));
  return tags.find(attributes=>(attributes.name||attributes['http-equiv']||'').toLowerCase()===name.toLowerCase())?.content;
}
const directives=policy=>new Map(String(policy||'').split(';').map(value=>value.trim().split(/\s+/)).filter(parts=>parts[0]).map(([name,...value])=>[name,value.join(' ')]));
for(const name of ['indexOLD.html','indexnoclock.html']){
  const html=read(name),policy=directives(meta(html,'Content-Security-Policy'));
  assert(html.length<1500,'Legacy entry points remain small redirect stubs');
  assert(!/<(?:script|iframe|object|embed|link)\b/i.test(html),'Legacy entry points cannot execute old or third-party code');
  assert(!/\bon[a-z]+\s*=/i.test(html),'No inline legacy event handlers remain');
  assert.equal(meta(html,'refresh'),'0;url=./','Old OAuth query parameters are not forwarded');
  assert(/<a\s+href="\.\/">[^<]+<\/a>/.test(html),'A usable fallback link survives disabled automatic redirects');
  assert.equal(meta(html,'referrer'),'no-referrer');
  for(const directive of ['default-src','base-uri','object-src','form-action'])assert.equal(policy.get(directive),"'none'");
}
const main=read('index.html'),mainPolicy=directives(meta(main,'Content-Security-Policy'));
assert.equal(meta(main,'referrer'),'no-referrer');
assert.equal(mainPolicy.get('base-uri'),"'none'");assert.equal(mainPolicy.get('object-src'),"'none'");
for(const directive of ['default-src','script-src','frame-src','connect-src','media-src','worker-src','child-src'])assert.equal(mainPolicy.has(directive),false,'Do not introduce unverified Spotify SDK restrictions');
assert(main.includes('script.src="https://sdk.scdn.co/spotify-player.js"'),'The optional SDK uses the documented fixed HTTPS endpoint');
assert(!/<iframe\b/i.test(main),'The application does not embed arbitrary frames itself');

// The local bundling template lives outside the public repository. Also verify
// it when present; a clean checkout still verifies every deployed HTML file.
const templatePath=path.resolve(root,'../mouth-preview-template.html'),template=fs.existsSync(templatePath)?fs.readFileSync(templatePath,'utf8'):null,preview=read('mouth-preview.html');
for(const html of [template,preview].filter(Boolean)){
  const policy=directives(meta(html,'Content-Security-Policy'));
  assert.equal(meta(html,'referrer'),'no-referrer');
  for(const directive of ['default-src','base-uri','object-src','form-action'])assert.equal(policy.get(directive),"'none'");
  assert.equal(policy.get('style-src'),"'unsafe-inline'",'The local preview may retain its existing dynamic styles');
  assert(!/<script\b[^>]*\bsrc\s*=/i.test(html),'The preview has no third-party executable dependency');
  assert(!/\b(?:fetch|getUserMedia|getDisplayMedia|MediaRecorder|WebSocket)\s*\(/.test(html),'The offline mouth preview never requests audio or a remote connection');
}
const placeholder='__SPOTDECK_INLINE_SCRIPT_HASHES__';
if(template)assert.equal(directives(meta(template,'Content-Security-Policy')).get('script-src'),placeholder,'Bundling leaves a deterministic slot for release-time hashes');
const scriptPolicy=directives(meta(preview,'Content-Security-Policy')).get('script-src');
if(scriptPolicy!==placeholder){
  const hashes=[...preview.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(match=>!/(?:^|\s)src\s*=/i.test(match[1])).map(match=>"'sha256-"+crypto.createHash('sha256').update(match[2]).digest('base64')+"'");
  assert(hashes.length>0);assert.equal(scriptPolicy,hashes.join(' '),'Released preview authorizes exactly its current inline scripts');
}
console.log('PASS script-free legacy redirects, safe Spotify CSP baseline, no-referrer policy and isolated offline preview with release-time script hashes.');
