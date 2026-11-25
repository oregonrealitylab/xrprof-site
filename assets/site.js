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
  setTimeout(function(){root.classList.add('tv-on');},1100);   /* the opening animation has finished: retire it */
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

/* Links marked data-video="<YouTube id>" open the video in a pop-up set on this page.
   The picture is the normal YouTube player with a 1-bit look laid over it (see ".vfx" in
   site.css). Sound is untouched. Without JavaScript the link simply opens YouTube. */
window.xrScreen=function(src,title){          /* the framed, filtered player, shared with the project cards */
  var s=document.createElement('div'); s.className='vscreen';
  s.innerHTML='<div class="vfx"><iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div class="vlines" aria-hidden="true"></div>';
  var f=s.querySelector('iframe'); f.title=title; f.src=src;
  return s;
};
(function(){
  var links=document.querySelectorAll('a[data-video]');
  if(!links.length)return;
  var box=null, last=null;

  function close(){
    if(!box)return;
    box.remove(); box=null;                  /* removing the player also stops the sound */
    document.documentElement.classList.remove('video-open');
    if(last)last.focus();
  }

  function open(a){
    last=a;
    var id=a.getAttribute('data-video'), title=a.getAttribute('data-title')||'Video';
    box=document.createElement('div');
    box.className='vbox';
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label',title);
    box.innerHTML=
      '<div class="vset">'+
        '<div class="vbar"><span class="vname"></span><button type="button" class="vclose">Close &times;</button></div>'+
        '<div class="vfoot"><label><input type="checkbox" id="vraw"> Show the original picture</label>'+
          '<a class="vout" rel="noopener">Open on YouTube</a></div>'+
      '</div>';
    box.querySelector('.vname').textContent=title;
    var set=box.querySelector('.vset');
    set.insertBefore(window.xrScreen('https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0&playsinline=1',title),set.querySelector('.vfoot'));
    box.querySelector('.vout').href=a.href;
    box.querySelector('#vraw').addEventListener('change',function(){box.classList.toggle('raw',this.checked);});
    box.querySelector('.vclose').addEventListener('click',close);
    box.addEventListener('click',function(e){if(e.target===box)close();});
    document.body.appendChild(box);
    document.documentElement.classList.add('video-open');
    box.querySelector('.vclose').focus();
  }

  links.forEach(function(a){
    a.addEventListener('click',function(e){
      if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
      e.preventDefault(); open(a);
    });
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
})();

/* Project cards: the Expand button opens the card. A card with a video (data-embed on its
   panel) gets the player, drawn through the same filter as the pop-up video, with a switch
   to see the original picture. Other cards show their artwork. Collapsing removes the player,
   which also stops the sound. */
(function(){
  function player(art){
    var id='raw-'+art.id, title=art.getAttribute('data-title');
    art.innerHTML='<div class="vfoot"><label><input type="checkbox" id="'+id+'"> Show the original picture</label>'+
      '<a class="vout" rel="noopener">Open the video</a></div>';
    art.insertBefore(window.xrScreen(art.getAttribute('data-embed'),title+' video'),art.firstChild);
    art.querySelector('.vout').href=art.getAttribute('data-href');
    art.querySelector('input').addEventListener('change',function(){art.classList.toggle('raw',this.checked);});
  }
  document.querySelectorAll('button.expand').forEach(function(b){
    var art=document.getElementById(b.getAttribute('aria-controls'));
    if(!art)return;
    b.hidden=false;
    b.addEventListener('click',function(){
      var open=b.getAttribute('aria-expanded')!=='true';
      b.setAttribute('aria-expanded',open?'true':'false');
      b.children[0].textContent=open?'Collapse ':'Expand ';
      b.children[1].textContent=open?'\u2212':'+';
      if(art.hasAttribute('data-embed')){
        if(open)player(art); else{art.innerHTML='';art.classList.remove('raw');}
      }
      art.hidden=!open;
    });
  });
})();
