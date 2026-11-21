const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const repo=path.resolve(__dirname,'..'),release=JSON.parse(fs.readFileSync(path.join(repo,'release.json'),'utf8'));
const html=fs.readFileSync(path.join(repo,'index.html'),'utf8'),settings=html.slice(html.indexOf('<div class="settings"'),html.indexOf('<div class="toast"'));
assert(settings.indexOf('id="appVersion"')>settings.indexOf('id="logoutBtn"'),'Version appears below the last settings action');
assert(settings.includes('Version '+release.version),'The visible footer identifies this embedded release');
assert(!/fetch\([^)]*(?:commits|release\.json)/.test(html),'The version does not substitute a newer remote version for a cached document');
function command(root,...args){return cp.spawnSync(process.execPath,[path.join(root,'scripts/prepare-release.cjs'),...args],{cwd:root,encoding:'utf8'})}
assert.equal(command(repo,'--check').status,0,'The repository release stamp and CSP hashes are current');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'spotdeck-release-check-'));
try{
  fs.mkdirSync(path.join(dir,'scripts'));
  for(const file of ['index.html','mouth-preview.html','indexOLD.html','indexnoclock.html','release.json','scripts/prepare-release.cjs'])fs.copyFileSync(path.join(repo,file),path.join(dir,file));
  fs.appendFileSync(path.join(dir,'index.html'),'\n<!-- changed application document -->\n');
  assert.notEqual(command(dir,'--check').status,0,'Changed code cannot pass with a stale release');
  assert.notEqual(command(dir).status,0,'Ordinary regeneration cannot silently reuse the old release for changed code');
  const result=command(dir,'--bump','--date='+release.releasedAt);assert.equal(result.status,0,result.stderr);
  const next=JSON.parse(fs.readFileSync(path.join(dir,'release.json'),'utf8'));
  assert.equal(Number(next.version.split('.').at(-1)),Number(release.version.split('.').at(-1))+1,'Same-day releases increment their sequence');
  assert.notEqual(next.sourceId,release.sourceId);
  assert.equal(command(dir,'--check').status,0,'A prepared release passes without access to Git or the network');
  const preview=path.join(dir,'mouth-preview.html');fs.writeFileSync(preview,fs.readFileSync(preview,'utf8').replace(/'sha256-[A-Za-z0-9+/=]+'/g,"'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='"));
  assert.notEqual(command(dir,'--check').status,0,'A stale script hash cannot ship unnoticed');
  assert.equal(command(dir).status,0,'Hash-only preparation is idempotent and needs no new application version');
  assert.equal(command(dir,'--check').status,0);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
console.log('PASS visible final settings version, embedded release identity, stale-source rejection, same-day sequence and CSP hash verification.');
