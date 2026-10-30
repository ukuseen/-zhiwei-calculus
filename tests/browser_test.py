"""Optional real-browser checks. Requires Python Playwright and Chromium.

Run: python3 tests/browser_test.py
Use CHROMIUM_PATH to select an installed Chromium executable if needed.
The delivered site itself needs neither Python nor Playwright.
"""
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("SITE_URL", (ROOT / "index.html").as_uri())


def run():
    checks = []
    errors = []
    external_requests = []
    executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
    with sync_playwright() as p:
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 1100})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: external_requests.append(request.url)
                if request.url.startswith(("http:", "https:")) and not request.url.startswith(URL.rsplit("/", 1)[0] + "/") else None)
        page.goto(URL)
        page.locator('[data-chapter="sequence"]').click()
        expect(page.locator("html")).to_have_attribute("data-app-ready", "true")
        expect(page.locator("#startup-notice")).to_be_hidden()
        expect(page.locator("#chapter-title")).to_contain_text("数列极限")
        expect(page.locator("#chart circle")).to_have_count(21)
        assert page.locator("#model-formula math").evaluate(
            "(el) => el.namespaceURI === 'http://www.w3.org/1998/Math/MathML' && el.getBoundingClientRect().height > 20"
        )
        checks.append("页面启动、初始图形与 MathML")

        def set_range(selector, value):
            page.locator(selector).evaluate(
                "(el, value) => {el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}",
                str(value),
            )

        set_range("#n-slider", 10)
        set_range("#epsilon-slider", 0.1)
        expect(page.locator("#n-slider-value")).to_have_text("10")
        expect(page.locator("#observation")).to_contain_text("N = 10")
        page.locator("#step-button").click()
        expect(page.locator("#n-slider-value")).to_have_text("11")
        expect(page.locator("#observation")).to_contain_text("当前 n > N")
        page.locator("#play-button").click()
        expect(page.locator("#n-slider-value")).not_to_have_text("11")
        page.locator("#play-button").click()
        value = page.locator("#n-slider").input_value()
        page.wait_for_timeout(600)
        assert page.locator("#n-slider").input_value() == value
        page.locator("#reset-button").click()
        expect(page.locator("#n-slider-value")).to_have_text("20")
        checks.append("数列滑块、严格 ε–N 边界、单步、播放、暂停、重置")

        for key in ["alternating", "compound", "reciprocal"]:
            page.locator('[data-model="' + key + '"]').click()
            assert page.locator("#chart circle").count() > 0
            page.locator("#next-explanation").click()
            expect(page.locator("#step-count")).to_have_text("02 / 04")
            page.locator("#previous-explanation").click()
            expect(page.locator("#step-count")).to_have_text("01 / 04")
        checks.append("三个数列模型与分步讲解")

        page.locator('[data-chapter="function"]').click()
        set_range("#h-slider", 0.001)
        expect(page.locator("#metrics")).to_contain_text("1.999")
        expect(page.locator("#metrics")).to_contain_text("2.001")
        page.locator('[data-direction="left"]').click()
        expect(page.locator('[data-direction="left"]')).to_have_attribute("aria-pressed", "true")
        page.locator('[data-model="sinc"]').click()
        expect(page.locator("#chart-caption")).to_contain_text("弧度")
        page.locator('[data-model="jump"]').click()
        expect(page.locator("#metrics")).to_contain_text("不存在")
        expect(page.locator("#epsilon-slider")).to_have_count(0)
        page.locator("#play-button").click()
        page.locator('[data-chapter="series"]').click()
        expect(page.locator("#play-button")).to_contain_text("自动演示")
        checks.append("三个函数模型、趋近方向、缺失双侧极限、切章暂停")

        for q, status in [(0.5, "收敛到"), (-0.5, "收敛到"), (1, "级数发散"),
                          (-1, "级数发散"), (1.2, "级数发散"), (-1.2, "级数发散"), (0, "收敛到")]:
            set_range("#q-slider", q)
            expect(page.locator("#observation")).to_contain_text(status)
        page.locator('[data-model="harmonic"]').click()
        expect(page.locator("#metrics")).to_contain_text("发散")
        page.locator('[data-model="alternatingHarmonic"]').click()
        expect(page.locator("#observation")).to_contain_text("ln 2")
        checks.append("三个级数模型，公比 0、±1、±1.2 边界")

        page.locator('[data-chapter="sequence"]').click()
        page.locator("#answer-form button[type=submit]").click()
        expect(page.locator("#answer-feedback")).to_contain_text("有效")
        page.locator("#number-answer").fill("9")
        page.locator("#answer-form button[type=submit]").click()
        expect(page.locator("#answer-feedback")).to_contain_text("再想一想")
        page.locator("#hint-button").click()
        expect(page.locator("#hint-text")).to_be_visible()
        page.locator("#number-answer").fill("20/2")
        page.locator("#answer-form button[type=submit]").click()
        expect(page.locator("#answer-feedback")).to_have_class("feedback success")
        expect(page.locator("#side-count")).to_have_text("1/44")
        page.locator("#answer-form button[type=submit]").click()
        expect(page.locator("#side-count")).to_have_text("1/44")
        page.reload()
        expect(page.locator("#side-count")).to_have_text("1/44")
        for chapter, answers in [("sequence", [None, 0, 1]),
                                 ("function", ["2", 2, 0]),
                                 ("series", ["2", 2, 1])]:
            page.locator('[data-chapter="' + chapter + '"]').click()
            for i, answer in enumerate(answers):
                if answer is None:
                    continue
                page.locator('[data-question="' + str(i) + '"]').click()
                if i == 0:
                    page.locator("#number-answer").fill(answer)
                else:
                    page.locator('input[name="answer"][value="' + str(answer) + '"]').check()
                page.locator("#answer-form button[type=submit]").click()
                expect(page.locator("#answer-feedback")).to_have_class("feedback success")
        expect(page.locator("#side-count")).to_have_text("9/44")
        checks.append("九题正答、错误和空输入、提示、分数、去重计数、刷新持久化")

        page.locator("#guide-button").click()
        expect(page.locator("#info-dialog")).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.locator("#info-dialog")).not_to_be_visible()
        page.locator("#progress-button").click()
        expect(page.locator("#dialog-body")).to_contain_text("9 / 44")
        page.locator("#dialog-done").click()
        checks.append("指南与进度弹窗、Escape 关闭")

        for width, height in [(1440, 1100), (1024, 768), (820, 1180), (768, 1024), (390, 844)]:
            page.set_viewport_size({"width": width, "height": height})
            for chapter in ["sequence", "function", "series"]:
                page.locator('[data-chapter="' + chapter + '"]').click()
                assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), (width, chapter)
            page.evaluate("window.scrollTo(0, 0)")
            page.locator(":focus").evaluate_all("(els) => els.forEach(el => el.blur())")
            page.screenshot(path=str(ROOT / "docs" / ("preview-" + str(width) + ".png")), full_page=True)
        checks.append("桌面、平板横竖屏、小屏无页面横向溢出")
        context.set_offline(True)
        if URL.startswith("file:"):
            page.reload()
        page.locator('[data-chapter="function"]').click()
        expect(page.locator("#chapter-title")).to_contain_text("函数极限")
        assert not external_requests, external_requests
        assert not errors, errors
        checks.append("离线运行、无外部请求、无页面脚本异常")
        browser.close()
    for check in checks:
        print("PASS:", check)
    print("Passed", len(checks), "browser check groups.")


if __name__ == "__main__":
    run()
