# lulu-music-site

LuluMusic 静态分发（GitHub Pages）。

- `/version.json` 更新清单（stable + beta）
- `/sources.json` 内置音源清单（对应 `/lx-sources/*.js`）
- `/donors.json` 赞助榜
- `/roles.json` 用户角色
- APK 走 Release 资产

App 端点解析顺序：github.io → jsDelivr → 旧服务器。改清单只需提交本仓库，无需重发 App。
