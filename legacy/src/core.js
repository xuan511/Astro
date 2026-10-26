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
