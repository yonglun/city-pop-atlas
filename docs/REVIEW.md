# 采集审核工作流

## 线上使用

打开网站“采集审核”，对照当前值与候选值，点击来源核对，再批准或填写理由后拒绝。首批队列包含2个真实来源冲突，尚未替用户作出决定。批准保存到独立校订层，刷新与资料重新导入后保留。所有导入候选先为pending，不会直接修改正式展示。

“字段覆盖”仍是事实断言，不是确切事实的保证；审核者应核实原始来源与版本对应关系。原始专辑日期与再版日期不能混用。

## 文件格式

```json
{"candidates":[{"entityId":"album_mignonne","field":"releaseDate","value":"1978-09-25","sourceUrl":"https://www.110107.com/s/oto/page/onuki_RCA?ima=5504","sourceType":"official label","checkedAt":"2026-10-02","note":"与艺人官网的9月21日存在冲突，请核查。"}]}
```

单次最多50项、64KiB。只接受属性定义中存在的字段、有限标量/数组值、HTTPS证据URL与真实日历日期。请求不会自动抓取提交的URL。

## 从采集器转换

```sh
python3 scripts/prepare_review.py --input collected-candidates.json --catalog data/catalog.json --output review-ready.json
```

转换器只生成待审字段。测试fixtures不能冒充已抓取证据。MusicBrainz release的发行日期只有在目标是edition时才会进入队列，不会覆盖album概念的首次发行日。媒体链接、曲目关系及新实体仍需独立策展后再发布。

## 本地测试

```sh
LOCAL_REVIEW=1 npm run dev
```

开发服务只绑定127.0.0.1，忽略调用者伪造的身份头；显式开启时注入本地测试身份。该模拟只在开发服务，未打包到Worker。默认本地模式只读。

## 安全边界

生产审核依赖已验证的“仅站点所有者可访问”平台边界。必须配置SITE_REVIEW_MODE=owner-private和精确SITE_REVIEW_ORIGIN，同时要求平台转发的登录用户ID、同源JSON POST和来源检查。只有服务访问凭据而没有浏览器用户身份的请求不能审核。

这是当前私人站点的审核机制，不是公开站点的编辑权限系统。**在扩大Site访问范围之前，必须先把审核模式设为disabled并发布生效，或实现经过验证的所有者ID授权。** 不得只改分享设置后仍保持现有审核模式。模式开关本身不实时查询分享状态。

源码默认不包含启用审核的运行配置、用户ID或秘密。审核决定/覆盖值/历史只保存在D1，不提交公开GitHub。
