const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const M = require("../math.js");
const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, a + " ≈ " + b);

test("数列：首项、交错符号和复利终值", () => {
  near(M.sequenceValue("reciprocal", 1), 1);
  near(M.sequenceValue("reciprocal", 100), .01);
  near(M.sequenceValue("alternating", 1), -1);
  near(M.sequenceValue("alternating", 2), .5);
  near(M.sequenceValue("compound", 1), 2);
  near(M.sequenceValue("compound", 2), 2.25);
  assert.equal(M.sequenceLimit("compound"), Math.E);
});

test("ε–N：严格边界，n=N 不一定满足，n>N 满足", () => {
  const N = M.sequenceThreshold("reciprocal", .1);
  assert.equal(N, 10);
  assert.equal(M.sequenceValue("reciprocal", N), .1);
  assert.ok(M.sequenceValue("reciprocal", N + 1) < .1);
  for (let hundredths = 1; hundredths <= 50; hundredths++) {
    const epsilon = hundredths / 100;
    for (const model of ["reciprocal", "alternating", "compound"]) {
      const threshold = M.sequenceThreshold(model, epsilon);
      for (const n of [threshold + 1, threshold + 2, threshold + 50, 10000]) {
        assert.ok(Math.abs(M.sequenceValue(model, n) - M.sequenceLimit(model)) < epsilon);
      }
    }
  }
});

test("连续复利数列递增、有上界，解析误差界有效", () => {
  let last = 0;
  for (let n = 1; n <= 1000; n++) {
    const value = M.sequenceValue("compound", n);
    assert.ok(value > last && value < Math.E);
    assert.ok(Math.E - value < Math.E / (2 * n));
    last = value;
  }
});

test("函数：正确保留原函数空心点", () => {
  assert.equal(M.functionValue("hole", 1), null);
  assert.equal(M.functionValue("sinc", 0), null);
  assert.equal(M.functionValue("jump", 0), null);
  near(M.functionValue("hole", .999), 1.999);
  near(M.functionValue("hole", 1.001), 2.001);
  near(M.functionValue("sinc", .001), .9999998333333416);
});

test("函数：左右极限不能用平均数代替", () => {
  const info = M.functionInfo("jump", .1);
  assert.equal(info.limit, null);
  assert.equal(info.delta, null);
  assert.equal(info.left, -1);
  assert.equal(info.right, 1);
  for (const h of [1, .1, .001, 1e-8]) {
    assert.equal(M.functionValue("jump", -h), -1);
    assert.equal(M.functionValue("jump", h), 1);
  }
});

test("ε–δ：可去间断与 sinc 的充分 δ 满足误差要求", () => {
  for (const model of ["hole", "sinc"]) {
    for (let hundredths = 1; hundredths <= 50; hundredths++) {
      const epsilon = hundredths / 100;
      const info = M.functionInfo(model, epsilon);
      for (const ratio of [-.999, -.5, -.001, .001, .5, .999]) {
        const x = info.a + info.delta * ratio;
        assert.ok(Math.abs(M.functionValue(model, x) - info.limit) < epsilon);
      }
    }
  }
});

test("几何级数从 q⁰ 起，n 是项数", () => {
  assert.deepEqual(M.partialSums("geometric", 4, .5), [1, 1.5, 1.75, 1.875]);
  assert.deepEqual(M.partialSums("geometric", 4, -.5), [1, .5, .75, .625]);
  const info = M.seriesInfo("geometric", 4, .5);
  near(info.limit, 2);
  near(info.error, .125);
});

test("几何级数：负公比、零和 ±1 的边界", () => {
  for (const q of [-1.2, -1, 1, 1.2]) {
    assert.equal(M.seriesInfo("geometric", 100, q).converges, false);
    assert.equal(M.seriesInfo("geometric", 100, q).limit, null);
    assert.equal(M.seriesInfo("geometric", 100, q).error, null);
  }
  assert.deepEqual(M.partialSums("geometric", 4, -1), [1, 0, 1, 0]);
  assert.deepEqual(M.partialSums("geometric", 4, 1), [1, 2, 3, 4]);
  assert.deepEqual(M.partialSums("geometric", 4, 0), [1, 1, 1, 1]);
  for (const q of [-.95, -.5, 0, .5, .95]) {
    const info = M.seriesInfo("geometric", 30, q);
    assert.equal(info.converges, true);
    near(info.sum, (1 - q ** 30) / (1 - q));
    near(info.error, Math.abs(q ** 30 / (1 - q)));
  }
});

test("调和级数：有限样本不能错误报告收敛", () => {
  near(M.seriesInfo("harmonic", 3).sum, 11 / 6);
  for (const n of [1, 10, 100, 10000]) {
    const info = M.seriesInfo("harmonic", n);
    assert.equal(info.converges, false);
    assert.ok(info.sum >= Math.log(n + 1));
  }
});

test("交错调和级数：首项、极限、下一项误差界", () => {
  near(M.seriesInfo("alternatingHarmonic", 1).sum, 1);
  near(M.seriesInfo("alternatingHarmonic", 2).sum, .5);
  for (let n = 1; n <= 100; n++) {
    const info = M.seriesInfo("alternatingHarmonic", n);
    assert.equal(info.limit, Math.LN2);
    assert.ok(info.error <= info.bound);
    near(info.bound, 1 / (n + 1));
  }
});

test("答题输入：支持分数、科学计数法，拒绝空白、表达式和无限值", () => {
  for (const value of ["2", "2.000", "4/2", " 2e0 "]) assert.equal(M.checkAnswer(value, 2), true);
  near(M.parseAnswer("1 / 2"), .5);
  for (const value of ["", " ", "Infinity", "1/0", "2+2", "alert(1)", "1/2/3", "NaN", "1e999"]) {
    assert.equal(M.checkAnswer(value, 2), false);
  }
  assert.equal(M.checkAnswer("9.9999", 10, 0), false);
  assert.equal(M.checkAnswer("10", 10, 0), true);
});

test("数学接口拒绝非法项数和未知模型", () => {
  assert.throws(() => M.sequenceValue("reciprocal", 0), RangeError);
  assert.throws(() => M.partialSums("geometric", 1.5, .5), RangeError);
  assert.throws(() => M.sequenceThreshold("reciprocal", 0), RangeError);
  assert.throws(() => M.functionValue("unknown", 1), RangeError);
  assert.throws(() => M.sequenceValue("unknown", 1), RangeError);
});

test("课程结构：课程结构、步骤与题目答案完整", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../lessons.js"), "utf8"), context);
  const chapters = Object.values(context.Lessons);
  assert.equal(chapters.length, 8);
  const ids = new Set();
  for (const chapter of chapters) {
    assert.ok(chapter.models.length >= 1);
    assert.ok(chapter.questions.length >= 1);
    for (const model of chapter.models) {
      assert.equal(model.steps.length, 4);
      assert.ok(model.formula.startsWith("<math"));
      assert.ok(model.result.startsWith("<math"));
    }
    for (const question of chapter.questions) {
      assert.ok(!ids.has(question.id));
      ids.add(question.id);
      assert.ok(question.hint && question.explanation);
      if (question.type === "choice") assert.ok(question.answer >= 0 && question.answer < question.choices.length);
    }
  }
  assert.equal(ids.size, 44);
});
