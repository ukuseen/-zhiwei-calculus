(function (root) {
  "use strict";
  const F = {
    transform: function (x, a, b) { return (x - a) ** 2 + b; },
    interest: function (rate, years) { return { simple: 100 * (1 + rate * years), compound: 100 * (1 + rate) ** years }; },
    market: function (demandIntercept, price) { return { demand: demandIntercept - 2 * price, supply: 2 + price, equilibriumPrice: (demandIntercept - 2) / 3, equilibriumQuantity: (demandIntercept + 4) / 3 }; }
  };
  root.FoundationMath = F;
  function curve(c, fn, stroke, lo, hi, dash) {
    let path = "";
    for (let i = 0; i <= 180; i++) {
      const x = lo + (hi - lo) * i / 180;
      path += (i ? "L" : "M") + c.sx(x).toFixed(2) + " " + c.sy(fn(x)).toFixed(2) + " ";
    }
    return '<path d="' + path + '" fill="none" stroke="' + stroke + '" stroke-width="2" clip-path="url(#plot-clip)"' + (dash ? ' stroke-dasharray="5 5"' : "") + "/>";
  }
  root.LessonRenderers.foundations = {
    controls: function (s, api) {
      if (s.model === "transform") return api.range("a-slider", "水平平移 a", -2, 2, .1, s.a, "f(x)=(x−a)²+b，a>0 向右平移。") + api.range("parameter-slider", "竖直平移 b", -2, 2, .1, s.parameter, "b 决定最低点的高度。") + api.range("x-slider", "代入的自变量 x", -3, 3, .1, s.x, "观察同一个规则如何把 x 映射为 f(x)。");
      if (s.model === "inverse") return api.range("a-slider", "原函数的输入 x", -1.5, 1.5, .1, s.a, "点 (x,eˣ) 交换横纵坐标后落在 ln x 上。");
      if (s.model === "interest") return api.range("x-slider", "存款年数 t", 1, 10, 1, s.x, "本金固定 100，复利按年计息。") + api.range("rate-slider", "年利率 r", 0, .2, .01, s.rate, "0.05 表示 5%；单利与复利采用相同利率。");
      return api.range("x-slider", "当前价格 P", 0, s.parameter / 2, .1, s.x, "只观察需求量非负的范围。") + api.range("parameter-slider", "需求截距 A", 10, 30, 1, s.parameter, "需求 Qd=A−2P，供给 Qs=2+P。");
    },
    sync: function (s, api) {
      if (s.model === "market") {
        s.x = Math.min(s.parameter / 2, s.x);
        if (api.$("x-slider")) {
          api.$("x-slider").max = s.parameter / 2;
          api.$("x-slider").closest(".slider-field").querySelector(".range-labels span:last-child").textContent = api.fmt(s.parameter / 2);
        }
      }
    },
    tip: "自动演示会移动当前输入，观察函数对应关系。",
    finished: function (s) { return s.model === "inverse" ? s.a >= 1.5 : s.x >= (s.model === "transform" ? 3 : (s.model === "interest" ? 10 : s.parameter / 2)); },
    advance: function (s) {
      if (s.model === "inverse") s.a = Math.min(1.5, Math.round((s.a + .1) * 10) / 10);
      else s.x = Math.min(s.model === "transform" ? 3 : (s.model === "interest" ? 10 : s.parameter / 2), Math.round((s.x + (s.model === "interest" ? 1 : .2)) * 10) / 10);
    },
    restart: function (s) { if (s.model === "inverse") s.a = -1.5; else s.x = s.model === "transform" ? -3 : (s.model === "interest" ? 1 : 0); },
    chart: function (s, api) {
      let c, layers = "", observation, description;
      if (s.model === "transform") {
        const value = F.transform(s.x, s.a, s.parameter), ymax = Math.max(12, value + 2);
        c = api.chartBase(-4, 4, -3, ymax, "x", "y");
        layers = curve(c, function (x) { return F.transform(x, s.a, s.parameter); }, "#247b5d", -4, 4);
        layers += api.line(c.sx(s.a), c.top, c.sx(s.a), c.bottom, "#a4b897", 'stroke-dasharray="4 5"');
        layers += api.dot(c, s.a, s.parameter, "#247b5d", true, "顶点");
        layers += api.dot(c, s.x, value, "#c58a50", true, "当前代入值");
        api.metrics([["自变量 x", api.fmt(s.x)], ["函数值 f(x)", api.fmt(value)], ["最小值 / 值域下界", api.fmt(s.parameter)]]);
        observation = "定义域为 R，值域为 [" + api.fmt(s.parameter) + ",+∞)。对称轴 x=" + api.fmt(s.a) + "。改变 a、b 会平移图像；自变量仍可取任意实数。";
        description = "函数平移，当前 x=" + s.x + "，f(x)=" + value;
        api.legend([["dot", "函数与顶点"], ["dot orange", "当前输入对应的输出"]]);
      } else if (s.model === "inverse") {
        c = api.chartBase(-2, 5, -2, 5, "x", "y");
        layers = curve(c, Math.exp, "#247b5d", -2, 2) + curve(c, Math.log, "#c58a50", .04, 5) + curve(c, function (x) { return x; }, "#9dac8c", -2, 5, true);
        layers += api.dot(c, s.a, Math.exp(s.a), "#247b5d", true, "指数函数点");
        layers += api.dot(c, Math.exp(s.a), s.a, "#c58a50", true, "反函数点");
        api.metrics([["原输入 x", api.fmt(s.a)], ["原输出 eˣ", api.fmt(Math.exp(s.a))], ["反向还原 ln(eˣ)", api.fmt(s.a)]]);
        observation = "eˣ 的定义域 R、值域 (0,+∞)，正好对应 ln x 的值域与定义域。反函数交换输入和输出，不是取倒数 1/f(x)。";
        description = "指数函数和对数函数，点关于 y=x 对称";
        api.legend([["dot", "eˣ"], ["dot orange", "ln x"], ["dash", "y=x"]]);
      } else if (s.model === "interest") {
        const d = F.interest(s.rate, s.x), top = F.interest(s.rate, 10).compound * 1.12;
        c = api.chartBase(0, 10, 80, Math.max(125, top), "t", "本利和");
        layers = curve(c, function (t) { return F.interest(s.rate, t).compound; }, "#247b5d", 0, 10) + curve(c, function (t) { return F.interest(s.rate, t).simple; }, "#c58a50", 0, 10);
        for (let i = 0; i <= 10; i++) layers += api.dot(c, i, F.interest(s.rate, i).compound, "#247b5d", i === s.x, "第" + i + "年");
        api.metrics([["单利终值", api.fmt(d.simple, 2)], ["复利终值", api.fmt(d.compound, 2)], ["复利多出的金额", api.fmt(d.compound - d.simple, 2)]]);
        observation = "单利 B=100(1+rt)，复利 B=100(1+r)ᵗ。这里按年计息，整数点代表实际年末值；同利率下复利把利息计入下一年的本金。";
        description = "第" + s.x + "年单利" + d.simple + "复利" + d.compound;
        api.legend([["dot", "按年复利"], ["dot orange", "单利"]]);
      } else {
        const d = F.market(s.parameter, s.x);
        c = api.chartBase(0, s.parameter / 2, 0, s.parameter * 1.15, "P", "Q");
        layers = curve(c, function (p) { return F.market(s.parameter, p).demand; }, "#247b5d", 0, s.parameter / 2) + curve(c, function (p) { return F.market(s.parameter, p).supply; }, "#c58a50", 0, s.parameter / 2);
        layers += api.dot(c, d.equilibriumPrice, d.equilibriumQuantity, "#247b5d", true, "市场均衡");
        layers += api.line(c.sx(s.x), c.sy(d.demand), c.sx(s.x), c.sy(d.supply), "#7e9871", 'stroke-dasharray="3 3"');
        api.metrics([["需求量 Qd", api.fmt(d.demand)], ["供给量 Qs", api.fmt(d.supply)], ["均衡价格 P*", api.fmt(d.equilibriumPrice)]]);
        observation = "本图横轴为价格 P，纵轴为数量 Q。当前" + (Math.abs(d.demand - d.supply) < .0001 ? "供需相等。" : (d.demand > d.supply ? "需求大于供给，存在短缺。" : "供给大于需求，存在过剩。")) + "求解 Qd=Qs 得均衡价格 (A−2)/3。";
        description = "市场均衡价格" + d.equilibriumPrice + "，当前需求量" + d.demand + "，供给量" + d.supply;
        api.legend([["dot", "需求"], ["dot orange", "供给"]]);
      }
      api.setChart(c, layers, description);
      api.$("observation").textContent = observation;
      api.$("chart-caption").textContent = "教材第 1 章 · 函数";
      api.$("chart-footnote").textContent = "先识别自变量、定义域和对应规则，再讨论图像与经济含义。";
    }
  };
})(globalThis);
