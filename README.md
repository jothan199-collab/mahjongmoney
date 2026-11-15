# 🀄 麻将钱账 v4 — 多手机共享房间版

## 先说明：GitHub Pages 与实时同步

此版本**可以在 GitHub Pages 发布**，但跨手机实时同步需要额外的共享数据库。采用 Firebase Cloud Firestore；玩家不用注册、输入密码或选择「我是谁」，App 会在后台进行匿名认证以符合数据库安全规则。

- **已配置 Firebase**：同一个 GitHub Pages URL，所有手机看到同一份云端房间列表和牌局；各房间独立记账，自动同步。
- **未配置 Firebase**：自动使用旧版 v3 的浏览器本机存储。可管理多个房间，但**不同手机之间不会同步**。界面会显示「本机」或「云端」状态，避免误会。
- 同一部手机换浏览器，或各自的手机，也能看到云端相同的数据，但需要联网。

## 主要操作

1. 打开网址进入房间大厅；可创建多间房，例如「星期五麻将」和「第二桌」，两桌同时使用互不影响。
2. 房间中的每张玩家卡片都有「🀄 姓名 胡牌」按钮。赢家点自己的名字，检查自摸／点炮、飞等项目，点击「确认记账」。不用先选择当前手机的操作者身份。
3. 胡牌后结束当前一局；杠属于当局。其它手机的数据会自动更新。
4. 每张卡片显示当前姓名水印、加大名字、当前余额、1–4 名排名。
5. 历史记录可撤销或恢复**任何一笔**。统计表显示胡牌、自摸、点炮、杠、飞和净输赢。
6. 「玩家／规则」可改名字及中途换人（离席者保留历史成绩）。
7. 房间大厅可进入、删除和分享指定房间网址；不同手机打开**同一个基础网址**即可看到房间列表。
8. 每笔金额按当时座位及规则计算，并在云端写入时使用数据库事务，降低多人同时登记时互相覆盖的风险。

## 默认规则

| 项目 | 默认 | 
| --- | --- |
| 自摸 | 其它三家各付 RM1 |
| 点炮 | 点炮者 RM2；另两家各 RM1 |
| 飞 | 每粒其它三家各付 RM1（与胡牌叠加） |
| 明杠 | 其它三家各付 RM2；也可指定一家 |
| 暗杠 | 其它三家各付 RM4；也可指定一家 |

金额可在每个房间分别调整。内部金额均以整数仙计算。

## 一次性 Firebase 配置（Spark 免费计划）

1. 打开 <https://console.firebase.google.com/>，**Create project**，例如 `mahjong-money-app`。选择 **Spark** 免费方案；Analytics 可关闭。
2. **Project Overview → Web（`</>`）→ Register app**，名称可写 `Mahjong Calculator`。无需 Firebase Hosting，网站由 GitHub Pages 发布。
3. **Build → Authentication → Sign-in method → Anonymous → Enable**（匿名认证不等于让用户选择自己的麻将玩家身份）。
4. **Build → Firestore Database → Create database**，选择 **Standard edition**、数据库 ID `(default)`；地区按你需要选择。按控制台提示创建。
5. Firestore → **Rules**，把项目文件 `firestore.rules` 的**全部内容**复制进去，并点击 **Publish**。单纯把 `firestore.rules` 上传 GitHub **不会**自动更新 Firestore 安全规则。
6. **Project settings → General → Your apps → SDK setup and configuration → Config**，复制 `apiKey`、`authDomain`、`projectId`、`appId`。
7. 编辑 `firebase-config.js`，把 `window.MAHJONG_FIREBASE_CONFIG = null;` 替换成：

   ```javascript
   window.MAHJONG_FIREBASE_CONFIG = {
     apiKey: '这里填你的 apiKey',
     authDomain: '这里填你的 authDomain',
     projectId: '这里填你的 projectId',
     appId: '这里填你的 appId'
   };
   ```

   注意不要上传服务器私钥、service account JSON 或 Firebase Admin SDK 凭据。网页的 Web config **不是管理员密钥**。

8. 把文件上传 GitHub，刷新网站。房间区域应显示「**云端已同步**」；如果显示「本机」，说明仍未填好 Firebase 配置；如果显示「连接错误」，按提示检查 Auth、Firestore Rules、网络及浏览器控制台。

## GitHub Pages 部署 / 更新

上传到 GitHub Repository 的**根目录**：

- `index.html`
- `app.js`
- `cloud-sync.js`
- `firebase-config.js`
- `firestore.rules`（便于保存，但必须在 Firebase Console 另行 Publish）
- `README.md`
- `.nojekyll`（可选）

在 Repository → **Settings → Pages → Deploy from a branch → main → /(root)** 发布。地址一般为：

`https://你的GitHub用户名.github.io/你的Repository名称/`

旧版 v2 的文件可能仍在仓库中，但新版不会再引用它们；以此 ZIP 包中的文件为准。

## 真实跨手机测试步骤

1. 手机 A 和 B 打开同一个网址，确认两边状态都显示「云端已同步」。
2. A 创建「第一桌」，B 无需刷新应能看见「第一桌」。
3. A 进入房间，点击东位卡片的「胡牌」，确认记账，B 应自动更新余额、局数和记录。
4. B 登记一次南位胡牌，A 应自动收到更新。
5. A 创建「第二桌」，两部手机看到两个房间，分别记账；金额不会混用。
6. 用「分享」复制房间链接，第三部手机打开可直达相应房间。

## 旧版本数据迁移

本机 v3 和云端 v4 是**两套不同存储**，不会在开启云端后自动把本机历史偷偷上传。

如果要搬旧账：**在未启用 Firebase 的旧网站**使用「备份全部房间」或「备份 JSON」；之后启用 Firebase，在新版房间大厅使用「导入房间备份」，会作为**新的云端房间**导入。不要在迁移完成前删除旧资料。

## 安全和使用边界

- 本版本专门给**互相信任的牌友**。任何打开网站、成功匿名认证的人都能看到、修改和**删除所有云端房间**；没有房间密码、管理员角色或误操作追责机制。房间网址不等于访问权限。不要保存敏感个人资料。
- 真正需要防陌生人更改时，后续应增加房间密码/访问控制和服务端校验；仅隐藏按钮不能防止未经授权的修改。
- 房间资料采用单个 Firestore 文档保存，应用设有 **1,300 笔记录 / 700KB** 的保护上限。牌局很多时，定期导出 JSON 后另建新房间。Firebase 文档本身另有大小限制。
- GitHub Pages 不会保存数据库；要持久同步必须保持 Firebase 项目启用。免费额度与产品政策以官方 Firebase 文档为准。
- 云端离线时，页面显示离线并暂停新记账，以免两部手机出现各算各的资料。
- 目前已完成本地浏览器测试及模拟云端适配器测试；**尚未在真实 Firebase 项目做跨手机端到端测试**，需要你配置完后按上述步骤验证。

## 文件说明

- `index.html`：视觉、操作页、记分表。
- `app.js`：计费、统计、换人、历史撤销、房间 UI。
- `cloud-sync.js`：Firebase 匿名认证、云端快照订阅、事务写入。
- `firebase-config.js`：你自己的 Web App 配置（默认 `null` 使用本机版）。
- `firestore.rules`：互信模式的 Firestore 基本规则，需要到 Firebase 控制台发布。
- `.nojekyll`：可在 GitHub Pages 根目录直接部署。
