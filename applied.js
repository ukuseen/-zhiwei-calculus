(function (root) {
  "use strict";
  function info(model,a,parameter,rate) {
    if (![a,parameter,rate].every(Number.isFinite)) throw new RangeError("参数必须有限");
    if (model === "implicit") {
      if (parameter<=0 || a<0 || a>180) throw new RangeError("半径或角度超出范围");
      const t=a*Math.PI/180, x=parameter*Math.cos(t), y=(a===0||a===180)?0:parameter*Math.sin(t);
      return {x,y,slope:y===0?null:-x/y};
    }
    if (model === "parametric") return {x:a*a,y:a*a*a,dx:2*a,dy:3*a*a,slope:a===0?null:1.5*a,tangent:1.5*a};
    if (model === "related") {
      if (a<0 || a>=5 || rate<0) throw new RangeError("梯子位置或速度超出范围");
      const y=Math.sqrt(25-a*a);
      return {x:a,y,dx:rate,dy:-a*rate/y};
    }
    throw new RangeError("未知模型");
  }
  root.AppliedMath={info};
  if (!root.LessonRenderers) return;
  function path(c,points,color,dash) {
    return '<path d="'+points.map(function(p,i){return (i?'L':'M')+c.sx(p[0]).toFixed(3)+' '+c.sy(p[1]).toFixed(3);}).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="2.5" clip-path="url(#plot-clip)"'+(dash?' stroke-dasharray="6 5"':'')+'/>';
  }
  function tangent(c,d,slope) {
    if (slope===null) return path(c,[[d.x,c.ymin],[d.x,c.ymax]],'#c58a50',true);
    return path(c,[[c.xmin,d.y+slope*(c.xmin-d.x)],[c.xmax,d.y+slope*(c.xmax-d.x)]],'#c58a50',true);
  }
  root.LessonRenderers.applied={
    controls:function(s,a){
      if(s.model==='implicit') return a.range('a-slider','观察角度 θ（度）',0,180,.01,s.a,'两端 y=0；观察竖直切线。')+a.range('parameter-slider','圆的半径 r',1,5,.1,s.parameter,'角度不变时，改变半径不改变切线斜率。');
      if(s.model==='parametric') return a.range('a-slider','参数 t',-2,2,.02,s.a,'经过 t=0 时，两个参数速度都为零，需要另作判断。');
      return a.range('x-slider','底端距墙 x（米）',0,4.9,.05,s.x,'梯长为 5 米；滑块避开 y=0 的失效位置。')+a.range('rate-slider','向外速度 dx/dt（米/秒）',0,3,.1,s.rate,'改变速度，比较顶端高度的变化率。');
    },
    tip:'先读关系式，再单步移动观察点，核对导数的条件与符号。',
    finished:function(s){return s.model==='related'?s.x>=4.9:s.a>=(s.model==='implicit'?180:2);},
    advance:function(s){if(s.model==='related')s.x=Math.min(4.9,Math.round((s.x+.1)*100)/100);else s.a=Math.min(s.model==='implicit'?180:2,Math.round((s.a+(s.model==='implicit'?5:.1))*100)/100);},
    restart:function(s){if(s.model==='related')s.x=0;else s.a=s.model==='implicit'?0:-2;},
    chart:function(s,a){
      const d=info(s.model,s.model==='related'?s.x:s.a,s.parameter,s.rate);
      let c,layers,observation;
      if(s.model==='implicit'){
        const r=s.parameter, half=1.3*r*617/261/2;
        c=a.chartBase(-half,half,-.1*r,1.2*r,'x','y');
        layers=path(c,Array.from({length:181},function(_,i){const t=i*Math.PI/180;return[r*Math.cos(t),r*Math.sin(t)];}),'#247b5d')+tangent(c,d,d.slope);
        a.metrics([['横坐标 x',a.fmt(d.x)],['纵坐标 y',a.fmt(d.y)],['dy/dx',d.slope===null?'无有限导数':a.fmt(d.slope),d.slope===null]]);
        observation=d.slope===null?'此处 y=0，不能除以 y。上半圆端点有竖直切线，不存在有限的 dy/dx。':'2x+2yy′=0，因此 y′=−x/y='+a.fmt(d.slope)+'。角度确定位置，导数仍是对 x 求的。';
      }else if(s.model==='parametric'){
        c=a.chartBase(-.4,4.5,-9,9,'x','y');
        layers=path(c,Array.from({length:201},function(_,i){const t=-2+i/50;return[t*t,t*t*t];}),'#247b5d')+tangent(c,d,d.tangent);
        a.metrics([['dx/dt',a.fmt(d.dx)],['dy/dt',a.fmt(d.dy)],['dy/dx 公式',d.slope===null?'0/0，需另判':a.fmt(d.slope),d.slope===null]]);
        observation=d.slope===null?'t=0 时不能直接相除。另由过原点的割线斜率 y/x=t→0，可得水平切线。两分支合起来并不是单值函数 y=f(x)。':'dy/dx=(3t²)/(2t)=3t/2='+a.fmt(d.slope)+'。这里 dx/dt≠0，所以参数导数比可以使用。';
      }else{
        c=a.chartBase(-.5,13.5,-.5,-.5+14*261/617,'x（米）','y（米）');
        layers=path(c,[[0,5.2],[0,0],[5.2,0]],'#a6b69a')+path(c,[[0,d.y],[d.x,0]],'#247b5d');
        layers+=a.dot(c,0,d.y,'#c58a50',true,'梯子顶端')+a.dot(c,d.x,0,'#247b5d',true,'梯子底端');
        layers+=a.svgText(c.sx(6),c.sy(4.3),'梯长固定：5 米')+a.svgText(c.sx(6),c.sy(3.4),'底端速度：'+a.fmt(d.dx)+' m/s')+a.svgText(c.sx(6),c.sy(2.5),'顶端速度：'+a.fmt(d.dy)+' m/s');
        a.metrics([['当前高度 y',a.fmt(d.y)],['底端 dx/dt',a.fmt(d.dx)],['顶端 dy/dt',a.fmt(d.dy)]]);
        observation='先对时间求导，再代入 x='+a.fmt(d.x)+'、y='+a.fmt(d.y)+'。dy/dt=−(x/y)×'+a.fmt(d.dx)+'='+a.fmt(d.dy)+' 米/秒。'+(d.dy<0?'负号表示下降。':'此刻高度的一阶变化率为零。');
      }
      if(s.model!=='related')layers+=a.dot(c,d.x,d.y,'#176853',true,'当前观察点');
      a.setChart(c,layers,observation);
      a.legend(s.model==='related'?[['dot','梯子 / 底端'],['dot orange','顶端']]:[['dot','曲线 / 观察点'],['dot orange','切线']]);
      a.$('observation').textContent=observation;
      a.$('chart-caption').textContent=s.model==='related'?'速度单位：米/秒':s.model==='implicit'?'θ = '+a.fmt(s.a,2)+'°':'t = '+a.fmt(s.a,2);
      a.$('chart-footnote').textContent=s.model==='related'?'演示比较不同位置的瞬时速度，单步不代表相等时间间隔。':s.model==='parametric'?'参数点沿曲线移动。t=0 的水平切线由单独的极限分析得到。':'上半圆两端不具有有限导数；切线垂直时不输出无穷数值。';
    }
  };
})(globalThis);
