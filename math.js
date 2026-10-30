(function (root) {
  "use strict";
  function sequenceValue(model, n) {
    if (!Number.isInteger(n) || n < 1) throw new RangeError("n 必须为正整数");
    if (model === "reciprocal") return 1 / n;
    if (model === "alternating") return (n % 2 ? -1 : 1) / n;
    if (model === "compound") return Math.exp(n * Math.log1p(1 / n));
    throw new RangeError("未知数列");
  }
  function sequenceLimit(model) {
    if (!["reciprocal", "alternating", "compound"].includes(model)) throw new RangeError("未知数列");
    return model === "compound" ? Math.E : 0;
  }
  function sequenceThreshold(model, epsilon) {
    if (!(epsilon > 0)) throw new RangeError("ε 必须为正数");
    return Math.floor((model === "compound" ? Math.E / 2 : 1) / epsilon);
  }
  function functionValue(model, x) {
    if (model === "hole") return x === 1 ? null : x + 1;
    if (model === "sinc") return x === 0 ? null : Math.sin(x) / x;
    if (model === "jump") return x === 0 ? null : (x < 0 ? -1 : 1);
    throw new RangeError("未知函数");
  }
  function functionInfo(model, epsilon) {
    if (model === "hole") return { a: 1, limit: 2, left: 2, right: 2, delta: epsilon };
    if (model === "sinc") return { a: 0, limit: 1, left: 1, right: 1, delta: Math.min(1, Math.sqrt(6 * epsilon)) };
    if (model === "jump") return { a: 0, limit: null, left: -1, right: 1, delta: null };
    throw new RangeError("未知函数");
  }
  function seriesTerm(model, k, q) {
    if (model === "geometric") return Math.pow(q, k - 1);
    if (model === "harmonic") return 1 / k;
    if (model === "alternatingHarmonic") return (k % 2 ? 1 : -1) / k;
    throw new RangeError("未知级数");
  }
  function partialSums(model, n, q) {
    if (!Number.isInteger(n) || n < 1) throw new RangeError("n 必须为正整数");
    let sum = 0;
    return Array.from({ length: n }, function (_, i) {
      sum += seriesTerm(model, i + 1, q);
      return sum;
    });
  }
  function seriesInfo(model, n, q) {
    const sums = partialSums(model, n, q);
    const sum = sums[n - 1];
    const limit = model === "geometric" ? (Math.abs(q) < 1 ? 1 / (1 - q) : null) :
      (model === "alternatingHarmonic" ? Math.LN2 : null);
    return { sums: sums, sum: sum, limit: limit, converges: limit !== null,
      error: limit === null ? null : Math.abs(sum - limit),
      bound: model === "alternatingHarmonic" ? 1 / (n + 1) : null };
  }
  function parseAnswer(value) {
    const s = String(value).trim();
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return Number(s);
    const fraction = s.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
    if (fraction && Number(fraction[2]) !== 0) return Number(fraction[1]) / Number(fraction[2]);
    return NaN;
  }
  function checkAnswer(value, answer, tolerance) {
    const parsed = parseAnswer(value);
    return Number.isFinite(parsed) && Math.abs(parsed - answer) <= (tolerance === undefined ? 0.001 : tolerance);
  }
  const api = { sequenceValue, sequenceLimit, sequenceThreshold, functionValue, functionInfo,
    seriesTerm, partialSums, seriesInfo, parseAnswer, checkAnswer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CalcMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
