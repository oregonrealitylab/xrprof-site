/* Folder links ("about-me/") work on a real web server. Anywhere else (a file opened
   from disk, a preview host) point them at the index.html inside the folder. */
(function(){
  var h=location.hostname;
  var server=location.protocol!=='file:'&&(/(^|\.)xrprof\.org$/.test(h)||/\.(github\.io|pages\.dev|netlify\.app|vercel\.app)$/.test(h)||h==='localhost'||h==='127.0.0.1');
  if(server)return;
  document.querySelectorAll('a[href$="/"]').forEach(function(a){
    var r=a.getAttribute('href'); if(!/^[a-z]+:/i.test(r))a.setAttribute('href',r+'index.html');
  });
})();

/* Changing page works like changing the set: the picture collapses to a line and a dot
   (class "tv-off"), the next page loads, and its picture snaps open (the "poweron" animation). */
(function(){
  var root=document.documentElement;
  var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function centre(){root.style.setProperty('--oy',(window.scrollY+window.innerHeight/2)+'px');}
  centre();
  window.addEventListener('pageshow',function(e){          /* coming back with the Back button */
    root.classList.remove('tv-off');
    if(e.persisted){centre();root.classList.add('tv-again');setTimeout(function(){root.classList.remove('tv-again');},1100);}
  });
  if(still)return;
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest('a[href]');
    if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
    var to;
    try{to=new URL(a.href,location.href);}catch(_){return;}
    if(!/^(https?|file):$/.test(to.protocol)||to.host!==location.host||to.pathname===location.pathname)return;
    e.preventDefault();
    centre();
    root.classList.add('tv-off');
    setTimeout(function(){location.href=a.href;},440);
  });
})();
