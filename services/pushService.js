const axios = require("axios");
const dotenv = require("dotenv");
const logger = require("./logger");

// 加载环境变量
dotenv.config();

// WxPusher API配置
const WXPUSHER_API_URL =
  process.env.WXPUSHER_API_URL ||
  "https://wxpusher.zjiecode.com/api/send/message";
const WXPUSHER_APP_TOKEN = process.env.WXPUSHER_APP_TOKEN;

/**
 * 向指定用户推送消息
 * @param {String} content 消息内容
 * @param {Array<String>} uids 用户ID列表
 * @param {Boolean} isHtml 是否为HTML内容
 * @param {String} summary 消息摘要
 * @returns {Promise<Object>} API调用结果
 */
async function pushMessageToUsers(
  content,
  uids,
  isHtml = false,
  summary = "天气推送"
) {
  logger.info("====== 开始推送消息 ======");
  logger.info(`目标用户数: ${uids.length}`);
  logger.debug(`用户IDs: ${JSON.stringify(uids)}`);
  logger.info(`消息摘要: ${summary}`);
  logger.debug(`是否HTML: ${isHtml}`);

  if (!WXPUSHER_APP_TOKEN) {
    logger.error("错误: 未设置WXPUSHER_APP_TOKEN环境变量");
    throw new Error("未设置WXPUSHER_APP_TOKEN环境变量");
  }

  // 构建请求参数
  const data = {
    appToken: WXPUSHER_APP_TOKEN,
    content: content,
    summary: summary,
    contentType: isHtml ? 2 : 1, // 1:文本, 2:HTML
    uids: uids,
  };

  logger.info("推送参数准备完成，准备发送请求到WxPusher API");
  logger.debug(`API端点: ${WXPUSHER_API_URL}`);

  try {
    logger.info("发送HTTP请求...");
    const response = await axios.post(WXPUSHER_API_URL, data);
    logger.debug("WxPusher API响应:", JSON.stringify(response.data));

    if (response.data && response.data.success) {
      // 检查响应中是否包含消息ID
      let messageId = "未知";
      try {
        if (
          response.data.data &&
          response.data.data.length > 0 &&
          response.data.data[0].messageId
        ) {
          messageId = response.data.data[0].messageId;
        }
      } catch (err) {
        logger.warn("无法获取消息ID:", err.message);
      }
      logger.info(`推送成功，消息ID: ${messageId}`);

      return response.data;
    } else {
      logger.error(
        `推送失败，错误码: ${response.data.code}, 错误信息: ${response.data.msg}`
      );
      throw new Error(`推送失败: ${response.data.msg}`);
    }
  } catch (error) {
    logger.error("推送请求异常:", error.message);
    if (error.response) {
      logger.error(`HTTP状态码: ${error.response.status}`);
      logger.error("响应数据:", JSON.stringify(error.response.data));
    }
    if (error.request) {
      logger.error("未收到响应，可能是网络问题或API端点不可用");
    }
    logger.error("错误堆栈:", error.stack);
    throw error;
  }
}

// 导出模块
module.exports = {
  pushMessageToUsers,
};
