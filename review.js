(function (root) {
  "use strict";
  const C=root.ReviewCore, M=root.CalcMath, bank=root.MidtermBank, sections=root.Curriculum.sections;
  const known=new Set(bank.map(function(q){return q.id;})), byId=new Map(bank.map(function(q){return[q.id,q];}));
  const storageKey='zhiwei-review-v1';
  let records=Object.create(null), storageAvailable=true, session=null, view='home', chapterFilter='all';
  const esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  try { const saved=JSON.parse(localStorage.getItem(storageKey)||'null'); if(saved)records=C.validateRecords(saved.records,known); } catch(_){storageAvailable=false;}
  const dialog=document.createElement('dialog'); dialog.id='review-dialog'; dialog.setAttribute('aria-labelledby','review-title');
  dialog.innerHTML='<div class="review-top"><div><span class="section-overline">MIDTERM STUDIO · 前三章</span><h2 id="review-title">期中备考室<span>把不会的，变成会的。</span></h2></div><button class="icon-button" data-review-action="close" aria-label="关闭期中备考室">×</button></div>'+
    '<nav class="review-nav" aria-label="备考室导航"><button data-review-view="home">复习总览</button><button data-review-view="mistakes">错题本 <span id="review-wrong-count">0</span></button><button data-review-view="weak">薄弱知识点</button><button data-review-action="backup">备份记录 ↗</button></nav>'+
    '<div id="review-panel"></div><p class="review-storage" id="review-storage" role="status"></p>';
  document.body.appendChild(dialog);
  const panel=dialog.querySelector('#review-panel');
  function sectionOf(q){return sections.find(function(s){return s.number===q.section;});}
  function statsHtml(){const s=C.summarize(bank,records);return '<div class="review-stats">'+[['期中题目',s.total],['已尝试',s.attempted],['最近答对',s.latestCorrect],['待复习错题',s.mistakes]].map(function(v){return '<div><strong>'+v[1]+'</strong><span>'+v[0]+'</span></div>';}).join('')+'</div>';}
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,records}));}catch(_){storageAvailable=false;}status();}
  function status(){
    dialog.querySelector('#review-wrong-count').textContent=C.summarize(bank,records).mistakes;
    dialog.querySelector('#review-storage').textContent=storageAvailable?'答题记录仅保存在当前浏览器；可通过“备份记录”导出。正在进行的小测在当前页面内保留。':'浏览器未允许保存或原记录无法读取。本次记录仍可使用，请在离开页面前导出备份。';
  }
  function record(id,correct){
    if(!known.has(id))return;
    records[id]=C.recordAnswer(records,id,correct,Date.now());persist();
    document.dispatchEvent(new CustomEvent('zhiwei-answer',{detail:{id,correct}}));
  }
  function button(label,action,extra,kind){return '<button type="button" class="button '+(kind||'secondary')+'" data-review-action="'+action+'" '+(extra||'')+'>'+label+'</button>';}
  function sectionDetails(s){return '<details class="review-concept"><summary>复习 '+esc(s.number+' · '+s.title)+'</summary><p><strong>要掌握：</strong>'+esc(s.key)+'</p><p><strong>代表例题：</strong>'+esc(s.example)+'</p><p><strong>易错点：</strong>'+esc(s.pitfall)+'</p>'+button('回到相关实验 ↗','lab','data-target="'+s.target+'"')+'</details>';}
  function filteredBank(){return chapterFilter==='all'?bank:bank.filter(function(q){return q.section.startsWith(chapterFilter+'.');});}
  function home(){
    const pool=filteredBank();
    panel.innerHTML=statsHtml()+'<div class="review-start"><div><h3>先找薄弱点，再逐节练习</h3><p>题库覆盖教材前三章 18 节，共 '+bank.length+' 题。选择题检验概念，数值题练计算；每题提交后立即讲解。</p></div><label for="review-chapter">练习范围</label><select id="review-chapter"><option value="all">前三章混合</option value="1">第 1 章 · 函数</option><option value="2">第 2 章 · 极限与连续性</option><option value="3">第 3 章 · 导数与微分</option></select>'+button('开始 '+Math.min(12,pool.length)+' 题小测 →','mixed','','primary')+(session?button('继续上次练习','resume'):'')+'</div>'+
      '<p class="review-note">小测每题按首次提交计分；答错的题进入错题本，重练答对后移出待复习列表。统计反映本站练习情况，不代表考试成绩。</p>'+
      '<div class="review-sections">'+sections.filter(function(s){return chapterFilter==='all'||String(s.chapter)===chapterFilter;}).map(function(s){
        const qs=bank.filter(function(q){return q.section===s.number;}), st=C.summarize(qs,records);
        return '<article class="review-section-row"><div><span class="section-overline">'+s.number+'</span><h3>'+esc(s.title)+'</h3><p>'+qs.length+' 题 · 最近答对 '+st.latestCorrect+' · 待复习 '+st.mistakes+'</p></div>'+button('练本节 →','section','data-section="'+s.number+'"')+sectionDetails(s)+'</article>';
      }).join('')+'</div>';
    panel.querySelector('#review-chapter').value=chapterFilter;
  }
  function mistakes(){
    const qs=bank.filter(function(q){return records[q.id]&&!records[q.id].lastCorrect;});
    panel.innerHTML='<div class="review-page-intro"><h3>错题本 · '+qs.length+' 题待复习</h3><p>这里保留最近一次作答错误的题。先看错因，再独立重练；最近答对后会移出待复习列表，历史尝试次数仍保留。</p></div>'+
      (qs.length?button('重练全部错题 →','retry','','primary')+'<div class="review-list">'+qs.map(function(q){const r=records[q.id];return '<article><div><span class="section-overline">'+q.section+' · '+esc(sectionOf(q).title)+'</span><h3>'+esc(q.title)+'</h3><p>累计作答 '+r.attempts+' 次，答对 '+r.correct+' 次</p></div>'+button('重练','one','data-id="'+q.id+'"')+'</article>';}).join('')+'</div>':'<div class="review-empty"><span>✓</span><h3>目前没有待复习错题</h3><p>可以从一组混合小测开始，检验概念与计算。</p>'+button('回到复习总览','home','','primary')+'</div>');
  }
  function weak(){
    const rows=sections.map(function(s){return {s,st:C.summarize(bank.filter(function(q){return q.section===s.number;}),records)};});
    rows.sort(function(a,b){return (b.st.mistakes/Math.max(1,b.st.attempted))-(a.st.mistakes/Math.max(1,a.st.attempted)) || b.st.mistakes-a.st.mistakes;});
    panel.innerHTML='<div class="review-page-intro"><h3>优先复习最近错得多的知识点</h3><p>按“待复习错题 ÷ 已尝试题目”排序。尚未练习的章节不计为零分；“历次正确率”包含同一道题的多次尝试。</p></div><div class="review-list">'+rows.map(function(row){const s=row.s,st=row.st;return '<article class="review-weak-row"><div><span class="section-overline">'+s.number+'</span><h3>'+esc(s.title)+'</h3><p>'+(st.attempted?'尝试 '+st.attempted+'/'+st.total+' 题 · 待复习 '+st.mistakes+' 题 · 历次正确率 '+st.accuracy+'%':'尚未练习 · '+st.total+' 题可开始')+'</p><div class="review-meter" aria-hidden="true"><span style="width:'+st.latestCorrect/st.total*100+'%"></span></div></div>'+button(st.mistakes?'巩固本节':'练本节','section','data-section="'+s.number+'"')+'</article>';}).join('')+'</div>';
  }
  function start(qs,title){
    if(!qs.length){view='mistakes';render();return;}
    session={ids:qs.map(function(q){return q.id;}),index:0,answers:Object.create(null),title};view='practice';render();
  }
  function expected(q){return q.type==='choice'?q.choices[q.answer]:Number(q.answer.toPrecision(8)).toString();}
  function answerHtml(q,result){
    const steps=q.steps||[q.hint,q.explanation];
    return '<div class="review-explanation '+(result.correct?'correct':'incorrect')+'" role="status"><h4>'+(result.correct?'答对了':'这题先记入错题本')+'</h4><p><strong>参考答案：</strong>'+esc(expected(q))+'</p><ol>'+steps.map(function(s){return '<li>'+esc(s)+'</li>';}).join('')+'</ol>'+(q.pitfall?'<p class="review-pitfall"><strong>易错点：</strong>'+esc(q.pitfall)+'</p>':'')+'</div>';
  }
  function practice(){
    if(!session){view='home';home();return;}
    if(session.index>=session.ids.length){finish();return;}
    const q=byId.get(session.ids[session.index]), result=session.answers[q.id], s=sectionOf(q);
    panel.innerHTML='<div class="review-paper-heading"><div><span class="section-overline">'+esc(session.title)+'</span><h3>第 '+(session.index+1)+' / '+session.ids.length+' 题 <small>'+q.section+' · '+esc(s.title)+'</small></h3></div>'+button('返回总览','home')+'</div>'+
      '<div class="review-meter"><span style="width:'+session.index/session.ids.length*100+'%"></span></div><article class="review-question" data-review-question="'+q.id+'"><h3 tabindex="-1" id="review-question-title">'+esc(q.title)+'</h3><p class="review-question-body">'+esc(q.body)+'</p><form id="review-answer"><fieldset '+(result?'disabled':'')+'><legend>'+(q.type==='choice'?'选择一个答案':'填写答案（支持小数或分数）')+'</legend>'+
      (q.type==='choice'?'<div class="review-choices">'+q.choices.map(function(v,i){return '<label><input type="radio" name="review-answer" value="'+i+'" '+(result&&Number(result.input)===i?'checked':'')+'><span>'+esc(v)+'</span></label>';}).join('')+'</div>':'<label class="review-number" for="review-number">'+esc(q.unit||'答案')+'<input id="review-number" name="review-answer" type="text" inputmode="decimal" autocomplete="off" placeholder="例如 0.5 或 1/2" value="'+(result?esc(result.input):'')+'"></label>')+'</fieldset><div class="review-answer-actions"><button type="submit" class="button primary" '+(result?'disabled':'')+'>提交答案</button>'+button('给我提示','hint')+(result?button(session.index===session.ids.length-1?'查看本次结果 →':'下一题 →','next','','primary'):'')+'</div><p id="review-input-message" role="status"></p><p id="review-hint" class="hint" hidden>'+esc(q.hint)+'</p></form>'+
      (result?answerHtml(q,result):'')+sectionDetails(s)+'</article>';
  }
  function finish(){
    const answers=session.ids.map(function(id){return {q:byId.get(id),r:session.answers[id]};}), correct=answers.filter(function(a){return a.r&&a.r.correct;}).length;
    panel.innerHTML='<div class="review-finish"><span class="section-overline">'+esc(session.title)+' · 本次完成</span><h3>'+correct+' <small>/ '+session.ids.length+' 题首次答对</small></h3><p>回顾下面的结果，再回到错题本巩固。一次练习的分数不是掌握程度的全部。</p><div class="review-answer-actions">'+button('再来一组小测','mixed','','primary')+button('进入错题本','mistakes')+button('查看薄弱知识点','weak')+'</div></div><div class="review-list">'+answers.map(function(a){return '<details><summary><span class="review-result-mark">'+(a.r.correct?'✓':'需复习')+'</span> '+esc(a.q.title)+'</summary><p>'+esc(a.q.body)+'</p>'+answerHtml(a.q,a.r)+'</details>';}).join('')+'</div>';
  }
  function render(){
    dialog.querySelectorAll('[data-review-view]').forEach(function(b){const active=b.dataset.reviewView===view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
    if(view==='home')home();else if(view==='mistakes')mistakes();else if(view==='weak')weak();else practice();
    status();dialog.scrollTop=0;
  }
  function open(section){
    document.dispatchEvent(new CustomEvent('zhiwei-stop'));
    if(section&&sections.some(function(s){return s.number===section;}))start(C.shuffled(bank.filter(function(q){return q.section===section;})),section+' 节专项练习');
    else render();
    if(!dialog.open)dialog.showModal();
  }
  dialog.addEventListener('submit',function(e){
    if(e.target.id!=='review-answer')return;e.preventDefault();
    const q=byId.get(session.ids[session.index]);if(session.answers[q.id])return;
    const field=q.type==='choice'?panel.querySelector('input[name="review-answer"]:checked'):panel.querySelector('#review-number');
    if(!field||!field.value.trim()||(q.type==='number'&&!Number.isFinite(M.parseAnswer(field.value)))){panel.querySelector('#review-input-message').textContent=q.type==='choice'?'请选择一个答案。':'请输入有效的小数或分数，例如 1/2。';return;}
    const input=field.value, correct=q.type==='choice'?Number(input)===q.answer:M.checkAnswer(input,q.answer,q.tolerance);
    session.answers[q.id]={input,correct};record(q.id,correct);practice();
    panel.querySelector('.review-explanation').scrollIntoView({block:'nearest'});
    panel.querySelector('[data-review-action="next"]').focus({preventScroll:true});
  });
  dialog.addEventListener('change',function(e){if(e.target.id==='review-chapter'){chapterFilter=e.target.value;home();}});
  dialog.addEventListener('click',function(e){
    const nav=e.target.closest('[data-review-view]');if(nav){view=nav.dataset.reviewView;render();return;}
    const b=e.target.closest('[data-review-action]');if(!b)return;
    const action=b.dataset.reviewAction;
    if(action==='close'){dialog.close();return;}
    if(action==='backup'){dialog.close();document.dispatchEvent(new CustomEvent('zhiwei-backup'));return;}
    if(action==='lab'){dialog.close();document.dispatchEvent(new CustomEvent('zhiwei-goto',{detail:b.dataset.target}));return;}
    if(action==='home'||action==='mistakes'||action==='weak'){view=action;render();return;}
    if(action==='mixed'){start(C.selectQuestions(filteredBank(),12),(chapterFilter==='all'?'前三章混合':'第 '+chapterFilter+' 章')+'小测');return;}
    if(action==='section'){open(b.dataset.section);return;}
    if(action==='one'){start([byId.get(b.dataset.id)],'错题重练');return;}
    if(action==='retry'){start(C.shuffled(bank.filter(function(q){return records[q.id]&&!records[q.id].lastCorrect;})),'错题重练');return;}
    if(action==='resume'){view='practice';render();return;}
    if(action==='hint'){const hint=panel.querySelector('#review-hint');hint.hidden=!hint.hidden;b.textContent=hint.hidden?'给我提示':'收起提示';return;}
    if(action==='next'){session.index++;render();const h=panel.querySelector('#review-question-title');if(h)h.focus({preventScroll:true});}
  });
  root.MidtermReview={open,record,
    exportRecords:function(){return JSON.parse(JSON.stringify(records));},
    merge:function(incoming){records=C.mergeRecords(records,incoming,known);persist();},
    stats:function(){return C.summarize(bank,records);}
  };
  status();
})(globalThis);
