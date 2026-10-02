# City Pop Atlas · シティポップ

中 / EN / 日本語的日本 City Pop 知识图谱。支持旋转图云、音乐档案、来源证据、人物照片与 Spotify / YouTube 链接。

## 当前迭代 v0.2

- 122 个条目、278 条关系；新增资料仍是代表性收录，不是全量目录
- 持久化 SQL 存储：线上 Cloudflare D1，本地 SQLite
- 人物、唱片、歌曲及角色关系；属性定义与带来源的扩展属性
- 5 张有明确再利用许可的人物照片；7 张唱片通过 Spotify 官方播放器展示封面
- 35 个已核实平台链接（31 Spotify、4 YouTube）；不保证全球可播放
- 资料采集候选 → 人工审核 → 版本化数据集 → 原子导入数据库

## 运行

需要 Node.js 22.13+（建议 Node 24）和 Python 3.9+。不需要 Spotify / YouTube API Key。

```sh
npm ci
npm run build
npm test
npm run dev
```

访问 http://127.0.0.1:8000 。数据库保存在 `.local/catalog.sqlite`；重启保留数据。服务仅用于本地开发，生产运行 Cloudflare Worker。可用 `PORT` 更改本地端口。

## 目录

- `public/`：可编辑 HTML、CSS、JavaScript 前端
- `data/catalog.json`：经过审核、带版本号与来源的资料快照
- `db/schema.ts` / `drizzle/`：数据库定义与增量迁移
- `server/`：Worker HTTP API 与数据库存取
- `scripts/collect_musicbrainz.py`：限速、缓存、候选输出的采集 CLI
- `scripts/serve.mjs`：本地 SQLite 服务
- `tests/`：存储、数据完整性、DOM 回归与采集器测试
- `docs/ROADMAP.md`：迭代规划、完成范围及后续验收标准
- `docs/DATA-MODEL.md`：对象、属性、证据与扩展约定
- `docs/COLLECTOR.md` / `docs/DATA-SOURCES.md`：采集与来源规则

`dist/` 为生成输出，不再是编辑源码目录。构建通过 esbuild 输出可部署的 Worker。

## 存储与发布

数据库 schema 由 Drizzle 迁移；运行时不会 CREATE/ALTER 表。已发布迁移不可重写。首次读取新的资料版本时，在一次 D1 事务批处理中导入整份已审核快照；失败保留旧快照。当前表只存审核资料，尚无访客编辑或个人数据。今后加入人工编辑后台时，应分离编辑草稿与版本发布表，不能直接复用全量快照导入覆盖编辑数据。

GitHub 源码与在线网站分别发布。公共仓库不包含私有部署标识、账号、令牌、数据库文件或研究缓存。默认公开源码不意味着已选定开源许可证；本项目尚未选择代码许可证。

## 图片与第三方服务

人物照片从 Wikimedia Commons 提供，保留作者、来源页、原始裁剪说明、拍摄时间和许可证；未另外裁剪/调色。照片年代并不都是 1980 年代。唱片封面由 Spotify 官方嵌入式播放器提供，不复制/再分发 Spotify 图片。播放器和外部图片会向相应第三方服务发起浏览器请求；地域、登录、服务可用性可能影响显示与播放。音乐与视频链接是已核实的对应条目，数字扩展版、重制版及官方视频版本分别注明。没有匹配证据的链接保持缺失。

本项目不托管音源或歌词。来源与每张照片的许可单独适用。
