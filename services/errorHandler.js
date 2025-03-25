/**
 * 统一错误处理模块
 * 定义通用错误类型和处理方法
 */
const logger = require("./logger");

/**
 * 自定义应用程序错误类
 */
class AppError extends Error {
  /**
   * 创建应用程序错误
   * @param {String} message 错误信息
   * @param {String} code 错误代码
   * @param {Number} status HTTP状态码
   */
  constructor(message, code = "UNKNOWN_ERROR", status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * API调用错误
 */
class ApiError extends AppError {
  /**
   * 创建API调用错误
   * @param {String} message 错误信息
   * @param {String} service 服务名称
   * @param {Object} originalError 原始错误对象
   */
  constructor(message, service, originalError = null) {
    super(message, "API_ERROR", 500);
    this.service = service;
    this.originalError = originalError;
  }
}

/**
 * 验证错误
 */
class ValidationError extends AppError {
  /**
   * 创建验证错误
   * @param {String} message 错误信息
   * @param {Object} validationErrors 验证错误详情
   */
  constructor(message, validationErrors = {}) {
    super(message, "VALIDATION_ERROR", 400);
    this.validationErrors = validationErrors;
  }
}

/**
 * 处理错误并生成统一的错误响应
 * @param {Error} error 错误对象
 * @param {Boolean} isApiResponse 是否用于API响应
 * @returns {Object} 格式化的错误对象
 */
function handleError(error, isApiResponse = false) {
  // 记录错误
  if (error instanceof AppError) {
    logger.error(`${error.name}: ${error.message}`, error);
  } else {
    logger.error("未处理的错误", error);
  }

  // 如果是API响应，返回格式化的错误对象
  if (isApiResponse) {
    return {
      success: false,
      error: {
        code: error instanceof AppError ? error.code : "UNKNOWN_ERROR",
        message: error.message || "发生未知错误",
      },
    };
  }

  // 如果不是API响应，直接返回错误对象
  return error;
}

/**
 * 对错误处理进行包装的装饰器工厂函数
 * @param {Function} fn 要包装的函数
 * @param {Boolean} returnError 是否返回错误对象而不是抛出
 * @returns {Function} 包装后的函数
 */
function withErrorHandling(fn, returnError = false) {
  return async function (...args) {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`执行${fn.name || "匿名函数"}时出错`, error);

      if (returnError) {
        return { error: handleError(error) };
      }

      throw error;
    }
  };
}

module.exports = {
  AppError,
  ApiError,
  ValidationError,
  handleError,
  withErrorHandling,
};
