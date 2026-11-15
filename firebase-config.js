/*
  默认是本机模式：打开网页就能记账，但不同手机不会自动同步。

  开启云端同步：
  1. 在 https://console.firebase.google.com/ 创建 Spark 免费项目；
  2. 添加 Web App，开启 Authentication > Anonymous；
  3. 创建 Cloud Firestore (Standard)，在 Rules 粘贴同目录的 firestore.rules；
  4. Project settings > Your apps > Config 复制各项值，填入下面的对象。
  5. 上传这个文件到 GitHub，替换旧版。四部手机使用同一个网址。

  Firebase 的 Web apiKey 是公开的项目配置项，不是管理员密钥；
  但绝对不要上传 service account/private key 或任何管理员令牌。
*/
window.MAHJONG_FIREBASE_CONFIG = null;
/* 改成以下形式（删除上面那一行）：
window.MAHJONG_FIREBASE_CONFIG = {
  apiKey: '你的 apiKey',
  authDomain: '你的 authDomain',
  projectId: '你的 projectId',
  appId: '你的 appId'
};
*/
