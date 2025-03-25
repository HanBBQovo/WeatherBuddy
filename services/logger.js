/**
 * 统一日志模块，支持不同级别的日志记录和格式化
 */

/**
 * 获取当前时间戳字符串
 * @returns {String} 格式化的时间戳
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * 格式化日志内容
 * @param {String} level 日志级别
 * @param {String} message 日志消息
 * @param {Object} data 附加数据
 * @returns {String} 格式化后的日志
 */
function formatLog(level, message, data = null) {
  const timestamp = getTimestamp();
  let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  if (data) {
    if (typeof data === "object") {
      try {
        // 限制对象嵌套层级的输出，避免过大
        const dataStr = JSON.stringify(data, null, 2);
        logMessage += `\nData: ${dataStr}`;
      } catch (error) {
        logMessage += "\nData: [无法序列化的对象]";
      }
    } else {
      logMessage += `\nData: ${data}`;
    }
  }

  return logMessage;
}

/**
 * 记录信息级别日志
 * @param {String} message 日志消息
 * @param {Object} data 附加数据
 */
function info(message, data = null) {
  console.log(formatLog("info", message, data));
}

/**
 * 记录调试级别日志
 * @param {String} message 日志消息
 * @param {Object} data 附加数据
 */
function debug(message, data = null) {
  console.debug(formatLog("debug", message, data));
}

/**
 * 记录警告级别日志
 * @param {String} message 日志消息
 * @param {Object} data 附加数据
 */
function warn(message, data = null) {
  console.warn(formatLog("warn", message, data));
}

/**
 * 记录错误级别日志
 * @param {String} message 日志消息
 * @param {Object} error 错误对象
 */
function error(message, error = null) {
  if (error instanceof Error) {
    console.error(
      formatLog("error", message, {
        message: error.message,
        stack: error.stack,
      })
    );
  } else {
    console.error(formatLog("error", message, error));
  }
}

module.exports = {
  info,
  debug,
  warn,
  error,
};
