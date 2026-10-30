const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../review-core.js');
const ctx=vm.createContext({});
for(const f of ['applied.js','review-data.js','curriculum.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
const A=ctx.AppliedMath,bank=JSON.parse(JSON.stringify(ctx.MidtermBank)),known=new Set(bank.map(q=>q.id));
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} vs ${b}`);
test('隐函数：曲线上点、半径变化与解析切线',()=>{
 for(const r of [1,3,5])for(const angle of [1,30,90,150,179]){
  const d=A.info('implicit',angle,r,0);near(d.x*d.x+d.y*d.y,r*r);
  const h=1e-7,derivative=(Math.sqrt(r*r-(d.x+h)**2)-Math.sqrt(r*r-(d.x-h)**2))/(2*h);
  near(d.slope,derivative,0.0001);
 }
 for(const angle of [0,180])assert.equal(A.info('implicit',angle,5,0).slope,null);
});
test('参数曲线：两侧斜率与退化参数点',()=>{
 for(const t of [-2,-1,.5,2]){
  const d=A.info('parametric',t,0,0),h=1e-6;
  near(d.slope,((t+h)**3-(t-h)**3)/((t+h)**2-(t-h)**2));
 }
 const origin=A.info('parametric',0,0,0);assert.equal(origin.slope,null);assert.equal(origin.tangent,0);
});
test('梯子：速度约束、停止和边界拒绝',()=>{
 const d=A.info('related',3,0,2);near(d.y,4);near(d.dy,-1.5);near(d.x*d.dx+d.y*d.dy,0);
 near(A.info('related',4,0,0).dy,0);
 assert.ok(Math.abs(A.info('related',4.9,0,1).dy)>Math.abs(A.info('related',3,0,1).dy));
 assert.throws(()=>A.info('related',5,0,1));assert.throws(()=>A.info('implicit',0,0,1));
});
test('题库覆盖18节，保留原题编号并排除期末与级数题',()=>{
 assert.equal(bank.length,90);assert.equal(known.size,90);assert.equal(ctx.Curriculum.sections.length,18);
 for(const s of ctx.Curriculum.sections)assert.ok(bank.filter(q=>q.section===s.number).length>=3);
 assert.ok(known.has('seq-1'));assert.ok(known.has('opt-3'));
 for(const id of ['opt-1','opt-2','int-1','ser-1'])assert.ok(!known.has(id));
 const extra=JSON.parse(fs.readFileSync(path.join(__dirname,'../practice-content.json'))).questions;
 assert.equal(extra.length,54);
 for(const q of extra){assert.equal(q.steps.length,3,q.id);assert.ok(q.steps.every(s=>s.trim()));assert.ok(q.pitfall);}
});
test('新增计算题：独立核对利息、极限、求导与经济量',()=>{
 const expected={
  'mid-1-3-2':(2+1)**2,'mid-1-4-1':1000*(1+.12/4)**4,'mid-1-4-2':(20-3)*3-(2*3+10),'mid-1-4-3':1000*(1+.1*2),
  'mid-2-1-1':1,'mid-2-1-2':40,'mid-2-2-2':3,'mid-2-2-3':0,'mid-2-3-1':0,'mid-2-4-1':1/2,'mid-2-4-2':4,
  'mid-2-5-1':3/2,'mid-2-5-3':0,'mid-2-6-2':2/3,'mid-2-7-1':1,'mid-2-7-2':1,
  'mid-3-1-1':2*3,'mid-3-1-3':2**2-2*2*2,'mid-3-2-1':2*2/(1+2**2),'mid-3-2-2':1/(1+1)**2,
  'mid-3-3-1':2**2,'mid-3-3-2':-1,'mid-3-3-3':5*4*3*2,
  'mid-3-4-1':-(2+1)/(1+2),'mid-3-4-2':2/3,'mid-3-4-3':-3/Math.sqrt(25-9)*2,
  'mid-3-5-1':3+.06/6,'mid-3-5-2':3*2**2*.01,'mid-3-5-3':.1**2,
  'mid-3-6-1':5+10,'mid-3-6-2':20*2/(100-2*20),'mid-3-6-3':10-2*3
 };
 for(const [id,value] of Object.entries(expected)){const q=bank.find(q=>q.id===id);near(q.answer,value,(q.tolerance||1e-5)+1e-8);}
 assert.equal(Object.keys(expected).length,bank.filter(q=>q.id.startsWith('mid-')&&q.type==='number').length);
});
test('错题重练：保留历史次数，最近答对后退出错题列表',()=>{
 const records={};records['seq-1']=C.recordAnswer(records,'seq-1',false,100);
 assert.equal(C.summarize(bank,records).mistakes,1);
 records['seq-1']=C.recordAnswer(records,'seq-1',true,200);
 const s=C.summarize(bank,records);assert.equal(s.mistakes,0);assert.equal(s.attempted,1);assert.equal(s.attempts,2);assert.equal(s.accuracy,50);
 assert.equal(C.summarize(bank,{}).accuracy,null);
});
test('导入合并：幂等、保留更新记录、过滤过期题号',()=>{
 const old={'seq-1':{attempts:1,correct:0,lastCorrect:false,updatedAt:100}};
 const recent={'seq-1':{attempts:2,correct:1,lastCorrect:true,updatedAt:200},unknown:{bad:1}};
 const merged=C.mergeRecords(old,recent,known);assert.equal(merged['seq-1'].lastCorrect,true);assert.equal(merged.unknown,undefined);
 assert.deepEqual(C.mergeRecords(merged,recent,known),merged);
 assert.deepEqual(C.mergeRecords(merged,old,known),merged);
});
test('无效导入不修改原记录，不接受数组或不一致计数',()=>{
 const old={'seq-1':{attempts:1,correct:0,lastCorrect:false,updatedAt:100}},snapshot=JSON.stringify(old);
 for(const value of [[],null,{'seq-1':{attempts:-1}}, {'seq-1':{attempts:1,correct:2,lastCorrect:true,updatedAt:1}}, {'seq-1':{attempts:1,correct:1,lastCorrect:false,updatedAt:1}}])assert.throws(()=>C.mergeRecords(old,value,known));
 assert.equal(JSON.stringify(old),snapshot);
});
test('混合小测：无重复、每章四题、分章筛选与短题池',()=>{
 for(let i=0;i<30;i++){
  const qs=C.selectQuestions(bank,12);assert.equal(new Set(qs.map(q=>q.id)).size,12);
  for(const chapter of ['1','2','3'])assert.equal(qs.filter(q=>q.section[0]===chapter).length,4);
 }
 const filtered=bank.filter(q=>q.section==='1.1');assert.equal(C.selectQuestions(filtered,12).length,filtered.length);
 assert.equal(C.selectQuestions([],12).length,0);
});
