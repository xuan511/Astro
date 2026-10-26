import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=await fs.readFile(path.join(root,'dist/content.js'),'utf8');
const scripts=await Promise.all(['storage.js','core.js','content.js','network.js','transfer.js','github.js','publish.js'].map(n=>fs.readFile(path.join(root,'src',n),'utf8')));
function memory(){const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),dump:()=>JSON.stringify([...map])};}
function element(value=''){return{value,disabled:false,innerHTML:'',textContent:'',classList:{toggle(){}},handlers:{},addEventListener(n,f){this.handlers[n]=f;}};}
async function setup({conflict=false,branchMoved=false,uncertain=false,editDuringUpload=false}={}){
 const elements=Object.fromEntries(['gh-owner','gh-repo','gh-branch','gh-folder','gh-token','github-form','github-publish','connection-status','publish-log'].map(k=>['#'+k,element()]));
 elements['#gh-owner'].value='xuan511';elements['#gh-repo'].value='blog';elements['#gh-branch'].value='main';elements['#gh-token'].value='dummy-token-only-in-test-memory';
 const ctx=vm.createContext({window:{},document:{querySelector:q=>elements[q]||null,querySelectorAll:()=>[],addEventListener(){}},localStorage:memory(),sessionStorage:memory(),structuredClone,Blob,File,TextEncoder,TextDecoder,URL,Intl,Date,Map,Uint8Array,DataView,crypto:globalThis.crypto,btoa,atob,location:{protocol:'https:',href:'https://example.test/blog/#/studio'},setTimeout,clearTimeout,AbortController});
 vm.runInContext(content,ctx);ctx.window.BLOG_DATA=ctx.window.BLOG_DATA;
 vm.runInContext(scripts[0],ctx);vm.runInContext(scripts[1],ctx);ctx.Blog=ctx.window.Blog;
 const B=ctx.Blog,errors=[];B.actions={};B.toast=(m,t)=>{if(t==='error')errors.push(m);};B.render=()=>{};B.flushEditor=async()=>true;B.flushSettings=async()=>true;B.persist=async()=>true;B.whenSaved=async()=>{};B.state.trash=[];
 const media=new Map([['local:exampleimage',new File([new Uint8Array([137,80,78,71])],'sample.png',{type:'image/png'})],['local:exampleaudio',new File([new Uint8Array([1,2,3,4])],'sample.mp3',{type:'audio/mpeg'})]]);
 B.mediaGet=async key=>media.get(key);
 const orig=B.state.original;
 B.state.workspace.posts[0].body+='\n\n![example](local:exampleimage)';
 B.state.workspace.posts.push({...structuredClone(orig.posts[0]),id:'private-draft',title:'PRIVATE-DRAFT-SENTINEL',body:'PRIVATE-BODY-SENTINEL ![draft](local:unavailabledraftmedia)',status:'draft'});
 B.state.workspace.tracks.push({id:'localmusic',title:'My Music',artist:'Test',src:'local:exampleaudio',color:'sage'});
 const calls=[];let refReads=0,patched=false;
 ctx.fetch=async(url,options={})=>{
  const u=new URL(url),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;calls.push({url:u.href,method,body});
  if(u.origin==='https://example.test'){
   const name=u.pathname.replace('/blog/','');
   try{const bytes=await fs.readFile(path.join(root,'dist',name));return{ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}catch{return{ok:false,status:404};}
  }
  assert.equal(u.origin,'https://api.github.com');
  assert.equal(options.headers.Authorization,'Bearer dummy-token-only-in-test-memory');
  let response;
  if(u.pathname.includes('/contents/'))response={sha:conflict&&u.searchParams.get('ref')==='head-123'?'new-sha':'original-sha',encoding:'base64',content:Buffer.from(content).toString('base64')};
  else if(u.pathname.endsWith('/git/ref/heads/main')){refReads++;response={object:{sha:patched?'new-commit':branchMoved&&refReads>1?'other-head':'head-123'}};}
  else if(u.pathname.endsWith('/git/commits/head-123'))response={tree:{sha:'original-tree'}};
  else if(u.pathname.endsWith('/git/blobs')){if(editDuringUpload&&!calls.some(c=>c._edited)){calls.at(-1)._edited=true;B.state.workspace.posts[0].body+=' LATE-EDIT-SENTINEL';}response={sha:'blob-'+calls.length};}
  else if(u.pathname.endsWith('/git/trees')){assert.equal(body.base_tree,'original-tree');response={sha:'new-tree'};}
  else if(u.pathname.endsWith('/git/commits')){assert.equal(body.tree,'new-tree');assert.deepEqual(body.parents,['head-123']);response={sha:'new-commit'};}
  else if(u.pathname.endsWith('/git/refs/heads/main')){assert.equal(body.force,false);assert.equal(body.sha,'new-commit');patched=true;if(uncertain)throw Error('transport timeout after accepted write');response={};}
  else throw Error('Unexpected request '+u.href);
  return{ok:true,status:200,json:async()=>response};
 };
 for(const script of scripts.slice(2))vm.runInContext(script,ctx);
 return{B,ctx,elements,calls,errors,media};
}
{
 const {B,ctx}=await setup();
 assert(!JSON.stringify(B.publicData()).includes('PRIVATE-DRAFT-SENTINEL'));
 const malicious=B.markdown('<img src=x onerror="alert(1)">\n\n[bad](javascript:alert(1))\n\n![a" onerror="x](https://example.test/a.png)').html;
 assert(!malicious.includes('<img src=x'));assert(!malicious.includes('href="javascript:'));assert(!malicious.includes('alt="a" onerror='));
 assert.equal(B._test.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
 const prepared=await B._test.preparePublic();assert.equal(prepared.media.length,2);assert(!JSON.stringify(prepared.data).includes('local:'));assert(!JSON.stringify(prepared.data).includes('PRIVATE-BODY-SENTINEL'));
 let capture;B.download=(name,blob)=>capture={name,blob};await B.actions['export-site'](element());assert(capture.blob instanceof Blob);
 await fs.writeFile(path.join(root,'tools/verified-browser-format.zip'),new Uint8Array(await capture.blob.arrayBuffer()));
 const assets=B._test.collectAssetPaths({...prepared.data,site:{...prepared.data.site,avatar:'assets/uploads/old-avatar.png'}});assert(assets.includes('assets/uploads/old-avatar.png'));
 assert(!ctx.localStorage.dump().includes('dummy-token'));
 console.log('PASS: Markdown escapes unsafe HTML/URLs; public exports exclude drafts and include local media.');
}
for(const mode of ['normal','content-conflict','branch-conflict','uncertain-write','edit-during-upload']){
 const {B,ctx,elements,calls,errors}=await setup({conflict:mode==='content-conflict',branchMoved:mode==='branch-conflict',uncertain:mode==='uncertain-write',editDuringUpload:mode==='edit-during-upload'});
 B.bindPublish();await elements['#github-form'].handlers.submit({preventDefault(){},submitter:element()});
 assert.equal(elements['#github-publish'].disabled,false);
 await B.actions['github-publish'](elements['#github-publish']);
 const updates=calls.filter(c=>c.method==='PATCH');
 assert.equal(updates.length,['normal','uncertain-write','edit-during-upload'].includes(mode)?1:0);
 const bodies=JSON.stringify(calls.filter(c=>c.method==='POST').map(c=>c.body));assert(!bodies.includes('PRIVATE-DRAFT-SENTINEL'));assert(!bodies.includes('PRIVATE-BODY-SENTINEL'));
 assert(!ctx.localStorage.dump().includes('dummy-token'));assert(!JSON.stringify(B.state.workspace).includes('dummy-token'));
 if(mode==='content-conflict')assert.equal(calls.filter(c=>c.method==='POST').length,0);
 assert.equal(errors.length,['normal','uncertain-write','edit-during-upload'].includes(mode)?0:1);
 if(mode==='edit-during-upload'){assert(B.state.workspace.posts[0].body.includes('LATE-EDIT-SENTINEL'));assert(!B.state.original.posts[0].body.includes('LATE-EDIT-SENTINEL'));}
 console.log(`PASS: GitHub ${mode}; atomic commit preserves unrelated files, rejects stale versions and never stores token.`);
}

{
 const {B,ctx,elements,errors,media}=await setup();
 media.set('local:unavailabledraftmedia',new File([new Uint8Array([5,6,7])],'draft.png',{type:'image/png'}));
 B.state.trash=[{id:'deleted-record',kind:'posts',value:{...structuredClone(B.state.original.posts[0]),id:'trashed-post',body:'![trash image](local:exampleimage)'},deletedAt:'2026-10-23T00:00:00Z'}];
 let captured;B.download=(name,blob)=>captured={name,blob};
 let restored=0;B.mediaPut=async file=>{const key='local:restored-'+(++restored);media.set(key,file);return key;};
 let recovery={post:{title:'导入前未保存的旧编辑状态'}};
 B.storageRepository={recovery:value=>{recovery=value;}};
 B.state.editorDirty=true;B.state.settingsDirty=true;
 let input;ctx.document.createElement=()=>{input={click(){}};return input;};
 B.modal=()=>{};B.closeModal=()=>{};elements['#confirm-import']=element();
 vm.runInContext(await fs.readFile(path.join(root,'src/backup.js'),'utf8'),ctx);
 await B.actions['export-backup'](element());
 const backup=JSON.parse(captured.blob);
 assert.equal(backup.format,'shijian-backup-v2');assert.equal(backup.trash.length,1);
 assert(backup.data.posts.some(p=>p.id==='private-draft'));
 assert(backup.media.some(m=>m.key==='assets/paper-light.wav'));
 assert(backup.media.some(m=>m.key==='local:unavailabledraftmedia'));
 const before=JSON.stringify(backup);
 B.actions['import-backup']();input.files=[new File([before],'backup.json',{type:'application/json'})];
 await input.onchange();await elements['#confirm-import'].onclick({target:element()});
 assert.equal(errors.length,0);assert.equal(B.state.trash.length,1);
 assert.equal(recovery,null);assert.equal(B.state.editorDirty,false);assert.equal(B.state.settingsDirty,false);
 const post=B.state.workspace.posts.find(p=>p.id==='private-draft');assert(post.body.includes('local:restored-'));
 const image=B.content.references({posts:[post]})[0];assert.deepEqual([...new Uint8Array(await media.get(image).arrayBuffer())],[5,6,7]);
 assert(B.state.workspace.tracks.every(t=>t.src.startsWith('local:restored-')));
 console.log('PASS: complete backup/import round trip preserves drafts, deleted content and embedded media bytes.');
}
{
 const {B,ctx}=await setup();let count=0;
 ctx.fetch=async()=>{count++;return count===1?{ok:false,status:503,json:async()=>({})}:{ok:true,status:200,json:async()=>({ok:true})};};
 assert((await B.request('https://example.test/data')).ok);assert.equal(count,2);
 count=0;ctx.fetch=async()=>{count++;throw Error('connection dropped');};
 await assert.rejects(()=>B.request('https://example.test/data',{method:'POST'}),/网络请求未完成/);assert.equal(count,1);
 ctx.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));
 await assert.rejects(()=>B.request('https://example.test/data',{timeout:10,attempts:1}),/请求超时/);
 console.log('PASS: bounded read retries, no blind write retries, and request timeouts.');
}
