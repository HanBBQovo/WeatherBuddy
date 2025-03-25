/**
 * 请求日志中间件
 * 用于记录所有传入的HTTP请求
 */
const logger = require("../services/logger");

/**
 * 生成请求日志中间件
 * @returns {Function} Express中间件函数
 */
function requestLogger() {
  return (req, res, next) => {
    const startTime = Date.now();

    // 获取请求信息
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip =
      req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"] || "-";

    // 记录请求开始
    logger.info(`请求开始: ${method} ${url}`, {
      method,
      url,
      ip,
      userAgent,
    });

    // 记录请求体（如果存在且不是文件上传）
    if (
      req.body &&
      Object.keys(req.body).length > 0 &&
      !req.is("multipart/form-data")
    ) {
      logger.debug("请求体:", req.body);
    }

    // 在响应完成时记录
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      const status = res.statusCode;

      // 根据状态码选择日志级别
      if (status >= 500) {
        logger.error(`请求完成: ${method} ${url} ${status} ${duration}ms`);
      } else if (status >= 400) {
        logger.warn(`请求完成: ${method} ${url} ${status} ${duration}ms`);
      } else {
        logger.info(`请求完成: ${method} ${url} ${status} ${duration}ms`);
      }
    });

    next();
  };
}

module.exports = requestLogger;
