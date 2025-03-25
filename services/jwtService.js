const fs = require("fs");
const path = require("path");
const jose = require("jose");
require("dotenv").config();

/**
 * 生成和风天气API的JWT Token
 * @returns {Promise<String>} JWT Token
 */
async function generateWeatherJWT() {
  try {
    // 读取私钥
    const privateKeyPath =
      process.env.HEFENG_PRIVATE_KEY_PATH ||
      path.join(__dirname, "../keys/ed25519-private.pem");
    const privateKey = fs.readFileSync(privateKeyPath, "utf8");

    // 从环境变量获取凭据ID和项目ID
    const keyId = process.env.HEFENG_KEY_ID;
    const projectId = process.env.HEFENG_PROJECT_ID;

    if (!keyId || !projectId) {
      throw new Error(
        "缺少必要的JWT参数，请检查环境变量中是否设置了HEFENG_KEY_ID和HEFENG_PROJECT_ID"
      );
    }

    // 导入私钥
    const privateKeyImported = await jose.importPKCS8(privateKey, "EdDSA");

    // 创建JWT
    const now = Math.floor(Date.now() / 1000) - 30; // 当前时间减去30秒，防止时间误差
    const jwt = await new jose.SignJWT({
      sub: projectId,
      iat: now,
      exp: now + 3600, // 1小时过期
    })
      .setProtectedHeader({
        alg: "EdDSA",
        kid: keyId,
      })
      .sign(privateKeyImported);

    return jwt;
  } catch (error) {
    console.error("生成JWT失败:", error.message);
    throw new Error("生成JWT失败：" + error.message);
  }
}

/**
 * 获取JWT Token，带缓存功能，避免频繁生成
 */
let cachedToken = null;
let tokenExpiry = 0;

async function getJWTToken() {
  const now = Date.now();

  // 如果Token不存在或者已过期（提前5分钟过期，确保安全）
  if (!cachedToken || now > tokenExpiry - 300000) {
    try {
      cachedToken = await generateWeatherJWT();
      // 设置缓存过期时间为50分钟后（比Token实际过期时间早10分钟）
      tokenExpiry = now + 50 * 60 * 1000;
    } catch (error) {
      console.error("获取JWT Token失败:", error.message);
      throw error;
    }
  }

  return cachedToken;
}

module.exports = {
  generateWeatherJWT,
  getJWTToken,
};
