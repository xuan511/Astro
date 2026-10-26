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
