/**
 * 统一配置管理模块
 * 所有环境变量和配置参数都从这里获取
 */
require("dotenv").config();
const path = require("path");

// 和风天气API配置
const hefengConfig = {
  apiUrl:
    process.env.HEFENG_API_URL || "https://devapi.qweather.com/v7/weather/3d",
  keyId: process.env.HEFENG_KEY_ID,
  projectId: process.env.HEFENG_PROJECT_ID,
  privateKeyPath:
    process.env.HEFENG_PRIVATE_KEY_PATH || "./keys/ed25519-private.pem",
  apiKey: process.env.HEFENG_API_KEY,
};

// WxPusher配置
const wxpusherConfig = {
  appToken: process.env.WXPUSHER_APP_TOKEN,
  apiUrl:
    process.env.WXPUSHER_API_URL ||
    "https://wxpusher.zjiecode.com/api/send/message",
  callbackUrl: process.env.WXPUSHER_CALLBACK_URL,
};

// DeepSeek API配置
const deepseekConfig = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  apiUrl:
    process.env.DEEPSEEK_API_URL ||
    "https://api.deepseek.com/v1/chat/completions",
  model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
};

// 服务器配置
const serverConfig = {
  port: process.env.PORT || 3000,
  scheduleCron: process.env.SCHEDULE_TIME || "0 20 * * *", // 默认每天晚上8点
  isTestMode: process.argv.includes("--test"),
};

// 默认地区配置
const defaultLocationConfig = {
  code: process.env.LOCATION || "101190104", // 默认南京江宁
  defaultCity: "南京",
  defaultDistrict: "江宁",
};

// 文件路径配置
const pathConfig = {
  publicDir: path.join(__dirname, "../public"),
  dataDir: path.join(__dirname, "../data"),
  chartsDir: path.join(__dirname, "../public/charts"),
  userPreferencesFile: path.join(__dirname, "../data/userPreferences.json"),
  locationsFile: path.join(__dirname, "../data/locations.json"),
};

module.exports = {
  hefeng: hefengConfig,
  wxpusher: wxpusherConfig,
  deepseek: deepseekConfig,
  server: serverConfig,
  defaultLocation: defaultLocationConfig,
  paths: pathConfig,
};
