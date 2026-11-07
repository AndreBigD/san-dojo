const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function fixture(){
 let handler;const messages=[],results=[];
 const target={id:'synthetic-device',endpoint:'https://web.push.apple.com/synthetic-test',p256dh:'synthetic',auth_key:'synthetic'};
 const service={rpc:async(name,args)=>{
  const data=name==='dojo_push_get_keys'?{keys:{},public_key:'synthetic'}:
   name==='dojo_is_active'||name==='dojo_push_job_authorized'?true:
   name==='dojo_push_test_target'?target:name==='dojo_push_take_batch'?[target]:null;
  if(name==='dojo_push_result')results.push(args);
  return {data,error:null};
 },auth:{getUser:async()=>({data:{user:{id:'synthetic-user'}},error:null})}};
 const webpush={Urgency:{Normal:'normal',High:'high'},importVapidKeys:async()=>({}),ApplicationServer:{new:async()=>({subscribe:subscription=>({pushTextMessage:async(text,options)=>{
  // Reproduce the provider rejection seen on the real iPhone, without contacting it.
  assert.equal(Object.hasOwn(options,'topic'),false,'Apple rejected the optional Topic header');
  messages.push({subscription,payload:JSON.parse(text),options});
 }})})}};
 const source=fs.readFileSync(path.join(__dirname,'backend/dojo-push/index.ts'),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInNewContext(source,{createClient:()=>service,webpush,Deno:{env:{get:()=> 'synthetic'},serve:fn=>{handler=fn;}},URL,Response,console});
 return {handler,messages,results};
}

test('iPhone test uses an immediate push without the rejected Topic header',async()=>{
 const f=fixture();
 const response=await f.handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify({action:'test',endpoint:'https://web.push.apple.com/synthetic-test'})}));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{sent:true});
 assert.equal(f.messages.length,1);assert.equal(f.messages[0].options.urgency,'high');assert.equal(f.messages[0].options.ttl,120);
 assert.equal(f.messages[0].payload.url,'/#sequence');
});

test('scheduled reminders omit Topic and record a successful delivery',async()=>{
 const f=fixture();
 const response=await f.handler(new Request('https://example.test',{method:'POST',headers:{'x-dojo-job-secret':'a'.repeat(64),'content-type':'application/json'},body:JSON.stringify({action:'send'})}));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{claimed:1,sent:1,failed:0,removed:0});
 assert.equal(f.messages[0].options.urgency,'normal');assert.equal(f.messages[0].options.ttl,1800);
 assert.equal(f.results[0].p_sent,true);assert.equal(f.results[0].p_gone,false);
});
