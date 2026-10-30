(function (root) {
  "use strict";
  const M = root.CalculusMath;
  function plotCurve(api, c, fn, fill, dash) {
    let path = "";
    for (let i = 0; i <= 200; i++) {
      const x = c.xmin + (c.xmax - c.xmin) * i / 200, y = fn(x);
      path += (i ? "L" : "M") + c.sx(x).toFixed(2) + " " + c.sy(y).toFixed(2) + " ";
    }
    return '<path d="' + path + '" fill="none" stroke="' + fill + '" stroke-width="2" clip-path="url(#plot-clip)"' + (dash ? ' stroke-dasharray="6 5"' : "") + "/>";
  }
  function extent(values) {
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const span = Math.max(.5, max - min);
    return [min - span * .12, max + span * .18];
  }
  function methodButtons(state) {
    return '<p class="direction-label">矩形取样点</p><div class="direction-buttons" role="group" aria-label="积分取样方式">' +
      [["left", "左端点"], ["midpoint", "中点"], ["right", "右端点"]].map(function (p) {
        return '<button class="direction-button' + (state.method === p[0] ? " active" : "") + '" data-method="' + p[0] + '" aria-pressed="' + (state.method === p[0]) + '">' + p[1] + "</button>";
      }).join("") + "</div>";
  }
  const derivative = {
    controls: function (s, api) {
      return api.range("a-slider", "观察位置 a", -2, 2, .1, s.a, "移动 A 点，观察不同位置的变化率。") +
        api.range("h-slider", "两点距离 h", .001, 1, .001, s.h, "缩小 h，比较左右割线与切线。", [".001 · 更近", "1 · 更远"]);
    },
    tip: "自动演示会缩小 h；绝对值在尖点处没有导数。",
    finished: function (s) { return s.h <= .001; },
    advance: function (s) { s.h = Math.max(.001, Math.floor(s.h * .8 * 1000) / 1000); },
    restart: function (s) { s.h = 1; },
    chart: function (s, api) {
      const d = M.derivativeInfo(s.model, s.a, s.h), lo = s.a - 1.25, hi = s.a + 1.25;
      const values = Array.from({ length: 100 }, function (_, i) { return M.derivativeValue(s.model, lo + (hi - lo) * i / 99); });
      const ys = extent(values), c = api.chartBase(lo, hi, ys[0], ys[1], "x", "f(x)");
      let layers = plotCurve(api, c, function (x) { return M.derivativeValue(s.model, x); }, "#4b8068");
      layers += plotCurve(api, c, function (x) { return d.value + d.left * (x - s.a); }, "#c58a50");
      layers += plotCurve(api, c, function (x) { return d.value + d.right * (x - s.a); }, "#458da0");
      if (d.derivative !== null) layers += plotCurve(api, c, function (x) { return d.value + d.derivative * (x - s.a); }, "#176853", true);
      layers += api.dot(c, s.a, d.value, "#176853", true, "观察点 a=" + api.fmt(s.a));
      layers += api.dot(c, s.a - s.h, M.derivativeValue(s.model, s.a - s.h), "#c58a50", false, "左侧点");
      layers += api.dot(c, s.a + s.h, M.derivativeValue(s.model, s.a + s.h), "#458da0", false, "右侧点");
      api.setChart(c, layers, "当前 a=" + api.fmt(s.a) + "。左割线斜率=" + api.fmt(d.left) + "，右割线斜率=" + api.fmt(d.right) + "；导数" + (d.derivative === null ? "不存在。" : "为" + api.fmt(d.derivative)));
      api.metrics([["左割线斜率", api.fmt(d.left)], ["右割线斜率", api.fmt(d.right)], ["导数 f′(a)", d.derivative === null ? "不存在" : api.fmt(d.derivative), d.derivative === null]]);
      api.legend([["dot orange", "左割线"], ["dot blue", "右割线"], ["dash", "切线（若存在）"]]);
      api.$("chart-caption").textContent = "h → 0 · a = " + api.fmt(s.a);
      api.$("chart-footnote").textContent = "割线表示平均变化率；虚线表示解析切线。曲线与直线可能在 h 很小时重叠。";
      api.$("observation").textContent = d.derivative === null ? "a=0 时，左右斜率分别为 −1 与 1，没有共同极限，因此这里连续但不可导。" :
        "当前位置的导数为 " + api.fmt(d.derivative) + "。减小 h，观察两侧差商向这一数值靠近。微分近似为 dy=f′(a)dx。";
      if (s.model === "absolute") api.$("result-formula").innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>' + (d.derivative === null ? "a=0 时不可导" : "f′(a)=" + api.fmt(d.derivative) + "，a≠0") + "</mtext></math>";
    }
  };
  function optimizationRange(s) {
    return { min: s.model === "averageCost" ? .5 : 0, max: s.model === "elasticity" ? Math.floor(190 / s.parameter) / 10 : (s.model === "profit" ? 20 : 15) };
  }
  const optimization = {
    controls: function (s, api) {
      const r = optimizationRange(s), average = s.model === "averageCost", elasticity = s.model === "elasticity";
      return api.range("x-slider", elasticity ? "当前价格 P" : "当前产量 q", r.min, r.max, .1, s.x, elasticity ? "仅观察需求 Q>0 的价格区间。" : "绿色标记是解析得到的最优点。") +
        api.range("parameter-slider", average ? "固定成本 F" : (elasticity ? "需求斜率参数 b" : "单位可变成本 c"), average ? 1 : (elasticity ? .5 : 0), average ? 100 : (elasticity ? 2 : 20), average ? 1 : (elasticity ? .1 : .5), s.parameter, average ? "固定成本增加，会改变最低平均成本。" : (elasticity ? "Q=20−bP，b 越大需求对价格越敏感。" : "本例的固定成本 20 已发生且不可避免。"));
    },
    sync: function (s, api) {
      const r = optimizationRange(s); s.x = Math.min(r.max, Math.max(r.min, s.x));
      const slider = api.$("x-slider");
      if (slider) {
        slider.max = r.max;
        slider.closest(".slider-field").querySelector(".range-labels span:last-child").textContent = api.fmt(r.max);
      }
    },
    tip: "自动演示沿可行区间移动当前选择，观察边际变化。",
    finished: function (s) { return s.x >= optimizationRange(s).max; },
    advance: function (s) { s.x = Math.min(optimizationRange(s).max, Math.round((s.x + .5) * 10) / 10); },
    restart: function (s) { s.x = optimizationRange(s).min; },
    chart: function (s, api) {
      const d = M.optimizationInfo(s.model, s.x, s.parameter), r = optimizationRange(s);
      const fn = function (x) { return M.optimizationInfo(s.model, x, s.parameter).value; };
      const values = Array.from({ length: 100 }, function (_, i) { return fn(r.min + (r.max - r.min) * i / 99); });
      const ys = extent(values.concat([0, d.optimumValue])), c = api.chartBase(r.min, r.max, ys[0], ys[1], s.model === "elasticity" ? "P" : "q", s.model === "profit" ? "π" : (s.model === "averageCost" ? "AC" : "R"));
      let layers = plotCurve(api, c, fn, "#247b5d");
      layers += plotCurve(api, c, function (x) { return d.value + d.slope * (x - s.x); }, "#c58a50", true);
      layers += api.line(c.sx(d.optimum), c.top, c.sx(d.optimum), c.bottom, "#a6bc93", 'stroke-dasharray="4 5"');
      layers += api.dot(c, d.optimum, d.optimumValue, "#176853", true, "最优选择=" + api.fmt(d.optimum));
      layers += api.dot(c, s.x, d.value, "#c58a50", true, "当前选择=" + api.fmt(s.x));
      layers += api.svgText(c.sx(d.optimum) + 7, c.top + 13, "最优点 " + api.fmt(d.optimum, 2));
      api.setChart(c, layers, "当前选择=" + api.fmt(s.x) + "，目标值=" + api.fmt(d.value) + "，导数=" + api.fmt(d.slope) + "。最优选择为" + api.fmt(d.optimum));
      api.metrics([[s.model === "profit" ? "当前利润 π" : (s.model === "averageCost" ? "平均成本 AC" : "当前收入 R"), api.fmt(d.value)], [s.model === "elasticity" ? "需求弹性绝对值 |E|" : "当前导数", api.fmt(s.model === "elasticity" ? d.elasticity : d.slope)], [s.model === "elasticity" ? "最优价格 P*" : "最优产量 q*", api.fmt(d.optimum)]]);
      api.legend([["dot", "目标曲线 / 最优点"], ["dot orange", "当前选择 / 切线"]]);
      api.$("chart-caption").textContent = "最优值 = " + api.fmt(d.optimumValue);
      api.$("chart-footnote").textContent = "曲线采用明确的教学模型，解析求解并检查可行域；图像不代替最优性证明。";
      let observation = "";
      if (s.model === "profit") observation = "MR−MC=" + api.fmt(d.slope) + "。" + (Math.abs(d.slope) < .0001 ? "已到利润最大点。" : (d.slope > 0 ? "当前小幅增产有利于提高利润。" : "当前小幅减产有利于提高利润。")) + "最大利润为 " + api.fmt(d.optimumValue) + "，也可能为负。";
      else if (s.model === "averageCost") observation = "当前 MC=" + api.fmt(d.marginal) + "，AC=" + api.fmt(d.value) + "。当 q=√F=" + api.fmt(d.optimum) + "，两者相等，平均成本最低。";
      else observation = "|E|=" + api.fmt(d.elasticity) + "。" + (Math.abs(d.elasticity - 1) < .0001 ? "单位弹性，此时收入最大。" : (d.elasticity < 1 ? "缺乏弹性，小幅提价增加收入。" : "富有弹性，小幅提价减少收入。")) + "这里讨论收入，不直接判断利润。";
      api.$("observation").textContent = observation;
    }
  };
  const integral = {
    controls: function (s, api) {
      return api.range("n-slider", "矩形个数 n", 1, 100, 1, s.n, "增加分割数，观察近似与精确值的差距。") +
        api.range("upper-slider", s.model === "cashflow" ? "期限 T（年）" : "积分上界 b", .1, s.model === "cashflow" ? 10 : 3, .1, s.upper, s.model === "signedArea" ? "下界固定为 −1；轴下的矩形贡献为负。" : "下界固定为 0。") +
        (s.model === "cashflow" ? api.range("rate-slider", "连续贴现率 r", 0, .3, .01, s.rate, "0.1 表示 10%；可直接观察 r=0 的情形。") : "") + methodButtons(s);
    },
    tip: "自动演示逐个增加矩形；精确值来自原函数。",
    finished: function (s) { return s.n >= 100; },
    advance: function (s) { s.n = Math.min(100, s.n + 1); },
    restart: function (s) { s.n = 1; },
    chart: function (s, api) {
      const d = M.integralInfo(s.model, s.upper, s.n, s.method, s.rate);
      const ylow = s.model === "signedArea" ? -1.3 : -.08 * (s.model === "cashflow" ? 100 : s.upper * s.upper);
      const yhigh = s.model === "cashflow" ? 115 : (s.model === "signedArea" ? Math.max(1.3, s.upper * 1.2) : Math.max(.1, s.upper * s.upper * 1.2));
      const c = api.chartBase(d.lower, d.upper, ylow, yhigh, s.model === "cashflow" ? "t" : "x", "f(x)");
      let layers = "";
      d.rectangles.forEach(function (r) {
        layers += '<rect x="' + c.sx(r.left) + '" y="' + c.sy(Math.max(0, r.height)) + '" width="' + Math.max(.1, c.sx(r.left + r.width) - c.sx(r.left)) + '" height="' + Math.abs(c.sy(r.height) - c.sy(0)) + '" fill="' + (r.height < 0 ? "#e8c9a9" : "#cce2bc") + '" stroke="white" stroke-width=".6" opacity=".8"><title>取样值 ' + api.fmt(r.height) + "，面积贡献 " + api.fmt(r.height * r.width) + "</title></rect>";
      });
      layers += plotCurve(api, c, function (x) { return M.integrand(s.model, x, s.rate); }, "#247b5d");
      api.setChart(c, layers, "分割数" + s.n + "，近似积分" + api.fmt(d.approximation) + "，精确积分" + api.fmt(d.exact) + "，绝对误差" + api.fmt(d.error));
      api.metrics([["矩形和（近似）", api.fmt(d.approximation)], ["定积分（精确）", api.fmt(d.exact)], ["绝对误差", api.fmt(d.error, 6)]]);
      api.legend([["dot", "被积函数"], ["band", "正面积贡献"], ["dot orange", "负面积贡献"]]);
      api.$("chart-caption").textContent = "Δx = " + api.fmt(d.width, 3);
      api.$("chart-footnote").textContent = "矩形和是数值近似；定积分是带符号的累计量。部分模型和取样法可能恰好算出精确值。";
      api.$("observation").textContent = (s.model === "signedArea" ? "轴下矩形记负号，轴上记正号。" : (s.model === "cashflow" && s.rate === 0 ? "r=0 时不贴现，精确现值为 100T。" : "")) +
        "当前 n=" + s.n + "，" + { left: "左端点", midpoint: "中点", right: "右端点" }[s.method] + "取样的误差为 " + api.fmt(d.error, 6) + "。精确值不会随分割数变化。";
    }
  };
  root.LessonRenderers = { derivative, optimization, integral };
})(globalThis);
