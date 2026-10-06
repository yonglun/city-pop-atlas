# v38 homepage performance verification

Release: `20261006-performance-v38`. This section describes the current performance release; the v37/v34 sections below are retained only as historical evidence.

- Required startup data, measured from actual built Worker responses on isolated synthetic SQLite: **14,070,715 → 794,096 bytes before compression (94.4% less)**. The old path fetched full graph, all-language articles and About in sequence; the new path preloads app code while loading a compact graph and metadata-only article index. Complete entity details, current-language essays, the full catalog and About load when their views need them. This is a data-size comparison, not a page-load-time percentage or production latency claim.
- Default gzip calculations for those same response bytes: 1,967,660 → 87,241 bytes. These are reproducible local compression calculations; live wire compression was not measured. Existing Nginx gzip configuration remains unchanged.
- Content-hashed script/style/icon paths support long-lived public caching. Legacy asset bytes stay source-identical and revalidate; public graph/detail/article responses use ETags with revalidation. Database identity, source revision and transactional epoch determine public snapshot reuse. Private/admin responses remain no-store and do not emit public validators or conditional 304 responses.
- No blocking external font stylesheet; first-screen hidden About and search-index DOM are deferred. Automatic graph rotation, saved pause preferences and reduced-motion behavior are preserved.
- Independent audit: 11 API groups and 22 full-catalog UI groups passed, covering exact lazy/full content and license fidelity, retries, Close, language and history races, article/body/index refresh, alias and topology reconciliation, revision/epoch races, private isolation, full SSR and static dependency hash parity.
- Site/Linux parity: 371 shared public/data/schema/migration/server/test files match byte-for-byte. The original Site authentication adapter is preserved. Ten Site-specific auth, analytics, performance/cache, atomic snapshot and SEO suites pass against its separately built Worker.
- Real local v37 → v38 → v37 → v38 HTTP/SQLite preflight preserved all 89 editorial/audit rows, including newer edits, overrides, undo/merge history and source imports. Existing `.env` bytes and mode remain unchanged. Schema and migration files are identical; source catalog revision is intentionally unchanged because its complete payload is identical. Includes 420 public API denials, 128 CSRF denials and 97 SEO/privacy checks.
- Release gates: the complete 63-stage application suite, seven SEO stages and three new performance stages all passed (73/73). Exact extracted archives are then checked for deterministic bytes/modes, npm-free startup, checksums, all public assets and versioned dependencies, all 963 sitemap pages, and upgrade/rollback/re-upgrade behavior.
- Limits: no user Linux server was accessed or deployed. Docker/Compose transport in the operator drill is stubbed, not container-tested. The cloud browser refused loopback navigation, so no real-browser visual, audio, FCP/LCP or TTI result is claimed. Public-host TLS/firewall and owner analytics settings were not changed. Local tests do not imply a GitHub CI pass.

# v37 Linux release verification

Release: `20261006-catalog-v37`. This section supersedes the historical release notes below.

- Source catalog: 1,467 entities, 1,985 base relationships, 253 full essays and distinct illustrations, 1,214 contextual introductions, 4,401 entity-language pages, 91 editions and 1,016 track positions. Private Site editorial overlays and history are not exported.
- Independent source parity: all 288 shared public/data/database/migration/server files match the v37 upstream except the explicit Linux authentication adapter; the portable build only removes private Sites metadata output.
- SEO: all 963 clean-source sitemap pages have HTTP 200, self canonical, four language alternates and valid JSON-LD. Context pages stay noindex; private/admin sitemap is 404; unknown routes are 404. Production origin is environment-bound.
- Actual local Node 24.19.0 HTTP/SQLite v34 → v37 → v34 → v37 preserves all six editorial/audit tables (89 rows), including decisions written after upgrading, approved overrides, undone removals and merge aliases. Existing source import history is preserved; schema and migration bytes are unchanged. Includes 420 public API denials, 128 CSRF denials and 97 SEO/privacy checks.
- Operator-shell rehearsal verifies archive extraction, migrations, backups, upgrade, rollback and re-upgrade. Five checkpoints preserve exact `.env` bytes/mode and existing credential-file bytes/mode; three backups are verified. Docker process transport is stubbed, not container-tested.
- npm-free extracted runtime: all 265 frozen public assets, catalog/relation identities, checksums, private/public separation, CSRF and restart persistence pass. All 963 sitemap pages are crawled through actual local HTTP.
- No user Linux host was accessed or modified. Docker CLI/daemon and real Compose/Nginx execution are unavailable in this environment. The public host, TLS, firewall, owner GA4 settings and actual browser/audio playback still need host/account-owner checks. No GitHub CI pass is implied by local tests.

# 2026-10-06 SEO v34 部署包验证

本次交付标签为 `20261006-seo-v34`，归档根目录为 `city-pop-linux-deploy-20261006`。完整 Linux 可移植源码和预构建运行时随包提供。公开 GitHub 基线仍为 `34a0aaac1ec01d8f56c262ff433227737555727b`；历史私有 SEO 上游标识不在本节复述。本次没有推送 GitHub，没有部署真实 Linux 主机，没有变更私有预览访问权限或任何分析账号。

`release.json` 区分 `publicGithubBaseCommit`、`privateSeoSourceCommit`、原始 SEO 补丁散列 `portableSeoPatchSha256` 和打包输入树散列 `buildInputTreeSha256`；`sourceCommit` 指向私有 SEO 来源，不能解释为新的公开提交或与整个适配源码完全相同的 Git 树。原始补丁已与公开 v33 基线工作树的完整 binary diff 逐字节核对。最终源码树和运行时由包内全文件 `SHA256SUMS`、归档散列和规范化模式指纹识别。

## 当前源码检查

- 应用回归的完整 57 个阶段并行逐项执行；最终全部阶段状态见交付验证结果。Python 单元测试共 26 项，其中 18 项检查确定性打包、私有来源标注、输入树指纹、分卷大小、损坏／缺失／截断检测和拒绝不安全路径。
- 7 个 SEO 检查阶段通过：3,678 个实体语言 URL 往返、798 个站点地图 URL 的无 JavaScript HTML、961 项 SEO／安全断言、174 项真实生产 HTTP／管理边界检查。server-rendered 正文、来源、canonical、hreflang、JSON-LD、分页、HEAD、真实 404、别名跳转、批准覆盖、撤销及源更新缓存隔离均受覆盖。
- 独立真实 HTTP 爬取通过：应用只绑定本机 loopback，配置生产 origin `https://city-pop.softmatrix.io`，逐一读取 798 个 sitemap URL。所有返回 HTTP 200，canonical 以配置域名为准，3,192 个 hreflang alternate 指向同一公开 origin，798 个 JSON-LD 文档可解析，XML 使用标准解析器验证。未连接线上域名。
- 背景导读保持 self-canonical 与 `noindex,follow`；错误 URL 返回 404。公开与管理监听器分别验证，伪造 Host／转发头不能改变域名或提权；私有模式 sitemap 404、robots 禁止抓取，管理内容 noindex。私有身份、待审原因与审核历史没有进入公开 HTML。
- 16 项 Linux 部署检查与 9 项运维回归通过。运维回归使用模拟 Docker 传输边界，不是容器验收。真实 Node HTTP 与 SQLite 的 v27→v34→v27→v34、v33→v34→v33→v34 分别保留六类审核／审计表共 89 行，包含升级后新增决定、撤销后的移除及合并别名；每条路径另验证 420 项公开接口拒绝、128 项 CSRF 拒绝和 97 项 SEO／隐私检查。四份历史 SQL 迁移完全一致；v33→v34 的 catalog revision 未变，仅在旧新目录数据完全相同时允许。
- 原始混合换行 `.env` 的全部字节和权限在启动、升级、回滚、再升级后不变。实际运维 shell 对真实归档完成校验／安全解包、Node SQLite 迁移与备份、升级与 code-only rollback，再升级及重复升级；五个检查点保留 `.env` 和已有管理口令文件，三份备份通过完整性核对。Docker 调用用隔离测试替身，不能用它证明真实 Compose／Nginx 可运行。
- 原子目录更新仍按 UTF-8 字节分块在一个事务提交，参数保持低于 1,800,000 字节；失败回滚、审核覆盖保留、同版幂等启动继续受应用检查覆盖。基础数据仍为源码公开快照，没有导出线上私有数据库。

## 归档验收与复核命令

TAR.GZ 与 ZIP 打包器逐项核对所有文件内容和规范化执行权限完全相同，生成每文件 SHA-256，并以固定上游时间戳生成确定性归档。分片每片不超过 15,000,000 字节。随附 `.parts.json`、Python 3 合并脚本、分片校验清单与完整归档校验和应保存在同一目录。合并器逐片与整体校验，原子生成归档并拒绝覆盖不相同的既有文件。

发布交付检查在两个独立输出目录重新打包和逐文件比较；解包后的两个格式分别执行无 npm 依赖运行测试和 798 URL HTTP sitemap 爬取。静态资源共 220 项：219 个不可变资源响应逐字节比对，图谱入口 HTML 去除明确的服务端 SEO 附加标记后与源资产逐字节比对。最终散列和实际归档检查结果以交付时记录为准，不能用候选包的散列验证最终包。

```sh
npm ci
npm run build
npm test
npm run test:seo
npm run test:deployment
python3 deploy/scripts/test_scripts.py
node tests/linux-upgrade.mjs VERIFIED_V27_DIRECTORY
node tests/linux-upgrade.mjs VERIFIED_V33_DIRECTORY
node tests/package-release.mjs EXTRACTED_RELEASE PRIVATE_SEO_SOURCE_COMMIT
node tests/package-seo.mjs EXTRACTED_RELEASE
python3 tests/linux-operator-upgrade.py VERIFIED_OLD_TAR FINAL_TAR
```

这些可重复检查只使用本机合成数据。以上占位路径必须替换为已核验的实际归档或目录，不能指向真实用户运行库；无 npm 运行验收应在原样解包、未安装 node_modules 的目录中执行。真实容器部署仍按 `DEPLOYMENT.md` 先备份、保留全部现有 `.env`、核对来源和 SHA-256，再由运维者执行。

## 尚未执行的边界

- 此环境无 Docker CLI／daemon；未做真实镜像构建、Nginx 容器、镜像拉取、目标主机重启、跨架构、证书、DNS、SSH 或防火墙验收。配置已静态核对：Nginx 的通用 location 反向代理所有新阅读路由、robots 与 sitemap，没有 SPA 的 `try_files` 静态回退；部署后仍须由运维者实测。
- 未访问或修改用户 Linux 主机及其数据库／配置；没有升级线上公开网站。公网 sitemap 的可用性需要安装本包并保留正确的 `PUBLIC_ORIGIN` 后验证。
- 没有真实 GA4／Clarity 流量、账号修改、搜索引擎提交、收录或排名验收，也不承诺生成式搜索推荐。手动 page_view 使用者须由账号所有者核对并关闭 GA4 增强型衡量的浏览器历史页面变化选项，避免重复记数；见部署手册和官方参考。
- 无第三方音乐实际播放、地区可用性或真实浏览器完整视觉验收。本次没有复制任何 `.openai`、私有环境文件、运行数据库、现场审核导出、凭证或部署身份清单。

以下为历史记录，旧数字及 GitHub 发布叙述仅描述其对应版本。

---

# 历史记录 2026-10-05 v33 发布验证

本轮把 CD 发行版补全及五批人物扩展累计合入既有 Linux 公共源码。基础快照为 1,226 个实体、1,711 条关系、76 个发行版与 835 个曲目位置；不是线上私有数据库的导出。schemaVersion 1 与四份既有 SQL 迁移保持不变。

## 已完成并通过的源码检查

- 完整应用测试链：`npm test` 的 57 个阶段通过，包括 24 项 Python 测试（其中 16 项为打包器测试）。使用 Node.js 24.19.0 和锁定依赖。打包器测试覆盖实际超过 20 MB 的完整运行时、固定上限分卷、确定性输出、缺失／损坏／截断分卷、路径安全和拒绝覆盖其他文件。
- 资料与静态内容：1,226 个条目、3,678 个语言版本，分别为 208 篇完整专文与 1,018 篇背景介绍。208 幅独立概念插画逐项核对来源清单与 SHA-256，全部互不重复；3 张 About 授权照片保留作者、来源、日期和许可。公开待审种子与 Linux 安全适配保持，不混入线上审核状态。
- 三语 DOM：111 个语言／加载状态、3,054 个背景介绍语言视图、全部 73 首歌曲的三语阅读／来源／插图／返回状态，以及五批人物、发行版曲序和来源边界回归。新访客仍默认英文；有效语言选择、减少动态偏好、已保存暂停和隐藏页面状态保留。
- 隐私与权限：27 个模拟客户端同意／撤回／存储竞争／DNT／GPC／审核隔离用例，1,050 项 Sites 拒绝矩阵和 840 项 Linux 拒绝矩阵。Linux 生产 HTTP 另行检查 Basic Auth、Host、Origin／CSRF、请求体及内容类型、公开只读、管理分析排除、重启和幂等迁移。测试使用虚构分析 ID 和每次生成的随机测试口令，没有加载真实供应商脚本。
- 大快照原子性：开发与生产 SQLite 适配器分别验证。当前快照使用 13 个事务语句，其中实体分为两块，最大参数为 1,799,230 UTF-8 字节，低于 1,800,000 上限。后续块唯一性错误完整回滚；超大单行和超出 32 语句预算在删除基础数据前拒绝。成功刷新与同版幂等读取均保留审核记录。
- 同日旧版实测：使用公共 GitHub 提交 `8d7f2e121ddde1e491b3320e9e6030cc80f833f8` 构建 v27，再执行真实本地 Node HTTP／SQLite 的 v27→v33→v27→v33。批准、拒绝、待审、字段覆盖、撤销记录、撤销后的实体移除、合并后的别名／移除以及升级后新写入均保留；包含 420 项公开路由／方法拒绝和 128 项 CSRF 拒绝。
- 运维脚本：Bash 语法和 9 项模拟 Docker 的运维测试通过。整个合成 `.env`（含旧版标签、原有分析配置、自定义值和注释）在同日升级、回滚、再升级及重复升级后逐字节不变。已批准实体的撤销和合并是受支持的移除路径，不宣称存在单独的删除 API。
- 真正 SQLite 备份／恢复：从快照 A 备份后写入 B；未确认恢复被拒绝且 B 保持；显式恢复后 A 生效，B 在恢复前安全备份及保留旧库中均可恢复，同时核对权限、完整性和外键。仅回滚代码的另一路径不恢复旧备份，保留升级后的新决定。

复核命令：`npm run build`、`npm test`、`npm run test:deployment`、`node tests/linux-snapshot-chunks.mjs`、`node tests/linux-upgrade.mjs VERIFIED_V27_DIRECTORY`、`bash -n deploy/scripts/citypop.sh`、`python3 deploy/scripts/test_scripts.py`。

## 交付文件核对

完整 TAR.GZ 与 ZIP 保留全部公开源文件、图片及预构建 `dist/server/index.js`，运行无需安装 npm 依赖。`release.json` 的标签为 `20261005-v33`；安装目录由压缩包散列前缀标识，与同日 v27 不冲突。打包时核对 TAR／ZIP 内容与权限完全一致、每个载荷文件的 SHA-256，并从确认的公共提交写入源码标识与时间戳。

超出附件限制时每卷不超过 15,000,000 字节，另附分卷清单、每格式校验清单和仅依赖 Python 3 标准库的合并脚本。合并脚本核对每卷及完整归档，原子写入且不覆盖其他现有文件。最终交付在独立目录重组两个格式，核对完整散列，并对解包版运行 `tests/package-release.mjs`：无 node_modules 启动、所有公开资源字节、图谱 ID／关系、文章数量、管理认证及隔离。不可把未核实的下载或可变 main 分支名作为归档来源证明。

## 未执行与部署前边界

- 没有 Docker CLI／daemon，未执行真实镜像／容器 Nginx、基础镜像拉取、目标主机重启恢复、跨发行版或 CPU 架构验收。模拟 Docker、DOM 和 Node HTTP 测试不能代替这些。
- 没有连接或修改用户 Linux 主机，没有操作 DNS、代理、TLS、SSH、防火墙、凭证、已有数据库或 `.env`；GitHub 签入与交付部署包不代表已经部署服务器。
- 本轮未做真实浏览器视觉／CSP 验收、实际音乐播放、地区可用性、音频母带等同性或真实 GA4／Clarity 控制台验收。已有分析配置应保留；供应商设置和报表须由运维者在允许的环境验收。
- 包与公共源码不含私有运行数据库、线上批准状态、身份名单、口令、令牌或私有部署元数据。跨 D1 到 Linux 的私有数据迁移不在本次范围。运行时改动应通过覆盖／操作表保存；直接 SQL 修改基础目录行不在保留保障内。
- GitHub Actions／检查状态须按本次完整提交单独核实。没有配置自动检查时，不把零个检查记作 CI 通过。

以下为历史记录，所有旧数字仅描述对应版本。

---

# 历史记录 2026-10-05 v27 发布验证

本轮将全部条目的三语阅读页、歌曲独立原创插图、About 导读与授权照片、默认图云旋转和可选同意式访问分析合入 Linux 公开源码。数据库 schemaVersion 1、四份既有 SQL 迁移和公开目录的 755 个实体、1,117 条关系保持不变。以下只列已完成并确认的分项检查；历史版本的文章、插图和测试数量不可用作本次发布统计。

## 已完成并通过的分项检查

- 内容与静态资产：755 个条目、2,265 个中英日版本；128 篇完整原创专文与 627 篇有来源的背景导读分开计数。128 幅独立原创概念插图与 3 张保留许可、作者、拍摄日期及来源的 About 真实照片核对通过；原有专文正文和既有插画保留。
- 三语界面与导航：111 个语言／加载状态检查及 1,881 个背景导读渲染检查通过，涵盖英文默认、有效语言选择保留、导读映射、引用和返回阅读上下文。默认旋转、减少动态效果、显式暂停及页面隐藏状态亦有应用回归检查。
- 访问分析：27 个模拟客户端隐私用例通过，连同服务端配置检查，覆盖 ID 缺失／无效、允许／拒绝、供应商独立加载、DNT／GPC、持久选择、撤回与重载、存储竞争、BFCache、审核隔离及去重页面浏览。测试使用虚构 ID；没有加载真实供应商脚本，也没有产生真实 GA4／Clarity 流量。
- 管理授权：1,050 项 Sites 拒绝检查和 840 项 Linux 拒绝检查通过。公开与管理边界、错误身份及路由组合继续拒绝访问私有审核数据；这些数量表示授权矩阵用例，不是线上访问或用户数量。
- 打包与运维：13 项打包器测试和 8 项模拟运维测试通过；Bash 语法检查通过。运维测试使用替代 Docker 命令，覆盖包校验、安全解包、私有路径、备份、升级、显式恢复与同 schema 回滚保护，不能证明真实容器行为。
- 真实本地 Node HTTP／SQLite 演练：从已核验的 20261004 旧发布升级至本次代码，再回滚旧代码、再次升级；临时合成的批准、拒绝、待审、结构记录、字段覆盖、审计行和升级后新增决定均保留。使用随机一次性测试口令，不连接真实用户数据库。
- 配置保留演练：使用模拟 Docker 的安装／生命周期／升级／回滚流程，逐字节核对原有 `shared/.env`，保留测试域名、自定义变量和随机管理口令文件。未用 `.env.example` 覆盖既有配置。该演练不连接用户主机，也不证明目标主机的文件权限或 Docker 配置正确。

完整 `npm test` 聚合运行已通过全部阶段，包括 21 项 Python 测试，其中 13 项为上文所列打包器测试，不另行重复计数；8 项模拟运维测试为单独运行。Linux 生产 HTTP 部署回归于 2026-10-05 00:27:43 UTC 确认 `passed: true`，16 项检查通过，加载的公开快照为 755 个实体。

## 未执行与部署前边界

- 本环境没有 Docker CLI／daemon，未执行真实镜像构建、容器 Nginx、基础镜像拉取、目标主机重启恢复、不同发行版或 CPU 架构验收。`--dry-run`、模拟 Docker、DOM 及 Node HTTP 测试不能代替这些验收。
- 没有连接或修改用户 Linux 服务器，没有检查其 DNS、防火墙、SSH、代理、证书、磁盘权限或现有部署。GitHub 源码和部署包的发布不等于已部署服务器。
- 本轮未完成真实浏览器的视觉／CSP 执行验收；此前云浏览器客户端访问本地预览受限。供应商实际遮罩、真实 GA4／Clarity 控制台和流量报表未验证，也未配置真实 ID。启用前需在允许的测试环境中使用明确同意的流量验收。
- 公开快照不包含私有运行数据库、线上已批准状态、所有者身份、口令或访问令牌。现有私有 D1 数据迁移需要另行授权的一致性导出、转换与核对；本次未执行。升级应保留既有 `.env`、数据库及安全设置。
- 第三方音乐／视频仍依赖平台、网络、地区和登录状态；服务器健康及应用测试通过不保证所有地区可播放。
- 当前发布来源最终以归档 `release.json` 的 `sourceCommit`、公开 GitHub 完整提交、TAR／ZIP 内容与随附 SHA-256 为准。校验清单不认证不可信来源；真实主机上线前应按部署手册完成恢复演练。

以下均为按日期保留的历史记录。旧版的 84 篇文章、252／384 个语言版本、84 幅插图、457／733 个实体和 7 项运维测试等数量只描述当时版本。

---

# 历史记录 2026-10-04 v26 英文默认语言发布验证

本轮仅调整首次访问和异常回退语言、加载/错误提示、初始 HTML 语言及标题，并补充回归测试和发布文档。中文、英文、日文的有效手动选择仍在同一浏览器保留；不依据浏览器语言自动切换。没有新增语言 URL 参数，既有审核视图 URL 保持不变。

- `npm test`：完整应用链通过；新增 111 个 UI/加载状态检查覆盖英文默认、中文/日文浏览器、缺失/空/非法/原型键值、存储读取与写入受限、选择后重载、三语导航/审核门禁、真实人物/唱片/歌曲文章的标题与元数据，以及加载、网络、数据和脚本失败提示。旧有专门检查中文文案的测试现在明确设置中文。
- Node.js 24.19.0 构建、全部 128 篇文章/384 个语言版本、44 首歌曲三语流程与 84 幅插画检查通过。所有目录、文章、插图、数据库迁移、后端及生产认证源码与上一公开版本字节相同；755 个实体、1,117 条关系保持不变。
- 1,050 项 Sites 授权拒绝及 840 项 Linux 授权拒绝矩阵通过；Linux HTTP 测试覆盖 Basic Auth、公开/管理入口隔离、Host、Origin/CSRF、私有路径、请求体/类型约束、重启和迁移幂等性。
- 18 项 Python 测试、8 项模拟运维测试通过。真实本地 HTTP/SQLite 的 v25 → v26 → v25 → v26 演练使用临时合成数据，字段覆盖、批准/拒绝/待审、结构记录、审计与升级后写入均保留；线上 D1 未用于这些写入测试。
- 发布归档按 `release.json` 的公开 GitHub commit 和源时间戳生成；交付时核对 TAR/ZIP 内容、权限、文件散列、可复现构建及无需 npm 安装的运行时。归档不包含私有 Site 配置、身份名单、线上数据库或审核状态。

验证边界：没有 Docker CLI，未执行镜像/容器、真实服务器、Nginx/TLS/SSH 或跨架构验收。DOM 与 HTTP 检查不等于新的真实浏览器视觉验收，也不保证第三方音乐在所有地区可播放。线上 Site 保持私有；Linux 包不自动迁入其私有 D1 数据。下列记录属于历史版本。

---

# 历史记录 2026-10-03 v25 GitHub / Linux 发布验证

本轮合入 Piper 两个官方发行版及全部44首歌曲的三语专文，并同步 Linux 发布材料。数据为755个分层实体、1,117条关系、44个发行版覆盖41张专辑、476个曲目位置；128篇专文、384个语言版本。原有84篇专文及84张插画保持不变。

## 本轮验证范围

- Node.js 24.19.0 构建与完整应用回归：授权边界、审核计数和并发保护、资料模型、媒体、导航、审核/撤销、结构操作及 Python 采集器测试。
- 全部44首歌曲 × 3语言的真实页面脚本 DOM 流程：文章入口、标题/正文/来源、语言切换、重复点击、Escape、档案筛选、焦点/滚动恢复、隐藏播放器清理；打包后的 Worker 返回全部128篇文章和原有84张有效 WebP。
- Linux 生产 HTTP 校验包括公开审核读写拒绝、伪造身份拒绝、独立管理员会话、Basic Auth、Host、Origin、请求体约束、重启与幂等迁移。
- 原部署包到新代码、代码回滚、再次升级的真实 HTTP / SQLite 演练，仅使用随机口令和合成数据，检查字段批准/拒绝/待审、覆盖、审核历史、结构批准和升级后新增决定均保留。
- 部署脚本的 Bash 语法与模拟运维回归覆盖同 schema 代码回滚不恢复旧数据库、备份完整性和攻击包拒绝。模拟 Docker 命令不等于容器验收。
- 公开文件清单、Git blob / SHA-256 和可执行权限核对；敏感凭证、身份标识及私有路径扫描。发布压缩包包含预构建运行时，运行不需要安装 npm 依赖。

## 未验证与迁移边界

- 本环境没有 Docker CLI / daemon，未执行镜像构建、容器 Nginx、实际 SSH 隧道、目标服务器 DNS / 防火墙 / TLS 或跨 CPU 架构验收。
- 未部署或修改真实服务器。更新包不包含现有 Site 私有 D1 的批准结果、覆盖和审计历史；需要另行授权导出、迁移并核对。
- DOM 与 HTTP 测试不能替代新的真实浏览器视觉验收，也不保证第三方音乐在所有地区实际可播放。
- 源码 commit、生成包的 sourceCommit、校验和及本次交付的测试记录共同标识发布内容。GitHub Actions 是否存在或运行须以该 commit 的远程状态为准。

以下为历史验证记录，旧数字和“未重建下载包”仅描述当时的源码同步，不代表本次交付。

---

# 历史记录 2026-10-03 GitHub 源码同步验证

本轮从已发布 Linux 源码合入四批公开资料、管理员审核会话和双队列数量修复。Linux 运行时、Docker/Compose、部署脚本、迁移和构建方式保留。生成目录、部署归档、私有运行数据与管理员身份配置不签入。

本轮数据为 733 个分层实体、1,095 条关系，42 个发行版覆盖 39/41 张专辑，共 456 个曲目位置。84 篇文章、252 个语言版本与 84 幅插画保持原有字节。

## 当时的源码验证

- Node.js 24.19.0，锁定依赖，与应用完整测试链。包括 1,050 项 Sites 授权拒绝矩阵、840 项 Linux 认证标志/路由/方法拒绝矩阵、两种授权的 UI 状态、双队列计数和并发状态、完整资料模型、三语 DOM、审核/撤销/结构审核，以及 8 项 Python 测试。
- Linux HTTP 验证包含 63 项伪造身份下的公开私有路由/方法组合、只读/管理会话隔离、Basic Auth、Host、Origin、JSON 与请求体边界、重启和幂等迁移。
- 部署脚本 Bash 语法与 7 项替代 Docker 的模拟运维测试；生产 SQLite 一致性备份及校验。
- 独立审查覆盖 79 项授权/CSRF/内容类型检查、945 项无效 Linux 标志/方法/路由组合（均拒绝且不访问数据库）、会话信息最小化与内部文件路径不可读。
- 公开文件清单、源码散列与敏感标识/凭证模式扫描；只提交公开数据、源代码、测试和文档。

这些检查不证明 Docker 容器、实际服务器或 TLS 已验收。原始部署压缩包未重建，运行中的 Site 和 Linux 服务未部署。下列旧验证记录保留为历史；其 457 实体等数字属于原包。

---

# 历史记录 2026-10-02 Linux 部署包验证

验证环境：Linux，Node.js v24.19.0；2026-10-02 UTC。验证只在隔离副本进行，未修改或部署线上站点。

## 已执行并通过

- `npm run build`：生成随包提供的 `dist/server/index.js`，包含全部站点静态资源；生产镜像构建不需要 `npm install`。
- `npm test`：现有完整应用测试链通过，包括内容、数据模型、SQLite 适配、审核/撤销/结构化操作、三语言 DOM 交互、独立安全与生命周期测试，以及 8 个 Python 测试。
- `node tests/deployment.mjs`：生产 HTTP 运行时启动、公开只读、整个审核/结构化操作 API 的公开读取和写入均拒绝、伪造身份拒绝、Host 校验、64 KiB 请求体上限、管理员认证、公开/管理入口隔离、CSRF 校验、授权预览、重启持久化、幂等迁移通过。
- `bash -n deploy/scripts/citypop.sh` 以及 `python3 deploy/scripts/test_scripts.py`：7 个模拟运维测试通过（校验/攻击包拒绝、预览、幂等安装、备份、升级/回滚、篡改备份拒绝）；这些使用替代 Docker 命令，不证明真实 Docker 行为。
- `production/database-tool.mjs backup` / `verify`：使用 Node SQLite 在线备份 API 得到一致快照，并通过 SQLite quick_check / foreign_key_check。
- 内容核对：84 篇文章，252 个中英日语言版本，84 张不同的 WebP 插画，457 个图谱实体；插画二进制随包提供。
- 独立 HTTP 审核：45 个公开入口变更/身份伪造组合全部被拒绝；管理员真实测试候选导入在重启后保留；私有路径不可从 HTTP 读取；静态 WebP 字节匹配。
- 独立迁移审核：重复启动幂等、迁移前备份、失败迁移回滚、迁移校验和变化拒绝、旧版本启动拒绝。

Linux 版本使用服务端明确传入的认证结果。原有应用单元测试的身份夹具已适配此接口；真正的网络认证边界由 `tests/deployment.mjs` 单独检验。

## 未执行与部署前边界

- 此环境没有 Docker CLI/daemon，因此没有执行 `docker build`、`docker compose up`、容器内 Nginx 启动、镜像拉取、不同 Linux 发行版或 CPU 架构验收。
- 没有连接用户服务器，没有检查其 DNS、防火墙、Docker 网络、SELinux、磁盘权限或 TLS 证书。部署后仍需按主文档完成 HTTP/HTTPS、日志、健康检查和备份恢复验收。
- Dockerfile 使用 Node 24.19.0；Compose 使用 Nginx 1.30.5-alpine。基础镜像不是随包离线镜像，服务器需能拉取或预载镜像；tag 未固定到 digest，使用前可按组织策略固定已验证 digest。
- Nginx 当前稳定版本与安全公告参考：https://nginx.org/en/download.html 和 https://nginx.org/en/security_advisories.html 。实际部署与后续维护需复核基础镜像安全更新。
- 第三方音乐/视频嵌入仍依赖对应平台和访问地区；它们不是随包可离线播放的音视频。
