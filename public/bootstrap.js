(async()=>{
 const el=document.getElementById('load-status');
 let lang='en';try{const saved=localStorage.getItem('citypop-language');if(['zh','en','ja'].includes(saved))lang=saved}catch{}
 const copy={en:{title:'Explore the graph',loading:'Loading archive…',scriptError:'The page could not load. Please reload.',dataError:'The archive is temporarily unavailable. Please reload.'},zh:{title:'图谱探索',loading:'正在读取音乐档案…',scriptError:'页面加载失败，请刷新重试',dataError:'资料库暂时无法连接，请刷新重试'},ja:{title:'グラフを探索',loading:'アーカイブを読み込み中…',scriptError:'ページを読み込めませんでした。再読み込みしてください。',dataError:'アーカイブに接続できません。再読み込みしてください。'}}[lang];
 document.documentElement.lang={en:'en',zh:'zh-CN',ja:'ja'}[lang];
 document.title='City Pop Atlas · '+copy.title;el.textContent=copy.loading;
 try {
  const response=await fetch('/api/graph',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw Error('Invalid dataset');
  window.DATA=data;
  const essays=await fetch('/articles.json',{cache:'no-store'});if(!essays.ok)throw Error('Editorial data unavailable');window.ARTICLES=await essays.json();
  const script=document.createElement('script');script.src='/app.js?v=20261004-26';
  script.onload=()=>{el.remove();document.body.classList.remove('loading')};
  script.onerror=()=>{el.textContent=copy.scriptError};
  document.body.appendChild(script);
 }catch(e){el.textContent=copy.dataError;}
})();
