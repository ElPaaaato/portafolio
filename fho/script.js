/* ───── Navbar scroll ───── */
const nav=document.getElementById('nav');
if(nav){
  window.addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>40));
}

/* ───── Reveal on scroll ───── */
const io=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&e.target.classList.add('in')),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ───── Particles network ───── */
const cv=document.getElementById('particles');
if(cv){
  const ctx=cv.getContext('2d');
  let W,H,parts=[];
  const COUNT=window.innerWidth<700?40:90;

  function resize(){
    W=cv.width=innerWidth*devicePixelRatio;
    H=cv.height=innerHeight*devicePixelRatio;
    cv.style.width=innerWidth+'px';
    cv.style.height=innerHeight+'px';
  }
  resize();addEventListener('resize',()=>{resize();init()});

  function init(){
    parts=[];
    for(let i=0;i<COUNT;i++){
      parts.push({
        x:Math.random()*W,
        y:Math.random()*H,
        vx:(Math.random()-.5)*.3*devicePixelRatio,
        vy:(Math.random()-.5)*.3*devicePixelRatio,
        r:(Math.random()*1.6+.6)*devicePixelRatio
      });
    }
  }
  init();

  let mouseX=-9999,mouseY=-9999;
  addEventListener('mousemove',e=>{mouseX=e.clientX*devicePixelRatio;mouseY=e.clientY*devicePixelRatio});

  function loop(){
    ctx.clearRect(0,0,W,H);
    parts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0||p.x>W)p.vx*=-1;
      if(p.y<0||p.y>H)p.vy*=-1;

      const dx=p.x-mouseX,dy=p.y-mouseY,d=Math.hypot(dx,dy);
      if(d<150*devicePixelRatio){
        const f=(150*devicePixelRatio-d)/(150*devicePixelRatio);
        p.x+=dx/d*f*1.5;
        p.y+=dy/d*f*1.5;
      }

      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba(224,168,90,.55)';
      ctx.fill();
    });

    for(let i=0;i<parts.length;i++){
      for(let j=i+1;j<parts.length;j++){
        const a=parts[i],b=parts[j];
        const d=Math.hypot(a.x-b.x,a.y-b.y);
        const max=120*devicePixelRatio;
        if(d<max){
          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=`rgba(224,168,90,${(1-d/max)*.18})`;
          ctx.lineWidth=devicePixelRatio*.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
}

/* ───── Service hover light ───── */
document.querySelectorAll('.service').forEach(s=>{
  s.addEventListener('mousemove',e=>{
    const r=s.getBoundingClientRect();
    s.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
    s.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
  });
});
