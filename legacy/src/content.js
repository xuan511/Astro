/* Typed content transforms. Media references are never inferred from ordinary prose. */
(() => {
  'use strict';
  const B=Blog;
  const isAsset=value=>/^assets\/[a-z\d_./-]+$/i.test(value||'')&&!value.includes('..');
  const isLocal=value=>/^local:[a-z\d-]+$/i.test(value||'');
  const imagePattern=/(!\[[^\]]*\]\()([^\s)]+)(\))/g;
  function transform(data,map) {
    const result=structuredClone(data);
    const replace=value=>Object.prototype.hasOwnProperty.call(map,value)?map[value]:value;
    if(result.site)result.site.avatar=replace(result.site.avatar);
    if(result.posts)for(const post of result.posts)post.body=post.body.replace(imagePattern,(_,before,src,after)=>before+replace(src)+after);
    if(result.tracks)for(const track of result.tracks)track.src=replace(track.src);
    return result;
  }
  function references(data) {
    const set=new Set();const add=value=>{if(isLocal(value)||isAsset(value))set.add(value);};
    add(data.site?.avatar);for(const track of data.tracks||[])add(track.src);
    for(const post of data.posts||[])for(const match of post.body.matchAll(imagePattern))add(match[2]);
    return [...set];
  }
  function trashData(trash=[]) {
    const result={posts:[],notes:[],tracks:[]};
    for(const record of trash)if(['posts','notes','tracks'].includes(record.kind))result[record.kind].push(record.value);
    return result;
  }
  function mapTrash(trash,map) {
    return trash.map(record=>{
      const key=record.kind;if(!['posts','notes','tracks'].includes(key))throw Error('回收站数据格式不正确');
      return {...record,value:transform({[key]:[record.value]},map)[key][0]};
    });
  }
  function pendingChanges(original,workspace) {
    const before=original.posts.filter(p=>p.status==='published'),after=workspace.posts.filter(p=>p.status==='published');
    const added=after.filter(p=>!before.some(q=>q.id===p.id)).length;
    const updated=after.filter(p=>before.some(q=>q.id===p.id&&JSON.stringify(q)!==JSON.stringify(p))).length;
    const removed=before.filter(p=>!after.some(q=>q.id===p.id)).length;
    const settings=JSON.stringify(original.site)!==JSON.stringify(workspace.site);
    const notes=JSON.stringify(original.notes)!==JSON.stringify(workspace.notes);
    const music=JSON.stringify(original.tracks)!==JSON.stringify(workspace.tracks);
    return {added,updated,removed,settings,notes,music,changed:!!(added||updated||removed||settings||notes||music)};
  }
  B.content={isAsset,isLocal,transform,references,trashData,mapTrash,pendingChanges};
})();
