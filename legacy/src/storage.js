/* Storage adapter. Contains no rendering or blog-specific business rules. */
window.ShijianStorage = (() => {
  'use strict';
  class StorageConflict extends Error {
    constructor() { super('另一个页面已保存新版本。请先保留本页备份，再载入最新内容。'); this.name='StorageConflict'; }
  }
  function preference(storage, key, fallback=null) {
    try { return storage.getItem(key) ?? fallback; } catch { return fallback; }
  }
  function setPreference(storage, key, value) {
    try { if(value===null)storage.removeItem(key);else storage.setItem(key,String(value));return true; } catch { return false; }
  }
  function safeArea(name){try{return globalThis[name];}catch{return {getItem(){return null;},setItem(){throw Error('浏览器禁止保存');},removeItem(){}};}}
  function scopeFor(href) {
    const u=new URL('.',href.split('#')[0]);
    return u.pathname;
  }
  class Repository {
    constructor({scope=scopeFor(location.href),indexedDB=globalThis.indexedDB,local=safeArea('localStorage'),session=safeArea('sessionStorage')}={}) {
      this.scope=scope;this.idb=indexedDB;this.local=local;this.session=session;
      this.name='shijian-v2:'+scope;this.key='shijian:'+scope+':workspace';
      this.mode='indexeddb';this.opening=null;this.legacyOpening=null;
    }
    open() {
      if(this.opening)return this.opening;
      this.opening=new Promise((resolve,reject)=>{
        if(!this.idb)return reject(Error('此浏览器无法打开本地数据库'));
        const r=this.idb.open(this.name,1);
        r.onupgradeneeded=()=>{r.result.createObjectStore('records');r.result.createObjectStore('files');};
        r.onerror=()=>reject(r.error||Error('本地数据库无法打开'));
        r.onblocked=()=>reject(Error('请关闭其他旧版博客页面后重试'));
        r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();this.opening=null;};resolve(db);};
      });
      return this.opening;
    }
    async readRecord() {
      if(this.mode==='compat') {
        const raw=preference(this.local,this.key);
        return raw?JSON.parse(raw):null;
      }
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('records'),r=tx.objectStore('records').get('workspace');
        r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
      });
    }
    async load(initial) {
      let record;
      try {record=await this.readRecord();}
      catch(error) {
        this.mode='compat';this.opening=null;this.degradedReason=error.message;
        // Never treat an unreadable existing record as an empty workspace.
        record=await this.readRecord();
      }
      if(record)return record;
      const claimed=preference(this.local,'shijian-legacy-owner');
      const legacy=(!claimed||claimed===this.scope)?preference(this.local,'shijian-workspace-v1'):null;
      let data=initial;
      if(legacy){try{const parsed=JSON.parse(legacy);if(parsed?.schemaVersion===1&&Array.isArray(parsed.posts))data=parsed;}catch{}}
      record={revision:0,data:structuredClone(data),trash:[],savedAt:null};
      // Migrated records are written before claiming the legacy data. Old bytes remain intact.
      if(legacy&&data!==initial){record=await this.write(record,0);setPreference(this.local,'shijian-legacy-owner',this.scope);}
      return record;
    }
    async write(snapshot,expectedRevision) {
      const record={...structuredClone(snapshot),revision:expectedRevision+1,savedAt:new Date().toISOString()};
      if(this.mode==='compat') {
        const old=await this.readRecord();
        if((old?.revision||0)!==expectedRevision)throw new StorageConflict();
        if(!setPreference(this.local,this.key,JSON.stringify(record)))throw Error('本地保存失败，内容仍在本页，请立即导出备份');
        return record;
      }
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');let conflict=false;
        const get=store.get('workspace');
        get.onsuccess=()=>{
          if((get.result?.revision||0)!==expectedRevision){conflict=true;tx.abort();return;}
          store.put(record,'workspace');
        };
        tx.oncomplete=()=>resolve(record);
        tx.onabort=()=>reject(conflict?new StorageConflict():tx.error||Error('本地保存未完成，请重试或导出备份'));
        tx.onerror=()=>{};
      });
    }
    async putMedia(file,key) {
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,key);
        tx.oncomplete=()=>resolve(key);tx.onabort=()=>reject(tx.error||Error('媒体保存失败，请检查浏览器存储空间'));
      });
    }
    async getMedia(key) {
      const db=await this.open();
      const value=await new Promise((resolve,reject)=>{
        const r=db.transaction('files').objectStore('files').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
      });
      if(value)return value;
      // Read through the v1 media store and migrate only the referenced file.
      if(!this.legacyOpening)this.legacyOpening=new Promise((resolve,reject)=>{
        const r=this.idb.open('shijian-media',1);
        r.onupgradeneeded=()=>r.result.createObjectStore('files');
        r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);
      });
      const legacy=await this.legacyOpening;
      const file=await new Promise((resolve,reject)=>{const r=legacy.transaction('files').objectStore('files').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      if(file)await this.putMedia(file,key);
      return file;
    }
    recovery(value) {
      const key=this.key+':editor-recovery';
      if(arguments.length)return setPreference(this.session,key,value?JSON.stringify(value):null);
      try{return JSON.parse(preference(this.session,key,'null'));}catch{return null;}
    }
  }
  return {Repository,StorageConflict,preference,setPreference,safeArea,scopeFor};
})();
