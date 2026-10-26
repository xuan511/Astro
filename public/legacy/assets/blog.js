/* Storage adapter. Contains no rendering or blog-specific business rules. */
window.ShijianStorage = (() => {
  'use strict';
  class StorageConflict extends Error {
    constructor() { super('另一个页面已保存新版本。请先保留本页备份，再载入最新内容。'); this.name='StorageConflict'; }
  }
  function preference(storage, key, fallback=null) {
    try { return storage.getItem(key) ?? fallback; } catch { return fallback; }
  }
  function setPreference(storage, key, value) {
    try { if(value===null)storage.removeItem(key);else storage.setItem(key,String(value));return true; } catch { return false; }
  }
  function safeArea(name){try{return globalThis[name];}catch{return {getItem(){return null;},setItem(){throw Error('浏览器禁止保存');},removeItem(){}};}}
  function scopeFor(href) {
    const u=new URL('.',href.split('#')[0]);
    return window.SHIJIAN_LEGACY_SCOPE || u.pathname;
  }
  class Repository {
    constructor({scope=scopeFor(location.href),indexedDB=globalThis.indexedDB,local=safeArea('localStorage'),session=safeArea('sessionStorage')}={}) {
      this.scope=scope;this.idb=indexedDB;this.local=local;this.session=session;
      this.name='shijian-v2:'+scope;this.key='shijian:'+scope+':workspace';
      this.mode='indexeddb';this.opening=null;this.legacyOpening=null;
    }
    open() {
      if(this.opening)return this.opening;
      this.opening=new Promise((resolve,reject)=>{
        if(!this.idb)return reject(Error('此浏览器无法打开本地数据库'));
        const r=this.idb.open(this.name,1);
        r.onupgradeneeded=()=>{r.result.createObjectStore('records');r.result.createObjectStore('files');};
        r.onerror=()=>reject(r.error||Error('本地数据库无法打开'));
        r.onblocked=()=>reject(Error('请关闭其他旧版博客页面后重试'));
        r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();this.opening=null;};resolve(db);};
      });
      return this.opening;
    }
    async readRecord() {
      if(this.mode==='compat') {
        const raw=preference(this.local,this.key);
        return raw?JSON.parse(raw):null;
      }
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('records'),r=tx.objectStore('records').get('workspace');
        r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
      });
    }
    async load(initial) {
      let record;
      try {record=await this.readRecord();}
      catch(error) {
        this.mode='compat';this.opening=null;this.degradedReason=error.message;
        // Never treat an unreadable existing record as an empty workspace.
        record=await this.readRecord();
      }
      if(record)return record;
      const claimed=preference(this.local,'shijian-legacy-owner');
      const legacy=(!claimed||claimed===this.scope)?preference(this.local,'shijian-workspace-v1'):null;
      let data=initial;
      if(legacy){try{const parsed=JSON.parse(legacy);if(parsed?.schemaVersion===1&&Array.isArray(parsed.posts))data=parsed;}catch{}}
      record={revision:0,data:structuredClone(data),trash:[],savedAt:null};
      // Migrated records are written before claiming the legacy data. Old bytes remain intact.
      if(legacy&&data!==initial){record=await this.write(record,0);setPreference(this.local,'shijian-legacy-owner',this.scope);}
      return record;
    }
    async write(snapshot,expectedRevision) {
      const record={...structuredClone(snapshot),revision:expectedRevision+1,savedAt:new Date().toISOString()};
      if(this.mode==='compat') {
        const old=await this.readRecord();
        if((old?.revision||0)!==expectedRevision)throw new StorageConflict();
        if(!setPreference(this.local,this.key,JSON.stringify(record)))throw Error('本地保存失败，内容仍在本页，请立即导出备份');
        return record;
      }
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');let conflict=false;
        const get=store.get('workspace');
        get.onsuccess=()=>{
          if((get.result?.revision||0)!==expectedRevision){conflict=true;tx.abort();return;}
          store.put(record,'workspace');
        };
        tx.oncomplete=()=>resolve(record);
        tx.onabort=()=>reject(conflict?new StorageConflict():tx.error||Error('本地保存未完成，请重试或导出备份'));
        tx.onerror=()=>{};
      });
    }
    async putMedia(file,key) {
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,key);
        tx.oncomplete=()=>resolve(key);tx.onabort=()=>reject(tx.error||Error('媒体保存失败，请检查浏览器存储空间'));
      });
    }
    async getMedia(key) {
      const db=await this.open();
      const value=await new Promise((resolve,reject)=>{
        const r=db.transaction('files').objectStore('files').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      });
      if(value)return value;
      // Read through the v1 media store and migrate only the referenced file.
      if(!this.legacyOpening)this.legacyOpening=new Promise((resolve,reject)=>{
        const r=this.idb.open('shijian-media',1);
        r.onupgradeneeded=()=>r.result.createObjectStore('files');
        r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);
      });
      const legacy=await this.legacyOpening;
      const file=await new Promise((resolve,reject)=>{const r=legacy.transaction('files').objectStore('files').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      if(file)await this.putMedia(file,key);
      return file;
    }
    recovery(value) {
      const key=this.key+':editor-recovery';
      if(arguments.length)return setPreference(this.session,key,value?JSON.stringify(value):null);
      try{return JSON.parse(preference(this.session,key,'null'));}catch{return null;}
    }
  }
  return {Repository,StorageConflict,preference,setPreference,safeArea,scopeFor};
})();

/* 拾间 · dependency-free static blog */
window.Blog = (() => {
  'use strict';
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const escape = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    leaf:'<path d="M20 4c0 8-2 14-9 14a7 7 0 0 1-7-7C4 4 12 3 20 4Z"/><path d="m4 21 11-11"/>',
    arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon:'<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
    music:'<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
    play:'<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    pause:'<path d="M8 5v14m8-14v14" stroke-width="4"/>',
    next:'<path d="m5 5 10 7L5 19Z" fill="currentColor" stroke="none"/><path d="M19 5v14"/>',
    prev:'<path d="m19 5-10 7 10 7Z" fill="currentColor" stroke="none"/><path d="M5 5v14"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    edit:'<path d="m15 5 4 4M4 20l5-1L21 7a2.8 2.8 0 0 0-4-4L5 15Z"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="m5 12 4 4L20 5"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    settings:'<path d="m10 3-1 3-3 1-3 3 3 2v3l3 1 1 3h4l1-3 3-1v-3l3-2-3-3-3-1-1-3Z"/><circle cx="12" cy="11" r="3"/>',
    volume:'<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    github:'<path d="M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-2.8c3.3-.4 6.8-1.6 6.8-7.3a5.7 5.7 0 0 0-1.5-4 5.3 5.3 0 0 0-.1-4s-1.3-.4-4.2 1.5a14.5 14.5 0 0 0-7.5 0C4.6-.5 3.3-.1 3.3-.1a5.3 5.3 0 0 0-.1 4 5.7 5.7 0 0 0-1.5 4c0 5.7 3.5 6.9 6.8 7.3a3.5 3.5 0 0 0-1 2.8v4" transform="translate(1 2) scale(.9)"/>',
    book:'<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v15"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin:'<path d="m16 3 5 5-5 2-3 4-3 1-1-3 4-3Zm-6 12-7 7"/>',
    trash:'<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    file:'<path d="M14 2H4v20h16V8ZM14 2v6h6M8 12h8m-8 4h8"/>',
    cloud:'<path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11M12 21V11m-4 4 4-4 4 4"/>',
    link:'<path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
    heart:'<path d="M20 4c-3-2-6 0-8 2-2-2-5-4-8-2-5 4 0 10 8 16 8-6 13-12 8-16Z"/>',
    back:'<path d="M19 12H5m5-5-5 5 5 5"/>',
    rss:'<path d="M4 4a16 16 0 0 1 16 16M4 10a10 10 0 0 1 10 10"/><circle cx="5" cy="19" r="1" fill="currentColor"/>',
    eye:'<path d="M2 12S6 5 12 5s10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
  const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function url(value, {image=false, local=false}={}) {
    let s=String(value||'').trim();
    if (!s || /[\u0000-\u001f\u007f]/.test(s) || s.includes('\\')) return '';
    if (image && /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(s)) return s;
    if (local && /^local:[a-z\d-]+$/i.test(s)) return s;
    if (/^(https?:|mailto:)/i.test(s)) {try { const u=new URL(s); return ['https:','http:','mailto:'].includes(u.protocol)?u.href:'';}catch{return '';}}
    if (/^(#|\.\/|assets\/)/.test(s) && !s.startsWith('//') && !s.includes('..') && !s.includes(':')) return s;
    return '';
  }
  const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return today();const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:today();};
  const str=(v,max=1000)=>String(v??'').slice(0,max);
  function normalize(raw) {
    if (!raw || raw.schemaVersion!==1 || !raw.site || !Array.isArray(raw.posts)) throw Error('不是有效的拾间博客数据（需要 schemaVersion: 1）');
    if(raw.posts.length>2000||raw.notes?.length>2000||raw.tracks?.length>100)throw Error('内容数量超过当前版本支持的范围，请拆分数据后导入');
    const s=raw.site;
    return uniqueIds({
      schemaVersion:1, updatedAt:str(raw.updatedAt,50),
      site:{name:str(s.name||'拾间',20),author:str(s.author||'Ethan',40),tagline:str(s.tagline||'记录代码、日常与值得留下的片刻。',150),heroTitle:str(s.heroTitle||'记录，是生活的\n另一种回声。',100),heroDescription:str(s.heroDescription||'关于代码的思考，关于生活的碎片。\n把那些不想忘记的事情，慢慢写下来。',300),bio:str(s.bio||'写代码，也记录生活。',400),about:str(s.about||'',30000),avatar:url(s.avatar,{image:true,local:true}),github:url(s.github),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email||'')?str(s.email,150):'',footer:str(s.footer||'慢慢记录，认真生活。',100),accent:['forest','ink','clay'].includes(s.accent)?s.accent:'forest'},
      posts:raw.posts.filter(p=>p&&typeof p==='object').map(p=>({id:str(p.id||uid(),100),title:str(p.title||'未命名文章',150),excerpt:str(p.excerpt,400),body:str(p.body,200000),date:validDate(p.date),category:str(p.category||'生活',30),tags:Array.isArray(p.tags)?p.tags.slice(0,10).map(t=>str(t,25)):[],status:p.status==='draft'?'draft':'published',featured:!!p.featured,cover:['sage','sand','night','lavender'].includes(p.cover)?p.cover:'sage',demo:!!p.demo})),
      notes:Array.isArray(raw.notes)?raw.notes.filter(n=>n&&typeof n==='object').map(n=>({id:str(n.id||uid(),100),body:str(n.body,3000),date:validDate(n.date),demo:!!n.demo})):[],
      tracks:Array.isArray(raw.tracks)?raw.tracks.filter(t=>t&&typeof t==='object').map(t=>({id:str(t.id||uid(),100),title:str(t.title||'未命名音乐',100),artist:str(t.artist||'我的歌单',100),src:url(t.src,{local:true}),color:['sage','sand','night','lavender'].includes(t.color)?t.color:'sage'})).filter(t=>t.src):[]
    });
  }
  function uniqueIds(data){for(const key of ['posts','notes','tracks']){const used=new Set();for(const item of data[key]){if(used.has(item.id))item.id=uid();used.add(item.id);}}return data;}
  const original=uniqueIds(normalize(window.BLOG_DATA));
  const storageKey='shijian:'+window.ShijianStorage.scopeFor(location.href)+':';
  const prefArea=window.ShijianStorage.safeArea('localStorage');
  const sessionArea=window.ShijianStorage.safeArea('sessionStorage');
  const getPref=(key,fallback=null)=>window.ShijianStorage.preference(prefArea,storageKey+key,fallback);
  const setPref=(key,value)=>window.ShijianStorage.setPreference(prefArea,storageKey+key,value);
  const state={original,workspace:structuredClone(original),editing:window.ShijianStorage.preference(sessionArea,storageKey+'editing')==='1',theme:getPref('theme',window.ShijianStorage.preference(prefArea,'shijian-theme','light')),category:'全部',query:'',studioTab:'posts',editor:null,listLimit:12};
  const data=()=>state.editing?state.workspace:state.original;
  const posts=()=>data().posts.filter(p=>p.status==='published').sort((a,b)=>b.date.localeCompare(a.date));
  const canonical=value=>{const d=structuredClone(value);delete d.updatedAt;return JSON.stringify(d);};
  function enterWorkspace(){state.editing=true;window.ShijianStorage.setPreference(sessionArea,storageKey+'editing','1');}
  function leaveWorkspace(){state.editing=false;window.ShijianStorage.setPreference(sessionArea,storageKey+'editing',null);}
  function toast(message,type='success',action=null) {
    const el=document.createElement('div');el.className=`toast ${type}`;
    el.innerHTML=icon(type==='success'?'check':'file')+`<span>${escape(message)}</span>`;
    if(action){const button=document.createElement('button');button.className='text-link toast-action';button.textContent=action.label;button.dataset.action=action.action;if(action.id)button.dataset.id=action.id;el.append(button);}$('#toasts').append(el);setTimeout(()=>el.remove(),action?10000:4800);
  }
  function download(name,content,type='text/plain;charset=utf-8') {
    const blob=content instanceof Blob?content:new Blob([content],{type});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.textContent='下载 '+name;a.className='text-link';
    const notice=document.createElement('div');notice.className='toast';notice.append(a);$('#toasts').append(notice);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);notice.remove();},60000);
  }
  const readFile=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('文件读取失败'));r.readAsDataURL(file);});
  const mediaURLs=new Map();
  async function resolveMedia(src){
    if(mediaURLs.has(src))return mediaURLs.get(src);
    const uploaded=src?.match(/^assets\/uploads\/([a-z\d-]+)\.[a-z\d]+$/i);
    if(!src?.startsWith('local:')&&!uploaded)return src;
    let file;try{file=await window.Blog.mediaGet(uploaded?'local:'+uploaded[1]:src);}catch(error){if(!uploaded)throw error;}
    if(!file){if(uploaded)return src;throw Error('找不到本地媒体，请重新添加文件');}
    const value=URL.createObjectURL(file);mediaURLs.set(src,value);return value;
  }
  function aliasMedia(path,blob){if(mediaURLs.has(path))URL.revokeObjectURL(mediaURLs.get(path));mediaURLs.set(path,URL.createObjectURL(blob));}
  function modal(html,{wide=false,close=true}={}) {
    closeModal();const root=$('#overlay-root');root.innerHTML=`<div class="overlay"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${wide?'写作与管理':'对话框'}">${close?`<button class="icon-button modal-close" data-action="close-modal" aria-label="关闭">${icon('close')}</button>`:''}${html}</section></div>`;
    const previous=document.activeElement;root._previous=previous;const overlay=root.firstElementChild;
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
    document.body.classList.add('modal-open');setTimeout(()=>$('.modal input, .modal button, .modal textarea')?.focus(),50);
  }
  function closeModal(){const root=$('#overlay-root');if(!root)return;root.innerHTML='';document.body.classList.remove('modal-open');root._previous?.focus?.();}
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if(e.key==='Tab'&&$('.modal')){const f=$$('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex="0"]',$('.modal'));if(!f.length)return;const first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  function inline(text) {
    const stash=[];const hold=h=>`\u0001${stash.push(h)-1}\u0001`;
    text=escape(text).replace(/`([^`]+)`/g,(_,v)=>hold(`<code>${v}</code>`));
    text=text.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g,(_,alt,src)=>{const u=url(src.replace(/&amp;/g,'&'),{image:true,local:true});return u?hold(`<img class="article-image" ${u.startsWith('local:')?`data-media="${escape(u)}"`:`src="${escape(u)}"`} alt="${alt}" loading="lazy">`):alt;});
    text=text.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g,(_,label,href)=>{const u=url(href.replace(/&amp;/g,'&'));return u?hold(`<a href="${escape(u)}" ${u.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}>${label}</a>`):label;});
    text=text.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_]+)__/g,'<strong>$1</strong>').replace(/~~([^~]+)~~/g,'<del>$1</del>').replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
    return text.replace(/\u0001(\d+)\u0001/g,(_,n)=>stash[+n]);
  }
  function markdown(source) {
    const lines=String(source||'').replace(/\r\n/g,'\n').split('\n'),out=[],toc=[];let i=0;
    while(i<lines.length){const l=lines[i];
      if(!l.trim()){i++;continue;}
      if(/^```/.test(l)){const lang=l.slice(3).trim();let code=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);i++;out.push(`<div class="code-block"><div><span>${escape(lang||'code')}</span><button data-action="copy-code" aria-label="复制代码">${icon('copy')} 复制</button></div><pre><code>${escape(code.join('\n'))}</code></pre></div>`);continue;}
      const heading=l.match(/^(#{1,6})\s+(.+)/);if(heading){const level=heading[1].length,id='section-'+toc.length;toc.push({level,title:heading[2].replace(/[*`_]/g,''),id});out.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);i++;continue;}
      if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(l)){out.push('<hr>');i++;continue;}
      if(/^>\s?/.test(l)){const q=[];while(i<lines.length&&/^>\s?/.test(lines[i]))q.push(lines[i++].replace(/^>\s?/,''));out.push(`<blockquote>${q.map(inline).join('<br>')}</blockquote>`);continue;}
      if(/^\s*([-*+] |\d+\. )/.test(l)){const ordered=/^\s*\d+\./.test(l),tag=ordered?'ol':'ul',items=[];while(i<lines.length&&/^\s*([-*+] |\d+\. )/.test(lines[i])){let item=lines[i++].replace(/^\s*([-*+] |\d+\. )/,'');const todo=item.match(/^\[([ xX])\]\s+(.*)/);items.push(todo?`<li class="todo"><input type="checkbox" disabled ${todo[1].toLowerCase()==='x'?'checked':''}>${inline(todo[2])}</li>`:`<li>${inline(item)}</li>`);}out.push(`<${tag}>${items.join('')}</${tag}>`);continue;}
      if(l.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3}/.test(lines[i+1])){const cells=r=>r.trim().replace(/^\||\|$/g,'').split('|').map(x=>inline(x.trim()));const heads=cells(l);i+=2;const rows=[];while(i<lines.length&&lines[i].includes('|'))rows.push(cells(lines[i++]));out.push(`<div class="table-scroll"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;}
      const p=[l];i++;while(i<lines.length&&lines[i].trim()&&!/^(#{1,6}\s|```|>\s?|\s*[-*+] |\s*\d+\. )/.test(lines[i]))p.push(lines[i++]);out.push(`<p>${p.map(inline).join('<br>')}</p>`);
    }
    return {html:out.join('\n'),toc};
  }
  const readingTime=body=>Math.max(1,Math.ceil(String(body).length/450));
  const displayDate=(d,short=false)=>new Intl.DateTimeFormat('zh-CN',short?{month:'long',day:'numeric',timeZone:'Asia/Shanghai'}:{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Shanghai'}).format(new Date(d+'T12:00:00+08:00'));
  return {$,$$,escape,icon,uid,today,url,normalize,state,data,posts,canonical,storageKey,getPref,setPref,enterWorkspace,leaveWorkspace,toast,download,readFile,resolveMedia,aliasMedia,modal,closeModal,markdown,readingTime,displayDate};
})();

/* Workspace coordinator: serialized saves, recovery, revisions and cross-tab signals. */
(() => {
  'use strict';
  const B=Blog,S=B.state,Storage=window.ShijianStorage;
  const repository=new Storage.Repository();
  const clientId=B.uid();let queue=Promise.resolve(true),request=0,lastSerialized='',channel=null;
  S.storage={status:'loading',revision:0,savedAt:null,mode:'indexeddb',conflict:false,message:''};
  S.trash=[];
  const envelope=()=>({data:structuredClone(S.workspace),trash:structuredClone(S.trash)});
  const notify=()=>B.updateStorageStatus?.();
  function fail(error) {
    S.storage.status=error.name==='StorageConflict'?'conflict':'error';S.storage.message=error.message;
    if(error.name==='StorageConflict')S.storage.conflict=true;
    notify();B.toast(error.message,'error');return false;
  }
  B.persist=()=>{
    const snapshot=envelope(),serialized=JSON.stringify(snapshot),sequence=++request;
    S.storage.status='saving';notify();
    queue=queue.catch(()=>false).then(async()=>{
      if(S.storage.conflict)return fail(new Storage.StorageConflict());
      if(serialized===lastSerialized){if(sequence===request)S.storage.status='saved';notify();return true;}
      try {
        const record=await repository.write(snapshot,S.storage.revision);
        S.storage.revision=record.revision;S.storage.savedAt=record.savedAt;lastSerialized=serialized;
        if(sequence===request){S.storage.status='saved';S.storage.message='';}
        channel?.postMessage({clientId,revision:record.revision});notify();return true;
      }catch(error){return fail(error);}
    });
    return queue;
  };
  B.whenSaved=async()=>{await B.flushEditor?.();if(!await queue||S.storage.conflict||S.storage.status==='error')throw Error(S.storage.message||'内容尚未保存，请重试或先导出备份');};
  B.stageEditorRecovery=post=>repository.recovery({post:structuredClone(post),at:Date.now()});
  B.clearEditorRecovery=post=>{const recovery=repository.recovery();if(recovery?.post&&JSON.stringify(recovery.post)===JSON.stringify(post))repository.recovery(null);};
  B.loadStoredWorkspace=async()=>{
    await queue.catch(()=>false);const record=await repository.readRecord();if(!record)return;
    S.workspace=B.normalize(record.data);S.trash=Array.isArray(record.trash)?record.trash:[];
    S.storage={...S.storage,revision:record.revision,savedAt:record.savedAt,status:'saved',conflict:false,message:''};
    lastSerialized=JSON.stringify(envelope());S.editor=null;S.editorDirty=false;repository.recovery(null);notify();
  };
  B.mediaPut=async file=>repository.putMedia(file,'local:'+B.uid());
  B.mediaGet=key=>repository.getMedia(key);
  B.initWorkspace=async()=>{
    try {
      const record=await repository.load(S.original);
      if(!Number.isInteger(record.revision)||record.revision<0||!record.data)throw Error('本地写作数据格式异常，原始内容已保留，请先导出可用内容再恢复备份');
      S.workspace=B.normalize(record.data);S.trash=Array.isArray(record.trash)?record.trash:[];
      Object.assign(S.storage,{revision:record.revision,savedAt:record.savedAt,mode:repository.mode,status:'saved'});
      lastSerialized=JSON.stringify(envelope());
      const recovery=repository.recovery();
      if(recovery?.post){
        const p=recovery.post,stored=S.workspace.posts.find(x=>x.id===p.id);
        if(!stored||JSON.stringify(stored)!==JSON.stringify(p)){
          const recovered=B.normalize({schemaVersion:1,site:S.workspace.site,posts:[{...p,id:B.uid(),title:(p.title||'未命名文章')+' · 恢复的草稿',status:'draft',featured:false}]}).posts[0];
          S.workspace.posts.unshift(recovered);await B.persist();S.recoveredPostId=recovered.id;
        }
        repository.recovery(null);
      }
      if(typeof BroadcastChannel!=='undefined'){
        channel=new BroadcastChannel('shijian:'+repository.scope);
        channel.onmessage=event=>{if(event.data?.clientId!==clientId&&event.data?.revision>S.storage.revision){S.storage.conflict=true;S.storage.status='conflict';S.storage.message='另一个标签页已保存新版本。保留本页备份后，可载入最新内容。';notify();}};
      }
      if(repository.mode==='compat')S.storage.message='浏览器正在使用兼容保存；请只在一个标签页编辑，并定期导出备份。';
    }catch(error){fail(error);}
  };
  B.retrySave=()=>B.persist();
  B.storageRepository=repository;
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){B.flushEditor?.();B.flushSettings?.();}});
  window.addEventListener('beforeunload',event=>{
    if(S.editorDirty||S.settingsDirty||S.storage.status==='saving'||S.storage.status==='error'||S.storage.conflict){
      B.flushEditor?.();B.flushSettings?.();event.preventDefault();event.returnValue='';
    }
  });
})();

/* Typed content transforms. Media references are never inferred from ordinary prose. */
(() => {
  'use strict';
  const B=Blog;
  const isAsset=value=>/^assets\/[a-z\d_./-]+$/i.test(value||'')&&!value.includes('..');
  const isLocal=value=>/^local:[a-z\d-]+$/i.test(value||'');
  const imagePattern=/(!\[[^\]]*\]\()([^\s)]+)(\))/g;
  function transform(data,map) {
    const result=structuredClone(data);
    const replace=value=>Object.prototype.hasOwnProperty.call(map,value)?map[value]:value;
    if(result.site)result.site.avatar=replace(result.site.avatar);
    if(result.posts)for(const post of result.posts)post.body=post.body.replace(imagePattern,(_,before,src,after)=>before+replace(src)+after);
    if(result.tracks)for(const track of result.tracks)track.src=replace(track.src);
    return result;
  }
  function references(data) {
    const set=new Set();const add=value=>{if(isLocal(value)||isAsset(value))set.add(value);};
    add(data.site?.avatar);for(const track of data.tracks||[])add(track.src);
    for(const post of data.posts||[])for(const match of post.body.matchAll(imagePattern))add(match[2]);
    return [...set];
  }
  function trashData(trash=[]) {
    const result={posts:[],notes:[],tracks:[]};
    for(const record of trash)if(['posts','notes','tracks'].includes(record.kind))result[record.kind].push(record.value);
    return result;
  }
  function mapTrash(trash,map) {
    return trash.map(record=>{
      const key=record.kind;if(!['posts','notes','tracks'].includes(key))throw Error('回收站数据格式不正确');
      return {...record,value:transform({[key]:[record.value]},map)[key][0]};
    });
  }
  function pendingChanges(original,workspace) {
    const before=original.posts.filter(p=>p.status==='published'),after=workspace.posts.filter(p=>p.status==='published');
    const added=after.filter(p=>!before.some(q=>q.id===p.id)).length;
    const updated=after.filter(p=>before.some(q=>q.id===p.id&&JSON.stringify(q)!==JSON.stringify(p))).length;
    const removed=before.filter(p=>!after.some(q=>q.id===p.id)).length;
    const settings=JSON.stringify(original.site)!==JSON.stringify(workspace.site);
    const notes=JSON.stringify(original.notes)!==JSON.stringify(workspace.notes);
    const music=JSON.stringify(original.tracks)!==JSON.stringify(workspace.tracks);
    return {added,updated,removed,settings,notes,music,changed:!!(added||updated||removed||settings||notes||music)};
  }
  B.content={isAsset,isLocal,transform,references,trashData,mapTrash,pendingChanges};
})();

/* A single request policy: bounded timeouts and retries only for read operations. */
(() => {
  'use strict';
  const B=Blog;
  B.request=async(url,{method='GET',body,headers={},signal,timeout=25000,attempts=2,raw=false}={})=>{
    for(let attempt=0;attempt<attempts;attempt++){
      const controller=new AbortController(),onAbort=()=>controller.abort();let expired=false;
      if(signal?.aborted)throw Error('操作已取消');
      signal?.addEventListener('abort',onAbort,{once:true});
      const timer=setTimeout(()=>{expired=true;controller.abort();},timeout);
      try {
        const response=await fetch(url,{method,headers,signal:controller.signal,redirect:'error',cache:method==='GET'?'no-store':'default',...(body===undefined?{}:{body:JSON.stringify(body)})});
        if(method==='GET'&&response.status>=500&&attempt+1<attempts)continue;
        if(!response.ok){
          let detail;try{detail=await response.json();}catch{}
          const messages={401:'令牌无效或已过期，请重新输入。',403:'访问被拒绝，请检查令牌权限或稍后重试。',404:'找不到文件、仓库或分支，请检查配置。',409:'存在版本冲突，已停止同步。',422:'分支不能更新，请检查保护规则或重新连接。',429:'请求较多，请稍后再试。'};
          const error=Error(messages[response.status]||`请求失败（${response.status}）：${String(detail?.message||'请稍后重试').slice(0,100)}`);error.status=response.status;throw error;
        }
        return raw?new Uint8Array(await response.arrayBuffer()):response.status===204?{}:await response.json();
      }catch(error){
        if(signal?.aborted)throw Error('操作已取消');
        if(error.status)throw error;
        if(method==='GET'&&attempt+1<attempts)continue;
        throw Error(expired?'请求超时，内容仍保留在本地，请稍后重试。':'网络请求未完成，请检查连接后重试。');
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
    }
  };
})();

(() => {
  'use strict';
  const B=Blog,{$,$$,escape:e,icon:i,state:S}=B;
  B.actions={};
  const link=(label,url,cls='')=>`<a class="${cls}" href="${e(url)}">${label}</a>`;
  const articleURL=p=>'#/post/'+encodeURIComponent(p.id);
  B.articleURL=articleURL;
  const meta=p=>`<div class="post-meta"><span class="category-label">${e(p.category)}</span><span class="dot"></span><time>${e(B.displayDate(p.date))}</time>${p.demo?'<span class="demo-mark">示例</span>':''}</div>`;
  const tags=p=>`<div class="tag-list">${p.tags.map(t=>`<a class="tag" href="#/tag/${encodeURIComponent(t)}">${e(t)}</a>`).join('')}</div>`;
  function avatar(cls='avatar') {const site=B.data().site;return site.avatar?`<img class="${cls}" ${site.avatar.startsWith('local:')?`data-media="${e(site.avatar)}"`:`src="${e(site.avatar)}"`} alt="${e(site.author)} 的头像">`:`<div class="${cls}" aria-hidden="true">${e(site.author.charAt(0).toLowerCase())}</div>`;}
  function social(){const s=B.data().site;return `${s.github?`<a href="${e(s.github)}" target="_blank" rel="noopener noreferrer" aria-label="GitHub">${i('github')}</a>`:''}${s.email?`<a href="mailto:${e(s.email)}" aria-label="电子邮件">${i('link')}</a>`:''}`;}
  function thumb(p){return `<div class="post-thumb ${p.cover}" aria-hidden="true"><span class="thumb-orbit"></span><span class="thumb-icon">${i(({sage:'book',sand:'sun',night:'file',lavender:'music'})[p.cover])}</span></div>`;}
  function postRow(p){return `<a class="post-row" href="${articleURL(p)}"><div>${meta(p)}<h3>${e(p.title)}</h3><p class="excerpt">${e(p.excerpt||p.body.replace(/[#*`>]/g,'').slice(0,100))}</p><div class="post-bottom"><div class="tag-list">${p.tags.map(t=>`<span class="tag">${e(t)}</span>`).join('')}</div><span class="read-time">${i('clock')}${B.readingTime(p.body)} 分钟</span></div></div>${thumb(p)}</a>`;}
  function empty(title='这里还很安静',description='新的故事，会从下一次落笔开始。'){return `<div class="empty-state">${i('leaf')}<h3>${e(title)}</h3><p>${e(description)}</p></div>`;}
  function aside(){const d=B.data(),latest=d.notes.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,2),track=d.tracks[0];return `<aside class="home-aside"><div class="aside-block"><div class="aside-title">ABOUT ME <span style="flex:1;height:1px;background:var(--line)"></span></div><div class="profile-card"><div class="profile-top">${avatar()}<div><div class="profile-name">${e(d.site.author)}</div><div class="online">在自己的节奏里</div></div></div><p class="profile-bio">${e(d.site.bio)}</p><div class="profile-socials">${social()}<a class="more" href="#/about">更多关于我 ${i('arrow')}</a></div></div></div><div class="aside-block"><div class="aside-title">${i('edit')} 随手记下</div>${latest.length?latest.map(n=>`<a class="mini-note" style="display:block" href="#/notes"><p>${e(n.body)}</p><time>${e(B.displayDate(n.date,true))}${n.demo?'<span class="demo-mark">示例</span>':''}</time></a>`).join(''):'<p class="hint">给某个平凡的瞬间，留一个位置。</p>'}<a class="text-link" style="font-size:10px;color:var(--muted);margin-left:20px" href="#/notes">所有随记 ${i('arrow')}</a></div>${track?`<div class="aside-block"><div class="aside-title">${i('music')} MUSIC CORNER</div><button class="playlist-card" data-action="playlist" style="width:100%;text-align:left"><div class="playlist-top"><div class="vinyl"></div><div><div class="playlist-name">给日常一点背景乐</div><div class="playlist-sub">${d.tracks.length} 首 · 点击打开歌单</div></div></div><p class="playlist-quote">“文字之外，还有旋律。”</p></button></div>`:''}<p class="garden-note">A little space for thoughts,<br>and everything in between.</p></aside>`;}
  function renderHome(tag=''){
    const d=B.data(),all=B.posts(),featured=tag?null:all.find(p=>p.featured),categories=['全部',...new Set(all.map(p=>p.category))];
    let filtered=all.filter(p=>(S.category==='全部'||p.category===S.category)&&(!tag||p.tags.includes(tag)));
    const showFeature=featured&&S.category==='全部';if(showFeature)filtered=filtered.filter(p=>p.id!==featured.id);
    return `<div class="container">${!tag?`<section class="hero"><div><div class="eyebrow">A SMALL CORNER OF THE INTERNET</div><h1>${e(d.site.heroTitle)}</h1><p class="hero-description">${e(d.site.heroDescription)}</p><div class="hero-bottom"><a class="text-link" href="#latest" data-action="scroll-latest">从这里开始 ${i('arrow')}</a><span class="tiny-divider"></span><span class="hero-note">WRITE A LITTLE. LIVE A LOT.</span></div></div><div class="hero-art"><img src="./assets/hero.svg" alt="一扇窗、一张唱片与一枝绿叶的插画"><span class="art-caption">ordinary days, little wonders.</span></div></section>`:`<section class="page-top"><div class="eyebrow">COLLECTION</div><h1># ${e(tag)}</h1><p>一些有关「${e(tag)}」的记录。</p></section>`}<div class="home-layout" id="latest"><section><div class="section-heading"><h2>${tag?'标签文章':'最近的记录'}<small>${tag?'COLLECTION':'LATEST STORIES'}</small></h2><a class="text-link" href="#/archive">全部归档 ${i('arrow')}</a></div>${showFeature?`<a class="featured-post" href="${articleURL(featured)}"><div class="featured-art"><img src="./assets/feature.svg" alt="月光下的终端与纸页插画"></div><div class="featured-content">${meta(featured)}<h3>${e(featured.title)}</h3><p class="excerpt">${e(featured.excerpt)}</p><span class="text-link read-more">读一读 ${i('arrow')}</span></div></a>`:''}<div class="post-filter">${categories.map(c=>`<button class="filter-button ${S.category===c?'active':''}" data-action="category" data-value="${e(c)}">${e(c)}</button>`).join('')}<span class="post-count">${all.filter(p=>!tag||p.tags.includes(tag)).length} 篇记录</span></div><div id="post-list">${filtered.length?filtered.slice(0,S.listLimit).map(postRow).join(''):empty('还没有这类文章','可以换个分类，或去归档看看。')}</div>${filtered.length>S.listLimit?'<div class="load-more"><button class="button" data-action="load-more">继续翻一翻</button></div>':''}<div class="list-end">写给未来的自己</div></section>${aside()}</div></div>`;
  }
  function renderArchive(){const all=B.posts(),years=[...new Set(all.map(p=>p.date.slice(0,4)))];return `<div class="container"><section class="page-top"><div class="eyebrow">THE ARCHIVE</div><h1>时光的目录<span class="count-chip">${all.length} 篇文章</span></h1><p>写下的文字，是时间留下的脚印。</p></section>${years.length?years.map(y=>`<div class="archive-layout"><div class="archive-year">${e(y)}<span style="font:10px var(--sans);color:var(--muted);margin-left:9px">${all.filter(p=>p.date.startsWith(y)).length} 篇</span></div><div class="archive-month">${all.filter(p=>p.date.startsWith(y)).map(p=>`<a class="archive-item" href="${articleURL(p)}"><time>${p.date.slice(5).replace('-',' / ')}</time><h3>${e(p.title)}</h3>${p.demo?'<span class="demo-mark">示例</span>':''}${i('arrow')}</a>`).join('')}</div></div>`).join(''):empty()}</div>`;}
  function renderNotes(){const d=B.data(),notes=d.notes.slice().sort((a,b)=>b.date.localeCompare(a.date));return `<div class="container"><section class="page-top"><div class="eyebrow">LITTLE MOMENTS</div><h1>一些生活的切片</h1><p>不必每次都写成长篇。\n一句话、一点想法，也值得有个去处。</p></section><div class="notes-grid">${notes.map((n,idx)=>`<article class="note-card"><time>${i('clock')}${e(B.displayDate(n.date))}${n.demo?'<span class="demo-mark">示例</span>':''}</time><p>${e(n.body)}</p><div class="note-sign">${String(idx+1).padStart(2,'0')} / a little thought</div></article>`).join('')}</div>${!notes.length?empty():''}</div>`;}
  function renderAbout(){const d=B.data();return `<div class="container"><section class="page-top"><div class="eyebrow">BEHIND THE WORDS</div><h1>你好，我是 ${e(d.site.author)}。</h1><p>${e(d.site.tagline)}</p></section><div class="about-layout"><aside class="about-profile">${avatar()}<div><div class="profile-name">${e(d.site.author)}</div><p class="profile-bio">${e(d.site.bio)}</p></div><div class="profile-socials">${social()}</div></aside><article class="prose">${B.markdown(d.site.about).html}</article></div></div>`;}
  function renderArticle(id){const all=B.posts(),p=all.find(p=>p.id===id);if(!p)return `<div class="container">${empty('这篇文章还没出现','可能仍是草稿，也可能已经移到了别处。')}<p style="text-align:center"><a class="button" href="#/">回到首页</a></p></div>`;const md=B.markdown(p.body),idx=all.findIndex(q=>q.id===id),prev=all[idx+1],next=all[idx-1];document.title=p.title+' · '+B.data().site.name;return `<div class="container"><div class="article-layout"><article><a class="article-back" href="#/">${i('back')} 回到记录</a><header class="article-head">${meta(p)}<h1>${e(p.title)}</h1><div class="post-meta"><span>${e(B.data().site.author)}</span><span class="dot"></span><span>约 ${B.readingTime(p.body)} 分钟阅读</span></div>${tags(p)}</header><div class="prose article-body">${md.html}</div><div class="article-tail"><span class="article-sign">谢谢你，读到了这里。</span><div class="article-actions"><button class="button small" data-action="share-article">${i('link')} 复制链接</button>${S.editing?`<button class="button small" data-action="edit-post" data-id="${e(p.id)}">${i('edit')} 编辑</button>`:''}</div></div><div class="article-neighbors">${prev?`<a href="${articleURL(prev)}"><small>上一篇记录</small><p>${e(prev.title)}</p></a>`:'<span></span>'}${next?`<a href="${articleURL(next)}"><small>下一篇记录</small><p>${e(next.title)}</p></a>`:''}</div></article><aside><nav class="toc" aria-label="文章目录"><h2>在这篇记录里</h2>${md.toc.filter(h=>h.level<=3).map(h=>`<a class="level-${h.level}" href="#${h.id}" data-action="toc" data-id="${h.id}">${e(h.title)}</a>`).join('')}<p class="garden-note" style="margin-top:25px">Take your time.<br>Enjoy the reading.</p></nav></aside></div></div>`;}
  B.hydrateMedia=async()=>{for(const el of $$('img[data-media],img[src^="assets/uploads/"]')){try{el.src=await B.resolveMedia(el.dataset.media||el.getAttribute('src'));}catch{el.alt='本地图片暂不可用';}}};
  B.render=({scroll=true}={})=>{
    const route=(location.hash.slice(1)||'/').split('/'),page=route[1]||'home';if(page==='studio')B.enterWorkspace();
    const d=B.data();document.body.dataset.theme=S.theme;document.body.dataset.accent=d.site.accent;document.title=d.site.name+' · '+d.site.author+' 的个人博客';$('meta[name="description"]').content=d.site.tagline;
    $('#header').innerHTML=`<div class="container header-inner"><a class="brand" href="#/" aria-label="${e(d.site.name)} 首页"><span class="brand-mark">${i('book')}</span><span><span class="brand-name">${e(d.site.name)}</span><span class="brand-sub">${e(d.site.author.toUpperCase())}'S JOURNAL</span></span></a><nav class="nav" aria-label="主导航">${[['home','/','文章'],['notes','/notes','随记'],['archive','/archive','归档'],['about','/about','关于']].map(([key,path,name])=>`<a href="#${path}" class="${page===key||(key==='home'&&['post','tag'].includes(page))?'active':''}" ${page===key?'aria-current="page"':''}>${name}</a>`).join('')}</nav><div class="header-tools"><button class="icon-button" data-action="search" aria-label="搜索文章">${i('search')}</button><button class="icon-button theme-toggle" data-action="theme" aria-label="切换明暗主题">${i(S.theme==='dark'?'sun':'moon')}</button><button class="icon-button music-toggle" data-action="playlist" aria-label="打开歌单">${i('music')}</button></div></div>`;
    $('#workspace-bar').innerHTML=S.editing?`<div class="workspace-banner"><div class="container"><span>${i('edit')} 本地预览 <span class="workspace-description">· 本机写作空间，发布后访客可见</span></span><span style="display:flex;gap:15px"><a href="#/studio">写作台</a><button data-action="leave-workspace">查看线上内容</button></span></div></div>`:'';
    let html;try{html=page==='studio'?B.renderStudio():page==='post'?renderArticle(decodeURIComponent(route.slice(2).join('/'))):page==='tag'?renderHome(decodeURIComponent(route.slice(2).join('/'))):page==='archive'?renderArchive():page==='notes'?renderNotes():page==='about'?renderAbout():renderHome();}catch(error){console.error('Blog render failed:',error);html=`<div class="container">${empty('链接似乎写错了','回到首页，重新翻开一篇记录吧。')}</div>`;}
    $('#main').innerHTML=html;
    $('#footer').innerHTML=`<div class="container footer-inner"><span>© ${new Date().getFullYear()} ${e(d.site.author)} · ${e(d.site.name)}</span><span class="footer-note">${e(d.site.footer)}</span><div class="footer-links"><button data-action="theme">${S.theme==='dark'?'浅色模式':'深色模式'}</button><a href="#/studio">${i('edit')} 写作台</a></div></div>`;
    B.hydrateMedia();B.refreshPlayer?.();if(page==='studio')B.bindStudio?.();if(scroll)window.scrollTo({top:0,behavior:'instant'});updateProgress();
  };
  function updateProgress(){const article=$('.article-body'),bar=$('#reading-progress');if(!article){bar.style.width='0';return;}const start=article.offsetTop,end=article.offsetHeight-window.innerHeight+120;bar.style.width=Math.max(0,Math.min(100,(scrollY-start+150)/Math.max(1,end)*100))+'%';}
  window.addEventListener('scroll',updateProgress,{passive:true});
  B.actions['category']=el=>{S.category=el.dataset.value;S.listLimit=12;const y=scrollY;B.render({scroll:false});window.scrollTo(0,y);};
  B.actions['load-more']=()=>{S.listLimit+=12;B.render({scroll:false});};
  B.actions['focus-main']=()=>$('#main')?.focus({preventScroll:true});
  B.actions['scroll-latest']=()=>$('#latest')?.scrollIntoView({behavior:'smooth'});
  B.actions['toc']=el=>{document.getElementById(el.dataset.id)?.scrollIntoView({behavior:'smooth'});$$('.toc a').forEach(a=>a.classList.toggle('active',a===el));};
  B.actions['theme']=()=>{
    S.theme=S.theme==='dark'?'light':'dark';B.setPref('theme',S.theme);document.body.dataset.theme=S.theme;
    const headerButton=document.querySelector('.theme-toggle');if(headerButton)headerButton.innerHTML=i(S.theme==='dark'?'sun':'moon');
    const footerButton=document.querySelector('#footer [data-action="theme"]');if(footerButton)footerButton.textContent=S.theme==='dark'?'浅色模式':'深色模式';
  };
  B.actions['leave-workspace']=async()=>{await B.flushEditor?.();await B.flushSettings?.();B.leaveWorkspace();if(location.hash==='#/')B.render();else location.hash='#/';B.toast('正在查看已上线的内容。本地修改仍保留在写作台。');};
  B.actions['close-modal']=B.closeModal;
  B.copyText=async text=>{try{await navigator.clipboard.writeText(text);B.toast('已复制');}catch{B.modal(`<h2>复制内容</h2><p class="modal-description">选中下方文字后复制。</p><textarea style="width:100%;height:90px">${e(text)}</textarea>`);}};
  B.actions['copy-code']=el=>B.copyText(el.closest('.code-block').querySelector('pre').textContent);
  B.actions['share-article']=()=>B.copyText(location.href);
  B.actions['search']=()=>{B.modal(`<h2>翻找一段记录</h2><div class="search-field">${i('search')}<input id="global-search" type="search" placeholder="搜索标题、正文、标签…" aria-label="搜索文章"></div><div class="search-results" id="search-results"><p class="hint" style="padding:20px 0">想找些什么？输入一个关键词吧。</p></div><p class="keyboard-hint">ESC 关闭 · / 快速打开搜索</p>`);$('#global-search').addEventListener('input',ev=>{const q=ev.target.value.trim().toLocaleLowerCase();const results=q?B.posts().filter(p=>[p.title,p.body,p.category,...p.tags].join(' ').toLocaleLowerCase().includes(q)):[];$('#search-results').innerHTML=!q?'<p class="hint" style="padding:20px 0">想找些什么？输入一个关键词吧。</p>':results.length?results.slice(0,30).map(p=>`<a class="search-result" data-action="close-modal" href="${articleURL(p)}"><h3>${e(p.title)}</h3><p>${e(p.category)} · ${e(B.displayDate(p.date))}</p></a>`).join(''):empty('没有找到相关记录','试试另一个关键词。');});};
  document.addEventListener('click',async ev=>{const el=ev.target.closest('[data-action]');if(!el)return;const action=B.actions[el.dataset.action];if(!action)return;if(el.dataset.action!=='close-modal')ev.preventDefault();try{await action(el,ev);}catch(err){B.toast(err.message||'操作没有完成，请稍后重试。','error');}});
  document.addEventListener('keydown',async ev=>{if(ev.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)&&!$('.modal')){ev.preventDefault();B.actions.search();}if((ev.ctrlKey||ev.metaKey)&&ev.key==='s'&&S.editor){ev.preventDefault();if(await B.flushEditor?.())B.toast('已保存到此浏览器');}});
  const positions=new Map();let lastRoute=location.hash,routeGeneration=0;
  window.addEventListener('hashchange',async()=>{
    const generation=++routeGeneration;positions.set(lastRoute,scrollY);
    await B.flushEditor?.();await B.flushSettings?.();if(generation!==routeGeneration)return;
    B.closeModal();S.listLimit=12;B.render({scroll:false});$('#main')?.focus({preventScroll:true});
    window.scrollTo({top:positions.get(location.hash)||0,behavior:'instant'});lastRoute=location.hash;
  });
  B.ui={avatar,social,thumb,meta,tags,empty};
})();

(() => {
  'use strict';
  const B=Blog,{$,$$,escape:e,icon:i,state:S}=B;
  const field=(name,label,value='',type='text',extra='')=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${e(value)}" ${extra}></div>`;
  const textarea=(name,label,value='',rows=3)=>`<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" rows="${rows}">${e(value)}</textarea></div>`;
  const tabs=[['posts','file','文章'],['notes','edit','随记'],['music','music','音乐'],['settings','settings','外观资料'],['publish','cloud','发布上线'],['backup','download','数据备份'],['trash','trash','回收站']];
  B.renderStudio=()=>`<div class="container studio"><header class="studio-header"><div><div class="eyebrow">YOUR WRITING ROOM</div><h1>给想法，一个落脚点。</h1><p>写作、整理、听首歌。让这里慢慢变成你的样子。</p></div><div class="button-row"><a class="button" href="#/">${i('eye')} 预览博客</a><span class="save-status" id="workspace-save-status" role="status"></span><button class="button primary" data-action="studio-tab" data-tab="publish">${i('upload')} 发布</button></div></header><div id="storage-notice"></div><div class="studio-layout"><nav class="studio-nav" aria-label="写作台">${tabs.map(([key,ic,name])=>`<button class="studio-tab ${S.studioTab===key?'active':''}" data-action="studio-tab" data-tab="${key}">${i(ic)}${name}</button>`).join('')}</nav><section class="studio-content">${S.studioTab==='posts'?(S.editor?editor():postManager()):S.studioTab==='notes'?noteManager():S.studioTab==='music'?musicManager():S.studioTab==='settings'?settings():S.studioTab==='publish'?B.renderPublish():S.studioTab==='trash'?B.renderTrash():backup()}</section></div></div>`;
  function postManager(){const all=S.workspace.posts.slice().sort((a,b)=>b.date.localeCompare(a.date));return `${S.workspace.updatedAt!==S.original.updatedAt?'<div class="notice"><strong>线上内容有更新。</strong> 本地内容与草稿仍保留，发布前请先核对。<button class="button small" data-action="reload-workspace">载入线上内容</button></div>':''}<div class="notice"><strong>这里是你的本地写作空间。</strong> 草稿自动保存在此浏览器。文章设为公开后，可在「发布上线」同步到 GitHub，或导出整站上传；刷新页面不会丢失本地修改。公开站点的访客可以体验编辑，但无法修改线上内容。</div><div class="panel"><div class="panel-header"><h2>我的文章 <span class="hint">${all.length} 篇</span></h2><button class="button primary small" data-action="new-post">${i('plus')} 写文章</button></div><input type="search" class="search-inline" id="studio-post-search" placeholder="查找文章或草稿…" aria-label="查找文章"><div id="studio-posts">${all.length?all.map(p=>`<div class="studio-post" data-post-title="${e(p.title.toLowerCase())}"><div class="studio-post-info"><h3>${p.featured?i('pin'):''} ${e(p.title)}</h3><p><span class="status ${p.status==='draft'?'draft':''}">${p.status==='draft'?'草稿':JSON.stringify(S.original.posts.find(q=>q.id===p.id))===JSON.stringify(p)?'公开':'公开 · 待同步'}</span><span>${e(p.date)}</span><span>${e(p.category)}</span>${p.demo?'<span class="demo-mark">示例</span>':''}</p></div><div class="studio-actions"><button class="icon-button" data-action="edit-post" data-id="${e(p.id)}" aria-label="编辑 ${e(p.title)}">${i('edit')}</button><button class="icon-button" data-action="delete-post" data-id="${e(p.id)}" aria-label="删除 ${e(p.title)}">${i('trash')}</button></div></div>`).join(''):B.ui.empty('第一篇，从现在开始','不必准备好所有想法，先写第一行。')}</div></div>`;}
  function editor(){const p=S.editor;return `<div class="editor-top"><button class="text-link" data-action="editor-back">${i('back')} 返回文章</button><div class="button-row"><button class="button" data-action="save-post" data-status="draft">保存草稿</button><button class="button primary" data-action="save-post" data-status="published">${i('check')} 设为公开</button></div></div><div class="panel"><form id="article-form"><input class="title-input" id="article-title" aria-label="文章标题" placeholder="给这段记录起个名字…" value="${e(p.title)}" maxlength="150"><div class="editor-meta">${field('article-date','日期',p.date,'date','required')}${field('article-category','分类',p.category,'text','list="category-options" maxlength="30"')}${field('article-tags','标签（逗号分隔）',p.tags.join(', '))}</div><datalist id="category-options">${[...new Set(S.workspace.posts.map(p=>p.category))].map(c=>`<option value="${e(c)}">`).join('')}</datalist>${textarea('article-excerpt','摘要（选填，留空自动截取）',p.excerpt,2)}<div class="field-row"><div class="field"><label for="article-cover">封面色调</label><select id="article-cover">${[['sage','鼠尾草'],['sand','暖沙'],['night','暮色'],['lavender','浅紫']].map(([c,l])=>`<option value="${c}" ${p.cover===c?'selected':''}>${l}</option>`).join('')}</select></div><label class="check-field"><input type="checkbox" id="article-featured" ${p.featured?'checked':''}>置顶为首页精选</label></div><div class="editor-toolbar" aria-label="Markdown 工具栏"><button type="button" data-action="md-insert" data-kind="bold"><b>B</b></button><button type="button" data-action="md-insert" data-kind="italic"><em>I</em></button><button type="button" data-action="md-insert" data-kind="heading">H2</button><button type="button" data-action="md-insert" data-kind="quote">引用</button><button type="button" data-action="md-insert" data-kind="list">列表</button><button type="button" data-action="md-insert" data-kind="code">代码</button><button type="button" data-action="md-insert" data-kind="link">链接</button><button type="button" data-action="insert-image">图片</button><span class="spacer"></span><button type="button" data-action="focus-editor">${S.focusMode?'退出专注':'专注写作'}</button><button type="button" data-action="toggle-preview" aria-pressed="${!!S.editorPreview}">${i('eye')} 预览</button></div><div class="editor-body ${S.editorPreview?'split':''}" id="editor-body"><textarea id="article-body" aria-label="Markdown 正文" spellcheck="false" placeholder="从一个想法开始。支持 Markdown，也可以直接写文字。">${e(p.body)}</textarea>${S.editorPreview?`<div class="editor-preview prose" id="editor-preview">${B.markdown(p.body).html}</div>`:''}</div><div class="editor-stats"><span id="editor-save-status" role="status">正在检查保存状态…</span><span id="editor-word-count">${p.body.length} 字 · 约 ${B.readingTime(p.body)} 分钟</span></div></form></div><p class="hint">「设为公开」会把文章纳入下次发布；上线请点击右上角「发布」。Ctrl / ⌘ + S 可随时保存。正文中的原始 HTML 会作为文字显示。</p>`;}
  function noteManager(){return `<div class="panel"><div class="panel-header"><h2>随手记下</h2><button class="button primary small" data-action="edit-note">${i('plus')} 写随记</button></div><p class="panel-description">短短几句话，也可以装下一个很好的瞬间。</p>${S.workspace.notes.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(n=>`<div class="studio-post"><div class="studio-post-info"><h3>${e(n.body.slice(0,55))}</h3><p>${e(n.date)}${n.demo?' · 示例':''}</p></div><div class="studio-actions"><button class="icon-button" data-action="edit-note" data-id="${e(n.id)}" aria-label="编辑随记">${i('edit')}</button><button class="icon-button" data-action="delete-note" data-id="${e(n.id)}" aria-label="删除随记">${i('trash')}</button></div></div>`).join('')||B.ui.empty('写下一点小事','今天，有什么想留下来的？')}</div>`;}
  function musicManager(){return `<div class="panel"><div class="panel-header"><h2>给日常，配一首歌</h2><button class="button small" data-action="add-track-url">${i('link')} 添加直链</button></div><p class="panel-description">支持 MP3、WAV、OGG、M4A、FLAC。播放能力取决于访客的浏览器。</p><label class="drop-zone" style="display:block" for="audio-upload">${i('music')}<p>点击选择音乐文件</p><small>每首最大 20 MB · 随整站导出与 GitHub 同步</small><input id="audio-upload" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac" multiple hidden></label><p class="hint" id="media-upload-state" role="status"></p><div>${S.workspace.tracks.map((t,idx)=>`<div class="music-studio-item"><div class="vinyl"></div><div class="track-details"><h3>${e(t.title)}</h3><p>${e(t.artist)} · ${t.src.startsWith('local:')?'本地文件，发布时一起上传':t.src.startsWith('http')?'音乐直链':'站内音乐'}</p></div><div class="studio-actions">${idx>0?`<button class="icon-button" data-action="track-up" data-id="${e(t.id)}" aria-label="向前移动音乐">${i('upload')}</button>`:''}<button class="icon-button" data-action="edit-track" data-id="${e(t.id)}" aria-label="编辑音乐信息">${i('edit')}</button><button class="icon-button" data-action="remove-track" data-id="${e(t.id)}" aria-label="移除音乐">${i('trash')}</button></div></div>`).join('')}</div><div class="notice" style="margin:23px 0 0">音乐默认不自动播放。直链需要指向实际音频文件；网易云、QQ 音乐的歌曲分享页通常不能直接播放。请使用自己拥有或获准使用的音乐。</div></div>`;}
  function settings(){const s=S.workspace.site;return `<div class="panel"><h2>把这里，变成你的样子</h2><p class="panel-description">名字、介绍和配色，都可以慢慢调整。</p><form id="settings-form"><div class="field-row">${field('site-name','博客名字',s.name,'text','maxlength="20" required')}${field('site-author','你的名字',s.author,'text','maxlength="40" required')}</div>${field('site-tagline','一句话介绍',s.tagline,'text','maxlength="150"')}${textarea('site-heroTitle','首页标题（回车换行）',s.heroTitle,2)}${textarea('site-heroDescription','首页说明',s.heroDescription,3)}${textarea('site-bio','侧栏个人简介',s.bio,3)}<div class="field"><label for="avatar-upload">头像</label><div style="display:flex;align-items:center;gap:20px">${B.ui.avatar()}<label class="button small upload-label" for="avatar-upload">选择图片</label><input type="file" id="avatar-upload" accept="image/png,image/jpeg,image/webp,image/gif" hidden><button type="button" class="button small" data-action="remove-avatar">使用文字头像</button></div><small>PNG、JPG、WebP、GIF · 最大 3 MB</small></div><div class="field-row">${field('site-github','GitHub 地址',s.github,'url','placeholder="https://github.com/你的用户名"')}${field('site-email','公开联系邮箱（选填）',s.email,'email')}</div><div class="form-section-title">喜欢什么颜色？</div><div class="color-options">${[['forest','林间绿','#315c4c'],['ink','雾霭蓝','#4d657d'],['clay','陶土棕','#9e6650']].map(([k,l,c])=>`<label class="color-option ${s.accent===k?'active':''}"><input type="radio" name="accent" value="${k}" ${s.accent===k?'checked':''}><span class="color-dot" style="background:${c}"></span>${l}</label>`).join('')}</div><div class="content-divider"></div>${textarea('site-about','关于页面（支持 Markdown）',s.about,10)}${field('site-footer','页脚的一句话',s.footer,'text','maxlength="100"')}<div class="button-row"><button type="submit" class="button primary">${i('check')} 保存资料</button></div></form></div>`;}
  function backup(){return `<div class="panel"><h2>给文字，留一个备份</h2><p class="panel-description">数据属于你。导出后可以换浏览器、换设备，也可以迁移到自己的服务器。</p><div class="backup-buttons"><button class="button primary" data-action="export-backup">${i('download')} 完整备份 JSON</button><button class="button" data-action="import-backup">${i('upload')} 导入备份</button><button class="button" data-action="export-markdown">${i('file')} 导出 Markdown</button></div><div class="notice" style="margin-top:25px"><strong>完整备份包含草稿与已上传媒体。</strong> 请妥善保存。整站部署包与 GitHub 发布只包含公开文章、随记、资料及其引用的媒体，草稿不会上传。</div></div><div class="panel"><h2>清空示例，从你开始</h2><p class="panel-description">一键移除标有「示例」的文章与随记。你自己写的内容会保留。</p><button class="button danger" data-action="clear-demos">${i('trash')} 移除示例内容</button></div>`;}
  B.formField=field;B.formTextarea=textarea;
})();

(() => {
  'use strict';
  const B=Blog,{$,$$,escape:e,icon:i,state:S}=B;
  let settingsTimer;
  function saveSettingsFields() {
    const form=$('#settings-form');if(!form)return;
    const site=S.workspace.site;
    for(const key of ['name','author','tagline','heroTitle','heroDescription','bio','about','footer'])site[key]=$('#site-'+key).value;
    site.github=B.url($('#site-github').value);site.email=$('#site-email').value.trim();
    site.accent=form.querySelector('input[name="accent"]:checked').value;
  }
  B.flushSettings=async()=>{
    clearTimeout(settingsTimer);if(!S.settingsDirty)return true;
    saveSettingsFields();S.settingsDirty=false;const saved=await B.persist();
    if(!saved)S.settingsDirty=true;return saved;
  };
  B.updateStorageStatus=()=>{
    const storage=S.storage;if(!storage)return;
    const labels={loading:'正在载入…',saving:'正在保存…',saved:storage.savedAt?'已保存 '+new Date(storage.savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'本地写作空间已就绪',error:'保存失败 · 内容仍在本页',conflict:'另一页面有更新'};
    const text=labels[storage.status]||'';
    for(const el of [$('#workspace-save-status'),$('#editor-save-status')])if(el){el.textContent=text;el.dataset.status=storage.status;}
    const notice=$('#storage-notice');if(!notice)return;
    if(storage.conflict)notice.innerHTML=`<div class="notice storage-alert" role="alert"><strong>另一页面保存了新版本。</strong> 本页改动仍在，请先导出备份，或载入最新内容。<div class="button-row"><button class="button small" data-action="export-backup">备份本页内容</button><button class="button small" data-action="reload-stored">载入最新内容</button></div></div>`;
    else if(storage.status==='error')notice.innerHTML=`<div class="notice storage-alert" role="alert"><strong>内容还没有保存成功。</strong> ${e(storage.message)}<div class="button-row"><button class="button small" data-action="retry-save">重试保存</button><button class="button small" data-action="export-backup">导出备份</button></div></div>`;
    else if(storage.mode==='compat')notice.innerHTML='<div class="notice">浏览器正在使用兼容保存。请只在一个标签页编辑，并定期导出备份。</div>';
    else notice.innerHTML='';
  };
  B.actions['retry-save']=async()=>{
    if(!await B.flushEditor()||!await B.flushSettings())return;
    if(await B.retrySave())B.toast('保存成功');
  };
  B.actions['reload-stored']=()=>{
    B.modal(`<h2>载入另一页面的内容？</h2><p class="modal-description">本页未保存的改动将被替换。你可以先点击「备份本页内容」保留它们。</p><div class="button-row"><button class="button" data-action="export-backup">备份本页内容</button><button class="button primary" id="reload-stored-confirm">载入最新内容</button></div>`);
    $('#reload-stored-confirm').onclick=async()=>{await B.loadStoredWorkspace();B.closeModal();B.render({scroll:false});B.toast('已载入最新本地版本');};
  };
  B.actions['studio-tab']=async el=>{
    await B.flushEditor();await B.flushSettings();S.studioTab=el.dataset.tab;S.editor=null;
    if(location.hash!=='#/studio')location.hash='#/studio';else B.render({scroll:false});
  };
  B.actions['reload-workspace']=()=>{
    B.modal(`<h2>载入当前线上内容？</h2><p class="modal-description">公开文章、资料、随记与歌单将切换到线上版本。本地草稿会保留；未发布的其他修改请先导出备份。</p><div class="button-row"><button class="button" data-action="export-backup">先备份</button><button class="button primary" id="reload-online-confirm">载入线上并保留草稿</button></div>`);
    $('#reload-online-confirm').onclick=async()=>{
      const drafts=S.workspace.posts.filter(p=>p.status==='draft').map(p=>({...p,id:S.original.posts.some(q=>q.id===p.id)?B.uid():p.id}));
      S.workspace=structuredClone(S.original);S.workspace.posts.push(...drafts);
      if(await B.persist()){S.editor=null;B.closeModal();B.render({scroll:false});B.toast('线上内容已载入，草稿已保留');}
    };
  };
  async function moveToTrash(kind,id) {
    const list=S.workspace[kind],index=list.findIndex(value=>value.id===id);if(index<0)return;
    const [value]=list.splice(index,1),record={id:B.uid(),kind,value,deletedAt:new Date().toISOString()};S.trash.unshift(record);
    if(await B.persist()){B.render({scroll:false});B.toast('已移到回收站','success',{label:'撤销',action:'restore-trash',id:record.id});}
  }
  B.actions['delete-post']=el=>moveToTrash('posts',el.dataset.id);
  B.actions['delete-note']=el=>moveToTrash('notes',el.dataset.id);
  B.actions['remove-track']=el=>moveToTrash('tracks',el.dataset.id);
  B.renderTrash=()=>`<div class="panel"><div class="panel-header"><h2>回收站 <span class="hint">${S.trash.length} 项</span></h2></div><p class="panel-description">删除的文章、随记和音乐先保存在这里。恢复后需要发布，才会重新出现在公开站点。</p>${S.trash.map(record=>`<div class="studio-post"><div class="studio-post-info"><h3>${e(record.value.title||record.value.body?.slice(0,60)||'未命名内容')}</h3><p>${({posts:'文章',notes:'随记',tracks:'音乐'})[record.kind]||'内容'} · ${e(record.deletedAt.slice(0,10))}</p></div><button class="button small" data-action="restore-trash" data-id="${e(record.id)}">恢复</button></div>`).join('')||B.ui.empty('这里空空的','删除的内容会先保留在这里。')}</div>`;
  B.actions['restore-trash']=async el=>{
    const index=S.trash.findIndex(r=>r.id===el.dataset.id);if(index<0)return;
    const record=S.trash[index],value=structuredClone(record.value);if(!S.workspace[record.kind])throw Error('无法识别的回收站内容');
    if(S.workspace[record.kind].some(p=>p.id===value.id))value.id=B.uid();
    S.workspace[record.kind].unshift(value);S.trash.splice(index,1);
    if(await B.persist()){B.render({scroll:false});B.toast('内容已恢复');}
  };
  B.actions['clear-demos']=()=>{
    B.modal(`<h2>移除示例内容？</h2><p class="modal-description">标有「示例」的文章和随记会移到回收站，你自己写的内容会保留。</p><div class="button-row"><button class="button" data-action="close-modal">取消</button><button class="button primary" id="clear-demos-confirm">移到回收站</button></div>`);
    $('#clear-demos-confirm').onclick=async()=>{for(const kind of ['posts','notes']){const samples=S.workspace[kind].filter(v=>v.demo);S.workspace[kind]=S.workspace[kind].filter(v=>!v.demo);for(const value of samples)S.trash.unshift({id:B.uid(),kind,value,deletedAt:new Date().toISOString()});}if(await B.persist()){B.closeModal();B.render({scroll:false});B.toast('示例已移到回收站');}};
  };
  B.actions['edit-note']=el=>{
    const note=S.workspace.notes.find(n=>n.id===el.dataset.id)||{id:B.uid(),date:B.today(),body:'',demo:false};
    B.modal(`<h2>记下一点小事</h2><p class="modal-description">不必完整，也不必深刻。</p><form id="note-form">${B.formTextarea('note-body','想留下的话',note.body,6)}${B.formField('note-date','日期',note.date,'date')}<div class="button-row"><button class="button primary" type="submit">${i('check')} 保存随记</button></div></form>`);
    $('#note-form').onsubmit=async event=>{
      event.preventDefault();const body=$('#note-body').value.trim();if(!body)return B.toast('还没有写下内容','error');
      const value={...note,body:body.slice(0,3000),date:$('#note-date').value||B.today(),demo:false},index=S.workspace.notes.findIndex(n=>n.id===value.id);
      if(index>=0)S.workspace.notes[index]=value;else S.workspace.notes.unshift(value);
      if(await B.persist()){B.closeModal();B.render({scroll:false});B.toast('随记已保存');}
    };
  };
  function trackDialog(track,add=false) {
    B.modal(`<h2>${add?'添加音乐直链':'编辑音乐信息'}</h2><p class="modal-description">给背景乐，一个合适的名字。</p><form id="track-form">${B.formField('track-title','曲名',track.title,'text','required maxlength="100"')}${B.formField('track-artist','音乐人 / 说明',track.artist,'text','maxlength="100"')}${!track.src.startsWith('local:')?B.formField('track-src','音频地址',track.src,'text','required placeholder="https://…/music.mp3"'):''}<div class="button-row"><button type="submit" class="button primary">保存音乐</button></div></form>`);
    $('#track-form').onsubmit=async event=>{
      event.preventDefault();const src=$('#track-src')?.value.trim()||track.src;if(!B.url(src,{local:true}))return B.toast('请输入有效的音频直链','error');
      const value={...track,title:$('#track-title').value.trim()||'未命名音乐',artist:$('#track-artist').value.trim(),src};
      if(add)S.workspace.tracks.push(value);else S.workspace.tracks[S.workspace.tracks.findIndex(t=>t.id===value.id)]=value;
      if(await B.persist()){B.closeModal();B.render({scroll:false});B.toast('歌单已保存');}
    };
  }
  B.actions['add-track-url']=()=>trackDialog({id:B.uid(),title:'',artist:'',src:'',color:'sage'},true);
  B.actions['edit-track']=el=>trackDialog(S.workspace.tracks.find(t=>t.id===el.dataset.id));
  B.actions['track-up']=async el=>{const index=S.workspace.tracks.findIndex(t=>t.id===el.dataset.id);if(index>0){[S.workspace.tracks[index-1],S.workspace.tracks[index]]=[S.workspace.tracks[index],S.workspace.tracks[index-1]];if(await B.persist())B.render({scroll:false});}};
  B.actions['remove-avatar']=async()=>{saveSettingsFields();S.workspace.site.avatar='';if(await B.persist())B.render({scroll:false});};
  B.bindStudio=()=>{
    B.updateStorageStatus();B.bindEditor?.();B.applyFocusMode?.();
    $('#studio-post-search')?.addEventListener('input',event=>{const q=event.target.value.toLowerCase();$$('[data-post-title]').forEach(el=>el.hidden=!el.dataset.postTitle.includes(q));});
    $('#settings-form')?.addEventListener('input',()=>{S.settingsDirty=true;saveSettingsFields();clearTimeout(settingsTimer);settingsTimer=setTimeout(B.flushSettings,500);});
    $('#settings-form')?.addEventListener('submit',async event=>{event.preventDefault();S.settingsDirty=true;if(await B.flushSettings()){S.workspace=B.normalize(S.workspace);B.render({scroll:false});B.toast('资料已保存');}});
    $('#avatar-upload')?.addEventListener('change',async event=>{try{const file=event.target.files[0];if(!file)return;if(file.size>3*1024*1024)throw Error('头像请控制在 3 MB 以内');if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('请选择常见格式的图片');saveSettingsFields();S.workspace.site.avatar=await B.mediaPut(file);if(await B.persist())B.render({scroll:false});}catch(error){B.toast(error.message,'error');}});
    $('#audio-upload')?.addEventListener('change',async event=>{
      const input=event.target;let count=0;
      try{for(const file of input.files){
        if(S.workspace.tracks.length>=100)throw Error('歌单最多支持 100 首音乐');
        if(file.size>20*1024*1024)throw Error(file.name+' 超过 20 MB');
        if(!/^audio\//.test(file.type)&&!/\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name))throw Error('请选择音频文件');
        if($('#media-upload-state'))$('#media-upload-state').textContent=`正在保存 ${count+1}/${input.files.length}：${file.name}`;
        const src=await B.mediaPut(file);S.workspace.tracks.push({id:B.uid(),title:file.name.replace(/\.[^.]+$/,''),artist:'我的歌单',src,color:'sage'});
        if(!await B.persist())return;count++;
      }B.render({scroll:false});B.toast(`已添加 ${count} 首音乐`);}catch(error){B.render({scroll:false});B.toast(error.message,'error');}finally{input.value='';}
    });
    B.bindPublish?.();
  };
})();

/* Editor controller: keep the textarea mounted so selection, undo and IME survive. */
(() => {
  'use strict';
  const B=Blog,{$,state:S}=B;
  let saveTimer,previewTimer,composing=false;
  function collect() {
    if(!S.editor||!$('#article-title'))return S.editor;
    Object.assign(S.editor,{
      title:$('#article-title').value,date:$('#article-date').value||B.today(),
      category:$('#article-category').value.trim()||'生活',
      tags:[...new Set($('#article-tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean))].slice(0,10),
      excerpt:$('#article-excerpt').value,cover:$('#article-cover').value,
      featured:$('#article-featured').checked,body:$('#article-body').value,demo:false
    });
    return S.editor;
  }
  function snapshot() {const p=structuredClone(collect());if(p&&!p.title.trim())p.title='未命名文章';return p;}
  function updatePreview() {
    const preview=$('#editor-preview'),body=$('#article-body');
    if(!preview||!body||preview._source===body.value)return;
    preview._source=body.value;preview.innerHTML=B.markdown(body.value).html;B.hydrateMedia();
  }
  B.flushEditor=async()=>{
    clearTimeout(saveTimer);
    if(!S.editor||!S.editorDirty)return true;
    const p=snapshot();
    if(!S.editor.title.trim()&&!p.body.trim())return true;
    const idx=S.workspace.posts.findIndex(q=>q.id===p.id);
    if(idx>=0)S.workspace.posts[idx]=p;else S.workspace.posts.unshift(p);
    if(p.featured)S.workspace.posts.forEach(q=>{if(q.id!==p.id)q.featured=false;});
    S.editorDirty=false;B.stageEditorRecovery(p);
    const saved=await B.persist();
    if(saved)B.clearEditorRecovery(p);
    else if(S.editor?.id===p.id)S.editorDirty=true;
    return saved;
  };
  function onInput() {
    S.editorDirty=true;const p=snapshot();B.stageEditorRecovery(p);
    const body=$('#article-body');
    if($('#editor-word-count'))$('#editor-word-count').textContent=`${body.value.length} 字 · 约 ${B.readingTime(body.value)} 分钟`;
    if($('#editor-save-status'))$('#editor-save-status').textContent='尚未保存…';
    clearTimeout(saveTimer);saveTimer=setTimeout(B.flushEditor,450);
    clearTimeout(previewTimer);if(!composing)previewTimer=setTimeout(updatePreview,160);
  }
  B.bindEditor=()=>{
    const form=$('#article-form');if(!form)return;
    form.addEventListener('submit',event=>event.preventDefault());form.addEventListener('input',onInput);
    form.addEventListener('change',onInput);
    $('#article-body').addEventListener('compositionstart',()=>{composing=true;});
    $('#article-body').addEventListener('compositionend',()=>{composing=false;updatePreview();});
    $('#article-body').addEventListener('keydown',event=>{
      if(event.key==='Tab'&&!event.shiftKey){event.preventDefault();insert('    ','','');}
    });
    B.applyFocusMode?.();B.updateStorageStatus?.();
  };
  async function open(post) {
    if(!await B.flushEditor())return;
    S.editor=post;S.editorDirty=false;S.studioTab='posts';
    if(location.hash!=='#/studio')location.hash='#/studio';else B.render({scroll:false});
  }
  B.actions['new-post']=async()=>{
    await open({id:B.uid(),title:'',excerpt:'',body:'',date:B.today(),category:'生活',tags:[],status:'draft',featured:false,cover:'sage',demo:false});
    $('#article-title')?.focus();
  };
  B.actions['edit-post']=el=>{
    const p=S.workspace.posts.find(p=>p.id===el.dataset.id);
    if(!p)throw Error('找不到这篇文章');return open(structuredClone(p));
  };
  B.actions['save-post']=async el=>{
    collect();
    if(!S.editor.title.trim()){$('#article-title').focus();throw Error('先给文章起个名字吧');}
    if(!S.editor.body.trim()){$('#article-body').focus();throw Error('正文还没有内容');}
    S.editor.status=el.dataset.status;S.editorDirty=true;
    if(await B.flushEditor())B.toast(el.dataset.status==='draft'?'草稿已保存':'已设为公开，发布后访客可见');
  };
  B.actions['editor-back']=async()=>{if(!await B.flushEditor())return;S.editor=null;B.render({scroll:false});};
  function insert(before,after='',placeholder='文字') {
    const ta=$('#article-body');if(!ta)return;
    const start=ta.selectionStart,end=ta.selectionEnd,selected=ta.value.slice(start,end)||placeholder;
    ta.setRangeText(before+selected+after,start,end,'select');ta.focus();ta.dispatchEvent(new Event('input',{bubbles:true}));
  }
  B.actions['md-insert']=el=>{
    const f={bold:['**','**'],italic:['*','*'],heading:['\n## ','\n','小标题'],quote:['\n> ','\n','想引用的话'],list:['\n- ','\n','第一件事'],code:['\n```c\n','\n```\n','// 在这里写代码'],link:['[','](https://example.com)','链接文字']};insert(...f[el.dataset.kind]);
  };
  B.actions['toggle-preview']=()=>{
    S.editorPreview=!S.editorPreview;const root=$('#editor-body');root.classList.toggle('split',S.editorPreview);
    if(S.editorPreview){const p=document.createElement('div');p.className='editor-preview prose';p.id='editor-preview';root.append(p);updatePreview();}
    else $('#editor-preview')?.remove();
    const button=document.querySelector('[data-action="toggle-preview"]');button?.setAttribute('aria-pressed',String(S.editorPreview));
  };
  B.actions['insert-image']=()=>{
    const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp,image/gif';
    input.onchange=async()=>{try{
      const file=input.files[0];if(!file)return;
      if(file.size>5*1024*1024)throw Error('图片请控制在 5 MB 以内');
      if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('请选择 PNG、JPG、WebP 或 GIF 图片');
      const src=await B.mediaPut(file);insert('\n![',`](${src})\n`,file.name.replace(/[\[\]()]/g,' '));
      await B.flushEditor();
    }catch(error){B.toast(error.message,'error');}};input.click();
  };
  B.applyFocusMode=()=>{document.querySelector('.studio')?.classList.toggle('focus-mode',!!S.focusMode&&!!S.editor);};
  B.actions['focus-editor']=()=>{S.focusMode=!S.focusMode;B.setPref('focus-mode',S.focusMode?'1':'0');B.applyFocusMode();const el=document.querySelector('[data-action="focus-editor"]');if(el)el.textContent=S.focusMode?'退出专注':'专注写作';};
  S.focusMode=B.getPref('focus-mode')==='1';
})();

(() => {
  'use strict';
  const B=Blog,{$,escape:e,icon:i,state:S}=B,encoder=new TextEncoder();
  const ASSETS=['assets/hero.svg','assets/feature.svg','assets/paper-light.wav','assets/blog.js','assets/blog.css'];
  function publicData(){const d=B.normalize(S.workspace);d.posts=d.posts.filter(p=>p.status==='published');return d;}
  B.publicData=publicData;
  function contentScript(d){return '/* 拾间博客公开内容 · 此文件不包含草稿 */\nwindow.BLOG_DATA = '+JSON.stringify(d,null,2).replace(/</g,'\\u003c')+';\n';}
  function decodeContent(text){const m=text.match(/^\/\*[\s\S]*?\*\/\s*window\.BLOG_DATA\s*=\s*([\s\S]+);\s*$/)||text.match(/^\s*window\.BLOG_DATA\s*=\s*([\s\S]+);\s*$/);if(!m)throw Error('仓库中的 content.js 不是拾间博客文件，请检查仓库和目录');return B.normalize(JSON.parse(m[1]));}
  function localKeys(data){return B.content.references(data).filter(B.content.isLocal);}
  async function bytesFor(blob){return new Uint8Array(await blob.arrayBuffer());}
  function base64(bytes){let binary='';for(let k=0;k<bytes.length;k+=0x8000)binary+=String.fromCharCode(...bytes.subarray(k,k+0x8000));return btoa(binary);}
  function unbase64(str){return Uint8Array.from(atob(str),c=>c.charCodeAt(0));}
  async function preparePublic(){
    const d=publicData(),media=[],map={};
    for(const key of localKeys(d)){const file=await B.mediaGet(key);if(!file)throw Error('有媒体文件缺失，请在文章或歌单里重新上传');const ext=({'audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a','audio/flac':'flac','image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'})[file.type]||file.name?.match(/\.([a-z\d]{1,5})$/i)?.[1]||'bin';const path='assets/uploads/'+key.slice(6)+'.'+ext.toLowerCase();map[key]=path;media.push({name:path,bytes:await bytesFor(file)});}
    const portable=B.normalize(B.content.transform(d,map));portable.updatedAt=new Date().toISOString();return {data:portable,media,map};
  }
  const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
  function zip(files){const pieces=[],directory=[];let offset=0;const now=new Date(),dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1),dosDate=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    for(const file of files){const name=encoder.encode(file.name),bytes=typeof file.bytes==='string'?encoder.encode(file.bytes):file.bytes,crc=crc32(bytes);const local=new Uint8Array(30+name.length),dv=new DataView(local.buffer);dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0x800,true);dv.setUint16(10,dosTime,true);dv.setUint16(12,dosDate,true);dv.setUint32(14,crc,true);dv.setUint32(18,bytes.length,true);dv.setUint32(22,bytes.length,true);dv.setUint16(26,name.length,true);local.set(name,30);pieces.push(local,bytes);const central=new Uint8Array(46+name.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(12,dosTime,true);cv.setUint16(14,dosDate,true);cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=local.length+bytes.length;}
    const centralSize=directory.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);return new Blob([...pieces,...directory,end],{type:'application/zip'});
  }
  B.zip=zip;
  const readme=`# 拾间 · 个人博客\n\n零依赖静态网站，支持 Markdown 编辑、草稿、图片、随记、音乐、明暗主题、回收站和专注写作。\n\n## GitHub Pages\n1. 创建公开仓库，推荐 xuan511.github.io，也支持任意仓库名。\n2. 把本压缩包内文件上传到仓库根目录（不要再包一层目录）。\n3. Settings → Pages → Deploy from a branch → main → /(root) → Save。\n4. 等待 Pages 完成部署后，通过仓库 Settings → Pages 显示的链接访问。\n\n## 写作与更新\n页面底部 → 写作台。内容先保存在浏览器，公开更新有两种方式：\n- 发布上线 → 导出整站 ZIP → 上传替换仓库中的文件。\n- 发布上线 → 连接已有 GitHub 仓库 → 同步公开内容。令牌仅在当前页面内存中使用，不写入本地存储或导出文件。\n\nGitHub 在线同步需要 fine-grained Personal Access Token，仅选择博客仓库，Contents: Read and write。令牌过期后重新输入。请勿把令牌写入 content.js 或文章正文。\n\n文章点击「设为公开」之后才会进入发布包。JSON 完整备份包含草稿、回收站和已引用的站内媒体；Markdown 导出包含正文图片。部署包不含草稿和回收站。写作数据主要存于 IndexedDB，会迁移旧版数据。不同站点子目录分别保存；多标签页版本冲突时会停止覆盖并提示备份。定期导出备份，浏览器清理数据会删除本地工作区与未同步媒体。\n\n本地预览：在此目录执行 python -m http.server 8000，然后访问 http://localhost:8000。可直接打开 index.html 阅读；整站导出与 GitHub 同步请通过 HTTP/HTTPS 使用。\n\n## 升级已有站点\n先在旧站点导出 JSON 完整备份，再上传新版文件。每次升级请一并替换 index.html 与 assets/blog.js、assets/blog.css；保留自己的 content.js 与 assets/uploads。只同步 GitHub 公开内容不会升级程序文件。写作空间按网址与子目录隔离，更换域名或目录时请导出备份，再到新网址导入。\n\n## 迁移服务器 / 域名\n把整站文件放入 Nginx 等静态服务目录即可；不需要 Node、数据库或构建过程。自定义域名在 GitHub Pages 或你的服务器中配置。\n\n音乐不自动播放；支持本地音频和可公开访问的音频直链。内置「纸上微光」为本项目合成的原创示例，可自由使用与删除。示例文章与随记均可在数据备份页一键移除。\n`;
  async function fetchBytes(path){return B.request(new URL(path,location.href.split('#')[0]).href,{raw:true});}
  async function siteFiles(prepared){if(location.protocol==='file:')throw Error('整站导出请先用本地服务器打开，具体方法见使用说明');const html=new TextDecoder().decode(await fetchBytes('index.html'));const files=[{name:'index.html',bytes:html},{name:'content.js',bytes:contentScript(prepared.data)},{name:'.nojekyll',bytes:''},{name:'README.md',bytes:readme}];const pending=new Set(prepared.media.map(m=>m.name)),included=new Set([...ASSETS,...collectAssetPaths(prepared.data)]);for(const path of included)if(!pending.has(path))files.push({name:path,bytes:await fetchBytes(path)});files.push(...prepared.media);return files;}
  function collectAssetPaths(data){return B.content.references(data).filter(B.content.isAsset);}
  B.actions['export-site']=async el=>{await B.flushEditor?.();await B.flushSettings?.();el.disabled=true;const text=el.innerHTML;el.textContent='正在整理整站…';try{const prepared=await preparePublic(),files=await siteFiles(prepared);B.download('shijian-blog-'+B.today()+'.zip',zip(files));B.toast('整站已准备好。若未自动下载，请点击下载链接。');}finally{el.disabled=false;el.innerHTML=text;}};
  B.transfer={ASSETS,publicData,contentScript,decodeContent,preparePublic,base64,unbase64,collectAssetPaths,readme,fetchBytes,zip};
  B._test={crc32,zip,contentScript,decodeContent,collectAssetPaths,preparePublic};
})();

/* Backups include referenced binary files and recycle-bin entries, not just text. */
(() => {
  'use strict';
  const B=Blog,{$,escape:e,state:S}=B;
  const {base64,unbase64,fetchBytes,zip}=B.transfer;
  const mimeByExtension={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',flac:'audio/flac',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
  async function fileForReference(key) {
    if(B.content.isLocal(key)){
      const file=await B.mediaGet(key);if(!file)throw Error('本地媒体缺失，请重新上传：'+key);return file;
    }
    const match=key.match(/^assets\/uploads\/([a-z\d-]+)\.[a-z\d]+$/i);
    if(match){try{const file=await B.mediaGet('local:'+match[1]);if(file)return file;}catch{}}
    const bytes=await fetchBytes(key),name=key.split('/').at(-1),ext=name.split('.').at(-1).toLowerCase();
    return new File([bytes],name,{type:mimeByExtension[ext]||'application/octet-stream'});
  }
  function normalizeTrash(raw,site) {
    if(raw===undefined)return [];
    if(!Array.isArray(raw)||raw.length>1000)throw Error('回收站数据格式不正确');
    return raw.map(record=>{
      if(!record||!['posts','notes','tracks'].includes(record.kind)||!record.value)throw Error('回收站记录不完整');
      const normalized=B.normalize({schemaVersion:1,site,posts:[],[record.kind]:[record.value]});
      if(!normalized[record.kind][0])throw Error('回收站记录中的内容无效');
      return{id:B.uid(),kind:record.kind,value:normalized[record.kind][0],deletedAt:typeof record.deletedAt==='string'?record.deletedAt.slice(0,50):new Date().toISOString()};
    });
  }
  B.actions['export-backup']=async el=>{
    await B.flushEditor();await B.flushSettings();
    const old=el.innerHTML;el.disabled=true;
    try {
      const data=structuredClone(S.workspace),trash=structuredClone(S.trash);
      const keys=[...new Set([...B.content.references(data),...B.content.references(B.content.trashData(trash))])],media=[];
      for(let index=0;index<keys.length;index++){
        el.textContent=`正在整理媒体 ${index+1}/${keys.length}…`;
        const key=keys[index],file=await fileForReference(key);
        media.push({key,name:file.name||'media',type:file.type,base64:base64(new Uint8Array(await file.arrayBuffer()))});
      }
      B.download('shijian-backup-'+B.today()+'.json',JSON.stringify({format:'shijian-backup-v2',data,trash,media}),'application/json');
      B.toast('备份已准备好，包含草稿、回收站和站内媒体');
    }finally{el.disabled=false;el.innerHTML=old;}
  };
  B.actions['export-markdown']=async el=>{
    await B.flushEditor();await B.flushSettings();el.disabled=true;
    try {
      const posts=structuredClone(S.workspace.posts),keys=B.content.references({posts}),map=Object.create(null),files=[];
      for(let index=0;index<keys.length;index++){
        const key=keys[index],file=await fileForReference(key),ext=file.name?.match(/\.([a-z\d]{1,5})$/i)?.[1]||'bin';
        const name='media/'+(index+1)+'.'+ext.toLowerCase();map[key]='../'+name;files.push({name,bytes:new Uint8Array(await file.arrayBuffer())});
      }
      const rewritten=B.content.transform({posts},map).posts;
      rewritten.forEach((p,index)=>files.push({name:`${p.status==='draft'?'草稿/':'文章/'}${p.date}-${p.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,80)}-${index+1}.md`,bytes:`---\ntitle: ${JSON.stringify(p.title)}\ndate: ${p.date}\ncategory: ${JSON.stringify(p.category)}\ntags: ${JSON.stringify(p.tags)}\nstatus: ${p.status}\n---\n\n${p.body}\n`}));
      B.download('shijian-markdown-'+B.today()+'.zip',zip(files));B.toast('Markdown 与正文图片已整理完成');
    }finally{el.disabled=false;}
  };
  B.actions['import-backup']=()=>{
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{try{
      const file=input.files[0];if(!file)return;if(file.size>200*1024*1024)throw Error('备份超过 200 MB，请拆分后导入');
      const raw=JSON.parse(await file.text()),data=B.normalize(raw.data||raw),trash=normalizeTrash(raw.trash,data.site),media=Array.isArray(raw.media)?raw.media:[];
      if(media.length>1000)throw Error('媒体数量过多');
      const seen=new Set();
      for(const item of media){
        if((!B.content.isLocal(item.key)&&!B.content.isAsset(item.key))||seen.has(item.key)||typeof item.base64!=='string'||item.base64.length>40*1024*1024||!/^[a-z\d+/=]*$/i.test(item.base64))throw Error('媒体数据无效或存在重复条目');
        seen.add(item.key);
      }
      const required=[...B.content.references(data),...B.content.references(B.content.trashData(trash))].filter(B.content.isLocal);
      if(required.some(key=>!seen.has(key)))throw Error('备份缺少本地媒体，无法完整导入，请在原设备重新导出');
      B.modal(`<h2>导入这份备份？</h2><p class="modal-description">${data.posts.length} 篇文章 · ${data.notes.length} 条随记 · ${data.tracks.length} 首音乐 · ${trash.length} 项回收内容。<br>将替换本地写作空间，线上内容需发布后才更新。</p><div class="button-row"><button class="button" data-action="export-backup">先备份当前内容</button><button class="button primary" id="confirm-import">导入并替换</button></div>`);
      $('#confirm-import').onclick=async event=>{
        const button=event.target;button.disabled=true;
        try {
          const map=Object.create(null);
          for(let index=0;index<media.length;index++){
            button.textContent=`恢复媒体 ${index+1}/${media.length}…`;
            const item=media[index],bytes=unbase64(item.base64);
            map[item.key]=await B.mediaPut(new File([bytes],String(item.name||'media'),{type:String(item.type||'application/octet-stream')}));
          }
          S.workspace=B.normalize(B.content.transform(data,map));S.workspace.updatedAt=S.original.updatedAt;
          S.trash=B.content.mapTrash(trash,map);S.editor=null;
          if(await B.persist()){
            S.editorDirty=false;S.settingsDirty=false;B.storageRepository.recovery(null);
            B.closeModal();B.render();B.toast('备份已完整导入');
          }
        }catch(error){B.toast(error.message,'error');}finally{button.disabled=false;button.textContent='导入并替换';}
      };
    }catch(error){B.toast('导入失败：'+error.message,'error');}};input.click();
  };
  B.backup={fileForReference,normalizeTrash};
})();

/* GitHub transport: one atomic tree/commit update, never a forced branch overwrite. */
(() => {
  'use strict';
  const B=Blog;
  function client(config,token) {
    const root='https://api.github.com/repos/'+encodeURIComponent(config.owner)+'/'+encodeURIComponent(config.repo);
    const path=(config.folder?config.folder+'/':'')+'content.js';
    const encodedPath=value=>value.split('/').map(encodeURIComponent).join('/');
    const branch=encodeURIComponent(config.branch);
    const api=(suffix,{signal,method='GET',body,raw=false}={})=>B.request(root+suffix,{method,body,signal,raw,headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2026-03-10',...(body?{'Content-Type':'application/json'}:{})}});
    async function read(ref=config.branch,signal) {
      const suffix='/contents/'+encodedPath(path)+'?ref='+encodeURIComponent(ref),file=await api(suffix,{signal});
      if(file.type&&file.type!=='file')throw Error('站点目录不正确，content.js 必须是文件');
      let bytes;
      if(file.content&&file.encoding==='base64')bytes=B.transfer.unbase64(file.content.replace(/\s/g,''));
      else {
        if(file.size>20*1024*1024)throw Error('内容文件超过 20 MB，请先拆分文章后再同步');
        bytes=await api(suffix,{signal,raw:true});
      }
      return {sha:file.sha,data:B.transfer.decodeContent(new TextDecoder().decode(bytes))};
    }
    async function publish(prepared,{expectedSha,signal,onProgress=()=>{}}) {
      onProgress('检查远端版本…');
      const ref=await api('/git/ref/heads/'+branch,{signal}),head=ref.object.sha;
      const current=await read(head,signal);
      if(current.sha!==expectedSha)throw Error('远端内容已有更新，已停止同步。请先保留备份，再载入最新版本。');
      const parent=await api('/git/commits/'+head,{signal}),tree=[],prefix=config.folder?config.folder+'/':'';
      for(let index=0;index<prepared.media.length;index++){
        const asset=prepared.media[index];onProgress(`上传媒体 ${index+1}/${prepared.media.length}…`);
        const blob=await api('/git/blobs',{signal,method:'POST',body:{content:B.transfer.base64(asset.bytes),encoding:'base64'}});
        tree.push({path:prefix+asset.name,mode:'100644',type:'blob',sha:blob.sha});
      }
      onProgress('创建公开内容提交…');
      const script=await api('/git/blobs',{signal,method:'POST',body:{content:B.transfer.contentScript(prepared.data),encoding:'utf-8'}});
      tree.push({path,mode:'100644',type:'blob',sha:script.sha});
      const newTree=await api('/git/trees',{signal,method:'POST',body:{base_tree:parent.tree.sha,tree}});
      const commit=await api('/git/commits',{signal,method:'POST',body:{message:'blog: publish stories, notes and music',tree:newTree.sha,parents:[head]}});
      onProgress('同步分支…');
      const latest=await api('/git/ref/heads/'+branch,{signal});
      if(latest.object.sha!==head)throw Error('发布期间分支有新提交，本次同步已停止，请重新检查连接。');
      try {
        await api('/git/refs/heads/'+branch,{signal,method:'PATCH',body:{sha:commit.sha,force:false}});
      }catch(error) {
        // A timeout can occur after GitHub accepted the write. Reconcile, never blindly retry PATCH.
        onProgress('正在确认提交结果…');let actual;
        try{actual=await api('/git/ref/heads/'+branch);}catch{throw Error('提交结果暂时无法确认，请到仓库核对提交 '+commit.sha.slice(0,7)+' 后再操作。');}
        if(actual.object.sha!==commit.sha)throw error;
      }
      return {commitSha:commit.sha,contentSha:script.sha};
    }
    return {config,path,read,publish};
  }
  B.github={client};
})();

(() => {
  'use strict';
  const B=Blog,{$,escape:e,icon:i,state:S}=B;
  const {publicData,contentScript,decodeContent,preparePublic,base64,unbase64}=B.transfer;
  let githubToken='',connection=null,publishing=false,publishAbort=null;
  const progress={message:'',error:false};
  let ghConfig;try{ghConfig=JSON.parse(B.getPref('github','{}'));}catch{ghConfig={};}
  ghConfig={owner:ghConfig.owner||'xuan511',repo:ghConfig.repo||'xuan511.github.io',branch:ghConfig.branch||'main',folder:ghConfig.folder||''};
  B.renderPublish=()=>`<div class="panel"><h2>让文字，去到更远的地方</h2><p class="panel-description">公开内容会随站点发布，草稿留在你手里。</p><div class="publish-summary"><div><b>${S.workspace.posts.filter(p=>p.status==='published').length}</b><span>公开文章</span></div><div><b>${S.workspace.notes.length}</b><span>条随记</span></div><div><b>${S.workspace.tracks.length}</b><span>首音乐</span></div><div><b>${S.workspace.posts.filter(p=>p.status==='draft').length}</b><span>篇草稿，不上传</span></div></div><div class="panel-header"><h2 style="font-size:18px">第一次上线</h2><button class="button primary small" data-action="export-site">${i('download')} 导出整站 ZIP</button></div><div class="publish-step"><span class="step-number">1</span><div><h3>创建你的博客仓库</h3><p>推荐公开仓库 <code>xuan511.github.io</code>，也可以用其他名字。<a href="https://github.com/new?name=xuan511.github.io&description=My+personal+blog&visibility=public" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">去 GitHub 创建 →</a></p></div></div><div class="publish-step"><span class="step-number">2</span><div><h3>解压整站包，把里面的文件上传到仓库</h3><p>让 <code>index.html</code> 直接位于仓库根目录，保留 <code>assets</code> 文件夹。</p></div></div><div class="publish-step"><span class="step-number">3</span><div><h3>开启 GitHub Pages</h3><p>Settings → Pages → Deploy from a branch → main → /(root) → Save。部署完成后即可访问；也可以把这些文件放到自己的服务器。</p></div></div></div><div class="panel"><h2>以后，在这里直接发布</h2><p class="panel-description">已经部署好博客？连接仓库后，一次同步文章、随记、资料与新增媒体。</p><div class="notice">在 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">GitHub 创建 fine-grained token</a>，仅选择博客仓库，授予 <strong>Contents: Read and write</strong>。令牌只在当前页面内存中使用，刷新后清除，不写入备份。<br>写作台是本地编辑器；访问者没有你的令牌，无法修改线上内容。</div>${changeSummary()}<form id="github-form"><div class="field-row">${input('gh-owner','GitHub 用户名',ghConfig.owner)}${input('gh-repo','仓库名',ghConfig.repo)}</div><div class="field-row">${input('gh-branch','分支',ghConfig.branch)}${input('gh-folder','站点子目录（根目录留空）',ghConfig.folder)}</div><div class="field"><label for="gh-token">Personal Access Token</label><input id="gh-token" ${publishing?'disabled':''} type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" ${githubToken?'data-present="1"':''}><small>${githubToken?'本页面已有令牌；留空可继续使用，刷新页面会清除。':'令牌只用于向 api.github.com 发起请求。'}</small></div><div class="button-row"><button type="submit" class="button">${i('link')} 检查连接</button><button type="button" id="github-publish" class="button primary" data-action="github-publish" ${connection&&!publishing?'':'disabled'}>${i('cloud')} ${publishing?'发布中…':'同步公开内容'}</button>${connection&&!publishing?'<button type="button" class="button small" data-action="github-disconnect">断开</button>':''}${publishing?'<button type="button" class="button" data-action="github-cancel">取消同步</button>':''}</div><div id="connection-status" class="connection-status">${e(progress.message||(connection?'已连接 '+connection.config.owner+'/'+connection.config.repo+'，同步会生成一次提交。':''))}</div><div id="publish-log" class="publish-log" role="status" aria-live="polite"></div></form></div>`;
  function changeSummary() {
    const changes=B.content.pendingChanges(S.original,S.workspace);
    const other=[changes.settings?'个人资料':null,changes.notes?'随记':null,changes.music?'歌单':null].filter(Boolean);
    return `<div class="notice"><strong>本次公开更新</strong><br>新增 ${changes.added} 篇 · 修改 ${changes.updated} 篇 · 移除 ${changes.removed} 篇${other.length?' · 更新'+other.join('、'):''}。草稿与回收站不会上传。</div>`;
  }
  function input(id,label,value){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${e(value)}" autocomplete="off" ${publishing?'disabled':''} ${id==='gh-folder'?'':'required'}></div>`;}
  function currentConfig() {
    const owner=$('#gh-owner').value.trim(),repo=$('#gh-repo').value.trim(),branch=$('#gh-branch').value.trim(),folder=$('#gh-folder').value.trim().replace(/^\/+|\/+$/g,'');
    if(!/^[a-z\d-]+$/i.test(owner)||!/^\.?[a-z\d_.-]+$/i.test(repo)||!branch||branch.includes('..')||/[\s~^:?*\[\\]/.test(branch)||folder&&(!/^[a-z\d_./-]+$/i.test(folder)||folder.includes('..')))throw Error('仓库信息格式不正确');
    return {owner,repo,branch,folder};
  }
  function status(message,error=false) {
    progress.message=message;progress.error=error;
    if($('#connection-status')){$('#connection-status').textContent=message;$('#connection-status').classList.toggle('error',error);}
  }
  B.bindPublish=()=>{
    const form=$('#github-form');if(!form)return;
    form.addEventListener('input',event=>{
      if(publishing)return;
      if(['gh-owner','gh-repo','gh-branch','gh-folder','gh-token'].includes(event.target.id)){connection=null;$('#github-publish').disabled=true;status('信息已改变，请重新检查连接。');}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(publishing)return;
      const button=event.submitter;button.disabled=true;connection=null;$('#github-publish').disabled=true;
      try {
        await B.whenSaved();
        if(location.protocol==='file:')throw Error('请通过 HTTPS 或本地服务器使用 GitHub 同步');
        if(S.workspace.updatedAt!==S.original.updatedAt)throw Error('线上版本已更新，请先核对本地与线上内容；本地修改可先导出备份。');
        const config=currentConfig(),token=$('#gh-token').value.trim();if(token)githubToken=token;
        if(!githubToken)throw Error('先输入仅授权此博客仓库的 GitHub 令牌');
        status('正在检查仓库与文件…');
        const api=B.github.client(config,githubToken),remote=await api.read();
        if(B.canonical(remote.data)!==B.canonical(S.original))throw Error('云端内容与本页版本不同。请先备份，再从实际博客网址载入最新版本。');
        connection={config,api,sha:remote.sha};ghConfig=config;B.setPref('github',JSON.stringify(config));
        $('#gh-token').value='';$('#github-publish').disabled=false;
        status(`已连接 ${config.owner}/${config.repo}，分支 ${config.branch}。同步将更新公开内容与新增媒体。`);
      }catch(error){status(error.message,true);B.toast(error.message,'error');}
      finally{button.disabled=false;}
    });
  };
  B.actions['github-disconnect']=()=>{githubToken='';connection=null;progress.message='';B.render({scroll:false});B.toast('已断开，令牌已从页面内存清除');};
  B.actions['github-cancel']=()=>{publishAbort?.abort();status('正在停止同步，并核对已发出的提交…');};
  B.actions['github-publish']=async element=>{
    if(publishing||!connection)return;
    const config=currentConfig();if(JSON.stringify(config)!==JSON.stringify(connection.config))throw Error('仓库信息已改变，请重新检查连接');
    await B.whenSaved();
    if(!B.content.pendingChanges(S.original,S.workspace).changed){B.toast('公开内容没有变化');return;}
    publishing=true;publishAbort=new AbortController();const selected=connection;
    B.render({scroll:false});
    try {
      status('正在整理本次发布内容…');
      // preparePublic clones synchronously before awaiting binary reads. Later edits remain in the workspace.
      const prepared=await B.transfer.preparePublic();
      const result=await selected.api.publish(prepared,{expectedSha:selected.sha,signal:publishAbort.signal,onProgress:message=>status(message)});
      S.original=structuredClone(prepared.data);
      S.workspace=B.normalize(B.content.transform(S.workspace,prepared.map||{}));S.workspace.updatedAt=prepared.data.updatedAt;
      const saved=await B.persist();
      connection={...selected,sha:result.contentSha};
      status(`已提交 ${result.commitSha.slice(0,7)}。GitHub Pages 部署完成后访客可见。${saved?'':'本地保存失败，请立即导出备份。'}`,!saved);
      B.toast(saved?'公开内容已同步到 GitHub':'GitHub 已提交，但本地保存失败，请先备份',saved?'success':'error');
    }catch(error){status(error.message,true);B.toast(error.message,'error');}
    finally {
      publishing=false;publishAbort=null;
      if(location.hash==='#/studio'&&S.studioTab==='publish')B.render({scroll:false});
    }
  };
})();

/* Player state survives navigation; only text and attributes are patched. */
(() => {
  'use strict';
  const B=Blog,{$,$$,escape:e,icon:i}=B,audio=$('#audio');
  let trackId=null,loadedSrc='',generation=0,loading=false,dragging=false,expanded=false,lastCheckpoint=0;
  let resume;try{resume=JSON.parse(B.getPref('playback','null'));}catch{}
  const songs=()=>B.data().tracks,current=()=>songs().find(t=>t.id===trackId)||songs()[0];
  const identity=src=>src?.replace(/^local:/,'').replace(/^assets\/uploads\//,'').replace(/\.[a-z\d]+$/i,'');
  const time=v=>Number.isFinite(v)?Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0'):'0:00';
  const volume=Number(B.getPref('volume','0.55'));audio.volume=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:.55));
  function remember(){if(trackId&&loadedSrc)B.setPref('playback',JSON.stringify({id:trackId,position:audio.currentTime}));}
  function mount(){
    $('#music-player').innerHTML=`<div class="music-bar"><button class="music-cover" data-action="playlist" aria-label="打开歌单"><span class="vinyl"></span></button><button class="music-info" data-action="music-expand" aria-label="展开播放进度" aria-expanded="false"><span class="music-title"></span><span class="music-artist"></span></button><div class="music-controls"><button class="icon-button" data-action="music-prev" aria-label="上一首">${i('prev')}</button><button class="play-button" data-action="music-toggle" aria-label="播放">${i('play')}</button><button class="icon-button" data-action="music-next" aria-label="下一首">${i('next')}</button></div><div class="music-progress"><input id="music-seek" type="range" min="0" max="1000" value="0" aria-label="播放进度"><div class="music-times"><span id="music-current">0:00</span><span id="music-duration">0:00</span></div></div><div class="music-volume">${i('volume')}<input id="music-volume" type="range" min="0" max="1" step="0.01" value="${audio.volume}" aria-label="音量"></div><div class="player-list"><button class="icon-button" data-action="playlist" aria-label="打开歌单">${i('list')}</button></div></div>`;
  }
  function progress(){
    if($('#music-current'))$('#music-current').textContent=time(audio.currentTime);
    if($('#music-duration'))$('#music-duration').textContent=time(audio.duration);
    if($('#music-seek')&&!dragging)$('#music-seek').value=Number.isFinite(audio.duration)&&audio.duration>0?audio.currentTime/audio.duration*1000:0;
    if(audio.currentTime-lastCheckpoint>5){lastCheckpoint=audio.currentTime;remember();}
  }
  function playing(){
    $('.music-bar')?.classList.toggle('playing',!audio.paused);
    const button=$('.play-button');if(button){button.innerHTML=i(audio.paused?'play':'pause');button.setAttribute('aria-label',loading?'取消加载':audio.paused?'播放':'暂停');button.setAttribute('aria-busy',String(loading));}
    for(const button of $$('[data-track-toggle]')){const active=button.dataset.trackToggle===trackId&&!audio.paused;button.innerHTML=i(active?'pause':'play');button.setAttribute('aria-label',(active?'暂停 ':'播放 ')+button.dataset.trackName);}
  }
  B.refreshPlayer=()=>{
    const list=songs();if(!trackId&&resume&&list.some(t=>t.id===resume.id))trackId=resume.id;
    const track=current();if(!track){generation++;audio.pause();trackId=null;loadedSrc='';$('#music-player').innerHTML='';return;}
    if(trackId&&!list.some(t=>t.id===trackId)){generation++;audio.pause();loadedSrc='';}trackId=track.id;
    if(loadedSrc&&loadedSrc!==track.src&&identity(loadedSrc)!==identity(track.src)){generation++;audio.pause();loadedSrc='';audio.removeAttribute('src');audio.load();}
    if(!$('.music-bar'))mount();$('.music-title').textContent=track.title;$('.music-artist').textContent=track.artist;
    $('.music-bar').classList.toggle('expanded',expanded);$('.music-info').setAttribute('aria-expanded',String(expanded));progress();playing();
  };
  async function play(track){
    if(!track)throw Error('歌单里还没有音乐');const my=++generation;trackId=track.id;loading=true;playing();
    try{
      if(loadedSrc!==track.src){audio.pause();const src=await B.resolveMedia(track.src);if(my!==generation)return;audio.src=src;loadedSrc=track.src;audio.load();}
      B.refreshPlayer();await audio.play();if(my!==generation)return;
      if('mediaSession'in navigator)navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:B.data().site.name});
    }catch(error){if(my===generation&&error.name!=='AbortError'){loadedSrc='';B.toast('这首音乐暂时无法播放，请检查地址或文件格式。','error');}}
    finally{if(my===generation){loading=false;playing();}}
  }
  async function step(offset){const list=songs();if(!list.length)return;const index=list.findIndex(t=>t.id===trackId);resume=null;await play(list[(index+offset+list.length)%list.length]);}
  B.actions['music-toggle']=async()=>{if(loading){generation++;loading=false;audio.pause();playing();return;}if(!audio.paused){audio.pause();return;}await play(current());};
  B.actions['music-next']=()=>step(1);B.actions['music-prev']=()=>step(-1);
  B.actions['music-expand']=()=>{expanded=!expanded;B.refreshPlayer();};
  B.actions['play-track']=el=>{if(el.dataset.id===trackId&&!audio.paused)return B.actions['music-toggle']();resume=null;return play(songs().find(t=>t.id===el.dataset.id));};
  B.actions['playlist']=()=>{
    B.modal(`<div class="eyebrow" style="margin-bottom:13px">A SOUNDTRACK FOR TODAY</div><h2>给日常一点背景乐</h2><p class="modal-description">${songs().length} 首音乐 · 点一首，让时间慢下来。</p>${songs().map((track,index)=>`<div class="playlist-item ${track.id===trackId?'current':''}"><span class="hint" style="width:15px">${String(index+1).padStart(2,'0')}</span><div class="vinyl"></div><div class="track-details"><h3>${e(track.title)}</h3><p>${e(track.artist)}</p></div><button class="icon-button" data-action="play-track" data-id="${e(track.id)}" data-track-toggle="${e(track.id)}" data-track-name="${e(track.title)}" aria-label="播放 ${e(track.title)}">${i('play')}</button></div>`).join('')||B.ui.empty('歌单还是空的','去写作台，放进一首喜欢的音乐。')}<p class="hint" style="margin-top:22px">${B.state.editing?'<a href="#/studio" data-action="manage-music">在写作台管理歌单 →</a>':'音乐不会自动播放，安静也很好。'}</p>`);playing();
  };
  B.actions['manage-music']=()=>{B.closeModal();B.state.studioTab='music';if(location.hash==='#/studio')B.render();else location.hash='#/studio';};
  document.addEventListener('pointerdown',event=>{if(event.target.id==='music-seek')dragging=true;});document.addEventListener('pointerup',()=>{dragging=false;});
  document.addEventListener('input',event=>{if(event.target.id==='music-seek'&&Number.isFinite(audio.duration))audio.currentTime=Number(event.target.value)/1000*audio.duration;if(event.target.id==='music-volume'){audio.volume=Number(event.target.value);B.setPref('volume',audio.volume);}});
  audio.addEventListener('timeupdate',progress);audio.addEventListener('loadedmetadata',()=>{if(resume?.id===trackId&&Number.isFinite(audio.duration)&&resume.position<audio.duration-1){audio.currentTime=Math.max(0,resume.position);resume=null;}progress();});
  audio.addEventListener('play',playing);audio.addEventListener('pause',()=>{playing();remember();});audio.addEventListener('ended',()=>step(1));
  audio.addEventListener('error',()=>{if(!loading&&audio.getAttribute('src'))B.toast('音频加载失败，可在写作台更换文件或地址。','error');});
  if('mediaSession'in navigator)for(const [name,handler] of Object.entries({play:()=>B.actions['music-toggle'](),pause:()=>audio.pause(),previoustrack:()=>step(-1),nexttrack:()=>step(1)})){try{navigator.mediaSession.setActionHandler(name,handler);}catch{}}
})();

(() => {
  'use strict';
  const B=Blog;
  B.initWorkspace().then(()=>{
    B.render();
    if(B.state.recoveredPostId)B.toast('已找回未完成的编辑，保留为一份恢复草稿');
  }).catch(()=>{
    document.querySelector('#main').innerHTML='<div class="empty-state"><h1>暂时无法载入写作空间</h1><p>本地数据仍被保留，请重新打开页面再试。</p></div>';
  });
})();
