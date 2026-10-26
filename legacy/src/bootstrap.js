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
