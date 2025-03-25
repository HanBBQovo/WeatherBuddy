/**
 * 统一API响应格式化模块
 * 用于生成一致的响应结构
 */

/**
 * 生成成功响应
 * @param {Object} data 响应数据
 * @param {String} message 成功消息
 * @returns {Object} 格式化的成功响应
 */
function success(data = null, message = "操作成功") {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * 生成错误响应
 * @param {String} message 错误消息
 * @param {String} code 错误代码
 * @param {Object} details 错误详情
 * @returns {Object} 格式化的错误响应
 */
function error(message = "操作失败", code = "ERROR", details = null) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * 生成格式化的命令响应
 * @param {String} title 响应标题
 * @param {String} content 响应内容
 * @param {String} icon 响应图标
 * @param {String} type 响应类型 (success, error, warning, info)
 * @returns {String} 格式化的HTML响应
 */
function formatCommandResponse(title, content, icon = "ℹ️", type = "info") {
  const typeClass = `response-${type}`;
  const iconHtml = icon ? `<span class="response-icon">${icon}</span>` : "";

  return `<div class="response-container ${typeClass}">
  <div class="response-header">
    ${iconHtml}
    <span class="response-title">${title}</span>
  </div>
  <div class="response-content">
    ${content}
  </div>
</div>`;
}

module.exports = {
  success,
  error,
  formatCommandResponse,
};
