(function (root) {
  "use strict";
  function derivativeValue(model, x) {
    if (model === "square") return x * x;
    if (model === "exponential") return Math.exp(x);
    if (model === "absolute") return Math.abs(x);
    throw new RangeError("未知导数模型");
  }
  function derivativeInfo(model, a, h) {
    if (!(h > 0)) throw new RangeError("h 必须大于 0");
    const value = derivativeValue(model, a);
    let derivative;
    if (model === "square") derivative = 2 * a;
    else if (model === "exponential") derivative = value;
    else derivative = a === 0 ? null : (a < 0 ? -1 : 1);
    const left = model === "exponential" ? value * -Math.expm1(-h) / h :
      (value - derivativeValue(model, a - h)) / h;
    const right = model === "exponential" ? value * Math.expm1(h) / h :
      (derivativeValue(model, a + h) - value) / h;
    return { value, left, right, derivative };
  }
  function optimizationInfo(model, x, parameter) {
    if (model === "profit") {
      // inverse demand P(q)=20-q, C(q)=c*q+20, 0<=q<=20
      const c = parameter;
      return { value: (20 - c) * x - x * x - 20, slope: 20 - c - 2 * x,
        optimum: Math.max(0, (20 - c) / 2), optimumValue: Math.pow(Math.max(0, 20 - c), 2) / 4 - 20 };
    }
    if (model === "averageCost") {
      if (!(x > 0) || !(parameter > 0)) throw new RangeError("产量和固定成本必须为正");
      const fixed = parameter;
      return { value: fixed / x + 2 + x, slope: 1 - fixed / (x * x),
        optimum: Math.sqrt(fixed), optimumValue: 2 + 2 * Math.sqrt(fixed), marginal: 2 + 2 * x };
    }
    if (model === "elasticity") {
      // Q=20-bP, valid only when Q>0
      const b = parameter, quantity = 20 - b * x;
      if (!(quantity > 0) || !(b > 0)) throw new RangeError("需求量必须为正");
      return { value: x * quantity, slope: 20 - 2 * b * x, quantity,
        elasticity: b * x / quantity, optimum: 10 / b, optimumValue: 100 / b };
    }
    throw new RangeError("未知应用模型");
  }
  function integrand(model, x, rate) {
    if (model === "area") return x * x;
    if (model === "signedArea") return x;
    if (model === "cashflow") return 100 * Math.exp(-rate * x);
    throw new RangeError("未知积分模型");
  }
  function integralInfo(model, upper, n, method, rate) {
    if (!Number.isInteger(n) || n < 1 || !(upper > 0)) throw new RangeError("区间上界和分割数必须为正");
    if (!["left", "midpoint", "right"].includes(method)) throw new RangeError("未知黎曼和方法");
    const lower = model === "signedArea" ? -1 : 0;
    const width = (upper - lower) / n, shift = { left: 0, midpoint: .5, right: 1 }[method];
    let approximation = 0;
    const rectangles = Array.from({ length: n }, function (_, i) {
      const left = lower + i * width, sample = left + shift * width;
      const height = integrand(model, sample, rate);
      approximation += height * width;
      return { left, width, height, sample };
    });
    let exact;
    if (model === "area") exact = upper ** 3 / 3;
    else if (model === "signedArea") exact = (upper * upper - 1) / 2;
    else exact = rate === 0 ? 100 * upper : -100 * Math.expm1(-rate * upper) / rate;
    return { lower, upper, width, approximation, exact, rectangles, error: Math.abs(exact - approximation) };
  }
  const api = { derivativeValue, derivativeInfo, optimizationInfo, integrand, integralInfo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CalculusMath = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
