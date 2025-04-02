const axios = require("axios");
const chartService = require("./chartService");
let jwtService;
try {
  jwtService = require("./jwtService");
} catch (error) {
  console.log("JWT服务加载失败，将使用API Key认证");
  jwtService = null;
}
require("dotenv").config();
// 导入日志服务
const logger = require("./logger");

/**
 * 获取指定地区的天气信息
 * @param {String} locationCode 城市/地区代码
 * @param {String} locationName 城市/地区名称，用于显示
 * @returns {Promise<Object>} 天气信息对象
 */
async function getWeatherByLocation(locationCode, locationName) {
  try {
    // 验证参数
    if (!locationCode || locationCode === "undefined") {
      logger.warn(`无效的地区代码[${locationCode}]，使用默认地区代码`);
      locationCode = "101190104"; // 默认使用南京江宁
      locationName = locationName || "南京江宁";
    }

    // 准备请求参数
    const params = {
      location: locationCode,
      lang: "zh",
    };

    const config = { params };

    // 如果JWT服务可用且环境变量中配置了JWT相关参数
    if (
      jwtService &&
      process.env.HEFENG_KEY_ID &&
      process.env.HEFENG_PROJECT_ID
    ) {
      try {
        const token = await jwtService.getJWTToken();
        config.headers = {
          Authorization: `Bearer ${token}`,
        };
        logger.info("使用JWT认证获取天气数据");
      } catch (jwtError) {
        logger.error("JWT认证失败，尝试使用API Key:", jwtError.message);
        // 如果JWT认证失败，尝试使用API Key
        if (process.env.HEFENG_API_KEY) {
          params.key = process.env.HEFENG_API_KEY;
          logger.info("使用API Key认证获取天气数据");
        } else {
          throw new Error("JWT认证失败且未配置API Key");
        }
      }
    } else if (process.env.HEFENG_API_KEY) {
      // 如果没有配置JWT但有API Key，则使用API Key
      params.key = process.env.HEFENG_API_KEY;
      logger.info("使用API Key认证获取天气数据");
    } else {
      throw new Error("未配置认证信息，请设置JWT相关参数或API Key");
    }

    logger.info(
      `开始请求${locationName}天气数据，URL: ${process.env.HEFENG_API_URL}`
    );
    const response = await axios.get(process.env.HEFENG_API_URL, config);
    logger.info(`成功获取${locationName}天气数据`);

    // 为返回的数据添加地区名称信息
    if (response.data && !response.data.locationName) {
      response.data.locationName = locationName;
    }

    return response.data;
  } catch (error) {
    logger.error(`获取${locationName}天气信息失败:`, error.message);
    if (error.response) {
      logger.error("错误详情:", error.response.data);
    }
    if (error.request) {
      logger.error("未收到响应，可能是网络问题或API端点不可用");
    }
    throw new Error(`获取${locationName}天气信息失败: ${error.message}`);
  }
}

/**
 * 获取南京江宁的天气信息 (向后兼容)
 * @returns {Promise<Object>} 天气信息对象
 */
async function getJiangningWeather() {
  return getWeatherByLocation(process.env.LOCATION || "101190104", "南京江宁");
}

/**
 * 获取明天的天气数据
 * @param {Object} weatherData 完整的天气数据
 * @returns {Object} 明天的天气数据
 */
function getTomorrowWeather(weatherData) {
  if (!weatherData || !weatherData.daily || weatherData.daily.length < 2) {
    throw new Error("无法获取明天的天气数据");
  }

  return weatherData.daily[1]; // 索引1对应明天的数据
}

/**
 * 获取随机底部图片
 * @returns {String} 随机底部图片的URL
 */
function getRandomBottomImage() {
  const images = [
    "https://pic1.imgdb.cn/item/67e0bbaf88c538a9b5c56204.gif",
    "https://pic1.imgdb.cn/item/67eca2a80ba3d5a1d7e9b978.gif",
    "https://pic1.imgdb.cn/item/67eca2a80ba3d5a1d7e9b979.gif",
    "https://pic1.imgdb.cn/item/67eca4710ba3d5a1d7e9bf32.gif",
    "https://pic1.imgdb.cn/item/67eca4a60ba3d5a1d7e9bfa1.gif",
  ];

  return images[Math.floor(Math.random() * images.length)];
}

/**
 * 格式化天气数据，返回HTML格式的内容
 * @param {Object} weatherData 和风天气API返回的数据
 * @param {String} clothingSuggestion 可选的穿衣建议
 * @returns {Promise<String>} 格式化后的HTML格式天气信息
 */
async function formatWeatherData(weatherData, clothingSuggestion = null) {
  if (!weatherData || !weatherData.daily || weatherData.daily.length < 2) {
    return "无法获取明天的天气数据";
  }

  // 获取地区代码
  const locationCode = weatherData.location || "101190104";

  // 只获取明天的天气信息
  const tomorrow = weatherData.daily[1];

  // 获取天气信息
  const cityName = weatherData.locationName || "南京江宁"; // 使用传入的地区名称，否则默认为南京江宁
  const date = tomorrow.fxDate || "明天";

  // 获取日期的星期
  const weekday = getWeekdayName(date);

  // 根据天气状况选择合适的天气图标
  const weatherIcon = getWeatherIcon(tomorrow.textDay);
  const weatherDesc = `${tomorrow.textDay}转${tomorrow.textNight}`;
  const temperature = `${tomorrow.tempMin}°C ~ ${tomorrow.tempMax}°C`;
  const windDirection = tomorrow.windDirDay || "未知";
  const windPower = `${tomorrow.windScaleDay}级`;
  const humidity = tomorrow.humidity || "未知";

  // 检查是否有特殊天气提醒
  const weatherAlert = generateWeatherAlert(tomorrow);

  // 根据温度决定颜色
  const minTemp = parseInt(tomorrow.tempMin);
  const maxTemp = parseInt(tomorrow.tempMax);
  let tempColor = "#20a0ff"; // 默认颜色

  if (maxTemp >= 35) {
    tempColor = "#ff6666"; // 高温红色
  } else if (maxTemp >= 30) {
    tempColor = "#ff9900"; // 较热橙色
  } else if (minTemp <= 0) {
    tempColor = "#99ccff"; // 寒冷冷色
  }

  // 获取天气背景图URL
  const bgImage = getWeatherBackground(tomorrow.textDay);

  // 生成图表图片URL
  let tempChartUrl = null;
  let rainChartUrl = null;
  let windChartUrl = null;

  if (weatherData.daily && weatherData.daily.length >= 3) {
    try {
      // 异步生成各种图表
      const chartPromises = [
        chartService.generateTemperatureChart(weatherData.daily, locationCode),
        chartService.generateRainfallChart(weatherData.daily, locationCode),
        chartService.generateWindChart(weatherData.daily, locationCode),
      ];

      // 等待所有图表生成完成
      const [tempChart, rainChart, windChart] =
        await Promise.all(chartPromises);

      tempChartUrl = tempChart;
      rainChartUrl = rainChart;
      windChartUrl = windChart;

      // 记录图表生成情况
      logger.info(`为地区 ${cityName}(${locationCode}) 生成了图表：`, {
        tempChart: tempChartUrl ? "成功" : "失败",
        rainChart: rainChartUrl ? "成功" : "失败",
        windChart: windChartUrl ? "成功" : "失败",
      });
    } catch (error) {
      logger.error("生成图表时出错:", error);
    }
  }

  // 在CSS部分添加或更新以下样式
  const css = `
    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .weather-card {
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin: 10px 0;
      background-color: #fff;
    }
    .card-header {
      background: linear-gradient(120deg, #3498db, #2c82c9);
      color: white;
      padding: 15px;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      background-image: url('${bgImage}');
      background-size: cover;
      background-position: center;
      position: relative;
    }
    .card-header-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 1;
    }
    .card-header-content {
      position: relative;
      z-index: 2;
    }
    .card-date {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 5px;
    }
    .card-body {
      padding: 15px;
    }
    .weather-item {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      font-size: 16px;
    }
    .weather-icon {
      width: 24px;
      text-align: center;
      margin-right: 12px;
      font-size: 20px;
    }
    .temp {
      color: ${tempColor};
      font-weight: bold;
      font-size: 18px;
    }
    .weather-alert {
      background-color: #fff4e5;
      border-left: 4px solid #ff9500;
      padding: 10px 15px;
      margin: 10px 0;
      border-radius: 5px;
      display: flex;
      align-items: center;
    }
    .trend-section, .chart-section {
      margin-top: 15px;
      border-top: 1px dashed #eee;
      padding-top: 15px;
    }
    .trend-title, .chart-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #3498db;
      display: flex;
      align-items: center;
    }
    .trend-title .icon, .chart-title .icon {
      margin-right: 8px;
    }
    .chart-section {
      margin-top: 20px;
      background-color: #f8fafc;
      border-radius: 10px;
      padding: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .chart-title {
      color: #2c3e50;
      margin-bottom: 15px;
    }
    .trend-chart {
      overflow-x: auto;
      font-size: 14px;
    }
    .trend-table {
      width: 100%;
      border-collapse: collapse;
      text-align: center;
    }
    .trend-table th {
      font-weight: normal;
      padding: 5px;
      color: #666;
    }
    .trend-table td {
      padding: 5px;
    }
    .high-temp {
      color: #ff6666;
      font-weight: bold;
    }
    .low-temp {
      color: #3498db;
      font-weight: bold;
    }
    .trend-arrow {
      font-size: 18px;
      color: #666;
      width: 24px;
      display: inline-block;
    }
    .clothing-section {
      margin-top: 15px;
      border-top: 1px dashed #eee;
      padding-top: 15px;
    }
    .clothing-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #3498db;
      display: flex;
      align-items: center;
    }
    .clothing-title .icon {
      margin-right: 8px;
    }
    .clothing-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .clothing-icon {
      min-width: 24px;
      text-align: center;
      margin-right: 8px;
    }
    .clothing-text {
      flex: 1;
      line-height: 1.5;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 15px;
      padding: 8px;
      background-color: #f9f9f9;
      border-radius: 0 0 15px 15px;
    }
  `;

  // 构建HTML内容
  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="weather-card">
    <div class="card-header">
      <div class="card-header-overlay"></div>
      <div class="card-header-content">
        <div>${cityName}天气预报</div>
        <div class="card-date">📆 ${date} ${weekday}</div>
      </div>
    </div>
    
    <div class="card-body">
      <div class="weather-item">
        <div class="weather-icon">${weatherIcon}</div>
        <div>天气：${weatherDesc}</div>
      </div>
      
      <div class="weather-item">
        <div class="weather-icon">🌡️</div>
        <div>温度：<span class="temp">${temperature}</span></div>
      </div>
      
      <div class="weather-item">
        <div class="weather-icon">💨</div>
        <div>风向：${windDirection} ${windPower}</div>
      </div>
      
      <div class="weather-item">
        <div class="weather-icon">💧</div>
        <div>湿度：${humidity}%</div>
      </div>
  `;

  // 如果有天气预警，添加到消息中
  if (weatherAlert) {
    html += `
      <div class="weather-alert">
        <div class="weather-icon">⚠️</div>
        <div>${weatherAlert}</div>
      </div>
    `;
  }

  // 添加未来三天温度趋势
  if (weatherData.daily && weatherData.daily.length >= 3) {
    const trendData = generateTemperatureTrendHTML(weatherData.daily);
    html += `
      <div class="trend-section">
        <div class="trend-title"><span class="icon">🌈</span> 温度趋势</div>
        <div class="trend-chart">
          ${trendData}
        </div>
      </div>
    `;

    // 添加图表图片（如果生成成功）
    if (tempChartUrl) {
      const serverBaseUrl =
        process.env.SERVER_BASE_URL ||
        `http://localhost:${process.env.PORT || 3000}`;
      const fullTempChartUrl = `${serverBaseUrl}${tempChartUrl}`;

      html += `
      <div class="chart-section">
        <div class="chart-title"><span class="icon">📊</span> 温度走势图</div>
        <div class="chart-image">
          <img src="${fullTempChartUrl}" alt="温度走势图" style="max-width:100%; border-radius:8px;">
        </div>
      </div>
      `;
    }

    if (rainChartUrl) {
      const serverBaseUrl =
        process.env.SERVER_BASE_URL ||
        `http://localhost:${process.env.PORT || 3000}`;
      const fullRainChartUrl = `${serverBaseUrl}${rainChartUrl}`;

      html += `
      <div class="chart-section">
        <div class="chart-title"><span class="icon">💧</span> 降水预测</div>
        <div class="chart-image">
          <img src="${fullRainChartUrl}" alt="降水预测图" style="max-width:100%; border-radius:8px;">
        </div>
      </div>
      `;
    }

    if (windChartUrl) {
      const serverBaseUrl =
        process.env.SERVER_BASE_URL ||
        `http://localhost:${process.env.PORT || 3000}`;
      const fullWindChartUrl = `${serverBaseUrl}${windChartUrl}`;

      html += `
      <div class="chart-section">
        <div class="chart-title"><span class="icon">🌬️</span> 风力预测</div>
        <div class="chart-image">
          <img src="${fullWindChartUrl}" alt="风力预测图" style="max-width:100%; border-radius:8px;">
        </div>
      </div>
      `;
    }
  }

  // 如果有穿衣建议，添加到消息中
  if (clothingSuggestion) {
    html += `
      <div class="clothing-section">
        <div class="clothing-title"><span class="icon">👔</span> 穿衣建议</div>
        ${formatClothingSuggestionHTML(clothingSuggestion)}
      </div>
    `;
  }

  // 底部
  html += `
    </div>
    <div>
      <img src="${getRandomBottomImage()}" alt="" style="display:block; width:100%; max-width:500px; margin:0 auto;" />
    </div>
    <div class="footer">
      祝您生活愉快 ⭐
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * 根据天气状况获取背景图片URL
 * @param {String} weatherText 天气描述文本
 * @returns {String} 背景图片URL
 */
function getWeatherBackground(weatherText) {
  // 根据天气情况返回对应的背景图URL
  // 使用Unsplash的永久图片链接，确保长期可用

  // 雨类天气
  if (
    weatherText.includes("暴雨") ||
    weatherText.includes("大暴雨") ||
    weatherText.includes("特大暴雨")
  ) {
    return "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("大雨")) {
    return "https://images.unsplash.com/photo-1433863448220-78aaa064ff47?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("中雨")) {
    return "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("雨")) {
    return "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?q=80&w=1000&auto=format&fit=crop";
  }

  // 雪类天气
  else if (weatherText.includes("大雪") || weatherText.includes("暴雪")) {
    return "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("中雪")) {
    return "https://images.unsplash.com/photo-1477601263568-180e2c6d046e?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("雪")) {
    return "https://images.unsplash.com/photo-1491002052546-bf38f186af56?q=80&w=1000&auto=format&fit=crop";
  }

  // 清晴天气
  else if (weatherText.includes("晴")) {
    return "https://images.unsplash.com/photo-1419833173245-f59e1b93f9ee?q=80&w=1000&auto=format&fit=crop";
  }

  // 多云、阴天
  else if (weatherText.includes("多云")) {
    return "https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("阴")) {
    return "https://images.unsplash.com/photo-1499956827185-0d63ee78a910?q=80&w=1000&auto=format&fit=crop";
  }

  // 特殊天气
  else if (weatherText.includes("雾")) {
    return "https://images.unsplash.com/photo-1487621167305-5d248087c724?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("霾")) {
    return "https://images.unsplash.com/photo-1535695449338-46723397d2be?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("沙尘") || weatherText.includes("扬沙")) {
    return "https://images.unsplash.com/photo-1521811559553-2a6ceb56cf58?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("冰雹") || weatherText.includes("雹")) {
    return "https://images.unsplash.com/photo-1624961688978-18063bec05ad?q=80&w=1000&auto=format&fit=crop";
  } else if (weatherText.includes("雷") || weatherText.includes("闪电")) {
    return "https://images.unsplash.com/photo-1461511669078-d46bf351cd6e?q=80&w=1000&auto=format&fit=crop";
  }

  // 默认图片
  return "https://images.unsplash.com/photo-1601297183305-6df142704ea2?q=80&w=1000&auto=format&fit=crop";
}

/**
 * 将文本穿衣建议格式化为HTML格式
 * @param {String} suggestion 原始建议文本
 * @returns {String} 格式化后的HTML
 */
function formatClothingSuggestionHTML(suggestion) {
  if (!suggestion) return "";

  // 分割成行
  const lines = suggestion.split("\n").filter((line) => line.trim().length > 0);
  let html = "";

  lines.forEach((line) => {
    // 尝试提取emoji和文本
    const match = line.match(/^(\p{Emoji}+)?\s*(.*)/u);
    if (match) {
      const emoji = match[1] || "👕";
      const text = match[2];

      html += `
        <div class="clothing-item">
          <div class="clothing-icon">${emoji}</div>
          <div class="clothing-text">${text}</div>
        </div>
      `;
    }
  });

  return html;
}

/**
 * 生成温度趋势HTML表格
 * @param {Array} dailyData 每日天气数据数组
 * @returns {String} HTML格式的温度趋势表
 */
function generateTemperatureTrendHTML(dailyData) {
  if (!dailyData || dailyData.length < 3) return "";

  // 只取未来3天的数据
  const data = dailyData.slice(0, 3);

  // 生成星期标签
  const weekdayLabels = data.map((day) => getWeekdayName(day.fxDate));

  // 获取天气图标
  const weatherIcons = data.map((day) => getWeatherIcon(day.textDay));

  // 获取最高温和最低温
  const maxValues = data.map((day) => parseInt(day.tempMax));
  const minValues = data.map((day) => parseInt(day.tempMin));

  // 获取温度变化趋势
  const getTrendArrow = (current, next) => {
    if (next > current) return '<span class="trend-arrow">↗️</span>';
    if (next < current) return '<span class="trend-arrow">↘️</span>';
    return '<span class="trend-arrow">→</span>';
  };

  // 构建表格 - 更新布局，添加天气图标
  const html = `
    <table class="trend-table">
      <tr>
        <th>${weatherIcons[0]} ${weekdayLabels[0]}</th>
        <th></th>
        <th>${weatherIcons[1]} ${weekdayLabels[1]}</th>
        <th></th>
        <th>${weatherIcons[2]} ${weekdayLabels[2]}</th>
      </tr>
      <tr>
        <td class="high-temp">${maxValues[0]}°C</td>
        <td>${getTrendArrow(maxValues[0], maxValues[1])}</td>
        <td class="high-temp">${maxValues[1]}°C</td>
        <td>${getTrendArrow(maxValues[1], maxValues[2])}</td>
        <td class="high-temp">${maxValues[2]}°C</td>
      </tr>
      <tr>
        <td class="low-temp">${minValues[0]}°C</td>
        <td>${getTrendArrow(minValues[0], minValues[1])}</td>
        <td class="low-temp">${minValues[1]}°C</td>
        <td>${getTrendArrow(minValues[1], minValues[2])}</td>
        <td class="low-temp">${minValues[2]}°C</td>
      </tr>
      <tr>
        <td><small>今天</small></td>
        <td></td>
        <td><small>明天</small></td>
        <td></td>
        <td><small>后天</small></td>
      </tr>
    </table>
  `;

  return html;
}

/**
 * 根据日期获取星期名称
 * @param {String} dateString 日期字符串，格式为YYYY-MM-DD
 * @returns {String} 星期名称
 */
function getWeekdayName(dateString) {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  try {
    const date = new Date(dateString);
    return weekdays[date.getDay()];
  } catch (error) {
    return "";
  }
}

/**
 * 根据天气状况获取对应的emoji图标
 * @param {String} weatherText 天气描述文本
 * @returns {String} 对应的天气emoji图标
 */
function getWeatherIcon(weatherText) {
  const weatherIcons = {
    晴: "☀️",
    多云: "⛅",
    阴: "☁️",
    小雨: "🌦️",
    中雨: "🌧️",
    大雨: "🌧️",
    暴雨: "⛈️",
    雷阵雨: "⛈️",
    小雪: "🌨️",
    中雪: "🌨️",
    大雪: "❄️",
    雾: "🌫️",
    霾: "🌫️",
  };

  // 遍历天气关键词，匹配最合适的图标
  for (const key in weatherIcons) {
    if (weatherText.includes(key)) {
      return weatherIcons[key];
    }
  }

  return "🌈"; // 默认图标
}

/**
 * 根据天气状况生成特殊天气提醒
 * @param {Object} weatherData 天气数据
 * @returns {String|null} 天气提醒内容或null
 */
function generateWeatherAlert(weatherData) {
  // 特殊天气类型及其提醒内容
  const alertTypes = {
    雨: {
      大雨: "明天有大雨，出门请带伞，小心路滑",
      暴雨: "明天有暴雨，尽量减少外出活动",
      中雨: "明天有中雨，记得带伞",
      雷阵雨: "明天有雷阵雨，注意防雷防雨",
    },
    雪: {
      大雪: "明天有大雪，注意保暖，路面可能结冰",
      中雪: "明天有中雪，出行注意安全",
    },
    雾: "明天有雾，能见度低，开车注意安全",
    沙尘: "明天有沙尘天气，建议戴口罩",
    霾: "明天有霾，注意防护，戴好口罩",
    风: {
      5: "明天风力较大，注意防风",
      6: "明天风力较大，注意防风",
      7: "明天大风，谨慎出行，注意安全",
      8: "明天大风，尽量减少户外活动",
    },
  };

  // 检查天气描述
  const weatherDesc = weatherData.textDay + weatherData.textNight;

  // 检查雨雪雾霾
  for (const type in alertTypes) {
    if (typeof alertTypes[type] === "object") {
      for (const subType in alertTypes[type]) {
        if (weatherDesc.includes(subType)) {
          return alertTypes[type][subType];
        }
      }
    } else if (weatherDesc.includes(type)) {
      return alertTypes[type];
    }
  }

  // 检查风力
  const windScale = parseInt(weatherData.windScaleDay || "0");
  if (windScale >= 5 && alertTypes.风[windScale.toString()]) {
    return alertTypes.风[windScale.toString()];
  }

  // 检查温度异常
  const minTemp = parseInt(weatherData.tempMin || "0");
  const maxTemp = parseInt(weatherData.tempMax || "0");

  if (maxTemp >= 35) {
    return "明天气温较高，注意防暑降温，多喝水";
  } else if (minTemp <= 0) {
    return "明天气温较低，注意保暖";
  }

  return null;
}

/**
 * 将命令响应格式化为美观的HTML
 * @param {String} title 响应标题
 * @param {String} content 响应内容
 * @param {String} icon 标题图标
 * @param {String} type 响应类型（info, success, warning, error）
 * @param {String} customStyles 自定义CSS样式
 * @returns {String} 格式化后的HTML
 */
function formatCommandResponse(
  title,
  content,
  icon = "ℹ️",
  type = "info",
  customStyles = ""
) {
  // 根据类型确定颜色
  let mainColor, bgColor, borderColor;
  switch (type) {
    case "success":
      mainColor = "#28a745";
      bgColor = "#f0fff4";
      borderColor = "#c3e6cb";
      icon = icon || "✅";
      break;
    case "warning":
      mainColor = "#ffc107";
      bgColor = "#fff9e6";
      borderColor = "#ffeeba";
      icon = icon || "⚠️";
      break;
    case "error":
      mainColor = "#dc3545";
      bgColor = "#fff2f0";
      borderColor = "#f5c6cb";
      icon = icon || "❌";
      break;
    default: // info
      mainColor = "#3498db";
      bgColor = "#f0f8ff";
      borderColor = "#bee5eb";
      icon = icon || "ℹ️";
  }

  // CSS样式
  const css = `
    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      color: #333;
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .command-card {
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin: 10px 0;
      background-color: #fff;
    }
    .card-header {
      background: ${mainColor};
      color: white;
      padding: 15px;
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card-header .icon {
      margin-right: 10px;
      font-size: 22px;
    }
    .card-body {
      padding: 20px;
      background-color: ${bgColor};
      border-left: 1px solid ${borderColor};
      border-right: 1px solid ${borderColor};
    }
    
    .highlight {
      background-color: rgba(255, 255, 0, 0.2);
      padding: 2px 4px;
      border-radius: 3px;
    }
    .command {
      background-color: rgba(0, 0, 0, 0.05);
      padding: 8px 12px;
      border-radius: 5px;
      font-family: monospace;
      margin: 10px 0;
      display: inline-block;
    }
    .item-list {
      padding-left: 20px;
    }
    .item-list li {
      margin-bottom: 8px;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      padding: 10px;
      background-color: #f9f9f9;
      border-radius: 0 0 15px 15px;
      border-bottom: 1px solid ${borderColor};
      border-left: 1px solid ${borderColor};
      border-right: 1px solid ${borderColor};
    }
    ${customStyles}
  `;

  // 转换内容中的一些格式标记
  let formattedContent = content
    // 将连字符列表项转换为HTML列表
    .replace(/^(- .+)$/gm, "<li>$1</li>")
    // 处理强调显示
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // 处理命令显示
    .replace(/`(.+?)`/g, '<code class="command">$1</code>');

  // 检查是否需要将连字符列表项包装在ul中
  if (formattedContent.includes("<li>")) {
    formattedContent = formattedContent
      .replace(/<li>/g, '<ul class="item-list"><li>')
      .replace(/<\/li>\n\n/g, "</li></ul>\n\n")
      .replace(/<\/li>$/, "</li></ul>");
  }

  // 构建HTML
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>
  <div class="command-card">
    <div class="card-header">
      <span class="icon">${icon}</span>
      <span>${title}</span>
    </div>
    <div class="card-body">
      <div class="content-section">
${formattedContent}
      </div>
    </div>
    <div class="footer">
      天气助手 - 随时为您服务
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * 生成温度趋势的交互式图表HTML
 * @param {Array} dailyData 每日天气数据数组
 * @returns {String} 包含图表的HTML
 */
function generateTemperatureChartHTML(dailyData) {
  if (!dailyData || dailyData.length < 3) return "";

  // 使用未来7天的数据
  const data = dailyData.slice(0, 7);

  // 准备图表数据
  const labels = data.map((day) => getWeekdayName(day.fxDate));
  const maxTemps = data.map((day) => parseInt(day.tempMax));
  const minTemps = data.map((day) => parseInt(day.tempMin));

  // 生成随机ID避免多个图表冲突
  const chartId = "tempChart" + Math.floor(Math.random() * 10000);

  // 构建图表HTML
  const chartHtml = `
    <div class="chart-container">
      <canvas id="${chartId}" width="400" height="220"></canvas>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      (function() {
        // 图表颜色配置
        const ctx = document.getElementById('${chartId}').getContext('2d');
        
        // 创建图表
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [
              {
                label: '最高温度(°C)',
                data: ${JSON.stringify(maxTemps)},
                borderColor: '#FF6384',
                backgroundColor: 'rgba(255, 99, 132, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#FF6384',
                pointRadius: 4,
                tension: 0.3,
                fill: false
              },
              {
                label: '最低温度(°C)',
                data: ${JSON.stringify(minTemps)},
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#36A2EB',
                pointRadius: 4,
                tension: 0.3,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: '未来天气温度走势',
                font: {
                  size: 16,
                  family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
                }
              },
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  boxWidth: 6
                }
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: {
                  size: 14
                },
                bodyFont: {
                  size: 13
                },
                callbacks: {
                  label: function(context) {
                    return context.dataset.label + ': ' + context.parsed.y + '°C';
                  }
                }
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                  callback: function(value) {
                    return value + '°C';
                  }
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
      })();
    </script>
    <style>
      .chart-container {
        position: relative;
        height: 220px;
        width: 100%;
        margin: 10px 0;
      }
    </style>
  `;

  return chartHtml;
}

/**
 * 生成降水预测图表HTML
 * @param {Array} dailyData 每日天气数据数组
 * @returns {String} 包含降水图表的HTML
 */
function generateRainfallChartHTML(dailyData) {
  if (!dailyData || dailyData.length < 3) return "";

  // 使用未来7天的数据
  const data = dailyData.slice(0, 7);

  // 准备图表数据
  const labels = data.map((day) => getWeekdayName(day.fxDate));
  const precip = data.map((day) => parseFloat(day.precip) || 0); // 降水量
  const pop = data.map((day) => parseInt(day.pop) || 0); // 降水概率

  // 生成随机ID避免多个图表冲突
  const chartId = "rainChart" + Math.floor(Math.random() * 10000);

  // 构建图表HTML
  const chartHtml = `
    <div class="chart-container">
      <canvas id="${chartId}" width="400" height="220"></canvas>
    </div>
    <script>
      (function() {
        // 图表颜色配置
        const ctx = document.getElementById('${chartId}').getContext('2d');
        
        // 创建图表
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [
              {
                label: '降水概率(%)',
                data: ${JSON.stringify(pop)},
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                yAxisID: 'y1',
                order: 1
              },
              {
                label: '降水量(mm)',
                data: ${JSON.stringify(precip)},
                type: 'line',
                borderColor: '#4bc0c0',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                pointBackgroundColor: '#4bc0c0',
                pointRadius: 4,
                tension: 0.3,
                borderWidth: 2,
                yAxisID: 'y',
                fill: false,
                order: 0
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: '未来降水预测',
                font: {
                  size: 16,
                  family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
                }
              },
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  boxWidth: 6
                }
              },
              tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                titleFont: {
                  size: 14
                },
                bodyFont: {
                  size: 13
                },
                callbacks: {
                  label: function(context) {
                    const label = context.dataset.label || '';
                    let value = context.parsed.y;
                    if (label.includes('降水概率')) {
                      return label + ': ' + value + '%';
                    } else if (label.includes('降水量')) {
                      return label + ': ' + value + 'mm';
                    }
                    return label + ': ' + value;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: {
                  display: false
                }
              },
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                  display: true,
                  text: '降水量(mm)'
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                  callback: function(value) {
                    return value + 'mm';
                  }
                }
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                  display: true,
                  text: '降水概率(%)'
                },
                min: 0,
                max: 100,
                grid: {
                  drawOnChartArea: false
                },
                ticks: {
                  callback: function(value) {
                    return value + '%';
                  }
                }
              }
            }
          }
        });
      })();
    </script>
  `;

  return chartHtml;
}

/**
 * 生成风向风力玫瑰图HTML
 * @param {Array} dailyData 每日天气数据数组
 * @returns {String} 包含风向风力图表的HTML
 */
function generateWindChartHTML(dailyData) {
  if (!dailyData || dailyData.length < 3) return "";

  // 使用未来7天的数据
  const data = dailyData.slice(0, 7);

  // 准备图表数据
  const labels = data.map((day) => getWeekdayName(day.fxDate));

  // 处理风向数据
  const windDirections = data.map((day) => {
    // 将文字风向转换为数值，用于极坐标图
    const directions = {
      北风: 0,
      东北风: 45,
      东风: 90,
      东南风: 135,
      南风: 180,
      西南风: 225,
      西风: 270,
      西北风: 315,
    };

    // 从风向字符串中提取主要方向
    let dir = day.windDirDay || "北风";
    for (const key in directions) {
      if (dir.includes(key)) {
        dir = key;
        break;
      }
    }

    return directions[dir] || 0;
  });

  // 风力等级数据
  const windScales = data.map((day) => parseInt(day.windScaleDay) || 0);

  // 生成随机ID避免多个图表冲突
  const chartId = "windChart" + Math.floor(Math.random() * 10000);

  // 构建图表HTML
  const chartHtml = `
    <div class="chart-container">
      <canvas id="${chartId}" width="400" height="250"></canvas>
    </div>
    <script>
      (function() {
        // 图表颜色配置
        const ctx = document.getElementById('${chartId}').getContext('2d');
        
        // 定义背景色渐变
        const backgroundColors = [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 199, 199, 0.6)'
        ];
        
        const borderColors = backgroundColors.map(color => color.replace('0.6', '1'));
        
        // 创建带风向标签的图表
        const directionLabels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        
        // 创建图表
        new Chart(ctx, {
          type: 'polarArea',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              label: '风力等级',
              data: ${JSON.stringify(windScales)},
              backgroundColor: backgroundColors,
              borderColor: borderColors,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              r: {
                angleLines: {
                  display: true
                },
                ticks: {
                  display: false
                },
                pointLabels: {
                  display: false
                }
              }
            },
            plugins: {
              title: {
                display: true,
                text: '风向与风力',
                font: {
                  size: 16,
                  family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
                }
              },
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  boxWidth: 6
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const label = context.label || '';
                    const value = context.raw || 0;
                    const index = context.dataIndex;
                    const directions = ${JSON.stringify(windDirections)};
                    const dir = directions[index];
                    
                    // 找到最接近的风向标签
                    const dirLabelIndex = Math.round(dir / 45) % 8;
                    const dirLabel = directionLabels[dirLabelIndex];
                    
                    return label + ': ' + dirLabel + '风 ' + value + '级';
                  }
                }
              }
            }
          }
        });
        
        // 添加风向指示器
        const drawWindLabels = function() {
          if (!ctx) return;
          
          const width = ctx.canvas.width;
          const height = ctx.canvas.height;
          const centerX = width / 2;
          const centerY = height / 2;
          const radius = Math.min(centerX, centerY) * 0.85;
          
          ctx.save();
          ctx.font = '12px sans-serif';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // 绘制风向标记
          directionLabels.forEach((label, index) => {
            const angle = (index * 45) * Math.PI / 180;
            const x = centerX + radius * Math.sin(angle);
            const y = centerY - radius * Math.cos(angle);
            
            ctx.fillText(label, x, y);
          });
          
          ctx.restore();
        };
        
        // 等图表渲染完成后添加风向标签
        setTimeout(drawWindLabels, 200);
      })();
    </script>
  `;

  return chartHtml;
}

async function getDefaultWeather() {
  return getWeatherByLocation("101190104", "南京江宁");
}

module.exports = {
  getJiangningWeather,
  getWeatherByLocation,
  getTomorrowWeather,
  formatWeatherData,
  formatCommandResponse,
  generateTemperatureChartHTML,
  generateRainfallChartHTML,
  generateWindChartHTML,
  getDefaultWeather,
};
