"""Build a self-contained, offline index.html using only Python's standard library."""
from base64 import b64encode
from pathlib import Path
import re
import json

ROOT = Path(__file__).resolve().parent


def load_content():
    chapters = {}
    questions = set()
    allowed = {
        "sequence": {"reciprocal", "alternating", "compound"},
        "function": {"hole", "sinc", "jump"},
        "series": {"geometric", "harmonic", "alternatingHarmonic"},
        "derivative": {"square", "exponential", "absolute"},
        "optimization": {"profit", "averageCost", "elasticity"},
        "integral": {"area", "signedArea", "cashflow"},
        "foundations": {"transform", "inverse", "interest", "market"},
        "applied": {"implicit", "parametric", "related"},
    }
    for path in sorted((ROOT / "content").glob("*.json")):
        c = json.loads(path.read_text(encoding="utf-8"))
        if c["id"] in chapters or not re.fullmatch(r"[a-z][a-zA-Z0-9-]*", c["id"]):
            raise ValueError("Duplicate/invalid chapter id: " + str(path))
        if c["renderer"] not in allowed or not c["models"] or not c["questions"]:
            raise ValueError("Missing renderer/models/questions: " + str(path))
        model_ids = set()
        for m in c["models"]:
            if m["id"] not in allowed[c["renderer"]] or m["id"] in model_ids or not m["steps"]:
                raise ValueError("Invalid/duplicate model or missing steps: " + str(path))
            model_ids.add(m["id"])
        for q in c["questions"]:
            if q["id"] in questions:
                raise ValueError("Duplicate question id: " + q["id"])
            questions.add(q["id"])
            if q["type"] == "choice":
                if not isinstance(q["answer"], int) or not 0 <= q["answer"] < len(q["choices"]):
                    raise ValueError("Invalid answer: " + q["id"])
            elif q["type"] != "number" or not isinstance(q["answer"], (int, float)):
                raise ValueError("Unsupported question: " + q["id"])
        chapters[c["id"]] = c
    return chapters


def build():
    chapters = load_content()
    data = json.dumps(chapters, ensure_ascii=False).replace("<", "\\u003c")
    (ROOT / "lessons.js").write_text("// Generated from content/*.json. Edit the JSON source, then rebuild.\nglobalThis.Lessons = " + data + ";\n", encoding="utf-8")
    curriculum = json.loads((ROOT / "curriculum.json").read_text(encoding="utf-8"))
    (ROOT / "curriculum.js").write_text("globalThis.Curriculum = " + json.dumps(curriculum, ensure_ascii=False).replace("<", "\\u003c") + ";\n", encoding="utf-8")
    sections = {s["number"]: s for s in curriculum["sections"]}
    bank = []
    for chapter in chapters.values():
        for question in chapter["questions"]:
            if question.get("section") in sections:
                bank.append(dict(question, target=chapter["id"]))
    extra = json.loads((ROOT / "practice-content.json").read_text(encoding="utf-8"))["questions"]
    bank.extend(dict(q, target=sections[q["section"]]["target"]) for q in extra)
    ids = set()
    for q in bank:
        if q["id"] in ids or q["section"] not in sections:
            raise ValueError("Invalid exam question id/section: " + q["id"])
        ids.add(q["id"])
        if q["type"] == "choice":
            if not isinstance(q["answer"], int) or not 0 <= q["answer"] < len(q["choices"]):
                raise ValueError("Invalid exam choice: " + q["id"])
        elif q["type"] != "number" or not isinstance(q["answer"], (float, int)):
            raise ValueError("Invalid exam answer: " + q["id"])
        if not q.get("hint") or not q.get("explanation"):
            raise ValueError("Missing explanation: " + q["id"])
    if any(not any(q["section"] == s for q in bank) for s in sections):
        raise ValueError("Missing exam section coverage")
    (ROOT / "review-data.js").write_text("// Generated from content and practice-content.json.\nglobalThis.MidtermBank = " + json.dumps(bank, ensure_ascii=False).replace("<", "\\u003c") + ";\n", encoding="utf-8")
    page = (ROOT / "page.template.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8").replace('@charset "UTF-8";', "")
    if "</style" in css.lower():
        raise ValueError("CSS cannot contain a closing style tag.")
    page = page.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + css + "\n</style>")
    icon = b64encode((ROOT / "icon.svg").read_bytes()).decode("ascii")
    page = page.replace('href="icon.svg"', 'href="data:image/svg+xml;base64,' + icon + '"')
    scripts = []
    for filename in ["math.js", "calculus.js", "lessons.js", "curriculum.js", "review-data.js", "review-core.js", "renderers.js", "foundations.js", "applied.js", "review.js", "app.js"]:
        code = (ROOT / filename).read_text(encoding="utf-8")
        if "</script" in code.lower():
            raise ValueError(filename + " contains a closing script tag.")
        page = page.replace('<script src="' + filename + '" defer></script>', "")
        scripts.append(code)
    # Inline scripts must execute after the page's elements exist. An inline
    # classic script ignores defer, so embedding them in the head would break.
    bootstrap = """
try {
%s
  document.documentElement.setAttribute("data-app-ready", "true");
  document.getElementById("startup-notice").hidden = true;
} catch (error) {
  var notice = document.getElementById("startup-notice");
  if (notice) {
    notice.hidden = false;
    notice.textContent = "交互未能启动。请将完整 HTML 文件下载到电脑，用新版 Chrome、Edge 或 Safari 打开；不要在聊天或文件预览窗口中运行。";
  }
  console.error("知微启动失败", error);
}
""" % "\n;\n".join(scripts)
    page = page.replace("</body>", "<script>\n" + bootstrap + "\n</script>\n</body>")
    if re.search(r'<script[^>]+\bsrc=|<link[^>]+\bhref="(?!data:)', page, re.I):
        raise ValueError("Unexpected external script or stylesheet.")
    (ROOT / "index.html").write_text(page, encoding="utf-8")
    (ROOT / "dist").mkdir(exist_ok=True)
    (ROOT / "dist" / "index.html").write_text(page, encoding="utf-8")
    print("Built standalone index.html:", len(page.encode("utf-8")), "bytes; no external assets.")
    return page


if __name__ == "__main__":
    build()
