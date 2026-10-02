# 数据模型 v2

## 基本约定

稳定的文本 ID 不依赖显示语言。人物可同时有歌手、作词、作曲、编曲、制作、演奏等角色，职责属于关系，不拆成重复人物。保留中文、英文、日文标题/简介与原名、别名；没有正式译名时保留原题。未知值不猜测，日期保留精度。

当前类型：artist（歌手/乐队）、person（创作者/乐手）、album（专辑概念）、song（历史歌曲条目）。已有 song 是作品/录音的兼容入口，尚未全部拆分。

可扩展类型预留：edition、recording、work、label。下一轮才补齐这些对象的真实记录；仅支持类型并不代表资料已完成。

## 存储

- entities：id / type / year 为可索引字段，其余对象为完整 JSON payload
- relationships：id / source / target / type 与带来源 payload；外键保证端点存在
- media：实体图片元数据、URL、作者、许可和日期
- external_links：平台、资源类型、精确 URL、版本说明、核实日期与来源
- property_definitions：字段键、三语标签、值类型及扩展约定
- imports：成功导入的资料版本与数量

图查询不要求立即上图数据库。当前关系规模可由 SQL 外键和 source/target 索引支持；未来复杂多跳路径查询再根据实际性能评估，而非先引入额外运维服务。

## 实体结构

```json
{
  "id": "person_tatsuro_yamashita",
  "type": "artist",
  "schemaVersion": 2,
  "labels": {"zh":"山下达郎","en":"Tatsuro Yamashita","ja":"山下達郎"},
  "aliases": ["Yamashita Tatsuro"],
  "description": {"zh":"…","en":"…","ja":"…"},
  "attributes": {
    "birthDate": {
      "value":"1953-02-04",
      "precision":"day",
      "sourceUrl":"https://www.tatsuro.co.jp/biography/",
      "sourceType":"official",
      "checkedAt":"2026-10-02"
    }
  },
  "externalIds": {"wikidata":"Q1154190"},
  "sources": ["https://www.tatsuro.co.jp/biography/"],
  "media": [],
  "serviceLinks": [],
  "updatedAt":"2026-10-02"
}
```

新增属性先在 properties / property_definitions 定义 key、labels、valueType（string/number/date/list）；每个属性值必须有来源和核实日期。可附 precision、meaning、note。未注册属性仍能由通用界面呈现键名，但正式发布前应补三语标签。

## 对象属性规划

- 人物：本名/艺名/别名、生日与精度、出生地和出身地分别记录、角色、乐器、活跃期、官方网站、外部 ID
- 专辑：原名、首次发行日期/精度、主艺人、专辑类型、厂牌、作品顺序、风格（需要单独出处）
- 发行版：所属专辑、发行日期、地区、介质、唱片编号、条码、封面版本、发行版 MBID
- 词曲作品：作词/作曲、原始语言、作品 MBID、改编关系
- 录音：所属作品、演唱与演奏、时长、ISRC、studio/live/remix/remaster、录音 MBID
- 曲目：发行版 + 碟号 + 曲序 + 录音；不能将相同歌名视为相同录音

仅在有来源时填值。country 的含义须明确：国籍、出生国家与活动地区不能自动互换。

## 关系

每个关系有确定性 ID、两端稳定 ID、type、sources、status、checkedAt 和 attributes。常见类型：released、performer、composer、lyricist、arranger、produced、co_produced、track_on、member_of。

performer 使用中性的演出含义；attributes.role 进一步标注吉他、贝斯、键盘、鼓、录音艺人等。具体角色由逐曲署名确认。

## 图片与服务链接

图片分别记录 sourcePage、creator、license、licenseUrl、attribution、changes、photoDate、checkedAt。Commons 的图片许可与 Wikidata 的 CC0 元数据许可独立。

服务链接分别记录 service、resourceType、url、version、sourceUrl、status、checkedAt。只有 verified 状态显示为正式链接；不以 URL 格式正确代替身份匹配。数字平台版本可能不同于原始唱片。

## 更新策略

当前正式库只包含已审核快照，没有访客创建数据。catalog.json 是版本化审核输入，D1 是持久化运行资料库。每次资料发布生成新 revision，服务用一次事务替换全部快照行并记录成功版本。先迁移 schema，再发布 Worker；seed 数据不写入 schema 迁移。

未来有用户编辑后必须引入独立草稿/断言历史与发布流程，避免被快照覆盖。未来规模超过单次导入限制时，升级成带版本 ID 的分块暂存与原子激活指针。不得将现在的小规模全量导入无限扩展。

## v3：第二轮实体分层（2026-10-02）

当前正式数据有301个实体：22艺人/乐队、21创作者、41专辑概念、38兼容歌曲入口、13发行版、127曲目位置、38词曲作品、1录音。569条关系。实体增加主要来自分层，不代表新增加了179首歌曲。

- 13个发行版本覆盖10个不同专辑概念，127个曲目位置均有顺序与来源
- work 从已有、带证据的作词/作曲关系建立；所有创作职责方向统一为人物→音乐实体
- recording 仅收录一条已核实名称与演出者的4:00 A.M. MusicBrainz录音；不声称它等同原版LP、SACD或Spotify版本
- track 独立记录 editionId / position / slotLabel；没有可靠依据时 recordingId=null
- album_timely_2008旧记录迁移为edition_timely_2008_flcf4243，entityAliases保留旧ID查找；Remember Summer Days的再版关联保留，不移动到1983年原专辑
- MIGNONNE原始日期存在官方来源差异，保留现值并标注；ROMANTIQUE附加曲标题差异进入候选队列
- work_four_am 的外部作品ID由原版LP页面上的链接证明，目标详情页未读到（429），界面明确标注此限制

### 独立审核层

新增candidates / attribute_overrides / review_events三张表，不参与版本化基础资料的全量替换；没有实体外键，以免基础数据更新误删用户决定。批准后的字段叠加到基础资料，拒绝不修改基础资料。审核仅支持已定义属性，不自动新增实体、关系、图片或媒体链接。

状态：pending→approved或rejected；每次决定带版本号，并记录备注与时间。批准时校验基础值以及实时实体/覆盖值，随后在同一事务内执行条件更新、字段覆盖和审计记录。过时或并发冲突返回409；相同决定重复提交不产生重复审计记录。拒绝必须有理由，且允许拒绝已失效目标的旧候选。

当前不提供一键撤销；需要反向修改时提交有来源的新候选，历史记录保留。不要直接编辑数据库绕过校验。
