const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const M = require("../calculus.js");
const near = (x, y, eps = 1e-10) => assert.ok(Math.abs(x - y) <= eps, x + " ≈ " + y);

test("左右差商趋于平方、指数函数的导数", () => {
  for (const model of ["square", "exponential"]) for (const a of [-2, -1, 0, 1, 2]) {
    const d = M.derivativeInfo(model, a, .001);
    near(d.derivative, model === "square" ? 2 * a : Math.exp(a));
    assert.ok(Math.abs(d.left - d.derivative) < .004);
    assert.ok(Math.abs(d.right - d.derivative) < .004);
  }
});
test("绝对值尖点不可导，离开尖点后可导", () => {
  const cusp = M.derivativeInfo("absolute", 0, .001);
  assert.equal(cusp.derivative, null);
  near(cusp.left, -1); near(cusp.right, 1);
  near(M.derivativeInfo("absolute", 1, .001).derivative, 1);
  near(M.derivativeInfo("absolute", -1, .001).derivative, -1);
});
test("利润解析最优点优于可行域采样，端点与亏损被保留", () => {
  for (const cost of [0, 4, 16, 20]) {
    const info = M.optimizationInfo("profit", 4, cost);
    for (let q = 0; q <= 20; q += .2) assert.ok(M.optimizationInfo("profit", q, cost).value <= info.optimumValue + 1e-9);
  }
  near(M.optimizationInfo("profit", 8, 4).slope, 0);
  near(M.optimizationInfo("profit", 0, 20).optimumValue, -20);
});
test("平均成本最低点满足 MC=AC，F>0", () => {
  for (const F of [1, 16, 100]) {
    const d = M.optimizationInfo("averageCost", Math.sqrt(F), F);
    near(d.slope, 0); near(d.value, d.marginal);
    for (const q of [.5, 2, 5, 15]) assert.ok(M.optimizationInfo("averageCost", q, F).value >= d.optimumValue - 1e-9);
  }
});
test("弹性与收入极值一致，需求为零时拒绝求值", () => {
  for (const b of [.5, 1, 2]) {
    const d = M.optimizationInfo("elasticity", 10 / b, b);
    near(d.elasticity, 1); near(d.slope, 0); near(d.value, d.optimumValue);
  }
  assert.throws(() => M.optimizationInfo("elasticity", 20, 1), RangeError);
});
test("黎曼和：单调函数左右估计，中点误差随 n 缩小", () => {
  const left = M.integralInfo("area", 2, 10, "left");
  const right = M.integralInfo("area", 2, 10, "right");
  near(left.exact, 8 / 3);
  assert.ok(left.approximation < left.exact && right.approximation > right.exact);
  assert.ok(M.integralInfo("area", 2, 100, "midpoint").error < M.integralInfo("area", 2, 10, "midpoint").error);
});
test("带符号积分正负抵消，线性函数中点和精确", () => {
  for (const n of [1, 2, 19, 100]) {
    const d = M.integralInfo("signedArea", 1, n, "midpoint");
    near(d.exact, 0); near(d.approximation, 0);
    near(M.integralInfo("signedArea", 2, n, "midpoint").approximation, 1.5);
  }
});
test("连续现金流：零利率单独处理，现值随正贴现率下降", () => {
  near(M.integralInfo("cashflow", 3, 10, "midpoint", 0).exact, 300);
  near(M.integralInfo("cashflow", 3, 10, "midpoint", 0).approximation, 300);
  const a = M.integralInfo("cashflow", 3, 100, "midpoint", .1);
  const b = M.integralInfo("cashflow", 3, 100, "midpoint", .2);
  assert.ok(b.exact < a.exact && a.exact < 300);
  assert.ok(a.error < .01);
});
test("基础函数：平移、复利和供需均衡", () => {
  const context = vm.createContext({ LessonRenderers: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../foundations.js"), "utf8"), context);
  const F = context.FoundationMath;
  near(F.transform(1, 1, -2), -2);
  near(F.interest(.1, 2).compound, 121);
  near(F.interest(.1, 2).simple, 120);
  near(F.market(20, 6).demand, 8); near(F.market(20, 6).supply, 8);
});
test("教材路线按照片对应前三章，18 节与全书六章齐全", () => {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, "../curriculum.json"), "utf8"));
  assert.deepEqual(c.chapters.slice(0,3).map(x=>x.title), ["函数", "极限与连续性", "导数与微分"]);
  assert.equal(c.chapters.length, 6);
  assert.deepEqual([1,2,3].map(n=>c.sections.filter(x=>x.chapter===n).length), [4,8,6]);
  assert.equal(new Set(c.sections.map(s=>s.number)).size, 18);
});
