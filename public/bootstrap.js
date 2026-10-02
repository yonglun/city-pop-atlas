(async()=>{
 const el=document.getElementById('load-status');
 try {
  const response=await fetch('/api/graph',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data.nodes)||!Array.isArray(data.edges))throw Error('Invalid dataset');
  window.DATA=data;
  const script=document.createElement('script');script.src='/app.js?v=20261002-12';
  script.onload=()=>{el.remove();document.body.classList.remove('loading')};
  script.onerror=()=>{el.textContent='页面加载失败，请刷新重试 / Please reload / 再読み込みしてください'};
  document.body.appendChild(script);
 }catch(e){el.textContent='资料库暂时无法连接，请刷新重试 / Database unavailable, please reload / データベースに接続できません。再読み込みしてください';}
})();
