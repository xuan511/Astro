/* Player state survives navigation; only text and attributes are patched. */
(() => {
  'use strict';
  const B=Blog,{$,$$,escape:e,icon:i}=B,audio=$('#audio');
  let trackId=null,loadedSrc='',generation=0,loading=false,dragging=false,expanded=false,lastCheckpoint=0;
  let resume;try{resume=JSON.parse(B.getPref('playback','null'));}catch{}
  const songs=()=>B.data().tracks,current=()=>songs().find(t=>t.id===trackId)||songs()[0];
  const identity=src=>src?.replace(/^local:/,'').replace(/^assets\/uploads\//,'').replace(/\.[a-z\d]+$/i,'');
  const time=v=>Number.isFinite(v)?Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0'):'0:00';
  const volume=Number(B.getPref('volume','0.55'));audio.volume=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:.55));
  function remember(){if(trackId&&loadedSrc)B.setPref('playback',JSON.stringify({id:trackId,position:audio.currentTime}));}
  function mount(){
    $('#music-player').innerHTML=`<div class="music-bar"><button class="music-cover" data-action="playlist" aria-label="打开歌单"><span class="vinyl"></span></button><button class="music-info" data-action="music-expand" aria-label="展开播放进度" aria-expanded="false"><span class="music-title"></span><span class="music-artist"></span></button><div class="music-controls"><button class="icon-button" data-action="music-prev" aria-label="上一首">${i('prev')}</button><button class="play-button" data-action="music-toggle" aria-label="播放">${i('play')}</button><button class="icon-button" data-action="music-next" aria-label="下一首">${i('next')}</button></div><div class="music-progress"><input id="music-seek" type="range" min="0" max="1000" value="0" aria-label="播放进度"><div class="music-times"><span id="music-current">0:00</span><span id="music-duration">0:00</span></div></div><div class="music-volume">${i('volume')}<input id="music-volume" type="range" min="0" max="1" step="0.01" value="${audio.volume}" aria-label="音量"></div><div class="player-list"><button class="icon-button" data-action="playlist" aria-label="打开歌单">${i('list')}</button></div></div>`;
  }
  function progress(){
    if($('#music-current'))$('#music-current').textContent=time(audio.currentTime);
    if($('#music-duration'))$('#music-duration').textContent=time(audio.duration);
    if($('#music-seek')&&!dragging)$('#music-seek').value=Number.isFinite(audio.duration)&&audio.duration>0?audio.currentTime/audio.duration*1000:0;
    if(audio.currentTime-lastCheckpoint>5){lastCheckpoint=audio.currentTime;remember();}
  }
  function playing(){
    $('.music-bar')?.classList.toggle('playing',!audio.paused);
    const button=$('.play-button');if(button){button.innerHTML=i(audio.paused?'play':'pause');button.setAttribute('aria-label',loading?'取消加载':audio.paused?'播放':'暂停');button.setAttribute('aria-busy',String(loading));}
    for(const button of $$('[data-track-toggle]')){const active=button.dataset.trackToggle===trackId&&!audio.paused;button.innerHTML=i(active?'pause':'play');button.setAttribute('aria-label',(active?'暂停 ':'播放 ')+button.dataset.trackName);}
  }
  B.refreshPlayer=()=>{
    const list=songs();if(!trackId&&resume&&list.some(t=>t.id===resume.id))trackId=resume.id;
    const track=current();if(!track){generation++;audio.pause();trackId=null;loadedSrc='';$('#music-player').innerHTML='';return;}
    if(trackId&&!list.some(t=>t.id===trackId)){generation++;audio.pause();loadedSrc='';}trackId=track.id;
    if(loadedSrc&&loadedSrc!==track.src&&identity(loadedSrc)!==identity(track.src)){generation++;audio.pause();loadedSrc='';audio.removeAttribute('src');audio.load();}
    if(!$('.music-bar'))mount();$('.music-title').textContent=track.title;$('.music-artist').textContent=track.artist;
    $('.music-bar').classList.toggle('expanded',expanded);$('.music-info').setAttribute('aria-expanded',String(expanded));progress();playing();
  };
  async function play(track){
    if(!track)throw Error('歌单里还没有音乐');const my=++generation;trackId=track.id;loading=true;playing();
    try{
      if(loadedSrc!==track.src){audio.pause();const src=await B.resolveMedia(track.src);if(my!==generation)return;audio.src=src;loadedSrc=track.src;audio.load();}
      B.refreshPlayer();await audio.play();if(my!==generation)return;
      if('mediaSession'in navigator)navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:B.data().site.name});
    }catch(error){if(my===generation&&error.name!=='AbortError'){loadedSrc='';B.toast('这首音乐暂时无法播放，请检查地址或文件格式。','error');}}
    finally{if(my===generation){loading=false;playing();}}
  }
  async function step(offset){const list=songs();if(!list.length)return;const index=list.findIndex(t=>t.id===trackId);resume=null;await play(list[(index+offset+list.length)%list.length]);}
  B.actions['music-toggle']=async()=>{if(loading){generation++;loading=false;audio.pause();playing();return;}if(!audio.paused){audio.pause();return;}await play(current());};
  B.actions['music-next']=()=>step(1);B.actions['music-prev']=()=>step(-1);
  B.actions['music-expand']=()=>{expanded=!expanded;B.refreshPlayer();};
  B.actions['play-track']=el=>{if(el.dataset.id===trackId&&!audio.paused)return B.actions['music-toggle']();resume=null;return play(songs().find(t=>t.id===el.dataset.id));};
  B.actions['playlist']=()=>{
    B.modal(`<div class="eyebrow" style="margin-bottom:13px">A SOUNDTRACK FOR TODAY</div><h2>给日常一点背景乐</h2><p class="modal-description">${songs().length} 首音乐 · 点一首，让时间慢下来。</p>${songs().map((track,index)=>`<div class="playlist-item ${track.id===trackId?'current':''}"><span class="hint" style="width:15px">${String(index+1).padStart(2,'0')}</span><div class="vinyl"></div><div class="track-details"><h3>${e(track.title)}</h3><p>${e(track.artist)}</p></div><button class="icon-button" data-action="play-track" data-id="${e(track.id)}" data-track-toggle="${e(track.id)}" data-track-name="${e(track.title)}" aria-label="播放 ${e(track.title)}">${i('play')}</button></div>`).join('')||B.ui.empty('歌单还是空的','去写作台，放进一首喜欢的音乐。')}<p class="hint" style="margin-top:22px">${B.state.editing?'<a href="#/studio" data-action="manage-music">在写作台管理歌单 →</a>':'音乐不会自动播放，安静也很好。'}</p>`);playing();
  };
  B.actions['manage-music']=()=>{B.closeModal();B.state.studioTab='music';if(location.hash==='#/studio')B.render();else location.hash='#/studio';};
  document.addEventListener('pointerdown',event=>{if(event.target.id==='music-seek')dragging=true;});document.addEventListener('pointerup',()=>{dragging=false;});
  document.addEventListener('input',event=>{if(event.target.id==='music-seek'&&Number.isFinite(audio.duration))audio.currentTime=Number(event.target.value)/1000*audio.duration;if(event.target.id==='music-volume'){audio.volume=Number(event.target.value);B.setPref('volume',audio.volume);}});
  audio.addEventListener('timeupdate',progress);audio.addEventListener('loadedmetadata',()=>{if(resume?.id===trackId&&Number.isFinite(audio.duration)&&resume.position<audio.duration-1){audio.currentTime=Math.max(0,resume.position);resume=null;}progress();});
  audio.addEventListener('play',playing);audio.addEventListener('pause',()=>{playing();remember();});audio.addEventListener('ended',()=>step(1));
  audio.addEventListener('error',()=>{if(!loading&&audio.getAttribute('src'))B.toast('音频加载失败，可在写作台更换文件或地址。','error');});
  if('mediaSession'in navigator)for(const [name,handler] of Object.entries({play:()=>B.actions['music-toggle'](),pause:()=>audio.pause(),previoustrack:()=>step(-1),nexttrack:()=>step(1)})){try{navigator.mediaSession.setActionHandler(name,handler);}catch{}}
})();
