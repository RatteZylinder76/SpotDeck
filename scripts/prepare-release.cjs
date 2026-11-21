#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),check=args.includes('--check'),bump=args.includes('--bump');
const dateArg=args.find(arg=>arg.startsWith('--date='));
if(args.some(arg=>!['--check','--bump'].includes(arg)&&!arg.startsWith('--date='))||check&&bump||dateArg&&!bump)throw Error('Use --check or --bump [--date=YYYY-MM-DD].');
const pages=['index.html','mouth-preview.html','indexOLD.html','indexnoclock.html'];
const original=new Map(pages.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
const footerPattern=/<!-- BEGIN RELEASE FOOTER -->[\s\S]*?<!-- END RELEASE FOOTER -->/;
const releasePattern=/\/\/ BEGIN APP RELEASE[\s\S]*?\/\/ END APP RELEASE/;
const cspPattern=/<meta\b(?=[^>]*http-equiv="Content-Security-Policy")[^>]*>/gi;
const previewLinkPattern=/mouth-preview\.html\?v=[A-Za-z0-9.-]+/g;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function canonical(html){
  return html.replace(/\r\n/g,'\n').replace(footerPattern,'<!-- RELEASE FOOTER -->').replace(releasePattern,'// APP RELEASE').replace(previewLinkPattern,'mouth-preview.html?v=RELEASE').replace(cspPattern,tag=>tag.replace(/script-src\s+[^;"]*/g,'script-src BUILD_HASHES'));
}
const fingerprint=sha(pages.map(file=>file+'\0'+canonical(original.get(file))).join('\0')+'\0'+fs.readFileSync(__filename,'utf8'));
const metadataPath=path.join(root,'release.json'),saved=JSON.parse(fs.readFileSync(metadataPath,'utf8'));
function validDate(value){const date=new Date(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
if(typeof saved.version!=='string'||!/^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/.test(saved.version)||!validDate(saved.releasedAt)||!saved.version.startsWith(saved.releasedAt.replace(/-/g,'.')+'.')||typeof saved.sourceId!=='string'||saved.sourceId&&!/^[a-f0-9]{64}$/.test(saved.sourceId))throw Error('Invalid release.json metadata.');
let release={...saved};
if(bump){
  const today=dateArg?dateArg.slice(7):new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!validDate(today))throw Error('Invalid release date.');
  const prefix=today.replace(/-/g,'.')+'.',sequence=saved.version.startsWith(prefix)?Number(saved.version.slice(prefix.length))+1:1;
  if(!Number.isSafeInteger(sequence)||sequence<1)throw Error('Invalid release sequence.');
  release={version:prefix+sequence,releasedAt:today,sourceId:fingerprint};
}else{
  if(saved.sourceId&&saved.sourceId!==fingerprint)throw Error('Application source changed. Run node scripts/prepare-release.cjs --bump before publishing.');
  release.sourceId=fingerprint;
}
function cspHashes(html){
  const hashes=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match=>"'sha256-"+crypto.createHash('sha256').update(match[1].replace(/\r\n/g,'\n')).digest('base64')+"'");
  return html.replace(cspPattern,tag=>/script-src\s/.test(tag)?tag.replace(/script-src\s+[^;"]*/g,'script-src '+hashes.join(' ')):tag);
}
const day=release.releasedAt.split('-').reverse().join('.');
const footer='<!-- BEGIN RELEASE FOOTER -->\n      <footer class="settings-version" aria-label="Versionsstand">\n        <span>SpotDeck</span>\n        <strong id="appVersion">Version '+release.version+'</strong>\n        <span id="appReleaseDate">Stand: '+day+'</span>\n      </footer>\n      <!-- END RELEASE FOOTER -->';
const block='// BEGIN APP RELEASE\n  const APP_RELEASE = Object.freeze('+JSON.stringify(release)+');\n  // END APP RELEASE';
let index=original.get('index.html');
if(!footerPattern.test(index)||!releasePattern.test(index))throw Error('Missing release markers in index.html.');
index=index.replace(footerPattern,footer).replace(releasePattern,block).replace(previewLinkPattern,'mouth-preview.html?v='+release.version);
const prepared=new Map(original);prepared.set('index.html',index);
for(const file of pages)prepared.set(file,cspHashes(prepared.get(file)));
if(check){
  if(saved.sourceId!==fingerprint||JSON.stringify(saved)!==JSON.stringify(release))throw Error('Release metadata does not match this source.');
  for(const file of pages)if(prepared.get(file)!==original.get(file))throw Error('Stale release stamp or CSP hash in '+file+'. Run the release preparation step.');
  console.log('Release '+release.version+' matches application source, footer and CSP hashes.');
}else{
  for(const file of pages)if(prepared.get(file)!==original.get(file))fs.writeFileSync(path.join(root,file),prepared.get(file));
  fs.writeFileSync(metadataPath,JSON.stringify(release,null,2)+'\n');
  console.log('Prepared release '+release.version+'.');
}
