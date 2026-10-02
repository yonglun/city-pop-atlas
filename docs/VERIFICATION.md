# Linux 部署包验证记录

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
