(async()=>{
 const el=document.getElementById('load-status');
 let lang='en';try{const saved=localStorage.getItem('citypop-language');if(['zh','en','ja'].includes(saved))lang=saved}catch{}
 const explicitPath=location.pathname.split('/')[1],explicitQuery=new URLSearchParams(location.search);if(['en','zh','ja'].includes(explicitPath))lang=explicitPath;else if(!location.hash&&[...explicitQuery.keys()].every(k=>['view','entity','lang'].includes(k)&&explicitQuery.getAll(k).length===1)&&(!explicitQuery.has('view')||['graph','catalog','guide','review'].includes(explicitQuery.get('view')))&&explicitQuery.getAll('lang').length===1&&['en','zh','ja'].includes(explicitQuery.get('lang')))lang=explicitQuery.get('lang');
 const copy={en:{title:'Explore the graph',loading:'Loading archive…',scriptError:'The page could not load. Please reload.',dataError:'The archive is temporarily unavailable. Please reload.'},zh:{title:'图谱探索',loading:'正在读取音乐档案…',scriptError:'页面加载失败，请刷新重试',dataError:'资料库暂时无法连接，请刷新重试'},ja:{title:'グラフを探索',loading:'アーカイブを読み込み中…',scriptError:'ページを読み込めませんでした。再読み込みしてください。',dataError:'アーカイブに接続できません。再読み込みしてください。'}}[lang];
 document.documentElement.lang={en:'en',zh:'zh-CN',ja:'ja'}[lang];
 document.title='City Pop Atlas · '+copy.title;el.textContent=copy.loading;
 // Fetch the application in parallel, but execute only once its graph is ready.
 // The same URL lets the script reuse this preload (including hashed builds).
 const appSource='/app.js?v=20261006-seo';
 const preload=document.createElement('link');preload.rel='preload';preload.as='script';preload.href=appSource;document.head.appendChild(preload);
 try {
  const response=await fetch('/api/graph?view=compact',{cache:'no-cache'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw Error('Invalid dataset');
  window.DATA=data;
  const script=document.createElement('script');script.src=appSource;
  script.onload=()=>{if(window.CityPopAppReady!==true){el.textContent=copy.scriptError;return}el.remove();document.body.classList.remove('loading')};
  script.onerror=()=>{el.textContent=copy.scriptError};
  document.body.appendChild(script);
 }catch(e){el.textContent=copy.dataError;}
})();
