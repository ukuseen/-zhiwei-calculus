# 公开发布

## GitHub Pages（自动更新）

1. 登录 GitHub，新建公开仓库 zhiwei-calculus。此仓库将包含学习工具源码。
2. 上传本包全部文件，保留 .github/workflows/pages.yml 隐藏目录；也可把仓库链接发给开发助手继续推送。
3. Settings → Pages → Source 选择 GitHub Actions。
4. Actions → Publish learning site → Run workflow。成功后 Settings → Pages 显示正式网址。
5. 之后提交到 main 自动执行构建、32 组数学和记录检查及发布。

## Cloudflare Pages（直接上传备选）

在 Cloudflare 控制台创建 Pages 项目，选择直接上传，把单独的 zhiwei-static.zip 上传并部署。该包根目录只有 index.html。首次可使用平台提供的域名，无需购买域名。此方法后续修改需重新构建并上传 dist/。

## 进度迁移

旧站导出学习记录 JSON，在新站导入。不同网址不自动共享本地记录。用户不需要 ChatGPT 账号。

## 验证记录

迁移使用已发布的期中版源码。重新通过32组数学/内容/记录检查，独立HTML构建通过。托管平台上的自动发布尚未运行；本轮未重跑浏览器测试。原有浏览器回归脚本保留在 tests/。
