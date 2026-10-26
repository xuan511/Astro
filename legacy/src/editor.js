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
