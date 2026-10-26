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
