const fs = require("fs");
const path = require("path");
const locations = require("../config/locations");
const config = require("../config/config");
const logger = require("./logger");
const { ValidationError, withErrorHandling } = require("./errorHandler");

// 用户偏好文件路径
const USER_PREF_FILE = config.paths.userPreferencesFile;

/**
 * 确保用户偏好文件存在
 */
function ensurePreferenceFileExists() {
  const dirPath = path.dirname(USER_PREF_FILE);

  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    logger.info(`创建目录: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 如果文件不存在，创建一个空的用户偏好文件
  if (!fs.existsSync(USER_PREF_FILE)) {
    logger.info(`创建用户偏好文件: ${USER_PREF_FILE}`);
    fs.writeFileSync(USER_PREF_FILE, JSON.stringify({ users: {} }, null, 2));
  } else {
    logger.debug(`用户偏好文件已存在: ${USER_PREF_FILE}`);
  }
}

/**
 * 获取用户的地区偏好
 * @param {String} uid 用户ID
 * @returns {Object} 地区信息，包含city、district、code和name
 */
const getUserLocationPreference = withErrorHandling(function (uid) {
  logger.info(`尝试获取用户[${uid}]的地区偏好`);
  ensurePreferenceFileExists();

  // 准备默认的返回值，确保始终返回有效的地区信息
  const defaultLocation = {
    city: config.defaultLocation.defaultCity,
    district: config.defaultLocation.defaultDistrict,
    code: config.defaultLocation.code,
    name: locations.getLocationName(
      config.defaultLocation.defaultCity,
      config.defaultLocation.defaultDistrict
    ),
  };

  try {
    const data = JSON.parse(fs.readFileSync(USER_PREF_FILE, "utf8"));
    logger.debug("成功读取用户偏好文件");
    logger.debug("当前用户偏好数据:", data);

    // 如果用户有设置偏好，则返回对应地区
    if (data.users && data.users[uid] && data.users[uid].location) {
      const { city, district } = data.users[uid].location;
      logger.info(`找到用户[${uid}]的地区设置: ${city} ${district}`);

      if (locations.isLocationValid(city, district)) {
        logger.info(`返回用户设置的地区: ${city} ${district}`);
        const code = locations.getLocationCode(city, district);
        if (!code) {
          logger.warn(`无法获取[${city} ${district}]的地区代码，使用默认值`);
          return {
            city,
            district,
            code: defaultLocation.code,
            name: `${city}${district}`,
          };
        }
        logger.debug(`成功获取地区代码: ${code}`);
        return {
          city,
          district,
          code,
          name: locations.getLocationName(city, district),
        };
      }
    }

    // 检查是否用户存在但没有地区设置，如果是，则添加默认地区设置
    if (data.users && data.users[uid] && !data.users[uid].location) {
      logger.info(`用户[${uid}]存在但没有地区设置，添加默认地区设置`);
      data.users[uid].location = {
        city: defaultLocation.city,
        district: defaultLocation.district,
        code: defaultLocation.code,
        name: defaultLocation.name,
      };
      fs.writeFileSync(USER_PREF_FILE, JSON.stringify(data, null, 2), "utf8");
      logger.info(`为用户[${uid}]添加了默认地区设置: ${defaultLocation.name}`);
    }

    // 默认返回配置的默认地区
    logger.info(
      `用户[${uid}]没有地区设置或设置无效，返回默认地区: ${defaultLocation.name}`
    );
    return defaultLocation;
  } catch (error) {
    logger.error("获取用户地区偏好失败:", error);
    // 默认返回配置的默认地区
    return defaultLocation;
  }
}, true);

/**
 * 设置用户的地区偏好
 * @param {String} uid 用户ID
 * @param {String} locationCode 地区代码
 * @returns {Boolean} 是否设置成功
 */
const setUserLocationPreference = withErrorHandling(function (
  uid,
  locationCode
) {
  logger.info(`尝试设置用户[${uid}]的地区偏好为: ${locationCode}`);
  ensurePreferenceFileExists();

  // 检查地区是否有效
  if (!locations.isLocationValid(locationCode)) {
    logger.warn(`无效的地区设置: ${locationCode}`);
    throw new ValidationError(`无效的地区代码: ${locationCode}`);
  }

  try {
    // 读取当前用户偏好数据
    const data = JSON.parse(fs.readFileSync(USER_PREF_FILE, "utf8"));
    logger.debug("成功读取当前用户偏好数据");

    // 如果用户不存在，创建用户
    if (!data.users[uid]) {
      logger.info(`创建新用户: ${uid}`);
      data.users[uid] = {};
    }

    // 设置用户地区偏好
    const location = locations.getLocationInfo(locationCode);
    logger.info(`更新用户[${uid}]的地区为: ${location.name}`);
    data.users[uid].location = {
      city: location.city,
      district: location.district,
      code: locationCode,
      name: location.name,
    };

    // 保存到文件
    logger.debug("保存更新后的用户偏好到文件");
    fs.writeFileSync(USER_PREF_FILE, JSON.stringify(data, null, 2));
    logger.info("用户偏好保存成功");

    return true;
  } catch (error) {
    logger.error("设置用户地区偏好失败:", error);
    throw error;
  }
}, true);

/**
 * 更新推送时间
 * @param {String} uid 用户ID
 * @param {String} time 推送时间，格式为 HH:mm
 * @returns {Boolean} 是否设置成功
 */
const updatePushTime = withErrorHandling(function (uid, time) {
  logger.info(`尝试更新用户[${uid}]的推送时间为: ${time}`);
  ensurePreferenceFileExists();

  // 验证推送时间格式
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  // 如果是单数字小时格式(如 9:30)，转换为双数字格式(09:30)
  let formattedTime = time;
  const singleDigitMatch = time.match(/^(\d):([0-5]\d)$/);
  if (singleDigitMatch) {
    formattedTime = `0${singleDigitMatch[1]}:${singleDigitMatch[2]}`;
    logger.info(`将单数字小时格式转换为标准格式: ${time} -> ${formattedTime}`);
  }

  // 重新验证标准格式
  if (!timePattern.test(formattedTime)) {
    logger.warn(`无效的推送时间格式: ${time} (${formattedTime})`);
    throw new ValidationError(`无效的推送时间格式: ${time}`);
  }

  try {
    // 读取当前用户偏好数据
    const data = JSON.parse(fs.readFileSync(USER_PREF_FILE, "utf8"));
    logger.debug("成功读取当前用户偏好数据");

    // 如果用户不存在，创建用户
    if (!data.users[uid]) {
      logger.info(`创建新用户: ${uid}`);
      data.users[uid] = {};
    }

    // 更新用户推送时间（使用格式化后的时间）
    logger.info(`更新用户[${uid}]的推送时间为: ${formattedTime}`);
    data.users[uid].pushTime = formattedTime;

    // 保存到文件
    logger.debug("保存更新后的用户偏好到文件");
    fs.writeFileSync(USER_PREF_FILE, JSON.stringify(data, null, 2));
    logger.info("用户偏好保存成功");

    return true;
  } catch (error) {
    logger.error("更新推送时间失败:", error);
    throw error;
  }
}, true);

/**
 * 获取推送时间
 * @param {String} uid 用户ID
 * @returns {String} 推送时间，格式为 HH:mm
 */
const getPushTime = withErrorHandling(function (uid) {
  logger.info(`尝试获取用户[${uid}]的推送时间`);
  ensurePreferenceFileExists();

  try {
    const data = JSON.parse(fs.readFileSync(USER_PREF_FILE, "utf8"));
    logger.debug("成功读取用户偏好文件");

    // 如果用户设置了推送时间，则返回
    if (data.users[uid] && data.users[uid].pushTime) {
      logger.info(
        `找到用户[${uid}]的推送时间设置: ${data.users[uid].pushTime}`
      );
      return data.users[uid].pushTime;
    }

    // 如果未设置，返回默认时间 20:00
    logger.info(`用户[${uid}]未设置推送时间，使用默认时间: 20:00`);
    return "20:00";
  } catch (error) {
    logger.error("获取推送时间失败:", error);
    // 发生错误时返回默认时间
    return "20:00";
  }
}, true);

/**
 * 获取所有支持的城市列表
 * @returns {Array<String>} 城市名称列表
 */
function getAllCities() {
  return locations.getAllCities();
}

/**
 * 获取指定城市的地区列表
 * @param {String} city 城市名称
 * @returns {Object} 该城市的地区列表
 */
function getCityLocations(city) {
  return locations.getCityLocations(city);
}

/**
 * 按地区对用户进行分组
 * @param {Array<String>} uids 用户ID列表
 * @returns {Object} 按地区分组的用户列表，key为地区代码，value为用户ID数组
 */
function groupUsersByLocation(uids) {
  const groups = {};

  uids.forEach((uid) => {
    const pref = getUserLocationPreference(uid);

    // 检查是否有错误 (由于使用了withErrorHandling，错误会以对象形式返回)
    if (pref.error) {
      logger.error(`获取用户[${uid}]的地区偏好时出错:`, pref.error);
      return;
    }

    const locationCode = pref.code;
    const locationName = pref.name || "未知地区";

    if (!groups[locationCode]) {
      groups[locationCode] = {
        users: [],
        name: locationName,
        city: pref.city,
        district: pref.district,
      };
    }

    groups[locationCode].users.push(uid);
  });

  return groups;
}

module.exports = {
  getUserLocationPreference,
  setUserLocationPreference,
  updatePushTime,
  getPushTime,
  getAllCities,
  getCityLocations,
  groupUsersByLocation,
};
