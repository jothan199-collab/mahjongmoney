/*
  默认为本机模式；不开启云端则不能跨手机同步、不能使用云端管理员登录或真正的房间密码。
  如果要开启：
  1. Firebase Console > Project settings > Your apps > Web App config；
  2. 开启 Authentication 的 Anonymous 和 Email/Password；
  3. 在 Authentication > Users 建立管理员邮箱账号，复制它的 UID；
  4. 把 UID 同时填到本文件的 adminUid 和 firestore.rules 的「填写管理员UID」；
  5. 在 Firestore > Rules 发布 firestore.rules。
  adminUid 是公开的用户识别号，不是密码；管理员密码绝对不要写到这个文件。
*/
window.MAHJONG_FIREBASE_CONFIG = null;
/* 填入实际 Firebase 配置时，删除上面一行，并取消下面注释：
window.MAHJONG_FIREBASE_CONFIG = {
  apiKey: '你的 apiKey',
  authDomain: '你的 authDomain',
  projectId: '你的 projectId',
  appId: '你的 appId',
  adminUid: '填写管理员UID'
};
*/
