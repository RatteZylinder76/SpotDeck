const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const {TextEncoder}=require('node:util');
const {harness}=require('./spotdeck.test.cjs');
const preferences={season:'off',surprises:false,tempoLookup:false};
const tokenUrl='https://accounts.spotify.com/api/token';
const saved=(name='A',expired=false)=>({access_token:'TEST_ACCESS_'+name,refresh_token:'TEST_REFRESH_'+name,expires_at:expired?0:Date.now()+3600000,auth_version:2,scopes:['user-read-playback-state']});
const tokens=(name='NEW')=>({access_token:'TEST_ACCESS_'+name,refresh_token:'TEST_REFRESH_'+name,expires_in:3600,scope:'user-read-playback-state streaming user-read-email user-read-private'});
function setup(fetcher){const h=harness({preferences,fetcher});h.context.crypto=webcrypto;h.context.TextEncoder=TextEncoder;h.context.btoa=value=>Buffer.from(value,'binary').toString('base64');return h;}
function store(h,value){h.context.testAuthSession=value;h.run('saveSession(testAuthSession)')}
const access=h=>h.run('loadSession()?.access_token||null');
const caught=promise=>promise.then(value=>({value}),error=>({name:error.name,code:error.code,message:error.message}));
(async()=>{
  let releaseCode;
  const login=setup((url,options,res)=>url===tokenUrl?new Promise(resolve=>releaseCode=()=>resolve(res(tokens('LOGIN')))):res(null,204));
  const cleaned=[];login.context.history.replaceState=(_state,_title,url)=>cleaned.push(url);
  login.run('location.search="?redirect_uri=https%3A%2F%2Fattacker.invalid%2F"');await login.run('beginAuth()');
  const authorize=new URL(login.run('location.href')),verifier=login.store.get('spotdeck.verifier'),state=login.store.get('spotdeck.authState');
  assert.equal(authorize.origin,'https://accounts.spotify.com');assert.equal(authorize.searchParams.get('response_type'),'code');assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');
  assert.match(verifier,/^[a-z0-9]{64}$/);assert.match(state,/^[a-z0-9]{32}$/);assert.equal(authorize.searchParams.get('state'),state);
  assert.equal(authorize.searchParams.get('code_challenge'),Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url'),'PKCE uses the real S256 digest of the stored verifier');
  assert.equal(new URL(authorize.searchParams.get('redirect_uri')).origin,login.context.location.origin,'A query parameter cannot replace the redirect origin');
  login.context.location.search='?code=TEST_CODE&state='+encodeURIComponent(state);const loginPending=login.run('boot()');await login.flush();
  assert(cleaned.length>0&&!cleaned.at(-1).includes('TEST_CODE'),'Authorization parameters are removed before waiting for token exchange');
  assert.equal(login.store.get('spotdeck.authState'),undefined,'State is consumed before exchange to reject a concurrent replay');
  const codeRequest=login.requests.find(r=>r.url===tokenUrl);
  assert.equal(codeRequest.options.method,'POST');assert.equal(codeRequest.options.body.get('code_verifier'),verifier);assert.equal(codeRequest.options.body.get('grant_type'),'authorization_code');assert(!codeRequest.options.body.has('client_secret'));
  releaseCode();await loginPending;
  assert.equal(access(login),'TEST_ACCESS_LOGIN');assert.equal(login.store.get('spotdeck.verifier'),undefined);assert.equal(login.store.get('spotdeck.authState'),undefined);

  const invalid=setup((_url,_options,res)=>res(null,204));store(invalid,saved('EXISTING'));
  invalid.run('sessionStorage.setItem("spotdeck.verifier","EXPECTED_VERIFIER");sessionStorage.setItem("spotdeck.authState","EXPECTED_STATE");location.search="?code=INJECTED_TEST_CODE&state=wrong"');await invalid.run('boot()');
  assert.equal(access(invalid),'TEST_ACCESS_EXISTING','An unauthenticated bad-state URL cannot log out an existing account');
  assert.equal(invalid.requests.filter(r=>r.url===tokenUrl).length,0,'State mismatch never reaches token exchange');
  assert.equal(invalid.store.get('spotdeck.authState'),'EXPECTED_STATE','An injected callback does not cancel the genuine pending login');
  invalid.run('location.search="?error=access_denied&state=EXPECTED_STATE"');await invalid.run('boot()');
  assert.equal(access(invalid),'TEST_ACCESS_EXISTING','An authorization denial does not delete another valid session');
  assert.equal(invalid.store.get('spotdeck.authState'),undefined);assert.equal(invalid.store.get('spotdeck.verifier'),undefined);

  let releaseRefresh;
  const logout=setup((url,_options,res)=>url===tokenUrl?new Promise(resolve=>releaseRefresh=()=>resolve(res(tokens('LATE')))):res(null,204));store(logout,saved('OLD',true));
  const oldApi=caught(logout.run('api("/me/player/pause",{method:"PUT"})'));await logout.flush();
  const refreshRequest=logout.requests.find(r=>r.url===tokenUrl);logout.event(logout.nodes.get('logoutBtn'),'click');
  assert.equal(access(logout),null);assert.equal(refreshRequest.options.signal.aborted,true,'Logout cancels the registered refresh request');
  const requestsAtLogout=logout.requests.length;releaseRefresh();await oldApi;
  assert.equal(access(logout),null,'A mock server ignoring abort still cannot resurrect tokens');
  assert.equal(logout.requests.length,requestsAtLogout,'An API call waiting for refresh cannot send credentials after logout');
  assert.equal(logout.run('authRequests.size'),0,'Canceled requests do not stay registered');

  let releaseExchange;
  const exchange=setup((url,_options,res)=>url===tokenUrl?new Promise(resolve=>releaseExchange=()=>resolve(res(tokens('LATE_CODE')))):res(null,204));store(exchange,saved('OLD'));
  exchange.run('sessionStorage.setItem("spotdeck.verifier","TEST_VERIFIER");sessionStorage.setItem("spotdeck.authState","TEST_STATE")');
  const exchangePending=caught(exchange.run('exchangeCode("TEST_CODE")'));await exchange.flush();exchange.event(exchange.nodes.get('logoutBtn'),'click');releaseExchange();await exchangePending;
  assert.equal(access(exchange),null,'A pending code exchange also cannot undo logout');
  assert.equal(exchange.store.get('spotdeck.verifier'),undefined);assert.equal(exchange.store.get('spotdeck.authState'),undefined);

  for(const status of [200,401]){
    let releaseOld;
    const changed=setup((url,_options,res)=>url===tokenUrl?new Promise(resolve=>releaseOld=()=>resolve(res(tokens('STALE'),status))):res(null,204));store(changed,saved('OLD',true));
    const pending=caught(changed.run('refreshIfNeeded()'));await changed.flush();store(changed,saved('NEW_ACCOUNT'));releaseOld();await pending;
    assert.equal(access(changed),'TEST_ACCESS_NEW_ACCOUNT','A stale refresh '+status+' must neither replace nor clear a newer account');
  }
  let releaseOtherTab;
  const otherTab=setup((url,_options,res)=>url===tokenUrl?new Promise(resolve=>releaseOtherTab=()=>resolve(res(tokens('STALE')))):res(null,204));store(otherTab,saved('OLD',true));
  const otherPending=caught(otherTab.run('refreshIfNeeded()'));await otherTab.flush();otherTab.store.delete('spotdeck.session');releaseOtherTab();await otherPending;
  assert.equal(access(otherTab),null,'A persisted snapshot guard also respects logout from another tab');

  let release401;
  const stale401=setup((url,_options,res)=>url.startsWith('https://api.spotify.com/')?new Promise(resolve=>release401=()=>resolve(res(null,401))):res(null,204));store(stale401,saved('OLD'));
  const staleRequest=caught(stale401.run('api("/me/player")'));await stale401.flush();store(stale401,saved('NEW_ACCOUNT'));stale401.run('setConnected()');release401();await staleRequest;
  assert.equal(access(stale401),'TEST_ACCESS_NEW_ACCOUNT','An old API 401 does not delete a newer session');
  assert.equal(stale401.nodes.get('app').classList.contains('disconnected'),false,'The old request cannot disconnect the newer UI session');

  let releaseBody;
  const body=setup((_url,_options,res)=>({...res(null),json:()=>new Promise(resolve=>releaseBody=()=>resolve({private:'TEST_LIBRARY'}))}));store(body,saved('BODY'));
  const response=await body.run('api("/me/playlists")'),bodyPending=caught(response.json());await body.flush();body.event(body.nodes.get('logoutBtn'),'click');releaseBody();
  const deniedBody=await bodyPending;assert.equal(deniedBody.code,'AUTH_CHANGED','A delayed private JSON body is not delivered after logout');

  const releases=[];
  const flight=setup((url,_options,res)=>url===tokenUrl?new Promise(resolve=>releases.push(name=>resolve(res(tokens(name))))):res(null,204));store(flight,saved('FIRST',true));
  const first=caught(flight.run('refreshIfNeeded()'));await flight.flush();flight.event(flight.nodes.get('logoutBtn'),'click');store(flight,saved('SECOND',true));
  const secondPromise=flight.run('refreshIfNeeded()'),second=caught(secondPromise);await flight.flush();releases[0]('OLD_RESULT');await first;
  assert.equal(flight.run('tokenRefreshPromise'),secondPromise,'An old refresh finally cannot clear the new account single-flight promise');
  releases[1]('SECOND_RESULT');await second;assert.equal(access(flight),'TEST_ACCESS_SECOND_RESULT');

  const offline=setup((_url,_options,res)=>res(null,503));store(offline,saved('RETRY',true));await caught(offline.run('refreshIfNeeded()'));
  assert.equal(access(offline),'TEST_ACCESS_RETRY','Temporary provider failure retains the refresh session for retry');
  const revoked=setup((_url,_options,res)=>res(null,400));store(revoked,saved('REVOKED',true));await revoked.run('refreshIfNeeded()');
  assert.equal(access(revoked),null,'A current invalid refresh grant still clears the expired session');

  const publicData=setup((_url,_options,res)=>res({}));store(publicData,saved('PUBLIC'));
  await publicData.run('publicMetadata("https://lrclib.net/api/get?track_name=Test",null,"lyrics")');
  const publicRequest=publicData.requests.find(r=>r.url.startsWith('https://lrclib.net/'));
  assert(publicRequest&&!publicRequest.options.headers.Authorization&&publicRequest.options.credentials==='omit','Public metadata requests receive neither bearer token nor cookies');
  console.log('PASS OAuth S256/state/redirect, early callback cleanup, invalid-callback session preservation, refresh/exchange logout cancellation, snapshot/account guards, stale 401/body protection, single-flight isolation and retry recovery.');
})().catch(error=>{console.error(error);process.exitCode=1});
