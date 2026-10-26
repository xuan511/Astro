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
