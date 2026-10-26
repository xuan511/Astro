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
