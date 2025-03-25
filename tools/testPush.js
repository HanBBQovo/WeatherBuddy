/**
 * 测试推送工具
 * 用于快速测试向指定用户推送天气信息
 */
const logger = require("../services/logger");
const pushService = require("../services/pushService");
const weatherService = require("../services/weatherService");
const deepseekService = require("../services/deepseekService");

/**
 * 获取命令行参数
 * @returns {Object} 解析后的命令行参数
 */
function parseArguments() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.substring(2).split("=");
      args[key] = value || true;
    }
  });
  return args;
}

/**
 * 主函数：解析命令行参数并执行推送测试
 */
function main() {
  try {
    const args = parseArguments();
    const uid = args.uid;

    // 这里直接使用南京浦口的地区代码
    const locationCode = "101190107";
    const locationName = "南京浦口";

    testPushToUser(uid, locationCode, locationName);
  } catch (error) {
    logger.error("测试推送出错:", error);
    process.exit(1);
  }
}

/**
 * 向指定用户推送测试天气信息
 * @param {String} uid 用户ID，如果不提供，则使用--uid命令行参数
 * @param {String} locationCode 地区代码
 * @param {String} locationName 地区名称
 * @returns {Promise<void>}
 */
async function testPushToUser(uid, locationCode, locationName) {
  try {
    // 如果没有提供uid，则使用命令行参数
    const args = parseArguments();
    uid = uid || args.uid;

    // 验证必要参数
    if (!uid) {
      logger.error("必须提供用户ID (--uid=xxx)");
      process.exit(1);
    }

    if (!locationCode) {
      logger.error("必须提供有效的地区代码");
      process.exit(1);
    }

    if (!locationName) {
      locationName = "测试地区";
    }

    logger.info(`开始向用户 [${uid}] 推送 [${locationName}] 的天气信息`);

    // 获取天气数据
    logger.debug(
      `使用参数获取天气数据：locationCode=${locationCode}, locationName=${locationName}`
    );
    const weatherData = await weatherService.getWeatherByLocation(
      locationCode,
      locationName
    );

    // 获取明天的天气数据
    const tomorrowWeather = weatherService.getTomorrowWeather(weatherData);

    // 生成推送摘要
    const pushSummary = `${locationName}天气预报 ${tomorrowWeather.fxDate} ${tomorrowWeather.textDay}`;

    // 使用DeepSeek获取穿衣建议
    logger.info(`开始获取${locationName}明日穿衣建议...`);
    let clothingSuggestion = null;
    try {
      clothingSuggestion =
        await deepseekService.getClothingSuggestion(tomorrowWeather);
      logger.info(`${locationName}穿衣建议获取成功`);
    } catch (suggestionError) {
      logger.error(`获取${locationName}穿衣建议失败:`, suggestionError);
      // 失败也继续，只是没有穿衣建议
    }

    // 生成推送内容
    const pushContent = await weatherService.formatWeatherData(
      weatherData,
      clothingSuggestion
    );

    // 推送给用户
    const result = await pushService.pushMessageToUsers(
      pushContent,
      [uid],
      true,
      pushSummary
    );

    logger.info("推送结果:", result);
    logger.info("测试推送完成");
  } catch (error) {
    logger.error("测试推送失败:", error);
    process.exit(1);
  }
}

// 如果直接运行该脚本，则执行测试推送
if (require.main === module) {
  main();
}

module.exports = {
  testPushToUser,
};
