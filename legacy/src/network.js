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
