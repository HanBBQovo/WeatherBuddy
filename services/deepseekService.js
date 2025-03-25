const axios = require("axios");
require("dotenv").config();
const logger = require("./logger");

/**
 * 使用DeepSeek模型获取基于天气的穿衣建议
 * @param {Object} tomorrowWeather 明天的天气数据
 * @returns {Promise<String>} 穿衣建议
 */
async function getClothingSuggestion(tomorrowWeather) {
  try {
    logger.info("开始获取基于天气的穿衣建议");
    const promptContent = `
你是一位专业的时尚顾问，请根据以下天气信息，给出简洁精炼的穿衣建议：

日期：${tomorrowWeather.fxDate}
白天天气：${tomorrowWeather.textDay}
夜间天气：${tomorrowWeather.textNight}
温度范围：${tomorrowWeather.tempMin}°C 至 ${tomorrowWeather.tempMax}°C
风向：${tomorrowWeather.windDirDay}
风力：${tomorrowWeather.windScaleDay}级
相对湿度：${tomorrowWeather.humidity}%

请提供以下三点简短建议，每点不超过15字：
1. 建议穿着的衣物类型
2. 是否需要携带雨具
3. 其他注意事项

回答格式要求：
• 使用emoji表情开头
• 每条建议一行
• 总字数不超过80字
• 不要有任何多余的解释
`;

    logger.debug("发送请求到DeepSeek API");
    const response = await axios.post(
      process.env.DEEPSEEK_API_URL,
      {
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [
          {
            role: "user",
            content: promptContent,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
      }
    );

    if (
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      // 获取模型返回的内容，根据实际API响应结构调整
      const suggestion =
        response.data.choices[0].message?.content ||
        response.data.choices[0].text ||
        "";
      // 处理返回的建议，确保格式美观
      logger.info("成功获取穿衣建议，开始格式化");
      return formatSuggestion(suggestion.trim());
    } else {
      logger.error("DeepSeek返回异常:", response.data);
      return "无法获取穿衣建议";
    }
  } catch (error) {
    logger.error("获取穿衣建议失败:", error.message);
    if (error.response) {
      logger.error("错误状态码:", error.response.status);
      logger.error("错误详情:", error.response.data);
    }
    if (error.request) {
      logger.error("未收到响应，可能是网络问题或API端点不可用");
    }
    return "无法获取穿衣建议，请根据天气自行判断着装";
  }
}

/**
 * 格式化穿衣建议，确保每行都以emoji开头
 * @param {String} suggestion 原始建议文本
 * @returns {String} 格式化后的建议
 */
function formatSuggestion(suggestion) {
  // 如果建议为空或太短，返回默认文本
  if (!suggestion || suggestion.length < 10) {
    return "无法生成合适的穿衣建议";
  }

  // 检查是否每行都以emoji开头，如果没有，添加默认emoji
  const defaultEmojis = ["👕", "☂️", "🔆"];
  const lines = suggestion.split("\n").filter((line) => line.trim().length > 0);
  const formattedLines = lines.map((line, index) => {
    // 检查行是否以emoji开头
    if (!/\p{Emoji}/u.test(line.substring(0, 2))) {
      // 如果不是，添加默认emoji
      return `${defaultEmojis[index % defaultEmojis.length]} ${line}`;
    }
    return line;
  });

  return formattedLines.join("\n");
}

module.exports = {
  getClothingSuggestion,
};
