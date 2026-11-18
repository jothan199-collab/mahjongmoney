# 🀄 麻将钱账 v6.0 — 分享网站／房间、普通牌友密码删除

适用于 GitHub Pages + Firebase Cloud Firestore。继续保留 v5 的房间搜索、改名、房间密码、管理员、四人麻将计分、换人、任意撤销、局数、输赢排名、个人统计及结算。

## v6 新增功能

1. **↗ 分享网站**：网页顶部新增按钮，分享固定 GitHub Pages 网址（不指定房间）。
2. **↗ 分享房间**：每张房间卡片及当前房间标题旁均有按钮；链接包含 `#room=房间ID`，收到的牌友打开后会跳转到指定房间；加密房间会要求输入房间密码。
3. **原生分享**：在支持 Web Share API 的手机上打开系统分享菜单（可选 WhatsApp、微信等安装的应用）；其他浏览器复制链接后手动粘贴到群组。
4. **普通牌友也可以删除加密房间**：在房间卡片点击「删除房间」，**每次都要重新输入该房间当前密码**，然后再次确认。Firestore 安全规则会核对密码派生校验值和同一批次的服务器时间戳，不能只通过绕过网页按钮直接删除。

### 删除权限

| 房间 | 普通牌友 | 创建者（原 Firebase 匿名身份） | 超级管理员 |
|---|---|---|---|
| 加密房间 | 每次删除都需重新输入房间密码并确认 | 无需密码，但需确认 | 无需密码，但需确认 |
| 公开房间（未设置密码） | 不可以删除 | 可删除 | 可删除 |

**为什么公开房间普通牌友不能删除？** 因为没有密码可供验证。若希望普通牌友能够删除，请由创建者／管理员先设置一个房间密码。

## 一、更新 GitHub Pages

1. **在 v5 先导出备份 JSON**：删除会永久移除房间，请为重要数据留存备份。
2. 下载 v6 ZIP，解压后把下面文件上传至 GitHub Repository 的根目录，覆盖同名文件：
   - `index.html`
   - `app.js`
   - `cloud-sync.js`
   - `firebase-config.js`
   - `firestore.rules`
   - `README.md`
   - `.nojekyll`（可选）
3. `index.html` 应直接位于 Repository 根目录。
4. 在 GitHub → Settings → Pages 中确认 Source 是 Deploy from a branch，分支为 `main`，目录是 `/(root)`。
5. **十分重要：必须将最新的 `firestore.rules` 重新粘贴到 Firebase Console → Firestore Database → Rules，点击 Publish。** 只上传 GitHub 不能启用普通牌友的密码删除功能。

### 从 v5 升级时的兼容性

- v6 继续使用原来的 `mahjong_room_index_v5`、`mahjong_rooms_v5`、`mahjong_room_secrets_v5`、`mahjong_room_members_v5`，**不用清空或重新建立房间**；这次只是增加删除授权集合 `mahjong_room_delete_authorizations_v5`。
- 保留你已经填好的 Firebase 配置。**ZIP 中 `firebase-config.js` 是安全空白示例！如果你已经设置过项目，不要直接覆盖成空白示例**；可先将旧文件下载备份，把旧版 Firebase 配置（包括 `adminUid`）复制到新版。
- `firestore.rules` 内 `request.auth.uid == '填写管理员UID'` 一定要改成你实际的管理员 UID，然后发布；如果用空白模板覆盖，则管理员权限会失效。
- 房间链接不会含密码（避免泄漏），发给牌友后，请另外告诉他们密码。

## 二、初次设置 Firebase

1. 在 https://console.firebase.google.com/ 建立 Firebase 项目（个人小规模使用可以先用免费 Spark Plan）。
2. 在 Authentication → Sign-in method 启用 **Anonymous**；如需要管理员，再启用 **Email/Password**。
3. 在 Firestore Database 建立 Standard edition 的 `(default)` 数据库。
4. 在 Firebase Project settings → General → Your apps → Web app → Config 复制配置到 `firebase-config.js`，保留 `window.MAHJONG_FIREBASE_CONFIG = { ... }` 的写法。
5. 在 Firebase Authentication → Users → Add user 建立管理员账号，复制此账号 UID，分别填入 `firebase-config.js` 的 `adminUid` 和 `firestore.rules` 的指定位置。
6. 将 `firestore.rules` 的全文复制到 Firestore Database → Rules，Publish。**切勿发布 `allow read, write: if true;` 的测试规则。**
7. 如果管理员邮箱登录时提示未授权域名，检查 Authentication → Settings → Authorized domains 是否包含你的 `用户名.github.io`。

## 三、如何分享

**分享网站（不指定房间）**：打开 GitHub Pages 网站，点击顶部「↗ 分享网站」。其他人打开同一个网址，就可以搜索、选择任意房间。

**分享具体房间**：找到目标房间点击「↗ 分享房间」，或进入房间点击「↗ 分享此房间」。分享链接格式例如：

`https://你的用户名.github.io/mahjong-money-app/#room=xxxxxxxx`

收件人打开后会定位到指定房间；加密房间会弹出密码输入框。**共享数据需要真实 Firebase 配置**；单机模式只在原浏览器保存资料，不能把本地房间分享给其他手机。

## 四、普通牌友删除房间

1. 找到要删除的**加密房间**，点击「删除房间」。
2. 输入该房间的**当前密码**（即使之前已进入，也需要重新输入）。
3. 点击「验证密码并删除」，再确认一次不可撤销的提示。
4. 云端会在同一个原子批次中核对密码校验值并删除房间目录、账本和密码文档；其他手机会自动从房间列表移除这间房。
5. 密码错误、房间密码改变、云端断线时，数据库会拒绝删除。

**安全说明：** 本项目以互相信任的朋友为目标，密码验证是 Firestore Rules 的访问控制，并非端到端加密。请勿把有实际价值的敏感资料写进牌局。知道房间密码的任何普通牌友都有删除权限，请先约定好谁可以删除、定期备份。Firebase 删除顶层文档**不会自动清空子集合**；既有的成员授权元数据及本版新增的删除授权记录可能保留为孤立资料。如果需要彻底清除这些技术元数据，需在 Firebase Console／Admin SDK 进行管理员清理。不同房间的数据互不影响。

## 五、麻将规则（延续 v5）

- 自摸：其余三人各 RM1。
- 点炮：点炮者 RM2、其他两人各 RM1。
- 飞：每粒其余三家各 RM1。
- 明杠每家 RM2；暗杠每家 RM4，可改为指定一人付款。
- 每次胡牌结束一局，杠记在当前局；不限次数撤销／恢复任意历史记录。
- 换人保留旧玩家全部账目，接替者从零开始；1–4 排名按现有四位净输赢。

## 六、测试与限制

- 已使用 Node.js 模拟浏览器事件及 Firebase 回调测试：网站／房间分享链接、错误密码不删除、正确密码删除、创建者直接删除和其他房间不受影响。由于当前测试环境限制，尚未完成 v6 的真实手机浏览器点击测试。
- 由于没有接入你的 Firebase 项目，**真实 Firestore 权限规则、不同手机实时同步及密码删除的云端执行，仍需实际部署后验证**。
- 密码由 PBKDF2-SHA256 派生；成员授权凭证属于可重用的校验值。不要将密码当作金融级强认证。
