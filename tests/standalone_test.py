"""Regression for downloading only the HTML and opening it without sibling files.

Uses a temporary localhost server because the managed test browser blocks file://.
The server directory contains only the copied HTML files, not project assets.
"""
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
from threading import Thread
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


@contextmanager
def isolated_site():
    with TemporaryDirectory(prefix="zhiwei-isolated-") as folder:
        shutil.copy(ROOT / "index.html", Path(folder) / "learn.html")
        shutil.copy(ROOT / "page.template.html", Path(folder) / "legacy.html")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=folder))
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            yield "http://127.0.0.1:" + str(server.server_port)
        finally:
            server.shutdown()
            worker.join()
            server.server_close()


def run():
    with isolated_site() as origin, sync_playwright() as p:
        executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        browser = p.chromium.launch(**options)
        original = browser.new_page()
        original.goto(origin + "/legacy.html")
        original.locator('[data-chapter="function"]').click()
        expect(original.locator("#chapter-title")).to_contain_text("数列极限")
        expect(original.locator("#n-slider")).to_have_count(0)
        assert original.locator(".sidebar").evaluate("(el) => getComputedStyle(el).position") == "static"
        original.close()
        print("PASS: 复现旧版只复制 HTML 时样式丢失、按钮无响应")

        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        # Even blocked browser storage must not prevent startup or current-page exercises.
        context.add_init_script("""
Object.defineProperty(window, "localStorage", {
  get() { throw new DOMException("Storage disabled for test", "SecurityError"); }
});
""")
        page = context.new_page()
        errors = []
        requests = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("request", lambda request: requests.append(request.url))
        page.route("**/*", lambda route: route.continue_()
                   if route.request.url == origin + "/learn.html" else route.abort())
        page.goto(origin + "/learn.html")
        page.locator('[data-chapter="sequence"]').click()
        expect(page.locator("html")).to_have_attribute("data-app-ready", "true")
        expect(page.locator("#startup-notice")).to_be_hidden()
        assert page.locator(".sidebar").evaluate("(el) => getComputedStyle(el).position") == "fixed"
        expect(page.locator("#n-slider-value")).to_have_text("20")
        page.locator("#step-button").click()
        expect(page.locator("#n-slider-value")).to_have_text("21")
        page.locator("#n-slider").focus()
        page.keyboard.press("ArrowRight")
        expect(page.locator("#n-slider-value")).to_have_text("22")
        page.locator("#number-answer").fill("10")
        page.locator("#answer-form button[type=submit]").click()
        expect(page.locator("#answer-feedback")).to_have_class("feedback success")
        expect(page.locator("#side-count")).to_have_text("1/44")
        assert requests == [origin + "/learn.html"], requests
        print("PASS: 单文件无旁置资源，样式、按钮、键盘滑块、答题正常；禁用本地存储不影响运行")

        context.set_offline(True)
        page.locator('[data-chapter="function"]').click()
        page.locator('[data-model="jump"]').click()
        expect(page.locator("#metrics")).to_contain_text("不存在")
        page.locator('[data-chapter="series"]').click()
        page.locator('[data-model="harmonic"]').click()
        expect(page.locator("#metrics")).to_contain_text("发散")
        print("PASS: 断网后仍可切换章节与模型")

        tablet = browser.new_context(viewport={"width": 820, "height": 1180},
                                     is_mobile=True, has_touch=True, device_scale_factor=1)
        touch_page = tablet.new_page()
        touch_page.goto(origin + "/learn.html")
        touch_page.locator('[data-chapter="function"]').tap()
        touch_page.locator('[data-model="sinc"]').tap()
        touch_page.locator("#step-button").tap()
        expect(touch_page.locator("#h-slider-value")).to_have_text("0.4")
        touch_page.locator("#h-slider").tap(position={"x": 24, "y": 2})
        assert float(touch_page.locator("#h-slider").input_value()) < 0.4
        for width, height in [(820, 1180), (1180, 820), (768, 1024)]:
            touch_page.set_viewport_size({"width": width, "height": height})
            assert not touch_page.evaluate("document.documentElement.scrollWidth > innerWidth")
        print("PASS: 平板触控点击、滑块点击、横竖屏无页面溢出")

        disabled = browser.new_context(java_script_enabled=False)
        disabled_page = disabled.new_page()
        disabled_page.goto(origin + "/learn.html")
        expect(disabled_page.locator("#startup-notice")).to_be_visible()
        expect(disabled_page.locator("noscript")).to_be_visible()
        assert disabled_page.locator(".sidebar").evaluate("(el) => getComputedStyle(el).position") == "fixed"
        print("PASS: 禁用 JavaScript 的预览器可见打开说明，内嵌样式仍生效")
        assert not errors, errors
        browser.close()
    print("Passed 5 standalone/browser regression groups.")


if __name__ == "__main__":
    run()
