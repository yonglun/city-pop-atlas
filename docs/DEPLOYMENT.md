# City Pop Atlas Linux 部署手册

本手册用于把 City Pop Atlas 的彩色图谱和图文长文版安装到你自己管理的 Linux 主机。推荐使用本包的 Docker Compose 路径：Nginx 对外提供只读站点，Node.js 24 运行 API，SQLite 数据保存在发布目录之外。管理入口默认关闭，需要时通过 SSH 隧道单独访问。

发布标签为 `20261005-v27`。本次发布为全部 755 个条目提供三语阅读页，补齐 44 幅歌曲专属原创插图，更新 About 三语导读和 3 张授权真实照片，并加入默认关闭的可选访问分析。首次访问仍为英文，Linux 运行和安全边界保持不变。准确发布标签和 GitHub 源码提交见包内 `release.json` 的 `version` 与 `sourceCommit`。包内载荷文件列入 `SHA256SUMS`（清单自身除外）；压缩包整体 SHA-256 在随附 `.sha256` 文件中。归档文件名为 `city-pop-linux-deploy-20261005.tar.gz` 和 `city-pop-linux-deploy-20261005.zip`；下载后仍须同时核对发布标签和散列值。这里提供部署材料，不代表已经在你的服务器部署。

首次访问不随浏览器语言自动切换；没有已保存语言、保存值无效或浏览器存储不可用时，均使用英文。用户明确选择并成功保存的 `zh`、`en` 或 `ja` 会保留；中文和日文切换及既有翻译仍可使用。本版没有改变目录实体、关系或数据库 schema。图云首次访问默认旋转；系统减少动态效果偏好和已保存的暂停选择优先，页面隐藏时暂停动画。

已有安装请直接阅读第 7 节原位升级流程，先确认现有安装根目录和备份。不要把新包的 `.env.example` 复制覆盖正在使用的 `shared/.env`，也不要重新初始化现有数据库。新安装才使用第 2 节。

## 1 部署前先确认

### 交付范围和验证边界

包内包含可运行的预构建 `dist/`、应用源文件、755 个条目的 2,265 个中英日文本版本、版本化公开目录快照、数据库迁移、Dockerfile、Compose 配置和运维脚本。其中 128 篇为完整原创专文，627 篇为与具体发行版、曲目位置、作品或录音参考对应的背景导读；不能把 627 篇导读称为完整长文。128 篇完整专文各有独立原创插图，包含保留的 84 幅及新增的 44 幅歌曲插图。背景导读明确标注共用插图。About 另有 3 张保留作者、日期、来源和许可的真实照片。

公开基础快照包含 755 个实体、1,117 条关系、41 张专辑、44 个发行版、476 个曲目位置与 44 个歌曲实体；44 个发行版覆盖全部 41 张专辑。这些是源码快照的数量，不是从你的线上数据库导出的实时统计。

本次交付环境可以运行 Node 和源码测试，但未安装 Docker 命令行工具，未执行真实 Docker 容器验证。Docker 镜像构建、真实容器联通、目标主机重启恢复及目标域名 HTTPS 尚需你在服务器上验收。不要把源码测试或脚本模拟结果当作容器已经成功启动的证明。本包的构建、应用回归、歌曲三语内容、Linux 认证、备份和脚本测试的具体结果与限制见 `docs/VERIFICATION.md`；发布前应按该记录核对实际执行范围。

本包仅包含公开源码快照，不包含管理员口令、证书私钥、账号、访问令牌、私有所有者身份或已有运行数据库。它也不包含现有 Cloudflare D1 数据库导出、线上已批准状态及私有部署配置。首次 Linux 启动会载入本包的公开基础快照，不会自动搬来线上私有的审核决定、字段覆盖或审计历史。源码附带的候选／结构操作只是待审种子资料，不代表线上处理状态。需要完整迁移时，先阅读第 9 节，再决定切换时间。

### 主机与工具

建议在仍受支持的 Ubuntu 或 Debian 64 位发行版上使用官方 Docker Engine 和 Docker Compose v2。其他可运行 Docker 的 Linux 发行版可能适用，但本包没有逐一验证。amd64 和 arm64 均需在目标架构实际拉取基础镜像并测试，不能把本次本地验证视为跨架构认证。

- 建议从 1 个 CPU、2 GB 内存、10 GB 可用磁盘开始，并为镜像、日志和备份预留增长空间。这是小型站点的起步建议，不是容量压测结论。
- 需要 Bash、带 SQLite 支持的 Python 3、`flock`、`tar`、`sha256sum`、`awk`、Docker Engine 和支持 `up --wait` 的 Docker Compose v2。示例排错使用 `curl`、`ss` 和 SSH 客户端。
- 构建镜像不执行 `npm install`，因为 `dist/` 已随包交付；首次构建仍需获取 Node 和 Nginx 基础镜像，除非已预先载入。构建镜像成功不代表第三方播放器可以离线播放。
- 使用一个固定的运维账户管理安装根目录。该账户需要 Docker 访问权；Docker 访问通常相当于主机 root 权限。不要把 Docker socket 改为所有人可写，也不要交替用不同账户操作同一个安装目录。
- 生产入口建议使用你已有的 HTTPS 反向代理。域名、DNS、TLS 证书及续期由主机管理员配置，本包不代为注册、签发或续期。

Docker 官方安装参考：Ubuntu https://docs.docker.com/engine/install/ubuntu/ ，Debian https://docs.docker.com/engine/install/debian/ ，Compose https://docs.docker.com/compose/install/linux/ 。请按发行版安装；脚本不会自动安装软件、修改防火墙或重启 Docker 守护进程。

### 从 GitHub 源码生成部署包

如果已经收到可信的部署包及对应 `.sha256` 文件，可以跳到第 2 节。GitHub 仓库保存可维护的源文件，不提交 `dist/`、压缩包或包内校验清单；发布脚本从确定的提交生成独立交付文件。不要从未提交改动或不明确的来源制作正式包。

以下步骤在装有 Git、Node.js 24、npm、Python 3、Bash 和 sha256sum 的构建主机执行。先克隆仓库并检出你确认的提交，再在仓库根目录执行。`npm ci` 会从 npm 下载锁定依赖；将输出目录放在仓库外。

```sh
set -e
SOURCE_COMMIT=$(git rev-parse HEAD)
SOURCE_DATE_EPOCH=$(git show -s --format=%ct "$SOURCE_COMMIT")
OUTPUT_DIR=$(mktemp -d)
npm ci
npm run build
npm test
npm run test:deployment
npm run test:privacy
bash -n deploy/scripts/citypop.sh
python3 deploy/scripts/test_scripts.py
```

测试通过后构建归档。打包脚本要求已构建的 `dist/`，并核对 Git 提交、未提交及未跟踪文件状态；它仅对待归档副本生成发布来源和包内散列清单，不回写源码文件。

```sh
python3 scripts/package-release.py \
  --source-commit "$SOURCE_COMMIT" \
  --source-date-epoch "$SOURCE_DATE_EPOCH" \
  --output "$OUTPUT_DIR"
printf '部署包与校验文件目录：%s\n' "$OUTPUT_DIR"
```

输出包含 TAR.GZ、ZIP 及各自的 `.sha256` 文件。运维脚本只接受 `.tar.gz`；ZIP 供检查和另行使用。相同源文件、构建结果、提交与源时间戳产生确定性归档。不要将运行数据库、备份、口令或私有配置复制到源码目录中参与打包。

将压缩包及 `.sha256` 文件通过可信渠道一同传到目标服务器，接下来的命令在服务器执行。源码构建和打包不需要 Docker，但不代表已验证真实容器运行。`release.json`、构建文件与随附校验值共同确定交付版本。

## 2 全新安装流程

以下命令在服务器的 Bash 中执行。把压缩包和随附校验文件放在同一工作目录。校验文件应来自与你确认过的发布包相同的可信交付渠道；仅自己重新计算散列值，不能证明包的来源。

### 校验并暂存版本

```sh
set -e
sha256sum -c city-pop-linux-deploy-20261005.tar.gz.sha256
ARCHIVE="$PWD/city-pop-linux-deploy-20261005.tar.gz"
DIGEST=$(awk '{print $1}' "$ARCHIVE.sha256")
tar -xzf "$ARCHIVE"
ROOT="$HOME/citypop"
bash city-pop-linux-deploy-20261005/deploy/scripts/citypop.sh \
  --root "$ROOT" install "$ARCHIVE" "$DIGEST"
CTL="$ROOT/current/deploy/scripts/citypop.sh"
```

`install` 只校验、解包并建立目录，不启动服务。它要求安装根目录是绝对路径、归当前账户所有、权限为 0700，并且路径中没有符号链接。第一次安装可让脚本创建新目录。已有安装请使用 `upgrade`，不要重跑 `install`。

脚本会核对压缩包的预期 SHA-256 和所有包内文件的 `SHA256SUMS`，拒绝路径穿越、重复路径、符号链接、特殊文件和超限包。若提示校验失败，停止使用该文件，重新取得可信交付；不要关闭校验继续安装。

### 启动默认只读站点

默认配置仅监听服务器回环地址 `127.0.0.1:8080`。先查看配置，再启动：

```sh
nano "$ROOT/shared/.env"
bash "$CTL" --root "$ROOT" start
bash "$CTL" --root "$ROOT" status
curl --fail http://localhost:8080/healthz
```

健康检查应返回 `ok`。在服务器本地浏览器中打开 `http://localhost:8080`。如果你从自己电脑远程管理服务器，可以在自己电脑执行下面的 SSH 隧道命令；把 `YOUR_USER@YOUR_SERVER` 换成实际 SSH 登录目标：

```sh
ssh -N -L 8080:127.0.0.1:8080 YOUR_USER@YOUR_SERVER
```

保持 SSH 会话开启，再在自己电脑访问 `http://localhost:8080`。域名对外上线前，完成第 4 节的 HTTPS 配置。

运行前预览支持 `--dry-run`，位置在子命令之前。例如：

```sh
bash "$CTL" --root "$ROOT" --dry-run start
```

预览会读配置和已安装文件、打印计划，不修改文件或容器，也不验证真实容器一定能运行。它不能代替正式启动验收。后续命令沿用本节的 `ROOT` 和 `CTL` 变量；每次新开服务器终端，请重新设置这两个变量。

## 3 目录和配置

### 运行目录

安装根目录与压缩包解包目录是两回事。安装后的持久数据放在 `shared/`，每个发布版本放在 `releases/`，`current` 指向当前版本。

```text
$HOME/citypop/
  current -> releases/<16 位压缩包散列前缀>
  releases/<版本 ID>/
  shared/.env
  shared/data/catalog.sqlite
  shared/backups/
  shared/secrets/admin-password   # 仅启用管理时创建
```

发布目录保存代码和构建结果；不要把数据库放进去，也不要直接修改发布目录中的已校验文件。`stop` 只停止服务，保留数据、镜像和备份。脚本不会清理旧版本或自动淘汰备份，请监控磁盘空间并按你的保留策略处理。

### 可修改的站点配置

编辑 `$ROOT/shared/.env`，权限保持 0600；例如使用 `nano "$ROOT/shared/.env"`。修改后运行 `restart` 重新创建服务并应用配置。不要用 shell 的 `source` 执行 `.env` 文件。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| PUBLIC_ORIGIN | http://localhost:8080 | 浏览器实际访问的完整源地址，含协议及非默认端口，不带末尾斜杠 |
| HTTP_BIND | 127.0.0.1 | 公共 HTTP 端口在主机的绑定地址 |
| HTTP_PORT | 8080 | 主机公共 HTTP 端口 |
| RELEASE_TAG | 20261005-v27 | 新安装的镜像标签；升级保留现有配置，按需要单独调整 |
| ADMIN_ENABLED | false | 只有设为 true 才启动管理监听 |
| ADMIN_ORIGIN | http://127.0.0.1:8081 | 管理浏览器访问的精确源地址 |
| ADMIN_HOST_PORT | 8081 | 映射到主机回环地址的管理端口 |
| GA_MEASUREMENT_ID | 空白 | 可选 GA4 公开 Measurement ID；空白或格式无效时关闭 |
| CLARITY_PROJECT_ID | 空白 | 可选 Clarity 公开项目 ID；空白或格式无效时关闭 |

`CITYPOP_DATA_DIR`、`CITYPOP_BACKUP_DIR`、`CITYPOP_SECRETS_DIR`、`CITYPOP_UID` 和 `CITYPOP_GID` 由运维脚本根据安装根目录及执行账户注入。按本手册部署时不要另改它们来指向其他安装。脚本使用固定 Compose 项目名 `citypop`，同一 Docker 守护进程不要并行安装多个本包实例。直接使用 Compose 时必须自行正确设置这些变量、持久路径、权限和项目名，不建议与脚本流程混用。

### 可选访问分析和隐私选择

GA4 和 Microsoft Clarity 都默认关闭，包内未提供真实 ID，也没有开通账号或启用线上跟踪。已有 `.env` 没有这两个变量时无需补填，Compose 按空白处理。若要启用，只在 `shared/.env` 中填入你自己的 GA4 网页数据流 Measurement ID（`G-…`）和 Clarity 项目 ID；不要填 API Key、口令、令牌或管理身份。修改后用 `restart` 重建服务。

即使配置了 ID，访客仍须通过三语“隐私选择”明确允许，才会加载相应供应商脚本；允许与拒绝同等醒目，拒绝不影响浏览。页面保留“隐私选择”入口，浏览器会保存允许或拒绝状态。访客可再次打开它并选择“拒绝访问分析”撤回同意。已加载分析脚本时，撤回会保存拒绝、停止后续应用事件、尽力清除可读的第一方分析 Cookie，并重新载入到 `/?privacy=off`。重新允许须由访客主动操作。没有配置 ID 时仅显示说明，不弹出无意义的同意提示。

管理／审核页面排除在分析之外，已认证管理员收到空白分析配置；DNT 和 GPC 隐私信号也会阻止加载。搜索文本、原始查询参数、片段、用户标识和审核信息不加入应用分析事件。供应商启用后仍会收到正常设备及连接信息，包括传输 IP 地址。撤回不能召回已发送或正在传输的请求，不能删除 Google／Microsoft 域下 Cookie 或历史服务端数据。

启用前，在 GA4 关闭 Enhanced Measurement 的自动历史页面浏览等可能超出手动事件范围的自动采集，并在 Clarity 配置严格遮罩。运营者需自行确认隐私告知、保留期限和供应商设置。应用测试使用虚构 ID；真实浏览器 CSP、供应商遮罩及在线报表尚需在允许的测试环境中用明确同意的流量验收。完整边界见 `docs/ANALYTICS-PRIVACY.md`。

### 端口与网络

容器内部公共服务使用 8000，Nginx 使用 80；主机默认只映射公共 HTTP 到 `127.0.0.1:8080`。管理服务在启用后使用容器端口 8001，主机仅绑定 `127.0.0.1:8081`。它不会通过公共 Nginx 转发。

外部网络通常只需到现有 HTTPS 代理的 443，以及你批准的 SSH 入口。是否开放 80 取决于你的证书和重定向方案。不要对公网开放 8000、8001 或管理端口。Docker 发布端口可能绕过部分 UFW/firewalld 规则，不能只靠防火墙前端显示来判断是否暴露；同时检查绑定地址和主机外部连通性。

若只在受控测试网络直接访问 HTTP，可在理解暴露范围后调整 `HTTP_BIND` 和 `PUBLIC_ORIGIN`。正式公网访问推荐继续保留回环绑定，由 HTTPS 代理转发。

## 4 使用已有域名和 HTTPS

全新安装时，先将实际域名解析到服务器，并准备对应的有效证书和私钥。保持 `HTTP_BIND=127.0.0.1`，把 `PUBLIC_ORIGIN` 设为浏览器实际使用的 HTTPS 源地址，例如 `https://YOUR_DOMAIN`，不带末尾斜杠。已有站点应保留现有正确的域名、代理、证书和 `.env`；已修复的 Host 配置无需重置为 localhost。

下面是主机上已有 Nginx 的反向代理配置示意，不是可原样执行的证书签发脚本。域名和两个证书文件路径必须换成真实值。此配置位于主机现有 Nginx，不能误放进本包的容器 Nginx 配置。

```nginx
server {
    listen 443 ssl;
    server_name YOUR_DOMAIN;
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    client_max_body_size 64k;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

让主机管理员验证并重载已有代理，例如确认 `sudo nginx -t` 成功后执行 `sudo systemctl reload nginx`。若修改了 `.env`，回到安装账户运行 `bash "$CTL" --root "$ROOT" restart`；首次启动可用 `start`。从外部浏览器检查证书、主页、图谱和文章。若 HTTPS 使用非标准端口，`PUBLIC_ORIGIN` 和转发的 Host 都必须保留该端口。

本包公共适配器检查 Host；当 `PUBLIC_ORIGIN` 已是域名时，用服务器 IP 或 `localhost` 访问普通页面会得到 421。这是配置与访问地址不一致，不是要求关闭 Host 检查。`/healthz` 例外，可继续通过回环地址检查存活。

本包不接收调用方提供的 `oai-authenticated-user-*`、`X-Forwarded-*` 或 `Forwarded` 等头作为管理身份。普通 HTTPS 代理只能接公共 8080，绝不能将域名代理到管理 8081 来绕过 SSH 隧道。

Nginx 官方 HTTPS 参考：https://nginx.org/en/docs/http/configuring_https_servers.html 。证书续期、到期告警和代理安全加固属于主机运维责任。

## 5 可选的私有管理入口

只有需要采集审核、批准拒绝或结构编辑时才启用管理。公共入口只提供图谱、文章和公开媒体，审核及操作 API 的查询和写入均关闭；待审、拒绝备注和审计历史只在管理入口可读。管理入口使用 HTTP Basic，固定用户名为 `citypop`。口令必须至少 24 个字符，不能包含冒号、控制字符或末尾空白。请使用密码管理器生成强随机口令；不要复用其他账户口令。

### 在服务器创建口令文件

在服务器上用同一个安装账户执行下面的命令。它要求交互式终端，输入两遍并隐藏回显，检查格式后原子写入权限为 0600 的口令文件。不要把真实口令写进 `.env`、命令参数、发布包、工单或版本库。

```sh
bash "$CTL" --root "$ROOT" configure-admin
```

此命令仅保存口令，不会自动开启管理。
编辑 `$ROOT/shared/.env`：设 `ADMIN_ENABLED=true`，默认保留 `ADMIN_ORIGIN=http://127.0.0.1:8081` 和 `ADMIN_HOST_PORT=8081`。然后运行 `restart`。口令文件缺失或格式不合格会使启用管理的启动失败，不会降级为无口令管理。

```sh
bash "$CTL" --root "$ROOT" restart
bash "$CTL" --root "$ROOT" status
```

### 从自己的电脑连接

在自己的电脑执行；不要在服务器上执行这个客户端隧道命令：

```sh
ssh -N -L 8081:127.0.0.1:8081 YOUR_USER@YOUR_SERVER
```

保持会话开启，访问 `http://127.0.0.1:8081`，按浏览器提示输入 `citypop` 和刚设置的口令。请按这个地址访问，不能随意改成 `localhost`，因为管理 Host 和 Origin 必须精确匹配。SSH 加密从你的电脑到服务器的传输；Basic 本身不提供传输加密，因此管理口绝不能直接暴露到公网 HTTP。

本地 8081 已被占用时，可把隧道本地端口改为其他值，同时将服务器的 `ADMIN_ORIGIN` 改成浏览器将访问的对应地址并重新启动。若还改了服务器映射端口，也要同步调整隧道右侧目标端口。写入请求需要正确 Origin 和 JSON 类型；提供 Sec-Fetch-Site 时也必须为 same-origin。管理凭证不替代这些 CSRF 校验，不要用禁用校验的方式排错。

更换口令时再运行 `configure-admin`，随后运行 `restart` 强制重建服务以加载新口令。停用管理时将 `ADMIN_ENABLED=false` 后运行 `restart`。浏览器可能缓存 Basic 凭证，离开共享设备前关闭相关浏览器会话。

## 6 备份和恢复

### 一致性备份

数据库使用 SQLite WAL 模式。不要在服务运行时只复制 `catalog.sqlite`，遗漏 WAL 可能导致快照不完整。使用本包的数据库备份命令；它通过 Node.js 内置 SQLite 备份 API 生成能够正确处理 WAL 的一致快照，并检查源数据库完整性及外键。

```sh
bash "$CTL" --root "$ROOT" backup
```

成功后会打印 `$ROOT/shared/backups/` 下的 `.sqlite` 路径，并生成相邻的 `.sqlite.json` 元数据。元数据记录备份校验和及对应版本信息。每次复制备份时，把这两个文件一起保存。备份包含审核记录等运行数据，应按私有数据保护。

将备份另外复制到受控的异机或离线位置，并定期演练恢复。只把备份放在同一台服务器不能防止主机或磁盘丢失。脚本不配置计划任务、不清理旧备份，也不备份 `.env`、管理口令或 TLS 私钥；这些需要你采用单独的安全保管方式。

### 恢复到当前版本

恢复会用备份替换当前数据，备份产生之后的变更将不可见。先确认停掉所有包外数据库写入者；脚本只能停止它管理的 Compose 服务。把 `BACKUP` 换成你选中的完整路径：

```sh
BACKUP="$ROOT/shared/backups/实际备份文件名.sqlite"
bash "$CTL" --root "$ROOT" restore \
  "$BACKUP" --confirm-restore
```

脚本先校验备份散列、SQLite 完整性、外键以及与当前版本的 schema 匹配，停止服务，为当前数据库生成保护性备份，然后替换数据库并重启。旧数据库与 WAL/SHM 旁文件会保留作人工恢复参考；这不能代替异机备份。

必须保留备份相邻的 `.sqlite.json`。不要修改元数据、删除迁移记录或关闭校验来让不匹配的备份通过。恢复后重新检查健康、关键条目、审核历史和最近操作。

## 7 升级和回滚

### 现有安装原位升级

新包需要来自可信渠道，并提供新的整体 SHA-256。本次新包文件名为 `city-pop-linux-deploy-20261005.tar.gz`，下载时分目录保存，勿混用旧校验文件；以 `release.json` 的 `20261005-v27` 和新包散列识别。提前检查变更说明、迁移影响、磁盘空间和可恢复的备份。升级期间会短暂停机，镜像构建或拉取较慢时停机时间可能更长。

先用原运维账户进入现有安装。下面假设原安装根目录为 `$HOME/citypop`；若原路径不同，必须填写原路径，不要新建第二套实例。先确认 `current`、`shared/.env` 和现有数据库都属于该安装。保存当前版本 ID、数据库一致备份及配置副本，另行保管管理口令和 TLS 文件。

```sh
set -e
umask 077
ROOT="$HOME/citypop"  # 必须是原有安装根目录
CTL="$ROOT/current/deploy/scripts/citypop.sh"
OLD_ID=$(basename "$(readlink -f "$ROOT/current")")
printf '升级前版本 ID：%s\n' "$OLD_ID"
bash "$CTL" --root "$ROOT" status
bash "$CTL" --root "$ROOT" backup
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
cp -- "$ROOT/shared/.env" "$ROOT/shared/backups/env-$STAMP"
```

把本次新包及对应 `.sha256` 放到一个独立下载目录，进入该目录后执行。可信散列应来自已确认的发布渠道；不要沿用旧包的散列文件。

```sh
sha256sum -c city-pop-linux-deploy-20261005.tar.gz.sha256
NEW_ARCHIVE="$PWD/city-pop-linux-deploy-20261005.tar.gz"
NEW_DIGEST=$(awk '{print $1}' "$NEW_ARCHIVE.sha256")
bash "$CTL" --root "$ROOT" --dry-run upgrade \
  "$NEW_ARCHIVE" "$NEW_DIGEST"
bash "$CTL" --root "$ROOT" upgrade \
  "$NEW_ARCHIVE" "$NEW_DIGEST"
bash "$CTL" --root "$ROOT" status
curl --fail http://127.0.0.1:8080/healthz
```

保留 `shared/.env` 中已正确设置的 `PUBLIC_ORIGIN`、端口、管理启停和安全配置。绝不要执行 `cp .env.example shared/.env` 来“更新配置”，也不要删除 `shared/data`、重建空库或导入公开快照来覆盖运行库。新分析变量未设置时保持关闭。`RELEASE_TAG` 是镜像标签；脚本的 `--build` 会重建选中版本，旧配置中的标签不会阻止代码升级。若确需换标签，只修改这一项并保留回退记录。

`upgrade` 校验并暂存新发布，检查 Compose 配置，停止旧服务，为旧数据库备份，再切换 `current`、构建镜像并等待新服务健康。共享 SQLite、配置、口令和备份留在 `shared/`；脚本不会把它们换成包内的空白数据库，也不会清空本地审核或审计历史。升级后检查 `status`、健康和页面；不要只看 `current` 指向了新目录就认定升级完成。

新版本启动时会按资料修订号更新基础目录表，再应用保留的本地字段覆盖和已批准结构操作。受支持的修改应通过管理入口写入独立覆盖／操作表；直接用 SQL 手改基础目录行不在保留保障内，可能被快照刷新替换。基础快照的变化可能使旧操作产生冲突或使某个覆盖失去适用对象。升级前在隔离副本演练；升级后核对管理入口中的审核历史、字段覆盖和结构冲突。数据保留不等于每项旧操作在新版基础资料上都仍然有效。

如果升级失败，`current` 可能已指向新版本，数据库也可能已执行部分新迁移。脚本会报错并保留材料供排查，不会盲目恢复旧代码。先读错误和日志，确认数据库迁移状态，再选择修复或带匹配备份回滚。

### 回滚前选择数据结果

`RELEASE_ID` 是已安装发布目录名，即压缩包 SHA-256 的前 16 位。可用 `ls "$ROOT/releases"` 查看。保留你可能需要回退的旧发布包、版本目录和升级前备份。

本次 v27 沿用 schemaVersion 1 及既有四份迁移。只有与目标旧版本的 schema、迁移记录和数据语义均兼容时，才可仅回退代码。此路径不恢复旧数据库，保留升级后新增的批准、拒绝、覆盖及审计记录；回滚前脚本还会备份当前数据。旧版本会载入自己的基础快照，因此仍须核对保留的操作和覆盖是否适用。不要为代码回退额外传入升级前备份，否则会抹去其后的可见变更。

```sh
OLD_ID="替换为升级前记录的16位版本ID"
bash "$CTL" --root "$ROOT" rollback "$OLD_ID"
```

不同 schema 的回滚必须同时恢复目标版本的匹配备份；这会丢弃备份之后的可见数据变更，包括升级后作出的审核决定。若这些决定必须保留，先停止回退并制定单独的数据转换和对账方案，不要直接运行以下恢复命令：

```sh
OLD_BACKUP="/absolute/path/to/matching-backup.sqlite"
bash "$CTL" --root "$ROOT" rollback "$OLD_ID" \
  --backup "$OLD_BACKUP" --confirm-restore
```

不要手工把 `current` 指回旧代码后强行启动，也不要用旧 SQL 覆盖新表。迁移文件按版本排序执行，已应用迁移的 SHA-256 被记录；已发布迁移不可改写。新版本可能含不可逆迁移，回滚保障来自已验证的匹配备份，而不是一条“撤销所有迁移”的命令。

## 8 日常检查与排错

### 停止和重新启动

```sh
bash "$CTL" --root "$ROOT" status
bash "$CTL" --root "$ROOT" logs
bash "$CTL" --root "$ROOT" stop
bash "$CTL" --root "$ROOT" start
```

`start` 会检查 Compose 配置并构建、启动、等待服务就绪；`stop` 不删数据。容器配置为 `unless-stopped`，但主机 Docker 是否开机启动需你自行确认。上线后至少做一次计划内的重启演练，不要把容器重启策略当成主机已经设置开机恢复。

### 常见现象

- 提示 Docker 不可用：检查 `docker info`、`docker compose version` 和当前账户权限。请主机管理员处理；不要修改 socket 为 0666。
- 端口被占用：用 `ss -ltn` 检查 8080、8081 或你选择的端口，调整 `.env` 后同步更新访问地址、代理和 SSH 隧道。
- 页面返回 421：检查 `PUBLIC_ORIGIN` 或 `ADMIN_ORIGIN` 与请求 Host 是否一致，确认反向代理保留正确域名和端口。
- 管理返回 401：确认用户名为 `citypop`，口令文件符合要求，并已重启实际进程。管理返回 403 时还要检查写入 Origin、JSON 类型和入口是否正确。
- Nginx 返回 502 或 app 不健康：先看日志和容器状态，检查 SQLite 路径权限、空间、迁移校验、基础镜像拉取以及域名配置。
- 数据库只读或权限被拒：由原安装账户操作，检查 `shared/data`、`shared/backups`、`shared/secrets` 的归属。本包用运维账户的 UID/GID 运行 app；不要用 `chmod 777` 解决。
- 数据库忙或请求变慢：只保留一个 app 实例，检查是否有外部写入者、长事务或磁盘问题。SQLite 单文件不是多实例数据库集群；扩容前需另外设计数据层。
- 播放器空白或无法播放：检查浏览器到 Spotify、YouTube 或图片来源的连通性、登录、地区和浏览器策略。服务器健康不代表第三方媒体可用。
- 校验或迁移散列不匹配：确认使用了完整原始发布包和对应备份，保留日志供排查，不要手改清单或迁移记录绕过保护。

### 上线验收清单

1. `status` 中服务运行，`/healthz` 返回 `ok`，外部 HTTPS 证书和域名正确。
2. 核对全部 755 个条目的三语阅读入口、128 篇完整专文、627 篇背景导读，以及 128 幅独立原创插图。About 三语导读和 3 张真实照片应保留来源及许可；背景导读的共用插图不得被误认作专属图片。核对图谱颜色、筛选、搜索、详情、来源链接及返回焦点／滚动位置；播放器不自动播放。
3. 新访客默认英文；无效或不可读的保存值回退英文，有效 `zh`、`en`、`ja` 选择保留。图云默认旋转，减少动态效果与已保存暂停均能停止自动旋转，页面隐藏时暂停动画。
4. 公共入口无法查询或写入审核及操作 API；默认管理关闭。启用管理后，只有 SSH 隧道入口能认证访问，错误口令和错误 Host/Origin 被拒绝。
5. 分析 ID 空白时不加载 GA4／Clarity；配置后未经访客同意仍不加载。允许、拒绝、持久隐私入口和撤回重载符合预期，管理页面、DNT 和 GPC 被排除；上线前验收真实供应商设置与报表。
6. 运行一次备份并在隔离测试环境恢复，核对关键条目、字段覆盖、审核与审计历史、结构操作冲突和配置；不要在生产库上“随手试恢复”。
7. 停止、启动及计划内主机重启后数据仍在。确认没有把管理端口暴露到主机外部，且磁盘、日志和备份有保留策略。

## 9 从现有站点迁移数据

本包的 `data/` 是发布时的基础目录快照。Linux 首次启动以它初始化数据库；这与“从线上 Cloudflare D1 导出完整运行数据”是不同工作。包内不包含线上数据库、私有后续审核数据或你账户的导出凭证。

完整迁移需要先约定停写窗口，再从你授权的原数据库做一致性导出，核对基础资料版本、候选、字段覆盖、决定历史和结构变更，转换为本包 schema 及迁移元数据，并在隔离 Linux 环境检查条目数量、外键和关键历史。确认无误后才切换入口；保留旧站点与导出副本直到验收结束。

不要把 D1 导出的 SQL 直接当作本包 `restore` 的输入，也不要只拷贝基础 `catalog.json` 就宣称私有运行数据已迁移。本次交付没有实现或执行跨 D1 到 Linux 的数据搬迁；这一步应另做受控迁移方案。

## 10 来源和使用边界

公开源码仓库：https://github.com/yonglun/city-pop-atlas 。构建脚本将检出的完整 GitHub 提交写入包内 `release.json` 的 `sourceCommit`；请在仓库提交页核对该值，不能用可变的 `main` 名称代替发布来源。发布包同时包含 Linux 适配、运维脚本、文档和由该提交构建的 `dist/`；准确文件与版本以包内清单、`release.json` 和随附整体校验值为准。部署包的整体散列不可能写回到其自身内部，须使用随附校验文件。

About 的三张照片分别为 LBM1948 拍摄的 1978 年东京街景（CC BY-SA 4.0）、Anna Gerdén／Tekniska museet 拍摄的 2006 年 Sony TPS-L2 博物馆照片（CC BY-SA 3.0）和 DXR 拍摄的 2019 年 Tower Records Shibuya（CC BY-SA 4.0）。后两者不作为 1980 年代现场影像。网页衍生图仅按比例缩放和重新编码，逐图来源见 `data/about-photo-provenance.json`。

代码尚未选择统一开源许可证。公开仓库可读不等于授予统一的复制、修改或再分发权。照片、平台播放器、图文内容和概念插图分别依各自来源和适用权利使用。每张外部照片保留作者、来源与许可；概念插图不是历史照片或原版唱片封面，清单见 `data/illustration-provenance.json`。

Spotify 和 YouTube 的嵌入播放器从第三方加载内容，浏览器会向其发出请求；地区、登录、网络策略和版权状态可能改变可用性。本项目不托管音源或歌词，不提供离线音乐下载，也不保证所有地区均可播放。

Node.js SQLite 备份 API 参考：https://nodejs.org/api/sqlite.html#sqlitebackupsource-db-path-options 。应用数据模型、编辑资料和媒体来源分别见 `docs/DATA-MODEL.md`、`docs/EDITORIAL.md` 与 `docs/DATA-SOURCES.md`。
