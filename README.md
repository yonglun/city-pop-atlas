# City Pop Atlas · シティポップ

中 / EN / 日本語的日本 City Pop 知识图谱。支持旋转图云、音乐档案、来源证据、人物照片与 Spotify / YouTube 站内播放器。

首次访问默认使用英文，不随浏览器语言切换；手动选择的中文、英文或日文会在同一浏览器中保留。清除站点存储、无效语言值或无法读取存储时回到英文。

## 当前迭代 v1.0

- 1,467 个分层实体、1,985 条关系；实体数量包含作品/版本/曲目位置，不是歌曲数量
- 82 张专辑的91个发行版、1016个有序曲目位置、53个词曲作品、54条单独记录的录音
- 候选批次先预览字段差异与来源，再确认加入待审核；识别批内重复、已有决定和未变化值，无效行会阻止整批导入
- 采集审核界面：2个真实冲突候选，支持导入、批准/拒绝、持久化字段覆盖和历史记录
- 持久化 SQL 存储：线上 Cloudflare D1，本地 SQLite
- 人物、唱片、歌曲及角色关系；属性定义与带来源的扩展属性
- 媒体覆盖与逐条缺口以 [媒体清单](docs/MEDIA-COVERAGE.json) 为准：独立授权照片、官方组件肖像、封面人物照片分别统计
- 唱片与歌曲使用核实的 Spotify / YouTube 站内播放器；无自动播放，保留原站链接和版本说明
- 224 个已核实平台链接；不保证全球可播放
- 资料采集候选 → 人工审核 → 版本化数据集 → 原子导入数据库

- 档案分类、媒体筛选、关联人物搜索、排序和24项分批展示；返回详情前的位置与筛选
- 分批加载保留已存在播放器，隐藏视图不重复加载播放器

- 可撤销仍然生效的批准：预览恢复值、填写原因、确认；保留历史与并发冲突保护

- 新补全 FOR YOU、RIDE ON TIME 的2023黑胶再版，以及 VARIETY、REQUEST 周年CD；间奏和附加曲有明确标识

- 大泷咏一两张专辑的单层SACD版本及6首歌曲/作品；保留多羅尾伴内原编曲署名，未明确的编曲关系保持空缺

- 详情按人物署名、唱片/版本、歌曲/作品/录音、曲目位置分组；同一人物的多个职责合并显示，人物页可按署名筛选
- 支持返回上一条目并恢复详情滚动与焦点；多步探索后仍能返回原档案筛选和位置

- 新实体、关系、精确发行版录音匹配与重复实体合并：三语表单、JSON预览、依赖/重复建议、明确确认、审核历史及保守撤销
- 54项MusicBrainz精确发行版曲目关联保留待审核；不自动建立录音等同性，不把数字/重制/实体版混为一谈
- 离线manifest转换器生成可审核批次；没有启用定时采集
- 完整流程和边界见 [结构审核](docs/STRUCTURAL-REVIEW.md)，本轮证据、验收和仍未知的资料见 [v1.0记录](docs/RELEASE-1.0.md)

- 新采集3个官方发行版、30个曲目位置、38条关系；12位人物补充61项有来源的属性，并新增林哲司授权照片。详情见 [本轮采集](docs/COLLECTION-2026-10-02-OFFICIAL-EDITIONS.md)。

- 本轮补充6张现有专辑的首个结构化官方发行版、56个曲目位置与64条关系。FULL MOON同编号的官方日期差异保留三语说明；不推定录音同一性。详情见 [六版采集](docs/COLLECTION-2026-10-03-SIX-EDITIONS.md)。

- 继续补全 CIRCUS TOWN、SPACY、LOVE SONGS、Who Are You?、TRANSIT 和 Tea For Tears：新增6个官方发行版、68个曲目位置和80条有来源的关系。保留黑胶A/B面、5首明确的现场加收曲及重制版说明。详情见 [新增六版](docs/COLLECTION-2026-10-03-MORE-EDITIONS.md)。

- 继续补全8张现有专辑：新增8个官方发行版、99个有序曲目位置与107条有来源的关系。保留14个附加曲、黑胶两面、版本限定及官方标题差异；已有用户审核结果保持不变。详情见 [八版采集](docs/COLLECTION-2026-10-03-EIGHT-EDITIONS.md)。

- Piper《Summer Breeze》《Sunshine Kiz》补齐两个2018年Vivid Sound限量纸套CD版及20个曲目位置。现有41张专辑均有至少一个结构化发行版；保留原始年份、逐曲署名和录音同一性的证据边界。详情见 [Piper发行版](docs/COLLECTION-2026-10-03-PIPER-EDITIONS.md)。

- 44个歌曲条目全部配有中、英、日原创专文，共132个新增语言版本；加上原有84篇人物与唱片专文，全站共128篇、384个语言版本。歌曲卡片与详情页可直接阅读并返回原浏览位置。专文保留来源和版本区别，不转载歌词，不把已有唱片/人物插画当作歌曲专属插画。见 [歌曲专文](docs/SONG-ESSAYS-2026-10-03.md)。

- 新增山下达郎与高中正义的6个CD再发行版、65个官方曲目位置与71条关系，保留11个附加位置和4段FOR YOU间奏。全部71个新条目有中英日介绍并链接原有专文与共用插画。RIDE ON TIME、SPACY的日期/介质/重制说明明确标为零售商证据，曲序仍以官方为准。见 [CD版本比较](docs/COLLECTION-2026-10-05-CD-EDITIONS.md)。

- 新增中森明菜、稻垣润一、中原明子、间宫贵子和松下诚，连同6张代表专辑、8首歌曲、6个精确发行版及59个曲目位置。19个新核心条目均有三语长文及独立概念插画；明菜肖像由完整官方组件提供。见 [五位歌手扩展](docs/COLLECTION-2026-10-05-ARTISTS.md)。

- 继续新增国分友里恵、CINDY、饭岛真理、Rajie和须藤薰，各配代表专辑与歌曲，共15篇三语长文与15幅独立插画；5个精确发行版补充56个有序位置。版次、同名艺人及参与职责分别核实。见 [第二批五位歌手](docs/COLLECTION-2026-10-05-ARTISTS-BATCH2.md)。

- 新增松任谷由实（荒井由实）、矢野显子、杉山清贵、久保田利伸与今井优子，连同5张专辑、6首歌曲、5个精确发行版和62个曲目位置。16篇三语长文及16幅独立概念插画补齐全部新增核心条目，五位新艺人的真实肖像均仅以完整官方组件显示。岩崎宏美《月光》以已确认的作曲、演唱署名连接久保田利伸，未推定共同录音。见 [第三批五位歌手](docs/COLLECTION-2026-10-05-ARTISTS-BATCH3.md)。

- 新增濱田金吾、芳野藤丸、惣领智子、山口美央子、安部恭弘，以及五张代表专辑、五首歌曲、五个精确发行版和49个曲目位置。15篇三语长文与15幅独立概念插画完整配套，发行日期差异、特定再版曲序及地区播放限制有明确说明。见[第四批五位歌手](docs/COLLECTION-2026-10-05-ARTISTS-BATCH4.md)。

- 新增南佳孝、杉真理、佐藤博、池田典代、庄野真代，连同五张代表专辑、五首歌曲、五个精确发行版和68个曲目位置。15篇三语长文与15幅独立概念插画完整配套，保留双碟曲序、年份分歧与具体署名范围。见[第五批五位歌手](docs/COLLECTION-2026-10-05-ARTISTS-BATCH5.md)。

- 新增菊池桃子、荻野目洋子、刀根麻理子、桑江知子和岡田有希子：15篇三语专文、15幅独立原创概念插画、5个精确发行版、67个有序曲目位置。保留专辑／单曲版本、卡拉OK附加曲及平台目录差异；未核实的照片与音源不补造。见[第六批歌手](docs/COLLECTION-2026-10-06-ARTISTS-BATCH6.md)。

- 新增尾崎亜美、太田裕美、笠井紀美子、松田聖子和斉藤由貴：15篇三语专文与15幅独立概念插画，5个精确发行版和54个有序曲目位置。保留初版／再版、LP／CD、配信加收曲及录音年代矛盾；已观察到地区限制的Spotify资源作为缺口记录，不计为可用播放器。见[第七批歌手](docs/COLLECTION-2026-10-06-ARTISTS-BATCH7.md)。

- 新增河合奈保子、柏原芳恵、南沙織、桜田淳子和木村恵子：15篇完整三语专文、15幅独立原创概念插画、5个精确发行版及60个有序曲目位置。保留首发日期冲突、LP两面、附加曲与平台限制；不把艺人或专辑的AI概念插画当作肖像或唱片封面。见[第八批歌手](docs/COLLECTION-2026-10-06-ARTISTS-BATCH8.md)。

## 全条目阅读与访问分析

1,467 个条目均有中英日对应介绍，共 4,401 个语言版本：253 篇完整专文配 253 幅各自独立的原创插画；1214 篇版本、曲目位置、作品和录音介绍明确标注共用插画并链接相关长文。“关于 City Pop”先介绍音乐，配有 3 张真实授权照片，资料覆盖放在最后。图谱首次访问默认旋转，尊重减少动态效果和已保存的暂停选择。

Google Analytics 4 和 Microsoft Clarity 默认关闭，可通过 `.env` 配置公开 ID，并须访客明确同意后才加载。见[本轮增强](docs/ENHANCEMENTS-2026-10-05.md)和[隐私与配置](docs/ANALYTICS-PRIVACY.md)。

## 管理员审核访问

采集审核现在要求平台登录身份与服务器管理员名单精确匹配，未完成身份绑定时默认关闭。候选、预览、审核历史、结构操作及撤销全部由后端保护。初次绑定步骤与部署边界见 [管理员访问](docs/ADMIN-ACCESS.md)。

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
- `docs/REVIEW.md` / `docs/COLLECTOR.md` / `docs/DATA-SOURCES.md`：采集与来源规则

`dist/` 为生成输出，不再是编辑源码目录。构建通过 esbuild 输出可部署的 Worker。

## 存储与发布

数据库 schema 由 Drizzle 迁移；运行时不会 CREATE/ALTER 表。已发布迁移不可重写。首次读取新的资料版本时，在一次 D1 事务批处理中导入整份已审核快照；失败保留旧快照。基础表仅存版本化资料；审核候选、字段覆盖与决定历史使用独立表，基础资料重新导入不会删除审核决定。生产审核仅在所有者私有访问范围内启用；扩大分享范围前必须禁用审核或实现所有者权限控制，详见docs/REVIEW.md。

GitHub 源码与在线网站分别发布。公共仓库不包含私有部署标识、账号、令牌、数据库文件或研究缓存。默认公开源码不意味着已选定开源许可证；本项目尚未选择代码许可证。

## 图片与第三方服务

人物照片从 Wikimedia Commons 提供，保留作者、来源页、原始裁剪说明、拍摄时间和许可证；未另外裁剪/调色。照片年代并不都是 1980 年代。唱片封面由 Spotify 官方嵌入式播放器提供，不复制/再分发 Spotify 图片。播放器和外部图片会向相应第三方服务发起浏览器请求；地域、登录、服务可用性可能影响显示与播放。音乐与视频链接是已核实的对应条目，数字扩展版、重制版及官方视频版本分别注明。没有匹配证据的链接保持缺失。

本项目不托管音源或歌词。来源与每张照片的许可单独适用。


## Linux release 20261006-performance-v38

The portable public source now includes multilingual SEO pages and singer batches 6–8: 1,467 entities, 1,985 base relationships, 253 full essays with unique illustrations, 1,214 contextual introductions, and 4,401 entity-language pages. The clean source snapshot produces 963 indexable sitemap URLs. Private Site database overrides and audit history are not part of this export.

Use [the Linux deployment guide](docs/DEPLOYMENT.md) for installation, safe upgrades, backup, restore and code-only rollback. Preserve the complete existing `.env`, including `PUBLIC_ORIGIN` and optional analytics identifiers, and retain the shared database and password file. The release archive includes a prebuilt Node.js 24 runtime bundle and does not require npm on the server. Source builds use `npm ci && npm run build`; run `npm test`, `npm run test:seo`, `npm run test:deployment`, and `python3 deploy/scripts/test_scripts.py` before packaging.

Archives use the distinct stem `city-pop-linux-deploy-20261006-v38` and 15 MB split parts. Use a fresh download folder; never mix earlier same-day files. See `release.json` for release counts and upstream provenance; the packaging command records the verified public GitHub commit and deterministic input-tree fingerprint.

## Homepage performance release

The v38 client starts from a compact graph and parallel app code. Full entity details, article text for the requested language and About content are fetched on demand. Source revision plus transactional catalog epoch invalidate public snapshots; private/admin responses remain isolated. Content-versioned static resources can be validated and reused. External font stylesheets no longer block startup. Existing nginx gzip remains enabled. These changes do not modify the database schema or overwrite operator environment settings.
