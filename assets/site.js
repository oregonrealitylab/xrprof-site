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

/* Links marked data-video="<YouTube id>" open the video in a pop-up set on this page.
   The picture is the normal YouTube player with a live filter over it: chunky pixels, then a
   1-bit ordered dither in the site's two tones. Sound is untouched. Without JavaScript the
   link simply opens YouTube. */
(function(){
  var links=document.querySelectorAll('a[data-video]');
  var inline=document.querySelector('.art[data-embed]');
  if(!links.length&&!inline)return;
  /* size of one picture pixel, in CSS px (odd): finer on phones and for players set inside a page */
  var P=(inline||window.innerWidth<640)?3:5;
  var BAYER=P===3?'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAATklEQVR4XmPk4OBgAIP6+noIY+HChWgiTBA+fkCUIpb9+/dDjGlsbIQwMEWIMokoRYwWFhZofklMTKSZ7xi/f/+O5rv4+Hg0EaIcTpQiACe3GFqY/vHVAAAAAElFTkSuQmCC':'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAAU0lEQVR4XmPk4OBgQAL19fXI3IULF+KRZUKWIxUMUc0s+/fvR/ZqY2MjMhe/7BD1M0XOZrSwsMCThhITE0dTGApg/P79O54UFh8fj0eWoqgaopoBP+UYaitGiE0AAAAASUVORK5CYII='; /* 4x4 dither threshold map, pre-scaled to that pixel size */
  var safari=/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  var box=null, last=null;

  function filter(){
    var s='http://www.w3.org/2000/svg', h=(P-1)/2;
    var el=document.createElementNS(s,'svg');
    el.setAttribute('width','0'); el.setAttribute('height','0'); el.setAttribute('aria-hidden','true');
    el.style.position='absolute';
    el.innerHTML=
      '<filter id="bitvideo" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'+
        /* 1. chunky pixels: keep one sample per PxP cell, then grow it to fill the cell */
        '<feFlood x="'+h+'" y="'+h+'" width="1" height="1"/>'+
        '<feComposite width="'+P+'" height="'+P+'"/>'+
        '<feTile result="grid"/>'+
        '<feComposite in="SourceGraphic" in2="grid" operator="in"/>'+
        '<feMorphology operator="dilate" radius="'+h+'"/>'+
        /* 2. black and white, with the shadows lifted so dark footage stays readable */
        '<feColorMatrix type="matrix" values=".3 .59 .11 0 0 .3 .59 .11 0 0 .3 .59 .11 0 0 0 0 0 1 0"/>'+
        '<feComponentTransfer result="grey"><feFuncR type="table" tableValues="0 .26 .5 .67 .77 .84 .89 .93 .96 .98 1"/><feFuncG type="table" tableValues="0 .26 .5 .67 .77 .84 .89 .93 .96 .98 1"/><feFuncB type="table" tableValues="0 .26 .5 .67 .77 .84 .89 .93 .96 .98 1"/></feComponentTransfer>'+
        /* 3. ordered dither: add a tiled 4x4 threshold map, then snap every pixel to on or off */
        '<feImage href="'+BAYER+'" x="0" y="0" width="'+4*P+'" height="'+4*P+'" preserveAspectRatio="none" result="map"/>'+
        '<feTile in="map" result="maps"/>'+
        '<feComposite in="grey" in2="maps" operator="arithmetic" k1="0" k2="1" k3="1" k4="-.5"/>'+
        '<feComponentTransfer><feFuncR type="discrete" tableValues=".047 .949"/><feFuncG type="discrete" tableValues=".059 .961"/><feFuncB type="discrete" tableValues=".043 .933"/><feFuncA type="discrete" tableValues="1 1"/></feComponentTransfer>'+
      '</filter>';
    document.body.appendChild(el);
  }

  /* Shared with the project cards (expand.js): makes sure the filter exists and says whether
     this browser gets the simpler fallback look. */
  window.xrBitVideo=function(){
    if(!document.getElementById('bitvideo'))filter();
    return {plain:safari};
  };

  function close(){
    if(!box)return;
    box.remove(); box=null;                  /* removing the player also stops the sound */
    document.documentElement.classList.remove('video-open');
    if(last)last.focus();
  }

  function open(a){
    last=a;
    var id=a.getAttribute('data-video'), title=a.getAttribute('data-title')||'Video';
    if(!document.getElementById('bitvideo'))filter();
    box=document.createElement('div');
    box.className='vbox'+(safari?' plain':'');
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-label',title);
    box.innerHTML=
      '<div class="vset">'+
        '<div class="vbar"><span class="vname"></span><button type="button" class="vclose">Close &times;</button></div>'+
        '<div class="vscreen">'+
          '<iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>'+
          '<div class="vlines" aria-hidden="true"></div>'+
        '</div>'+
        '<div class="vfoot"><label><input type="checkbox" id="vraw"> Show the original picture</label>'+
          '<a class="vout" rel="noopener">Open on YouTube</a></div>'+
      '</div>';
    box.querySelector('.vname').textContent=title;
    var frame=box.querySelector('iframe');
    frame.title=title;
    frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&rel=0&playsinline=1';
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
    var bit=window.xrBitVideo?window.xrBitVideo():{plain:false};
    var id='raw-'+art.id, title=art.getAttribute('data-title');
    art.classList.toggle('plain',bit.plain);
    art.innerHTML=
      '<div class="vscreen"><iframe allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>'+
      '<div class="vlines" aria-hidden="true"></div></div>'+
      '<div class="vfoot"><label><input type="checkbox" id="'+id+'"> Show the original picture</label>'+
      '<a class="vout" rel="noopener">Open the video</a></div>';
    var f=art.querySelector('iframe'); f.title=title+' video'; f.src=art.getAttribute('data-embed');
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
