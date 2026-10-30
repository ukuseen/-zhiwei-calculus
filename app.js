(function () {
  "use strict";
  const M = window.CalcMath, lessons = window.Lessons;
  const chapterIds = Object.keys(lessons);
  const $ = function (id) { return document.getElementById(id); };
  const state = { chapter: chapterIds[0], model: lessons[chapterIds[0]].models[0].id, n: 20, epsilon: 0.1, h: 0.5, q: 0.5, direction: "both", explanation: 0, question: 0, playing: false };
  const storageKey = "zhiwei-progress-v1";
  const knownQuestions = Object.values(lessons).flatMap(function (c) { return c.questions.map(function (q) { return q.id; }); });
  let completed = new Set(), storageAvailable = true, timer = null;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(stored)) completed = new Set(stored.filter(function (id) { return knownQuestions.includes(id); }));
  } catch (_) { storageAvailable = false; }
  function chapter() { return lessons[state.chapter]; }
  function model() { return chapter().models.find(function (m) { return m.id === state.model; }); }
  function kind() { return chapter().renderer || state.chapter; }
  function renderer() { return window.LessonRenderers[kind()] || null; }
  function api() { return { $, range, fmt, chartBase, setChart, line, dot, svgText, metrics, legend }; }
  function fmt(v, places) {
    if (v === null || !Number.isFinite(v)) return "—";
    if (Math.abs(v) >= 100000 || (v !== 0 && Math.abs(v) < 0.00001)) return v.toExponential(2).replace("e+", "e");
    return Number(v.toFixed(places === undefined ? 4 : places)).toString();
  }
  function htmlEscape(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function defaults() {
    Object.assign(state, {n:20, epsilon:.1, h:.5, q:.5, direction:"both", explanation:0, a:1, x:4, parameter:4, upper:2, rate:.1, method:"midpoint"}, chapter().defaults || {}, model().defaults || {});
  }
  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null; state.playing = false;
    $("play-button").innerHTML = '<span class="play-icon">▶</span>自动演示';
    $("play-button").setAttribute("aria-pressed", "false");
  }
  function switchChapter(key) {
    if (!lessons[key]) return;
    stop(); state.chapter = key; state.model = chapter().models[0].id; state.question = 0; defaults(); renderChapter();
    try { history.replaceState(null, "", "#chapter/" + key); } catch (_) {}
  }
  function switchModel(key) {
    stop(); state.model = key; defaults(); renderModels(); renderControls(); renderLesson(); updateVisualization();
  }
  function renderChapter() {
    const c = chapter();
    document.querySelectorAll("[data-chapter]").forEach(function (b) {
      const active = b.dataset.chapter === state.chapter;
      b.classList.toggle("active", active);
      if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    $("breadcrumb-current").textContent = c.title;
    $("chapter-title").innerHTML = c.title + '<span class="title-dot">.</span>';
    $("chapter-label").textContent = c.number === "拓展" ? "拓展实验" : "教材第 " + c.number + " 章";
    $("chapter-english").textContent = c.en;
    $("chapter-subtitle").textContent = c.subtitle;
    $("chapter-description").textContent = c.description;
    $("chart-title").textContent = c.chartTitle;
    $("chart-subtitle").textContent = c.chartSubtitle;
    $("definition-formula").innerHTML = c.definition;
    $("definition-text").textContent = c.concept;
    document.title = c.title + " · 知微高数实验室";
    renderModels(); renderControls(); renderLesson(); updateVisualization(); renderQuestion(); renderProgress();
  }
  function renderModels() {
    $("model-tabs").innerHTML = chapter().models.map(function (m) {
      const active = m.id === state.model;
      return '<button class="model-tab' + (active ? " active" : "") + '" data-model="' + m.id + '" aria-pressed="' + active + '">' + m.label + "<span>" + m.short + "</span></button>";
    }).join("");
  }
  function range(id, label, min, max, step, value, help, ends) {
    return '<div class="slider-field"><div class="slider-label"><label for="' + id + '">' + label + '</label><output id="' + id + '-value" for="' + id + '">' + fmt(value, 3) + '</output></div><input class="slider" id="' + id + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"><div class="range-labels"><span>' + (ends ? ends[0] : min) + "</span><span>" + (ends ? ends[1] : max) + '</span></div><p class="control-help">' + help + "</p></div>";
  }
  function renderControls() {
    let html = "";
    if (renderer()) {
      html = renderer().controls(state, api());
      $("control-tip").textContent = renderer().tip;
    } else if (kind() === "sequence") {
      html += range("n-slider", "观察项数 n", 1, 100, 1, state.n, "让更多的项出现在图中。");
      html += range("epsilon-slider", "允许误差 ε", 0.01, 0.5, 0.01, state.epsilon, "绿色带越窄，对「靠近」的要求越高。");
      $("control-tip").textContent = "试着减小 ε，看看 N 如何变化。";
    } else if (kind() === "function") {
      html += range("h-slider", "趋近距离 h", 0.001, 1, 0.001, state.h, "h 越小，x 离趋近点越近。", ["0.001 · 更近", "1 · 更远"]);
      if (state.model !== "jump") html += range("epsilon-slider", "允许误差 ε", 0.01, 0.5, 0.01, state.epsilon, "观察绿色 ε 带与蓝色 δ 区间。");
      html += '<p class="direction-label">趋近方向</p><div class="direction-buttons" role="group" aria-label="趋近方向">' + [["left", "从左侧"], ["both", "两侧同时"], ["right", "从右侧"]].map(function (pair) {
        return '<button class="direction-button' + (state.direction === pair[0] ? " active" : "") + '" data-direction="' + pair[0] + '" aria-pressed="' + (state.direction === pair[0]) + '">' + pair[1] + "</button>";
      }).join("") + "</div>";
      $("control-tip").textContent = "自动演示会逐渐缩小 h，靠近目标点。";
    } else {
      html += range("n-slider", "累加项数 n", 1, 100, 1, state.n, "图中展示前 n 项和，而非单个通项。");
      if (state.model === "geometric") html += range("q-slider", "公比 q", -1.2, 1.2, 0.05, state.q, "试试负公比，以及 q = ±1 的边界。");
      else html += '<div class="control-help" style="margin-bottom:24px;line-height:2">本例的通项固定。<br>增加项数，观察部分和是否趋于有限值。</div>';
      $("control-tip").textContent = "增加项数，观察部分和的长期趋势。";
    }
    $("controls").innerHTML = html;
    updateControlValues();
  }
  function updateControlValues() {
    [["n-slider", state.n], ["epsilon-slider", state.epsilon], ["h-slider", state.h], ["q-slider", state.q], ["a-slider", state.a], ["x-slider", state.x], ["parameter-slider", state.parameter], ["upper-slider", state.upper], ["rate-slider", state.rate]].forEach(function (pair) {
      const input = $(pair[0]); if (!input) return;
      input.value = pair[1]; $(pair[0] + "-value").textContent = fmt(pair[1], 3);
      const progress = 100 * (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
      input.style.setProperty("--range-progress", progress + "%");
    });
    $("step-button").disabled = renderer() ? renderer().finished(state) : (kind() === "function" ? state.h <= 0.001 : state.n >= 100);
  }
  function renderLesson() {
    const m = model(), step = m.steps[state.explanation];
    $("model-formula").innerHTML = m.formula;
    $("result-formula").innerHTML = m.result;
    $("economics-title").textContent = m.economics[0];
    $("economics-body").textContent = m.economics[1];
    $("step-count").textContent = String(state.explanation + 1).padStart(2, "0") + " / " + String(m.steps.length).padStart(2, "0");
    $("walkthrough-number").textContent = String(state.explanation + 1).padStart(2, "0");
    $("walkthrough-title").textContent = step[0];
    $("walkthrough-text").textContent = step[1];
    $("step-dots").innerHTML = m.steps.map(function (_, i) { return '<button class="step-dot' + (i === state.explanation ? " active" : "") + '" data-explanation="' + i + '" aria-label="查看第 ' + (i + 1) + ' 步" aria-pressed="' + (i === state.explanation) + '"></button>'; }).join("");
    $("previous-explanation").disabled = state.explanation === 0;
    $("next-explanation").textContent = state.explanation === m.steps.length - 1 ? "重新理解 ↺" : "下一步 →";
  }
  const color = { green: "#247b5d", light: "#a0b998", orange: "#c58a50", dark: "#376a53" };
  function svgText(x, y, text, extra) { return '<text x="' + x + '" y="' + y + '" class="chart-text" ' + (extra || "") + ">" + htmlEscape(text) + "</text>"; }
  function line(x1, y1, x2, y2, stroke, extra) { return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + stroke + '" ' + (extra || "") + "/>"; }
  function circle(x, y, r, fill, extra) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" ' + (extra || "") + "/>"; }
  function chartBase(xmin, xmax, ymin, ymax, xLabel, yLabel) {
    const left = 58, right = 675, top = 26, bottom = 287;
    const sx = function (x) { return left + (x - xmin) / (xmax - xmin) * (right - left); };
    const sy = function (y) { return bottom - (y - ymin) / (ymax - ymin) * (bottom - top); };
    let grid = "";
    for (let i = 0; i <= 5; i++) {
      const y = ymin + (ymax - ymin) * i / 5;
      grid += line(left, sy(y), right, sy(y), "#e9eee4");
      grid += svgText(left - 12, sy(y) + 4, fmt(y, 2), 'text-anchor="end"');
    }
    for (let i = 0; i <= 6; i++) {
      const x = xmin + (xmax - xmin) * i / 6;
      grid += line(sx(x), top, sx(x), bottom, "#f0f3ed");
      grid += svgText(sx(x), bottom + 23, fmt(x, 2), 'text-anchor="middle"');
    }
    grid += line(left, bottom, right + 6, bottom, "#cfd9c9");
    grid += line(left, top - 5, left, bottom, "#cfd9c9");
    if (ymin < 0 && ymax > 0) grid += line(left, sy(0), right, sy(0), "#c9d5c3");
    grid += svgText(right + 17, bottom + 5, xLabel) + svgText(left - 3, top - 13, yLabel);
    return { sx, sy, left, right, top, bottom, grid, xmin, xmax, ymin, ymax };
  }
  function yBand(c, center, epsilon) {
    const lo = Math.max(c.ymin, center - epsilon), hi = Math.min(c.ymax, center + epsilon);
    if (lo >= hi) return "";
    return '<rect x="' + c.left + '" y="' + c.sy(hi) + '" width="' + (c.right - c.left) + '" height="' + (c.sy(lo) - c.sy(hi)) + '" fill="#eaf2de" opacity=".8"/>' +
      line(c.left, c.sy(hi), c.right, c.sy(hi), "#cedfc1", 'stroke-dasharray="4 5"') +
      line(c.left, c.sy(lo), c.right, c.sy(lo), "#cedfc1", 'stroke-dasharray="4 5"');
  }
  function limitLine(c, value, label) {
    if (value < c.ymin || value > c.ymax) return "";
    return line(c.left, c.sy(value), c.right, c.sy(value), "#6f9663", 'stroke-dasharray="6 5" stroke-width="1.3"') +
      svgText(c.right - 5, c.sy(value) - 9, label, 'text-anchor="end" style="fill:#6e8d60"');
  }
  function dot(c, x, y, fill, active, title) {
    return '<g class="plot-dot"><title>' + htmlEscape(title) + "</title>" +
      (active ? circle(c.sx(x), c.sy(y), 9, fill, 'opacity=".1"') : "") +
      circle(c.sx(x), c.sy(y), active ? 4.5 : 3, fill, 'stroke="white" stroke-width="1.3"') + "</g>";
  }
  function setChart(c, layers, description) {
    $("chart").innerHTML = '<title id="graph-title">' + chapter().title + "：" + model().label + '</title><desc id="graph-description">' + htmlEscape(description) + '</desc><defs><clipPath id="plot-clip"><rect x="' + c.left + '" y="' + c.top + '" width="' + (c.right - c.left) + '" height="' + (c.bottom - c.top) + '"/></clipPath></defs>' + c.grid + layers;
  }
  function metrics(items) {
    $("metrics").innerHTML = items.map(function (item) { return '<div class="metric"><span class="metric-label">' + item[0] + '</span><span class="metric-value' + (item[2] ? " is-text" : "") + '">' + item[1] + "</span></div>"; }).join("");
  }
  function legend(items) {
    $("chart-legend").innerHTML = items.map(function (pair) { return '<span class="legend-item"><i class="legend-' + pair[0] + '"></i>' + pair[1] + "</span>"; }).join("");
  }
  function sequenceChart() {
    const limit = M.sequenceLimit(state.model), value = M.sequenceValue(state.model, state.n), threshold = M.sequenceThreshold(state.model, state.epsilon);
    const xmax = Math.max(30, Math.ceil(state.n / 30) * 30);
    let ymin = -0.2, ymax = 1.2;
    if (state.model === "alternating") { ymin = -1.2; ymax = 1.2; }
    if (state.model === "compound") { ymin = 1.8; ymax = Math.max(3, limit + state.epsilon + 0.1); }
    if (state.model === "reciprocal") ymin = -Math.max(0.2, state.epsilon + 0.05);
    const c = chartBase(0, xmax, ymin, ymax, "n", "aₙ");
    let layers = yBand(c, limit, state.epsilon) + limitLine(c, limit, "A = " + (limit ? "e" : "0"));
    if (threshold < xmax) {
      layers += line(c.sx(threshold), c.top, c.sx(threshold), c.bottom, "#c9ab79", 'stroke-dasharray="3 5"');
      layers += svgText(c.sx(threshold) + 7, c.top + 11, "N = " + threshold, 'style="fill:#b19872"');
    }
    layers += '<g clip-path="url(#plot-clip)">';
    for (let i = 1; i <= state.n; i++) {
      const v = M.sequenceValue(state.model, i);
      layers += dot(c, i, v, Math.abs(v - limit) < state.epsilon ? color.green : color.light, i === state.n, "n = " + i + "，aₙ = " + fmt(v, 6));
    }
    layers += "</g>";
    if (threshold >= xmax) layers += svgText(c.right - 5, c.top + 12, "N = " + threshold + "，位于当前视窗右侧", 'text-anchor="end"');
    setChart(c, layers, "当前 n=" + state.n + "，aₙ=" + fmt(value, 6) + "，极限为" + fmt(limit, 6) + "，允许误差" + state.epsilon + "。可取 N=" + threshold + "，n>N 时，所有后续项的误差均小于 ε。");
    metrics([["当前项数 n", state.n], ["当前值 aₙ", fmt(value, 5)], ["与极限的距离 |aₙ − A|", fmt(Math.abs(value - limit), 5)]]);
    legend([["dot", "数列项 aₙ"], ["dash", "极限 A"], ["band", "误差带 ±ε"]]);
    $("observation").innerHTML = "当 ε = <strong>" + fmt(state.epsilon) + "</strong>，可取 N = <strong>" + threshold + "</strong>。" +
      (state.n > threshold ? "当前 n > N，此后所有项都在误差带内。" : "继续增加 n，观察进入误差带的过程。") +
      (state.model === "compound" ? " 这里的 N 是误差界给出的充分值。" : "");
    $("chart-caption").textContent = "n → ∞";
    $("chart-footnote").textContent = "绿色带边界不计入 |aₙ − A| < ε；N 满足 n > N。图像不代替证明。";
  }
  function functionChart() {
    const info = M.functionInfo(state.model, state.epsilon), a = info.a;
    const c = chartBase(a - 1.5, a + 1.5, state.model === "hole" ? 0 : (state.model === "jump" ? -1.5 : 0.5), state.model === "hole" ? 4 : (state.model === "jump" ? 1.5 : 1.25), "x", "f(x)");
    let layers = "";
    if (info.limit !== null) {
      layers += yBand(c, info.limit, state.epsilon);
      layers += '<rect x="' + c.sx(a - info.delta) + '" y="' + c.top + '" width="' + (c.sx(a + info.delta) - c.sx(a - info.delta)) + '" height="' + (c.bottom - c.top) + '" fill="#c6e3e7" opacity=".22"/>';
      layers += line(c.sx(a - info.delta), c.top, c.sx(a - info.delta), c.bottom, "#a9cacf", 'stroke-dasharray="4 5"') + line(c.sx(a + info.delta), c.top, c.sx(a + info.delta), c.bottom, "#a9cacf", 'stroke-dasharray="4 5"');
      layers += limitLine(c, info.limit, "L = " + info.limit);
      layers += svgText(c.sx(a) + 7, c.top + 12, "δ = " + fmt(info.delta, 3), 'style="fill:#78a1a5"');
    }
    layers += line(c.sx(a), c.top, c.sx(a), c.bottom, "#aebba4", 'stroke-dasharray="3 5"');
    [-1, 1].forEach(function (side) {
      let path = "";
      for (let j = 0; j <= 160; j++) {
        const xx = a + side * (0.00001 + 1.49999 * j / 160), yy = M.functionValue(state.model, xx);
        path += (j === 0 ? "M" : "L") + c.sx(xx).toFixed(2) + " " + c.sy(yy).toFixed(2) + " ";
      }
      layers += '<path d="' + path + '" fill="none" stroke="' + color.green + '" stroke-width="2.3" stroke-linecap="round"/>';
    });
    if (info.limit !== null) layers += circle(c.sx(a), c.sy(info.limit), 5, "white", 'stroke="' + color.green + '" stroke-width="2"');
    else {
      layers += circle(c.sx(a), c.sy(-1), 5, "white", 'stroke="' + color.green + '" stroke-width="2"');
      layers += circle(c.sx(a), c.sy(1), 5, "white", 'stroke="' + color.green + '" stroke-width="2"');
    }
    const left = M.functionValue(state.model, a - state.h), right = M.functionValue(state.model, a + state.h);
    [-1, 1].forEach(function (side) {
      if ((side === -1 && state.direction === "right") || (side === 1 && state.direction === "left")) return;
      const xx = a + side * state.h, yy = side < 0 ? left : right, fill = side < 0 ? color.orange : color.green;
      layers += line(c.sx(xx), c.sy(yy), c.sx(xx), c.bottom, fill, 'stroke-dasharray="4 4" opacity=".5"');
      layers += dot(c, xx, yy, fill, true, "x=" + fmt(xx, 3) + "，f(x)=" + fmt(yy, 6));
      layers += svgText(c.sx(xx) + (side < 0 ? -10 : 10), c.sy(yy) + (side < 0 ? 24 : -15), "x=" + fmt(xx, 3), 'text-anchor="' + (side < 0 ? "end" : "start") + '" style="fill:' + fill + '"');
    });
    setChart(c, layers, "趋近点 a=" + a + "，距离 h=" + state.h + "。左侧函数值" + fmt(left, 6) + "，右侧函数值" + fmt(right, 6) + "。双侧极限" + (info.limit === null ? "不存在" : "为" + info.limit) + "。");
    metrics([["左侧 f(a − h)", fmt(left, 5)], ["右侧 f(a + h)", fmt(right, 5)], ["双侧极限 L", info.limit === null ? "不存在" : info.limit, info.limit === null]]);
    legend(info.limit !== null ? [["dot orange", "左侧趋近"], ["dot", "右侧趋近"], ["band", "误差带 ±ε"]] : [["dot orange", "左侧趋近"], ["dot", "右侧趋近"]]);
    if (info.limit === null) $("observation").innerHTML = "无论 h 多小，左侧总是 <strong>−1</strong>，右侧总是 <strong>1</strong>。两侧不相等，双侧极限不存在。";
    else $("observation").innerHTML = "可取 δ = <strong>" + fmt(info.delta, 4) + "</strong>。当前 h = <strong>" + fmt(state.h, 3) + "</strong>，" +
      (state.h < info.delta ? "满足 0 < h < δ，两侧函数值都在 ε 带内。" : "尚未满足 h < δ；继续缩小 h，观察误差变化。");
    $("chart-caption").textContent = "x → " + a + (state.model === "sinc" ? " · 弧度" : "");
    $("chart-footnote").textContent = info.limit === null ? "空心点表示该点未定义。左右极限不相等，所以双侧极限不存在。" : "蓝色竖带为输入的 δ 区间，绿色横带为输出的 ε 区间；空心点处未定义。";
  }
  function seriesChart() {
    const data = M.seriesInfo(state.model, state.n, state.q), xmax = Math.max(30, Math.ceil(state.n / 30) * 30);
    const vals = [0].concat(data.sums);
    if (data.limit !== null) vals.push(data.limit);
    let ymin = Math.min.apply(null, vals), ymax = Math.max.apply(null, vals);
    const span = ymax - ymin || 1; ymin -= span * 0.1; ymax += span * 0.15;
    const c = chartBase(0, xmax, ymin, ymax, "n", "Sₙ");
    let layers = "";
    if (data.limit !== null) layers += limitLine(c, data.limit, "S = " + (state.model === "alternatingHarmonic" ? "ln 2" : fmt(data.limit, 3)));
    let path = "";
    data.sums.forEach(function (value, i) { path += (i === 0 ? "M" : "L") + c.sx(i + 1).toFixed(2) + " " + c.sy(value).toFixed(2) + " "; });
    layers += '<path d="' + path + '" stroke="' + color.green + '" stroke-width="1.6" fill="none" opacity=".6"/>';
    data.sums.forEach(function (value, i) { layers += dot(c, i + 1, value, color.green, i === state.n - 1, "n=" + (i + 1) + "，Sₙ=" + fmt(value, 6)); });
    setChart(c, layers, "当前累加" + state.n + "项，部分和为" + fmt(data.sum, 6) + "。该级数" + (data.converges ? "收敛到" + fmt(data.limit, 6) : "发散") + "。");
    metrics([["累加项数 n", state.n], ["部分和 Sₙ", fmt(data.sum, 5)], [data.converges ? "与总和的距离 |Sₙ − S|" : "收敛判断", data.converges ? fmt(data.error, 5) : "发散", !data.converges]]);
    legend(data.converges ? [["dot", "部分和 Sₙ"], ["dash", "无穷级数的和 S"]] : [["dot", "部分和 Sₙ"]]);
    if (state.model === "geometric") {
      $("observation").innerHTML = data.converges ? "|q| = <strong>" + fmt(Math.abs(state.q), 2) + " < 1</strong>，级数收敛到 <strong>" + fmt(data.limit, 4) + "</strong>。" + (state.q < 0 ? "部分和在极限两侧交替趋近。" : "注意：首项是 q⁰ = 1。") :
        "|q| = <strong>" + fmt(Math.abs(state.q), 2) + " ≥ 1</strong>，级数发散。通项不趋于 0，不能使用无穷几何级数求和公式。";
      $("result-formula").innerHTML = data.converges ? model().result : '<math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mo>|</mo><mi>q</mi><mo>|</mo><mo>≥</mo><mn>1</mn><mo>⇒</mo><mtext>级数发散</mtext></mrow></math>';
    } else if (state.model === "harmonic") $("observation").innerHTML = "增长越来越慢，但部分和<strong>没有有限上界</strong>。每项趋于 0，并不能保证级数收敛。";
    else $("observation").innerHTML = "级数收敛到 <strong>ln 2 ≈ 0.69315</strong>。当前误差不超过下一项：1/(n+1) = <strong>" + fmt(data.bound, 5) + "</strong>。";
    $("chart-caption").textContent = state.model === "geometric" ? "q = " + fmt(state.q, 2) : "n → ∞";
    $("chart-footnote").textContent = "连线仅帮助追踪离散部分和；纵轴随数值缩放。有限窗口变平不代表收敛。";
  }
  function updateVisualization() {
    if (renderer() && renderer().sync) renderer().sync(state, api());
    updateControlValues();
    if (renderer()) renderer().chart(state, api());
    else if (kind() === "sequence") sequenceChart();
    else if (kind() === "function") functionChart();
    else seriesChart();
  }
  function advance() {
    if (renderer()) {
      renderer().advance(state); updateVisualization();
      if (renderer().finished(state)) stop();
      return;
    }
    if (kind() === "function") state.h = Math.max(0.001, Math.floor(state.h * 0.8 * 1000) / 1000);
    else state.n = Math.min(100, state.n + 1);
    updateVisualization();
    if ((kind() === "function" && state.h <= 0.001) || (kind() !== "function" && state.n >= 100)) stop();
  }
  function togglePlayback() {
    if (state.playing) { stop(); return; }
    if (renderer()) { if (renderer().finished(state)) renderer().restart(state); }
    else {
      if (kind() === "function" && state.h <= 0.001) state.h = 1;
      if (kind() !== "function" && state.n >= 100) state.n = 1;
    }
    state.playing = true;
    $("play-button").innerHTML = '<span class="play-icon">Ⅱ</span>暂停演示';
    $("play-button").setAttribute("aria-pressed", "true");
    updateVisualization();
    timer = setInterval(advance, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 900 : 400);
  }
  function renderProgress() {
    const count = chapter().questions.filter(function (q) { return completed.has(q.id); }).length;
    $("side-count").textContent = completed.size + "/" + knownQuestions.length;
    $("total-progress").style.width = completed.size / knownQuestions.length * 100 + "%";
    $("total-progress-label").textContent = "已掌握 " + completed.size + " / " + knownQuestions.length + " 道练习";
    $("practice-progress").textContent = "本章已完成 " + count + " / " + chapter().questions.length;
    document.querySelectorAll("[data-question]").forEach(function (b) { b.classList.toggle("completed", completed.has(chapter().questions[Number(b.dataset.question)].id)); });
  }
  function renderQuestion() {
    const question = chapter().questions[state.question];
    $("question-label").textContent = "练习 " + String(state.question + 1).padStart(2, "0");
    $("question-title").textContent = question.title;
    $("question-body").textContent = question.body;
    $("question-tabs").innerHTML = chapter().questions.map(function (q, i) { return '<button type="button" class="question-tab' + (i === state.question ? " active" : "") + (completed.has(q.id) ? " completed" : "") + '" data-question="' + i + '" aria-label="练习 ' + (i + 1) + (completed.has(q.id) ? "，已完成" : "") + '" aria-pressed="' + (i === state.question) + '">' + (i + 1) + "</button>"; }).join("");
    if (question.type === "number") {
      $("answer-fields").innerHTML = '<div class="number-answer"><label for="number-answer">' + question.unit + '</label><input id="number-answer" name="answer" type="text" inputmode="decimal" autocomplete="off" placeholder="输入你的答案" aria-describedby="answer-format"><small id="answer-format">支持小数或分数</small></div>';
    } else {
      $("answer-fields").innerHTML = '<fieldset class="answer-choices"><legend>选择一个答案</legend>' + question.choices.map(function (choice, i) { return '<label class="choice-option"><input type="radio" name="answer" value="' + i + '"><span>' + htmlEscape(choice) + "</span></label>"; }).join("") + "</fieldset>";
    }
    $("hint-text").hidden = true;
    $("hint-text").textContent = question.hint;
    $("hint-button").textContent = "给我一点提示";
    $("answer-feedback").hidden = true;
    $("answer-feedback").textContent = "";
    $("next-question").textContent = state.question === chapter().questions.length - 1 ? "回到第一题 ↺" : "下一题 →";
  }
  function submitAnswer(event) {
    event.preventDefault();
    const q = chapter().questions[state.question];
    const selected = q.type === "choice" ? document.querySelector('input[name="answer"]:checked') : $("number-answer");
    const feedback = $("answer-feedback");
    if (!selected || selected.value.trim() === "" || (q.type === "number" && !Number.isFinite(M.parseAnswer(selected.value)))) {
      feedback.className = "feedback"; feedback.textContent = q.type === "choice" ? "先选择一个答案，再来检验你的理解。" : "请输入有效的数字或分数，例如 2 或 1/2。";
      feedback.hidden = false; return;
    }
    const correct = q.type === "choice" ? Number(selected.value) === q.answer : M.checkAnswer(selected.value, q.answer, q.tolerance);
    window.MidtermReview.record(q.id, correct);
    feedback.className = "feedback" + (correct ? " success" : "");
    feedback.innerHTML = "<strong>" + (correct ? "答对了，理解又进了一步。" : "还差一点，再想一想。") + "</strong>" + (correct ? q.explanation : q.hint);
    feedback.hidden = false;
    if (correct) {
      completed.add(q.id);
      try { localStorage.setItem(storageKey, JSON.stringify(Array.from(completed))); }
      catch (_) { storageAvailable = false; feedback.innerHTML += "<br>浏览器未允许保存；本次学习进度在当前页面内仍然有效。"; }
      renderProgress();
    }
  }
  function openDialog(type) {
    stop();
    if (type === "syllabus") {
      $("dialog-title").textContent = "期中：前三章复习清单";
      $("dialog-body").innerHTML = "<p>根据你提供的教材目录整理。每节先掌握核心概念，再做代表例题；这份清单不等于已经完成全部题型训练。</p>" + window.Curriculum.sections.map(function (s) {
        return '<details class="syllabus-section"><summary>' + htmlEscape(s.number + " · " + s.title) + '</summary><p><strong>要掌握：</strong>' + htmlEscape(s.key) + '</p><p class="worked-example"><strong>例题：</strong>' + htmlEscape(s.example) + '</p><p><strong>易错点：</strong>' + htmlEscape(s.pitfall) + '</p><button class="button secondary" data-go-chapter="' + s.target + '">查看相关实验 →</button><button class="button primary" data-practice-section="'+s.number+'">练习这一节 →</button></details>';
      }).join("");
    } else if (type === "roadmap") {
      $("dialog-title").textContent = "期末：本册六章路线";
      $("dialog-body").innerHTML = "<p>" + htmlEscape(window.Curriculum.scope) + "</p>" + window.Curriculum.chapters.map(function (c) {
        return '<div class="route-row"><span class="small-tag">' + (c.phase === "midterm" ? "阶段一 · 期中优先" : "阶段二 · 期末补齐") + '</span><h3>第 ' + c.number + ' 章 · ' + htmlEscape(c.title) + '</h3><p>' + htmlEscape(c.status) + '</p>' + (c.target ? '<button class="text-button" data-go-chapter="' + c.target + '">查看已有实验 →</button>' : '<span class="section-overline">尚未上线完整学习模块</span>') + '</div>';
      }).join("") + "<p>无穷级数作为早期拓展实验保留，不属于你上传的这本上册六章目录主线。</p>";
    } else if (type === "guide") {
      $("dialog-title").textContent = "从看见，到理解";
      $("dialog-body").innerHTML = "<p>这里是你的高数实验室。无需按固定速度学习，也不必一次记住所有定义。</p><ol><li><strong>选一个例子：</strong>在 " + chapterIds.length + " 个专题、" + Object.values(lessons).reduce(function (sum, c) { return sum + c.models.length; }, 0) + " 个模型之间切换。</li><li><strong>改变参数：</strong>拖动滑块，或用键盘方向键微调。</li><li><strong>观察过程：</strong>自动演示可暂停，也可以逐项单步推进。</li><li><strong>理解为什么：</strong>阅读分步讲解，把图像与数学定义联系起来。</li><li><strong>检验理解：</strong>完成章节练习，查看即时反馈与解析。</li></ol><p>函数实验中 h 的最小值为 0.001，永远不会取到趋近点。级数图中的连线只是视觉辅助。图像展示有限样本，数学结论请结合推导理解。</p><p>在线版可收藏当前网址，点击章节后地址会保留章节位置。离线版仍可单文件运行。新增内容会更新同一个网站；学习记录目前保存在本机，可以通过下方导出、导入在设备间转移。</p>";
    } else {
      $("dialog-title").textContent = "你的每一步，都在这里";
      $("dialog-body").innerHTML = "<p>已掌握 <strong>" + completed.size + " / " + knownQuestions.length + "</strong> 道练习。同一道题重复答对，不会重复计数。</p>" + Object.values(lessons).map(function (c) {
        const count = c.questions.filter(function (q) { return completed.has(q.id); }).length;
        return '<div class="record-row"><span>' + c.number + " · " + c.title + "</span><small>" + count + " / " + c.questions.length + " 已完成</small></div>";
      }).join("") + '<p' + (storageAvailable ? "" : ' class="storage-note"') + ">" + (storageAvailable ? "进度只保存在当前浏览器中，不会上传。更换设备、浏览器或访问地址后，进度不会自动同步。清除浏览器站点数据会移除记录。" : "当前浏览器的本地存储不可用。你仍然可以完成所有实验；本次进度只在当前页面中保留。") + "</p>";
    }
    const reviewStats=window.MidtermReview.stats();
    $("dialog-body").innerHTML += '<p>期中题库：已尝试 '+reviewStats.attempted+' / '+reviewStats.total+' 题，待复习错题 '+reviewStats.mistakes+' 道。备份包含实验完成记录与期中答题记录。</p><div class="record-actions"><button class="button secondary" data-progress-export>导出学习进度</button><button class="button secondary" data-progress-import>导入学习进度</button></div><p id="transfer-status" role="status"></p>';
    $("info-dialog").showModal();
  }
  document.querySelector(".chapter-nav").innerHTML = chapterIds.map(function (id) {
    const c = lessons[id];
    return '<button class="chapter-button" data-chapter="' + htmlEscape(id) + '"><span class="nav-number">' + htmlEscape(c.number) + '</span><span>' + htmlEscape(c.title) + '<small>' + htmlEscape(c.navSubtitle || c.subtitle) + '</small></span><span class="nav-arrow">›</span></button>';
  }).join("");
  $("chapter-total").textContent = String(chapterIds.length).padStart(2, "0");
  document.querySelector(".chapter-nav").addEventListener("click", function (event) {
    const b = event.target.closest("[data-chapter]"); if (b) switchChapter(b.dataset.chapter);
  });
  $("model-tabs").addEventListener("click", function (event) { const b = event.target.closest("[data-model]"); if (b) switchModel(b.dataset.model); });
  $("controls").addEventListener("input", function (event) {
    const key = { "n-slider": "n", "epsilon-slider": "epsilon", "h-slider": "h", "q-slider": "q", "a-slider": "a", "x-slider": "x", "parameter-slider": "parameter", "upper-slider": "upper", "rate-slider": "rate" }[event.target.id];
    if (!key) return;
    stop(); state[key] = Number(event.target.value); updateVisualization();
  });
  $("controls").addEventListener("click", function (event) {
    const method = event.target.closest("[data-method]");
    if (method) {
      state.method = method.dataset.method;
      document.querySelectorAll("[data-method]").forEach(function (b) { const active = b.dataset.method === state.method; b.classList.toggle("active", active); b.setAttribute("aria-pressed", active); });
      updateVisualization(); return;
    }
    const b = event.target.closest("[data-direction]"); if (!b) return;
    state.direction = b.dataset.direction;
    document.querySelectorAll("[data-direction]").forEach(function (button) { const active = button.dataset.direction === state.direction; button.classList.toggle("active", active); button.setAttribute("aria-pressed", active); });
    updateVisualization();
  });
  $("reset-button").addEventListener("click", function () { stop(); defaults(); renderControls(); renderLesson(); updateVisualization(); });
  $("play-button").addEventListener("click", togglePlayback);
  $("step-button").addEventListener("click", function () { stop(); advance(); });
  $("previous-explanation").addEventListener("click", function () { state.explanation = Math.max(0, state.explanation - 1); renderLesson(); updateVisualization(); });
  $("next-explanation").addEventListener("click", function () { state.explanation = (state.explanation + 1) % model().steps.length; renderLesson(); updateVisualization(); });
  $("step-dots").addEventListener("click", function (event) { const b = event.target.closest("[data-explanation]"); if (b) { state.explanation = Number(b.dataset.explanation); renderLesson(); updateVisualization(); } });
  $("question-tabs").addEventListener("click", function (event) { const b = event.target.closest("[data-question]"); if (b) { state.question = Number(b.dataset.question); renderQuestion(); } });
  $("next-question").addEventListener("click", function () { state.question = (state.question + 1) % chapter().questions.length; renderQuestion(); });
  $("answer-form").addEventListener("submit", submitAnswer);
  $("hint-button").addEventListener("click", function () { $("hint-text").hidden = !$("hint-text").hidden; $("hint-button").textContent = $("hint-text").hidden ? "给我一点提示" : "收起提示"; });
  $("guide-button").addEventListener("click", function () { openDialog("guide"); });
  $("progress-button").addEventListener("click", function () { openDialog("progress"); });
  $("practice-jump").addEventListener("click", function () { stop(); $("practice").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); $("practice").focus({ preventScroll: true }); });
  $("close-dialog").addEventListener("click", function () { $("info-dialog").close(); });
  $("dialog-done").addEventListener("click", function () { $("info-dialog").close(); });
  $("info-dialog").addEventListener("click", function (event) { if (event.target === $("info-dialog")) { const r = $("info-dialog").getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $("info-dialog").close(); } });
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); });
  $("syllabus-button").addEventListener("click", function () { openDialog("syllabus"); });
  $("roadmap-button").addEventListener("click", function () { openDialog("roadmap"); });
  $("review-button").addEventListener("click", function () { window.MidtermReview.open(); });
  document.addEventListener("zhiwei-stop", stop);
  document.addEventListener("zhiwei-backup", function(){openDialog("progress");});
  document.addEventListener("zhiwei-goto", function(e){switchChapter(e.detail);$("main").scrollIntoView();});
  document.addEventListener("zhiwei-answer", function(e){
    if(!e.detail.correct||!knownQuestions.includes(e.detail.id))return;
    completed.add(e.detail.id);
    try{localStorage.setItem(storageKey,JSON.stringify(Array.from(completed)));}catch(_){storageAvailable=false;}
    renderProgress();
  });
  $("dialog-body").addEventListener("click", function (event) {
    const practice=event.target.closest("[data-practice-section]");
    if(practice){$("info-dialog").close();window.MidtermReview.open(practice.dataset.practiceSection);return;}
    const target = event.target.closest("[data-go-chapter]");
    if (target) { $("info-dialog").close(); switchChapter(target.dataset.goChapter); $("main").scrollIntoView(); return; }
    if (event.target.closest("[data-progress-export]")) {
      const blob = new Blob([JSON.stringify({format:"zhiwei-progress", version:2, completed:Array.from(completed), review:window.MidtermReview.exportRecords()}, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = "zhiwei-progress.json"; link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      $("transfer-status").textContent = "已导出进度文件。在另一台设备打开本站，再导入此文件。";
    }
    if (event.target.closest("[data-progress-import]")) $("progress-file").click();
  });
  $("progress-file").addEventListener("change", async function () {
    const file = this.files[0]; if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("文件过大");
      const data = JSON.parse(await file.text());
      if (data.format !== "zhiwei-progress" || ![1,2].includes(data.version) || !Array.isArray(data.completed) || !data.completed.every(function (id) { return typeof id === "string"; })) throw new Error("格式不匹配");
      if(data.version===2)window.MidtermReview.merge(data.review);
      const before = completed.size;
      data.completed.filter(function (id) { return knownQuestions.includes(id); }).forEach(function (id) { completed.add(id); });
      try { localStorage.setItem(storageKey, JSON.stringify(Array.from(completed))); } catch (_) { storageAvailable = false; }
      renderProgress(); renderQuestion(); openDialog("progress");
      $("transfer-status").textContent = "已合并进度，新增 " + (completed.size - before) + " 道已完成实验练习。" + (data.version===2?"期中答题记录按题目合并，保留时间较新的记录。":"旧版进度已兼容导入。") + (storageAvailable ? "" : "浏览器未允许保存，本次导入仅在当前页面保留。");
    } catch (_) { $("transfer-status").textContent = "无法导入。请选择由本站导出的进度 JSON 文件；原有进度未被清空。"; }
    this.value = "";
  });
  function readChapterHash() { return location.hash.startsWith("#chapter/") ? location.hash.slice(9) : ""; }
  window.addEventListener("hashchange", function () { const id = readChapterHash(); if (lessons[id] && id !== state.chapter) switchChapter(id); });
  const routed = readChapterHash();
  if (lessons[routed]) { state.chapter = routed; state.model = chapter().models[0].id; }
  defaults(); renderChapter(); stop();
})();
