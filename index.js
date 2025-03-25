const schedule = require("node-schedule");
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

// 导入配置和工具模块
const config = require("./config/config");
const logger = require("./services/logger");
const { withErrorHandling } = require("./services/errorHandler");

const weatherService = require("./services/weatherService");
const pushService = require("./services/pushService");
const userService = require("./services/userService");
const deepseekService = require("./services/deepseekService");
const userPreferenceService = require("./services/userPreferenceService");
const messageHandler = require("./services/messageHandler");

/**
 * 获取明天的天气并推送到用户
 * @param {Array<String>} targetUids 目标用户ID数组，如果为null则获取所有启用的用户
 */
const getWeatherAndPush = withErrorHandling(async function (targetUids = null) {
  logger.info("开始获取用户列表...");

  // 获取需要推送的用户列表
  const userUids = targetUids || (await userService.getEnabledUserUids());

  if (userUids.length === 0) {
    logger.info("没有需要推送的用户");
    return;
  }

  logger.info(`共有 ${userUids.length} 个用户需要推送天气数据`);

  // 为每个用户单独推送，不再按地区分组
  for (const uid of userUids) {
    try {
      logger.info(`开始为用户[${uid}]获取天气数据...`);

      // 直接获取用户偏好
      const userPrefResult =
        userPreferenceService.getUserLocationPreference(uid);

      logger.debug(`用户地区偏好原始返回值: ${JSON.stringify(userPrefResult)}`);

      // 检查是否有错误
      if (userPrefResult && userPrefResult.error) {
        logger.error(`获取用户[${uid}]地区偏好失败:`, userPrefResult.error);
        continue;
      }

      // 跳过错误处理包装，直接访问用户偏好
      // 由于withErrorHandling在成功时没有返回{result:...}格式，而是直接返回结果
      // 看日志发现系统能获取到地区代码101190107，但代码中获取不到
      // 直接从用户偏好文件获取用户地区
      let userPref = null;
      try {
        const fs = require("fs");
        const path = require("path");
        const userPrefPath = path.join(
          __dirname,
          "data",
          "userPreferences.json"
        );

        const data = JSON.parse(fs.readFileSync(userPrefPath, "utf8"));
        logger.debug(`读取用户偏好文件: ${JSON.stringify(data.users[uid])}`);

        if (data.users && data.users[uid] && data.users[uid].location) {
          const location = data.users[uid].location;
          userPref = {
            code: location.code,
            name: location.name || `${location.city}${location.district}`,
          };
          logger.debug(`成功从文件获取用户地区: ${JSON.stringify(userPref)}`);
        }
      } catch (error) {
        logger.error(`直接获取用户地区时出错:`, error);
      }

      // 如果直接获取失败，尝试使用返回值
      if (!userPref && userPrefResult) {
        if (typeof userPrefResult === "object") {
          // 如果是对象，尝试提取code和name
          userPref = {
            code: userPrefResult.code,
            name: userPrefResult.name,
          };
        }
      }

      // 依然没有获取到，使用默认值
      if (!userPref) {
        logger.warn(`无法获取用户地区信息，使用默认值`);
        userPref = {
          code: "101190104", // 南京江宁
          name: "南京江宁",
        };
      }

      // 提取地区代码和名称
      let locationCode = userPref.code;
      let locationName = userPref.name || "未知地区";

      logger.info(
        `最终确认用户[${uid}]的地区: ${locationName}(${locationCode})`
      );

      // 验证地区代码
      if (!locationCode || locationCode === "undefined") {
        logger.warn(`用户[${uid}]的地区代码[${locationCode}]无效，使用默认值`);
        // 不再跳过该用户，而是使用默认地区代码
        locationCode = "101190104"; // 南京江宁
        locationName = "南京江宁";
      }

      // 获取该地区的天气数据
      const weatherData = await weatherService.getWeatherByLocation(
        locationCode,
        locationName
      );

      // 获取明天的天气数据
      const tomorrowWeather = weatherService.getTomorrowWeather(weatherData);

      // 生成推送摘要，包含地区、日期和主要天气情况
      const pushSummary = `${locationName}天气预报 ${tomorrowWeather.fxDate} ${tomorrowWeather.textDay}`;

      logger.info(`开始获取${locationName}明日穿衣建议...`);

      // 使用DeepSeek获取穿衣建议
      let clothingSuggestion = null;
      try {
        clothingSuggestion =
          await deepseekService.getClothingSuggestion(tomorrowWeather);
        logger.info(`${locationName}穿衣建议获取成功`);
      } catch (suggestionError) {
        logger.error(`获取${locationName}穿衣建议失败:`, suggestionError);
        // 失败也继续，只是没有穿衣建议
      }

      // 格式化天气数据，包含明天的天气和穿衣建议
      const formattedWeather = await weatherService.formatWeatherData(
        weatherData,
        clothingSuggestion
      );

      logger.info(`准备推送${locationName}明日天气数据给用户[${uid}]...`);

      // 推送消息给用户
      await pushService.pushMessageToUsers(
        formattedWeather,
        [uid],
        true,
        pushSummary
      );

      logger.info(`已向用户[${uid}]推送${locationName}明日天气数据!`);
    } catch (error) {
      logger.error(`获取或推送用户[${uid}]天气时出错:`, error);
      // 继续处理下一个用户，不中断整体流程
    }
  }

  logger.info("所有用户天气数据推送完成!");
}, true);

/**
 * 处理用户的地区设置请求
 * @param {String} uid 用户ID
 * @param {String} message 用户发送的消息
 * @returns {Boolean} 是否成功处理
 */
const handleLocationSetupRequest = withErrorHandling(async function (
  uid,
  message
) {
  logger.info(
    `handleLocationSetupRequest开始处理 - 用户ID[${uid}], 消息内容[${message}]`
  );

  // 检查消息是否为设置地区指令
  const setupMatch = message.match(/^设置地区[：:]?\s*(.+)$/);
  if (!setupMatch) {
    logger.info('消息格式不匹配"设置地区"指令');
    return false;
  }

  const locationName = setupMatch[1].trim();
  logger.info(`提取的地区名称: "${locationName}"`);

  // 获取所有支持的地区
  const locations = userPreferenceService.getAllLocations();
  logger.debug("获取到所有支持的地区列表");

  // 检查用户输入的地区是否有效
  let matchedLocation = null;
  for (const key in locations) {
    if (key === locationName || locations[key].name === locationName) {
      matchedLocation = key;
      logger.info(`找到匹配的地区: ${key} (${locations[key].name})`);
      break;
    }
  }

  // 如果找到匹配的地区，更新用户偏好
  if (matchedLocation) {
    logger.info(`尝试更新用户[${uid}]的地区为: ${matchedLocation}`);
    const updateResult = userPreferenceService.setUserLocationPreference(
      uid,
      matchedLocation
    );

    const success = !updateResult.error; // 检查是否有错误
    logger.info(`更新用户地区结果: ${success ? "成功" : "失败"}`);

    // 向用户发送设置结果
    const resultMessage = success
      ? `您的地区已设置为: ${locations[matchedLocation].name}`
      : "设置地区失败，请稍后重试";

    logger.info(`发送设置结果给用户: "${resultMessage}"`);
    await pushService.pushMessageToUsers(
      resultMessage,
      [uid],
      false,
      "地区设置结果"
    );
    logger.info("设置结果已发送");
    return true;
  } else {
    // 地区无效，返回支持的地区列表
    logger.info("未找到匹配的地区，准备发送地区列表");
    let locationListMsg = "您指定的地区无效，目前支持以下地区：\n";
    for (const key in locations) {
      locationListMsg += `- ${key} (${locations[key].name})\n`;
    }
    locationListMsg +=
      '\n请使用"设置地区 地区名"的格式重新设置，例如：设置地区 玄武';

    logger.info("发送地区列表帮助给用户");
    await pushService.pushMessageToUsers(
      locationListMsg,
      [uid],
      false,
      "地区设置帮助"
    );
    logger.info("地区列表帮助已发送");
    return true;
  }
}, true);

/**
 * 立即运行一次天气推送（用于测试）
 */
function runImmediately() {
  logger.info("立即执行天气推送任务...");
  getWeatherAndPush()
    .then(() => {
      logger.info("立即执行的天气推送任务完成");
    })
    .catch((error) => {
      logger.error("立即执行的天气推送任务失败:", error);
    });
}

/**
 * 设置定时任务
 */
function scheduleTask() {
  logger.info("开始设置定时任务...");

  // 每分钟检查一次用户推送时间
  const checkJob = schedule.scheduleJob("* * * * *", async function () {
    try {
      logger.debug("检查用户推送时间...");

      // 获取所有启用的用户
      const userUids = await userService.getEnabledUserUids();

      // 如果没有用户关注应用，不执行任何推送操作
      if (userUids.length === 0) {
        logger.debug("没有用户关注应用，跳过推送检查");
        return;
      }

      // 获取当前时间
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // 需要推送的用户数组
      const usersToPush = [];

      // 默认推送时间是晚上8点(20:00)
      const defaultPushHour = 20;
      const defaultPushMinute = 0;

      // 遍历所有用户，检查是否到达他们的推送时间
      for (const uid of userUids) {
        // 获取用户推送时间偏好
        let userPushTime = null;

        try {
          // 读取用户偏好文件获取推送时间
          const fs = require("fs");
          const path = require("path");
          const userPrefPath = path.join(
            __dirname,
            "data",
            "userPreferences.json"
          );

          if (fs.existsSync(userPrefPath)) {
            const data = JSON.parse(fs.readFileSync(userPrefPath, "utf8"));

            // 如果用户设置了推送时间，则使用
            if (data.users && data.users[uid] && data.users[uid].pushTime) {
              userPushTime = data.users[uid].pushTime;
              logger.debug(`用户[${uid}]设置的推送时间是: ${userPushTime}`);
            } else {
              // 用户没有设置推送时间，使用默认时间
              userPushTime = `${defaultPushHour}:${defaultPushMinute.toString().padStart(2, "0")}`;
              logger.debug(
                `用户[${uid}]未设置推送时间，使用默认值: ${userPushTime}`
              );

              // 确保用户在preferences文件中有记录
              if (data.users) {
                if (!data.users[uid]) {
                  // 创建新用户记录
                  data.users[uid] = {
                    pushTime: userPushTime,
                    location: {
                      city: "南京",
                      district: "江宁",
                      code: "101190104",
                      name: "南京江宁",
                    },
                  };
                  fs.writeFileSync(
                    userPrefPath,
                    JSON.stringify(data, null, 2),
                    "utf8"
                  );
                  logger.info(`为用户[${uid}]创建了默认配置记录`);
                } else if (!data.users[uid].pushTime) {
                  // 用户存在但没有推送时间设置
                  data.users[uid].pushTime = userPushTime;
                  fs.writeFileSync(
                    userPrefPath,
                    JSON.stringify(data, null, 2),
                    "utf8"
                  );
                  logger.info(
                    `为用户[${uid}]设置了默认推送时间: ${userPushTime}`
                  );
                } else if (!data.users[uid].location) {
                  // 用户存在但没有地区设置
                  data.users[uid].location = {
                    city: "南京",
                    district: "江宁",
                    code: "101190104",
                    name: "南京江宁",
                  };
                  fs.writeFileSync(
                    userPrefPath,
                    JSON.stringify(data, null, 2),
                    "utf8"
                  );
                  logger.info(`为用户[${uid}]设置了默认地区: 南京江宁`);
                }
              }
            }
          } else {
            logger.warn(`用户偏好文件不存在: ${userPrefPath}，创建默认文件`);
            // 创建默认的用户偏好文件
            const defaultData = {
              users: {
                [uid]: {
                  pushTime: `${defaultPushHour}:${defaultPushMinute.toString().padStart(2, "0")}`,
                  location: {
                    city: "南京",
                    district: "江宁",
                    code: "101190104",
                    name: "南京江宁",
                  },
                },
              },
            };
            // 确保目录存在
            const dirPath = path.dirname(userPrefPath);
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }
            fs.writeFileSync(
              userPrefPath,
              JSON.stringify(defaultData, null, 2),
              "utf8"
            );
            logger.info(`创建了默认用户偏好文件，并为用户[${uid}]设置了默认值`);
            userPushTime = `${defaultPushHour}:${defaultPushMinute.toString().padStart(2, "0")}`;
          }
        } catch (error) {
          logger.error(`获取用户[${uid}]推送时间时出错:`, error);
          userPushTime = `${defaultPushHour}:${defaultPushMinute.toString().padStart(2, "0")}`;
        }

        if (!userPushTime || typeof userPushTime !== "string") {
          logger.debug(`用户[${uid}]的推送时间无效，使用默认值`);
          userPushTime = `${defaultPushHour}:${defaultPushMinute.toString().padStart(2, "0")}`;
        }

        // 解析推送时间
        const [hour, minute] = userPushTime.split(":").map(Number);

        // 检查是否到达推送时间
        if (hour === currentHour && minute === currentMinute) {
          logger.info(
            `用户[${uid}]到达推送时间${userPushTime}，添加到推送列表`
          );
          usersToPush.push(uid);
        }
      }

      // 如果有用户需要推送，开始推送天气
      if (usersToPush.length > 0) {
        logger.info(`共有${usersToPush.length}个用户需要推送天气`);
        await getWeatherAndPush(usersToPush);
      }
    } catch (error) {
      logger.error("检查用户推送时间时出错:", error);
    }
  });

  if (checkJob) {
    logger.info("定时任务设置成功");
  } else {
    logger.error("定时任务设置失败");
  }

  return checkJob;
}

/**
 * 处理用户消息
 * @param {String} uid 用户ID
 * @param {String} message 用户消息
 * @returns {Promise<Boolean>} 是否成功处理
 */
const handleUserMessage = withErrorHandling(async function (uid, message) {
  logger.info(`处理用户消息 - 用户ID[${uid}], 消息内容[${message}]`);

  try {
    // 去除消息两端的空白字符
    message = message.trim();

    // 先尝试使用messageHandler处理
    const response = messageHandler.handleMessage(message, uid);
    if (response) {
      // 根据消息内容确定合适的标题
      let title = "消息回复";

      // 设置更具体的标题
      if (message === "帮助") {
        title = "使用帮助";
      } else if (message.startsWith("查看城市详情")) {
        title = "城市区县列表";
      } else if (message.startsWith("查看城市")) {
        title = "省份城市列表";
      } else if (message === "地区列表") {
        title = "热门城市列表";
      } else if (message.startsWith("设置地区")) {
        title = "地区设置结果";
      } else if (message === "当前地区") {
        title = "当前地区信息";
      } else if (message === "查看推送时间") {
        title = "推送时间信息";
      } else if (message.startsWith("设置推送时间")) {
        title = "推送时间设置结果";
      }

      // 判断返回值类型，正确处理消息内容和HTML标志
      const messageContent = response.content || response;
      const isHtml = response.isHtml || false;

      // 发送响应给用户
      logger.info(
        `发送响应给用户[${uid}]: 标题[${title}], HTML格式[${isHtml}]`
      );
      await pushService.pushMessageToUsers(
        messageContent,
        [uid],
        isHtml,
        title
      );
      logger.info(`响应已发送给用户[${uid}]`);
      return true;
    } else {
      logger.info(`消息[${message}]未被messageHandler处理，尝试旧的处理方式`);

      // 如果是设置地区指令，调用旧的处理方法
      if (message.startsWith("设置地区")) {
        return await handleLocationSetupRequest(uid, message);
      }

      // 如果是推送测试指令，即时推送天气
      if (message === "推送测试") {
        logger.info(`收到推送测试请求，立即为用户[${uid}]推送天气`);
        await getWeatherAndPush([uid]); // 只推送给请求的用户
        return true;
      }

      // 处理常见问候语
      if (
        [
          "你好",
          "Hello",
          "hi",
          "嗨",
          "您好",
          "早上好",
          "下午好",
          "晚上好",
        ].includes(message.toLowerCase())
      ) {
        const greeting = `您好！我是天气助手，可以为您提供实时天气信息和穿衣建议。
发送"帮助"查看我能做什么。`;
        await pushService.pushMessageToUsers(
          greeting,
          [uid],
          false,
          "天气助手问候"
        );
        return true;
      }

      // 处理天气查询请求
      if (
        message.includes("天气") ||
        message.includes("气温") ||
        message === "查询"
      ) {
        logger.info(`收到天气查询请求，立即为用户[${uid}]推送天气`);
        await getWeatherAndPush([uid]);
        return true;
      }

      // 处理帮助请求
      if (
        message === "?" ||
        message === "？" ||
        message.includes("怎么用") ||
        message.includes("如何使用")
      ) {
        const helpText = '发送"帮助"即可获取使用说明。';
        await pushService.pushMessageToUsers(
          helpText,
          [uid],
          false,
          "使用帮助提示"
        );
        return true;
      }

      logger.info(`无法处理消息: ${message}`);
      return false;
    }
  } catch (error) {
    logger.error("处理用户消息出错:", error);
    return false;
  }
}, true);

/**
 * 启动API服务器
 */
function startApiServer() {
  const app = express();

  // 解析请求体
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  // 静态文件服务
  app.use(express.static(path.join(__dirname, "public")));

  // 健康检查端点
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: require("./package.json").version,
    });
  });

  // 微信推送回调接口
  app.post("/api/wx-callback", async (req, res) => {
    try {
      logger.debug(`收到回调请求: ${JSON.stringify(req.body)}`);

      // 获取回调数据 - WxPusher回调数据结构为 {action: "send_up_cmd", data: {uid, content, ...}}
      const requestData = req.body;

      // 检查请求格式
      if (!requestData || !requestData.data) {
        logger.warn(`接收到格式不正确的回调请求: ${JSON.stringify(req.body)}`);
        return res.status(400).json({
          success: false,
          message: "请求格式不正确",
        });
      }

      const { uid, content } = requestData.data;

      if (!uid || !content) {
        logger.warn(
          `接收到不完整的回调请求数据: ${JSON.stringify(requestData.data)}`
        );
        return res.status(400).json({
          success: false,
          message: "缺少必要参数",
        });
      }

      logger.info(`收到用户[${uid}]的消息: ${content}`);

      // 处理用户消息
      const handled = await handleUserMessage(uid, content);

      if (handled) {
        logger.info(`用户[${uid}]的消息已成功处理`);
      } else {
        logger.warn(`用户[${uid}]的消息未能处理: ${content}`);

        // 发送默认回复
        await pushService.pushMessageToUsers(
          '抱歉，我不理解您的消息。发送"帮助"获取使用说明。',
          [uid],
          false,
          "无法识别的指令"
        );
      }

      return res.json({ success: true });
    } catch (error) {
      logger.error("处理微信回调时出错:", error);
      return res.status(500).json({
        success: false,
        message: "处理消息失败",
      });
    }
  });

  // 全局错误处理中间件
  app.use((err, req, res, _next) => {
    logger.error("API请求处理出错:", err);
    res.status(500).json({
      success: false,
      message: "服务器内部错误",
    });
  });

  // 处理404错误
  app.use((req, res) => {
    logger.warn(`404未找到: ${req.method} ${req.url}`);
    res.status(404).json({
      success: false,
      message: "请求的资源不存在",
    });
  });

  // 启动服务器
  return app.listen(config.server.port, () => {
    logger.info(`API服务器已启动，监听端口: ${config.server.port}`);
  });
}

/**
 * 主函数，应用程序入口点
 */
function main() {
  try {
    logger.info("WeatherBuddy 服务启动中...");

    // 设置未捕获异常的全局处理器，防止程序崩溃
    process.on("uncaughtException", (error) => {
      logger.error("未捕获的异常:", error);
      logger.error("错误堆栈:", error.stack);
      // 不退出进程，但记录错误
    });

    process.on("unhandledRejection", (reason, _promise) => {
      logger.error("未处理的Promise拒绝:", reason);
      // 不退出进程，但记录错误
    });

    // 启动 API 服务器
    startApiServer();

    // 判断是否为测试模式
    const isTestMode = process.argv.includes("--test");
    if (isTestMode) {
      logger.info("以测试模式运行，立即执行一次天气获取和推送");
      runImmediately();
    } else {
      // 非测试模式，执行定时任务
      scheduleTask();
      logger.info("定时任务已设置");
    }
  } catch (error) {
    logger.error("程序启动失败:", error);
    logger.error("错误堆栈:", error.stack);
    process.exit(1); // 只有在主程序初始化失败时才退出
  }
}

// 执行主函数
main();

// 导出函数，便于测试或外部调用
module.exports = {
  getWeatherAndPush,
  runImmediately,
  scheduleTask,
  handleLocationSetupRequest,
  handleUserMessage,
  startApiServer,
};
