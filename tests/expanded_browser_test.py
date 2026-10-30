import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("SITE_URL", "http://127.0.0.1:8000/index.html")
chapters = [json.loads(p.read_text()) for p in sorted((ROOT / "content").glob("*.json"))]
total = sum(len(c["questions"]) for c in chapters)


def run():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which("chromium"), headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1080})
        page = context.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(URL)
        expect(page.locator("html")).to_have_attribute("data-app-ready", "true")
        expect(page.locator("#chapter-title")).to_contain_text("函数")
        expect(page.locator("[data-chapter]")).to_have_count(len(chapters))
        for c in chapters:
            page.locator('[data-chapter="' + c["id"] + '"]').click()
            for model in c["models"]:
                page.locator('[data-model="' + model["id"] + '"]').click()
                sliders = page.locator("#controls input[type=range]").evaluate_all("(els)=>els.map(e=>e.id)")
                for slider_id in sliders:
                    for bound in ["min", "max"]:
                        page.locator("#" + slider_id).evaluate(
                            "(e,b)=>{e.value=e[b];e.dispatchEvent(new Event('input',{bubbles:true}));}", bound)
                        assert "NaN" not in page.locator("#chart").inner_html(), (c["id"], model["id"], slider_id, bound)
                        assert "Infinity" not in page.locator("#chart").inner_html()
                page.locator("#reset-button").click()
                page.locator("#step-button").click()
                page.locator("#next-explanation").click()
                expect(page.locator("#step-count")).to_have_text("02 / 04")
        print("PASS: 8 个专题、25 个模型、全部滑块上下界、单步和讲解")

        page.locator('[data-chapter="derivative"]').click()
        page.locator('[data-model="absolute"]').click()
        expect(page.locator("#metrics")).to_contain_text("不存在")
        page.locator('[data-chapter="integral"]').click()
        page.locator('[data-model="cashflow"]').click()
        page.locator("#rate-slider").evaluate("(e)=>{e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}));}")
        expect(page.locator("#metrics")).to_contain_text("500")
        page.locator('[data-method="left"]').click()
        expect(page.locator('[data-method="left"]')).to_have_attribute("aria-pressed", "true")
        page.locator('[data-chapter="optimization"]').click()
        page.locator('[data-model="elasticity"]').click()
        page.locator("#x-slider").evaluate("(e)=>{e.value=e.max;e.dispatchEvent(new Event('input',{bubbles:true}));}")
        page.locator("#parameter-slider").evaluate("(e)=>{e.value=2;e.dispatchEvent(new Event('input',{bubbles:true}));}")
        assert float(page.locator("#x-slider").input_value()) <= 9.5
        print("PASS: 尖点、零贴现率、积分取样方式、动态可行域约束")

        for c in chapters:
            page.locator('[data-chapter="' + c["id"] + '"]').click()
            for i, q in enumerate(c["questions"]):
                page.locator('[data-question="' + str(i) + '"]').click()
                if q["type"] == "number":
                    page.locator("#number-answer").fill(str(q["answer"]))
                else:
                    page.locator('input[name=answer][value="' + str(q["answer"]) + '"]').check()
                page.locator("#answer-form button[type=submit]").click()
                expect(page.locator("#answer-feedback")).to_have_class("feedback success")
        expect(page.locator("#side-count")).to_have_text(str(total) + "/" + str(total))
        page.reload()
        expect(page.locator("#side-count")).to_have_text(str(total) + "/" + str(total))
        print("PASS:", total, "道题与所有解析、动态进度总数、刷新恢复")

        page.locator("#progress-button").click()
        with page.expect_download() as download:
            page.locator("[data-progress-export]").click()
        exported = json.loads(Path(download.value.path()).read_text())
        assert len(exported["completed"]) == total
        page.locator("#dialog-done").click()
        context2 = browser.new_context(viewport={"width": 1024, "height": 768})
        other = context2.new_page()
        other.goto(URL)
        other.locator("#progress-button").click()
        other.locator("#progress-file").set_input_files({"name":"progress.json","mimeType":"application/json","buffer":json.dumps(exported).encode()})
        expect(other.locator("#side-count")).to_have_text(str(total) + "/" + str(total))
        expect(other.locator("#transfer-status")).to_contain_text("已合并")
        other.locator("#progress-file").set_input_files({"name":"bad.json","mimeType":"application/json","buffer":b'{"format":"bad"}'})
        expect(other.locator("#transfer-status")).to_contain_text("无法导入")
        expect(other.locator("#side-count")).to_have_text(str(total) + "/" + str(total))
        print("PASS: 导出下载、跨浏览器上下文导入、错误文件不清空进度")

        page.locator("#syllabus-button").click()
        expect(page.locator(".syllabus-section")).to_have_count(18)
        page.locator(".syllabus-section").last.locator("summary").click()
        expect(page.locator(".syllabus-section").last).to_contain_text("边际与弹性")
        page.locator(".syllabus-section").last.locator("[data-go-chapter]").click()
        expect(page.locator("#chapter-title")).to_contain_text("边际")
        page.locator("#roadmap-button").click()
        expect(page.locator(".route-row")).to_have_count(6)
        expect(page.locator("#dialog-body")).to_contain_text("尚未上线完整学习模块")
        page.locator("#dialog-done").click()
        page.goto(URL + "#chapter/derivative")
        expect(page.locator("#chapter-title")).to_contain_text("导数与微分")
        print("PASS: 教材前三章 18 节、期末六章路线、实验跳转、章节书签")

        for width, height in [(1440,1080),(1024,768),(820,1180),(768,1024),(390,844)]:
            page.set_viewport_size({"width":width,"height":height})
            for c in chapters:
                page.locator('[data-chapter="' + c["id"] + '"]').click()
                page.locator('[data-question="' + str(len(c["questions"])-1) + '"]').click()
                assert not page.evaluate("document.documentElement.scrollWidth>innerWidth"), (width,c["id"])
            page.locator('[data-chapter="foundations"]').click()
            page.evaluate("window.scrollTo(0,0)")
            page.locator(":focus").evaluate_all("(els)=>els.forEach(e=>e.blur())")
            page.screenshot(path=str(ROOT/"docs"/("expanded-"+str(width)+".png")),full_page=True)
        print("PASS: 5 种桌面和平板/小屏尺寸，8 专题均无横向溢出")
        assert not errors, errors
        browser.close()
    print("Passed 6 expanded browser check groups.")


if __name__ == "__main__":
    run()
