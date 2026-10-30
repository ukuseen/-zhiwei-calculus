# 知微 · 高数学习工具

面向经济学大一学生的中文交互式高数学习网站。前三章包括函数、极限与连续性、导数与微分。

- 18 节复习提要、90 道期中题与解析。
- 参数滑块、逐步演示、混合小测、错题重练与薄弱点统计。
- 全站 25 个交互模型，另保留期末预习和级数拓展。
- 无需 ChatGPT 账号；学习记录只存于自己的浏览器，可导出和导入。

## 使用

公开网址以本仓库 Settings → Pages 显示的地址为准。
也可下载 index.html 用浏览器打开。若本地文件受限，运行 `python3 -m http.server 8000`，访问 http://localhost:8000。

## 增加内容

1. 修改 content/*.json 中的实验和题目；新增期中题放 practice-content.json。
2. 教材目录和复习提要在 curriculum.json。
3. 保持已有题目 id 不变，section 对应教材节号，例如 3.4。
4. 提交到 main 后，GitHub Actions 自动构建、检查和发布 dist/。

本地构建：`python3 build_standalone.py`。
数学与记录检查：`node tests/math.test.cjs`、`node tests/calculus.test.cjs`、`node tests/review.test.cjs`。
浏览器测试脚本位于 tests/，需要另行安装 Python Playwright 和 Chromium。

## 首次发布

GitHub Settings → Pages → Build and deployment → Source 选择 GitHub Actions，然后运行 Publish learning site 工作流。
GitHub 免费个人账号使用公开仓库即可启用此类 Pages 托管，实际使用受平台限额约束。

## 迁移学习进度

先在旧站“备份记录”导出 JSON，然后在新站导入。新网址与旧网址各自保存浏览器数据，不会自动同步。

## 内容范围

练习覆盖主要概念与代表题型，不替代教材习题和教师考试范围。第 4—6 章仍在逐步补充。此仓库只含学习工具及开发文件，不含原始教材照片或账号登录资料。
