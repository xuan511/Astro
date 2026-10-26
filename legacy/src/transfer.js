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
