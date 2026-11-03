const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const req = createRequire(resolve(__dirname, '../package.json'));
const { readFileSync } = require('node:fs');
const ts = req('typescript');
const React = req('react');
const { act, create } = req('react-test-renderer');
const { test } = require('node:test');
const assert = require('node:assert/strict');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(path, imports) {
  const code = ts.transpileModule(readFileSync(resolve(__dirname, '..', path), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const m={exports:{}};
  new Function('require','exports','module',code)(n=>imports[n]??req(n),m.exports,m);
  return m.exports;
}
async function setup() {
  const calls=[]; let pending=false; let error=null;
  const {LoginForm}=load('src/features/auth/components/LoginForm.tsx', {
    'react-native': {View:'View',Text:'Text',TextInput:'TextInput',Pressable:'Pressable'},
    '@/shared/components/ui': {Btn:'Btn'},
    '../hooks/useAuth': {useSignIn:()=>({mutateAsync:async value=>{calls.push(value)},isPending:pending,error})},
    '@/shared/lib/website-links': {openWebsitePage:()=>{}},
  });
  let tree; await act(async()=>{tree=create(React.createElement(LoginForm));});
  return {tree,calls,inputs:()=>tree.root.findAllByType('TextInput'),button:()=>tree.root.findByType('Btn'),
    state:async(p,e)=>{pending=p;error=e;await act(async()=>tree.update(React.createElement(LoginForm)));},
    fill:async(email,password)=>{await act(async()=>{const i=tree.root.findAllByType('TextInput');i[0].props.onChangeText(email);i[1].props.onChangeText(password);});},
    submit:async()=>{await act(async()=>{await tree.root.findByType('Btn').props.onPress();});},
    close:async()=>{await act(async()=>tree.unmount());},
  };
}
test('valid credentials submit on the first press without field blur',async()=>{
 const s=await setup(); await s.fill('worker@example.test','fixture-password');await s.submit();assert.equal(s.calls.length,1);await s.close();
});
test('valid credentials submit on first press after both blur handlers',async()=>{
 const s=await setup(); await s.fill('worker@example.test','fixture-password');await act(async()=>s.inputs().forEach(i=>i.props.onBlur()));await s.submit();assert.equal(s.calls.length,1);await s.close();
});
test('auth failure preserves credentials and permits retry without remounting',async()=>{
 const s=await setup();await s.fill('worker@example.test','fixture-password');await s.submit();await s.state(true,null);assert.equal(s.button().props.disabled,true);await s.state(false,new Error('Invalid login credentials'));assert.equal(s.inputs()[0].props.value,'worker@example.test');assert.equal(s.button().props.disabled,false);await s.submit();assert.equal(s.calls.length,2);await s.close();
});
test('whitespace email is normalized before validation and submission',async()=>{
 const s=await setup();await s.fill('worker@example.test ','fixture-password');await s.submit();assert.deepEqual(s.calls,[{email:'worker@example.test',password:'fixture-password'}]);await s.close();
});

const {createAuthFetch,SIGN_IN_TIMEOUT_MS}=load('src/shared/lib/auth-fetch.ts',{});
const {createClient}=req('@supabase/supabase-js');
const response=(token='fixture-access-token')=>new Response(JSON.stringify({access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user:{id:'fixture-worker',aud:'authenticated'}}),{status:200,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(r=>setImmediate(r));
function authClient(fetcher){
 const values=new Map();const events=[];
 const client=createClient('https://fixture.supabase.co','fixture-public-key',{auth:{autoRefreshToken:false,persistSession:true,detectSessionInUrl:false,storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}},global:{fetch:createAuthFetch(fetcher)}});
 client.auth.onAuthStateChange(event=>events.push(event));
 return {client,values,events};
}
for(const stage of ['headers','body'])test(`stalled ${stage} times out, permits retry and ignores late success`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const late=deferred();const started=deferred();let requests=0;let firstSignal;
 const s=authClient(async(_,options)=>{
   if(++requests>1)return response('new-session-token');
   firstSignal=options.signal;started.resolve();
   if(stage==='headers')return late.promise;
   return {text:()=>late.promise,status:200,statusText:'OK',headers:new Headers({'Content-Type':'application/json'})};
 });
 await s.client.auth.getSession();
 const login=s.client.auth.signInWithPassword({email:'worker@example.test',password:'fixture-password'});
 await started.promise;await flush();t.mock.timers.tick(SIGN_IN_TIMEOUT_MS);
 const result=await login;
 assert.match(result.error.message,/Sign-in timed out/);assert.equal(result.data.session,null);assert.equal(firstSignal.aborted,true);
 assert.equal(s.events.includes('SIGNED_IN'),false);assert.equal(s.values.size,0);
 const retry=await s.client.auth.signInWithPassword({email:'worker@example.test',password:'fixture-password'});
 assert.equal(retry.error,null);assert.equal(retry.data.session.access_token,'new-session-token');
 late.resolve(stage==='headers'?response('old-session-token'):JSON.stringify({access_token:'old-session-token',user:{id:'old'}}));
 await flush();assert.equal((await s.client.auth.getSession()).data.session.access_token,'new-session-token');
 assert.equal(s.events.filter(e=>e==='SIGNED_IN').length,1);assert.equal(requests,2);
});
test('invalid credentials retain their provider message and a subsequent login succeeds',async()=>{
 let attempts=0;const s=authClient(async()=>++attempts===1?new Response(JSON.stringify({msg:'Invalid login credentials',code:'invalid_credentials'}),{status:400,headers:{'Content-Type':'application/json'}}):response());
 const credentials={email:'worker@example.test',password:'fixture-password'};
 const first=await s.client.auth.signInWithPassword(credentials);assert.equal(first.error.message,'Invalid login credentials');
 const second=await s.client.auth.signInWithPassword(credentials);assert.equal(second.error,null);assert.ok(second.data.session);
});
test('non-password auth requests pass through unchanged',async()=>{
 const expected=response();let passed;
 const fetcher=createAuthFetch(async(...args)=>{passed=args;return expected;});
 const url='https://fixture.supabase.co/auth/v1/token?grant_type=refresh_token';const options={method:'POST',body:'fixture'};
 assert.equal(await fetcher(url,options),expected);assert.deepEqual(passed,[url,options]);
});
test('an already-cancelled password request is not sent',async()=>{
 let requests=0;const controller=new AbortController();controller.abort();
 await assert.rejects(createAuthFetch(async()=>{requests++;return response();})('https://fixture.supabase.co/auth/v1/token?grant_type=password',{signal:controller.signal}),/cancelled/);
 assert.equal(requests,0);
});
test('invalid fields show feedback and correction submits without restarting',async()=>{
 const s=await setup();await s.fill('bad-email','');await s.submit();assert.equal(s.calls.length,0);assert.match(JSON.stringify(s.tree.toJSON()),/Enter a valid email address/);
 await s.fill('worker@example.test','fixture-password');await s.submit();assert.equal(s.calls.length,1);await s.close();
});
test('correcting a blurred invalid email clears its error before another blur',async()=>{
 const s=await setup();await s.fill('bad-email','fixture-password');await act(async()=>s.inputs()[0].props.onBlur());
 await s.fill('worker@example.test','fixture-password');await s.submit();assert.equal(s.calls.length,1);await s.close();
});
test('email normalization never trims the password',async()=>{
 const s=await setup();await s.fill(' worker@example.test ',' fixture-password ');await s.submit();
 assert.deepEqual(s.calls,[{email:'worker@example.test',password:' fixture-password '}]);await s.close();
});
