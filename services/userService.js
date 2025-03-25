const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// 用户数据文件路径
const usersFilePath = path.join(__dirname, "../data/users.json");

/**
 * 从WxPusher获取所有关注了应用的用户UID列表
 * @returns {Promise<Array<String>>} 用户UID列表
 */
async function getEnabledUserUids() {
  try {
    // WxPusher查询用户列表v2接口
    const apiUrl = "https://wxpusher.zjiecode.com/api/fun/wxuser/v2";

    const response = await axios.get(apiUrl, {
      params: {
        appToken: process.env.WXPUSHER_APP_TOKEN,
        page: 1,
        pageSize: 100, // 设置一个合理的数量，根据实际情况调整
      },
    });

    if (response.data && response.data.code === 1000) {
      const users = response.data.data.records || [];
      // 提取所有用户的UID
      const uids = users.map((user) => user.uid);

      if (uids.length === 0) {
        console.log("未找到已关注的用户");
      } else {
        console.log(`找到 ${uids.length} 个已关注的用户`);
      }

      return uids;
    } else {
      console.error("获取WxPusher用户列表失败:", response.data.msg);
      return [];
    }
  } catch (error) {
    console.error("获取WxPusher用户列表异常:", error.message);
    return [];
  }
}

/**
 * 添加新用户
 * @param {Object} user 用户对象，包含uid、name等属性
 * @returns {Boolean} 是否添加成功
 */
function addUser(user) {
  try {
    // 确保用户对象有必要的属性
    if (!user.uid || !user.name) {
      throw new Error("用户数据无效，需要uid和name字段");
    }

    // 添加enabled字段，默认为true
    const newUser = {
      ...user,
      enabled: user.enabled !== undefined ? user.enabled : true,
    };

    // 读取现有用户数据
    let usersData = { users: [] };
    if (fs.existsSync(usersFilePath)) {
      usersData = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    }

    // 检查用户是否已存在
    const existingUserIndex = usersData.users.findIndex(
      (u) => u.uid === user.uid
    );
    if (existingUserIndex >= 0) {
      usersData.users[existingUserIndex] = newUser;
    } else {
      usersData.users.push(newUser);
    }

    // 保存更新后的用户数据
    fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2));
    return true;
  } catch (error) {
    console.error("添加用户失败:", error.message);
    return false;
  }
}

module.exports = {
  getEnabledUserUids,
  addUser,
};
