const fs = require("fs");
const path = require("path");
// 引入logger
let logger;
try {
  logger = require("../services/logger");
} catch (error) {
  logger = {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
}

// 地区配置文件路径
const LOCATIONS_FILE = path.join(__dirname, "../data/locations.json");

/**
 * 确保地区配置文件存在
 * @returns {Boolean} 文件是否存在
 */
function ensureLocationsFileExists() {
  const dirPath = path.dirname(LOCATIONS_FILE);

  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    logger.info(`创建目录: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 检查文件是否存在
  if (!fs.existsSync(LOCATIONS_FILE)) {
    logger.error(`地区配置文件不存在: ${LOCATIONS_FILE}`);
    return false;
  }

  return true;
}

/**
 * 获取所有地区配置
 * @returns {Object} 地区配置对象
 */
function getAllLocations() {
  if (!ensureLocationsFileExists()) {
    logger.error("地区配置文件不存在，请先创建地区配置文件");
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(LOCATIONS_FILE, "utf8"));
  } catch (error) {
    logger.error("读取地区配置文件失败:", error);
    return {};
  }
}

/**
 * 获取指定城市的地区列表
 * @param {String} city 城市名称
 * @returns {Object} 该城市的地区列表
 */
function getCityLocations(city) {
  const locations = getAllLocations();
  return locations[city] || {};
}

/**
 * 获取所有支持的城市列表
 * @returns {Array<String>} 城市名称列表
 */
function getAllCities() {
  return Object.keys(getAllLocations());
}

/**
 * 检查地区是否存在
 * @param {String} city 城市名称
 * @param {String} district 区县名称，如果只提供一个参数，则该参数被视为locationCode
 * @returns {Boolean} 是否存在
 */
function isLocationValid(city, district) {
  // 如果只提供了一个参数，则视为locationCode
  if (arguments.length === 1) {
    const locationCode = city;
    const locations = getAllLocations();

    // 遍历所有城市和地区
    for (const cityName in locations) {
      for (const districtName in locations[cityName]) {
        if (locations[cityName][districtName].code === locationCode) {
          return true;
        }
      }
    }
    return false;
  }

  // 如果提供了两个参数，检查城市和地区是否存在
  const locations = getAllLocations();
  return locations[city] && locations[city][district];
}

/**
 * 获取地区代码
 * @param {String} city 城市名称
 * @param {String} district 区县名称
 * @returns {String} 地区代码
 */
function getLocationCode(city, district) {
  const locations = getAllLocations();
  return locations[city]?.[district]?.code;
}

/**
 * 获取地区完整名称
 * @param {String} city 城市名称
 * @param {String} district 区县名称
 * @returns {String} 地区完整名称
 */
function getLocationName(city, district) {
  const locations = getAllLocations();
  return locations[city]?.[district]?.name;
}

/**
 * 根据locationCode获取地区信息
 * @param {String} locationCode 地区代码
 * @returns {Object|null} 地区信息，包含city、district、code和name
 */
function getLocationInfo(locationCode) {
  const locations = getAllLocations();

  // 遍历所有城市和地区
  for (const cityName in locations) {
    for (const districtName in locations[cityName]) {
      if (locations[cityName][districtName].code === locationCode) {
        return {
          city: cityName,
          district: districtName,
          code: locationCode,
          name: locations[cityName][districtName].name,
        };
      }
    }
  }

  return null;
}

module.exports = {
  getAllLocations,
  getCityLocations,
  getAllCities,
  isLocationValid,
  getLocationCode,
  getLocationName,
  getLocationInfo,
};
