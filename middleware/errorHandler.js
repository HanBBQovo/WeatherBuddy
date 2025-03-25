/**
 * 错误处理中间件
 * 用于统一处理Express应用中的错误
 */
const logger = require("../services/logger");
const { AppError } = require("../services/errorHandler");
const { error: formatError } = require("../services/responseFormatter");

/**
 * 404错误处理中间件
 * 当没有路由匹配时捕获请求并返回404
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function notFoundHandler(req, res, next) {
  const err = new AppError(`路径不存在: ${req.originalUrl}`, "NOT_FOUND", 404);
  next(err);
}

/**
 * 全局错误处理中间件
 * 捕获所有传递给next的错误，返回格式化的错误响应
 * @param {Error} err 错误对象
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function globalErrorHandler(err, req, res, _next) {
  // 获取错误信息
  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || "INTERNAL_SERVER_ERROR";
  const message = err.message || "服务器内部错误";

  // 记录错误日志
  if (statusCode >= 500) {
    logger.error(`服务器错误: ${message}`, err);
  } else {
    logger.warn(`请求错误: ${message}`, {
      code: errorCode,
      status: statusCode,
      path: req.path,
    });
  }

  // 生成错误响应
  const errorResponse = formatError(message, errorCode, err.validationErrors);

  // 在开发环境中添加错误堆栈
  if (process.env.NODE_ENV === "development") {
    errorResponse.stack = err.stack;
  }

  // 发送响应
  res.status(statusCode).json(errorResponse);
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
