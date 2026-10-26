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
