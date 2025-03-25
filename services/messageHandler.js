const {
  updatePushTime,
  setUserLocationPreference,
  getUserLocationPreference,
} = require("./userPreferenceService");
const {
  getAllCities,
  getCityLocations,
  isLocationValid,
  getLocationCode,
} = require("../config/locations");
const { formatCommandResponse } = require("./weatherService");

/**
 * 处理设置地区的命令
 * @param {String} message 用户消息
 * @param {String} uid 用户ID
 * @returns {String} 响应消息
 */
function handleSetLocation(message, uid) {
  // 匹配"设置地区：城市 区县"格式，更宽松的匹配
  const match = message.match(/^设置地区[：:]\s*(.+?)\s+(.+)$/);
  if (!match) {
    const content = `格式错误！

请使用以下格式设置地区：
\`设置地区：城市 区县\`

例如：\`设置地区：北京 朝阳\``;

    return formatCommandResponse("格式错误", content, "⚠️", "warning");
  }

  let [, city, district] = match;
  console.log(`解析到的城市: ${city}, 区县: ${district}`);

  // 处理可能的"市"和"区"后缀
  city = city.replace(/市$/, "");
  district = district.replace(/区$/, "").replace(/县$/, "");

  // 检查地区是否有效
  if (!isLocationValid(city, district)) {
    // 获取城市列表，最多显示10个建议
    const suggestedCities = getAllCities().slice(0, 10);

    const content = `未找到 **${city}${district}**

请检查城市和区县名称是否正确。

**热门城市**：
${suggestedCities.join("、")}

更多城市请使用\`地区列表\`命令查看`;

    return formatCommandResponse("地区未找到", content, "🔍", "warning");
  }

  try {
    // 获取位置代码
    const locationCode = getLocationCode(city, district);
    console.log(`获取到的位置代码: ${locationCode}`);

    // 使用位置代码更新用户偏好
    const success = setUserLocationPreference(uid, locationCode);

    if (success) {
      const content = `您的地区已成功设置为 **${city}${district}**

系统将根据此地区为您提供天气预报服务。`;

      return formatCommandResponse("地区设置成功", content, "✅", "success");
    } else {
      const content = `设置地区失败，请稍后重试。

如果问题持续存在，请联系管理员。`;

      return formatCommandResponse("设置失败", content, "❌", "error");
    }
  } catch (error) {
    console.error("设置地区失败:", error);

    const content = `设置地区失败：${error.message}

请稍后重试，或检查地区名称是否正确。`;

    return formatCommandResponse("设置失败", content, "❌", "error");
  }
}

/**
 * 处理查看地区列表的命令
 * @returns {String} 响应消息
 */
function handleListLocations() {
  const cities = getAllCities();
  const topCities = [
    "北京",
    "上海",
    "广州",
    "深圳",
    "南京",
    "杭州",
    "重庆",
    "成都",
    "武汉",
    "西安",
    "苏州",
    "天津",
    "长沙",
    "郑州",
    "青岛",
  ].filter((city) => cities.includes(city));

  // 构建HTML内容，只展示热门城市
  const content = `以下是热门城市列表：

<div class="city-grid">
  ${topCities.map((city) => `<div class="city-item">${city}</div>`).join("")}
</div>

<div class="city-tips">
  <p>如需查看更多城市，请发送以下命令：</p>
  <p><code>查看城市：省份名</code>（例如：<code>查看城市：江苏</code>）</p>
  <p><code>查看城市详情：城市名</code>（例如：<code>查看城市详情：南京</code>）</p>
  <p>设置地区的格式为：<code>设置地区：城市 区县</code></p>
  <p>例如：<code>设置地区：南京 江宁</code></p>
</div>`;

  // 创建自定义样式的HTML响应
  const customStyles = `
    .city-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 15px 0;
    }
    .city-item {
      background-color: #f0f8ff;
      border: 1px solid #d0e6ff;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      font-weight: bold;
      color: #2c3e50;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    .city-item:hover {
      background-color: #e0f0ff;
    }
    .city-tips {
      background-color: #f9f9f9;
      border-radius: 8px;
      padding: 12px 15px;
      margin-top: 15px;
      font-size: 14px;
      line-height: 1.5;
    }
    .city-tips p {
      margin: 8px 0;
    }
  `;

  return formatCommandResponse(
    "热门城市列表",
    content,
    "🏙️",
    "info",
    customStyles
  );
}

/**
 * 处理查看特定城市区县的命令
 * @param {String} cityName 城市名称
 * @returns {String} 响应消息
 */
function handleCityDetail(cityName) {
  const cities = getAllCities();
  const city = cities.find((c) => c === cityName || c.includes(cityName));

  if (!city) {
    const content = `未找到城市"${cityName}"。

请检查城市名称是否正确，或使用\`地区列表\`查看所有支持的城市。`;
    return formatCommandResponse("城市未找到", content, "🔍", "warning");
  }

  const districts = Object.keys(getCityLocations(city));

  // 构建HTML内容
  const content = `${city}的区县列表：

<div class="district-grid">
  ${districts
    .map((district) => `<div class="district-item">${district}</div>`)
    .join("")}
</div>

<div class="usage-tip">
  设置此地区请使用：<code>设置地区：${city} 区县名</code>
</div>`;

  // 创建自定义样式的HTML响应
  const customStyles = `
    .district-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 15px 0;
    }
    .district-item {
      background-color: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
      color: #333;
    }
    .usage-tip {
      background-color: #f0f8ff;
      border-left: 3px solid #3498db;
      padding: 10px 15px;
      margin-top: 15px;
      font-size: 14px;
    }
  `;

  return formatCommandResponse(
    `${city}区县列表`,
    content,
    "🏙️",
    "info",
    customStyles
  );
}

/**
 * 处理查看省份城市列表的命令
 * @param {String} provinceName 省份名称
 * @returns {String} 响应消息
 */
function handleProvinceDetail(provinceName) {
  // 简单的省份匹配规则
  const provinces = {
    北京: (cities) => cities.filter((c) => c === "北京"),
    上海: (cities) => cities.filter((c) => c === "上海"),
    天津: (cities) => cities.filter((c) => c === "天津"),
    重庆: (cities) => cities.filter((c) => c === "重庆"),
    河北: (cities) =>
      cities.filter((c) =>
        [
          "石家庄",
          "唐山",
          "秦皇岛",
          "邯郸",
          "邢台",
          "保定",
          "张家口",
          "承德",
          "沧州",
          "廊坊",
          "衡水",
        ].some((city) => c.includes(city))
      ),
    山西: (cities) =>
      cities.filter((c) =>
        [
          "太原",
          "大同",
          "阳泉",
          "长治",
          "晋城",
          "朔州",
          "晋中",
          "运城",
          "忻州",
          "临汾",
          "吕梁",
        ].some((city) => c.includes(city))
      ),
    辽宁: (cities) =>
      cities.filter((c) =>
        [
          "沈阳",
          "大连",
          "鞍山",
          "抚顺",
          "本溪",
          "丹东",
          "锦州",
          "营口",
          "阜新",
          "辽阳",
          "盘锦",
          "铁岭",
          "朝阳",
          "葫芦岛",
        ].some((city) => c.includes(city))
      ),
    吉林: (cities) =>
      cities.filter((c) =>
        ["长春", "吉林", "四平", "辽源", "通化", "白山", "松原", "白城"].some(
          (city) => c.includes(city)
        )
      ),
    黑龙江: (cities) =>
      cities.filter((c) =>
        [
          "哈尔滨",
          "齐齐哈尔",
          "鸡西",
          "鹤岗",
          "双鸭山",
          "大庆",
          "伊春",
          "佳木斯",
          "七台河",
          "牡丹江",
          "黑河",
          "绥化",
        ].some((city) => c.includes(city))
      ),
    江苏: (cities) =>
      cities.filter((c) =>
        [
          "南京",
          "无锡",
          "徐州",
          "常州",
          "苏州",
          "南通",
          "连云港",
          "淮安",
          "盐城",
          "扬州",
          "镇江",
          "泰州",
          "宿迁",
        ].some((city) => c.includes(city))
      ),
    浙江: (cities) =>
      cities.filter((c) =>
        [
          "杭州",
          "宁波",
          "温州",
          "嘉兴",
          "湖州",
          "绍兴",
          "金华",
          "衢州",
          "舟山",
          "台州",
          "丽水",
        ].some((city) => c.includes(city))
      ),
    安徽: (cities) =>
      cities.filter((c) =>
        [
          "合肥",
          "芜湖",
          "蚌埠",
          "淮南",
          "马鞍山",
          "淮北",
          "铜陵",
          "安庆",
          "黄山",
          "阜阳",
          "宿州",
          "滁州",
          "六安",
          "宣城",
          "池州",
          "亳州",
        ].some((city) => c.includes(city))
      ),
    福建: (cities) =>
      cities.filter((c) =>
        [
          "福州",
          "厦门",
          "莆田",
          "三明",
          "泉州",
          "漳州",
          "南平",
          "龙岩",
          "宁德",
        ].some((city) => c.includes(city))
      ),
    江西: (cities) =>
      cities.filter((c) =>
        [
          "南昌",
          "景德镇",
          "萍乡",
          "九江",
          "新余",
          "鹰潭",
          "赣州",
          "吉安",
          "宜春",
          "抚州",
          "上饶",
        ].some((city) => c.includes(city))
      ),
    山东: (cities) =>
      cities.filter((c) =>
        [
          "济南",
          "青岛",
          "淄博",
          "枣庄",
          "东营",
          "烟台",
          "潍坊",
          "济宁",
          "泰安",
          "威海",
          "日照",
          "临沂",
          "德州",
          "聊城",
          "滨州",
          "菏泽",
        ].some((city) => c.includes(city))
      ),
    河南: (cities) =>
      cities.filter((c) =>
        [
          "郑州",
          "开封",
          "洛阳",
          "平顶山",
          "安阳",
          "鹤壁",
          "新乡",
          "焦作",
          "濮阳",
          "许昌",
          "漯河",
          "三门峡",
          "南阳",
          "商丘",
          "信阳",
          "周口",
          "驻马店",
          "济源",
        ].some((city) => c.includes(city))
      ),
    湖北: (cities) =>
      cities.filter((c) =>
        [
          "武汉",
          "黄石",
          "十堰",
          "宜昌",
          "襄阳",
          "鄂州",
          "荆门",
          "孝感",
          "荆州",
          "黄冈",
          "咸宁",
          "随州",
        ].some((city) => c.includes(city))
      ),
    湖南: (cities) =>
      cities.filter((c) =>
        [
          "长沙",
          "株洲",
          "湘潭",
          "衡阳",
          "邵阳",
          "岳阳",
          "常德",
          "张家界",
          "益阳",
          "郴州",
          "永州",
          "怀化",
          "娄底",
        ].some((city) => c.includes(city))
      ),
    广东: (cities) =>
      cities.filter((c) =>
        [
          "广州",
          "韶关",
          "深圳",
          "珠海",
          "汕头",
          "佛山",
          "江门",
          "湛江",
          "茂名",
          "肇庆",
          "惠州",
          "梅州",
          "汕尾",
          "河源",
          "阳江",
          "清远",
          "东莞",
          "中山",
          "潮州",
          "揭阳",
          "云浮",
        ].some((city) => c.includes(city))
      ),
    广西: (cities) =>
      cities.filter((c) =>
        [
          "南宁",
          "柳州",
          "桂林",
          "梧州",
          "北海",
          "防城港",
          "钦州",
          "贵港",
          "玉林",
          "百色",
          "贺州",
          "河池",
          "来宾",
          "崇左",
        ].some((city) => c.includes(city))
      ),
    海南: (cities) =>
      cities.filter((c) =>
        ["海口", "三亚", "三沙", "儋州"].some((city) => c.includes(city))
      ),
    四川: (cities) =>
      cities.filter((c) =>
        [
          "成都",
          "自贡",
          "攀枝花",
          "泸州",
          "德阳",
          "绵阳",
          "广元",
          "遂宁",
          "内江",
          "乐山",
          "南充",
          "眉山",
          "宜宾",
          "广安",
          "达州",
          "雅安",
          "巴中",
          "资阳",
        ].some((city) => c.includes(city))
      ),
    贵州: (cities) =>
      cities.filter((c) =>
        ["贵阳", "六盘水", "遵义", "安顺", "毕节", "铜仁"].some((city) =>
          c.includes(city)
        )
      ),
    云南: (cities) =>
      cities.filter((c) =>
        ["昆明", "曲靖", "玉溪", "保山", "昭通", "丽江", "普洱", "临沧"].some(
          (city) => c.includes(city)
        )
      ),
    西藏: (cities) =>
      cities.filter((c) =>
        ["拉萨", "日喀则", "昌都", "林芝", "山南", "那曲", "阿里"].some(
          (city) => c.includes(city)
        )
      ),
    陕西: (cities) =>
      cities.filter((c) =>
        [
          "西安",
          "铜川",
          "宝鸡",
          "咸阳",
          "渭南",
          "延安",
          "汉中",
          "榆林",
          "安康",
          "商洛",
        ].some((city) => c.includes(city))
      ),
    甘肃: (cities) =>
      cities.filter((c) =>
        [
          "兰州",
          "嘉峪关",
          "金昌",
          "白银",
          "天水",
          "武威",
          "张掖",
          "平凉",
          "酒泉",
          "庆阳",
          "定西",
          "陇南",
        ].some((city) => c.includes(city))
      ),
    青海: (cities) =>
      cities.filter((c) => ["西宁", "海东"].some((city) => c.includes(city))),
    宁夏: (cities) =>
      cities.filter((c) =>
        ["银川", "石嘴山", "吴忠", "固原", "中卫"].some((city) =>
          c.includes(city)
        )
      ),
    新疆: (cities) =>
      cities.filter((c) =>
        ["乌鲁木齐", "克拉玛依", "吐鲁番", "哈密"].some((city) =>
          c.includes(city)
        )
      ),
    香港: (cities) => cities.filter((c) => c.includes("香港")),
    澳门: (cities) => cities.filter((c) => c.includes("澳门")),
    台湾: (cities) => cities.filter((c) => c.includes("台湾")),
  };

  // 检查是否有匹配的省份
  if (!provinces[provinceName]) {
    // 尝试模糊匹配
    const matchedProvince = Object.keys(provinces).find(
      (p) => p.includes(provinceName) || provinceName.includes(p)
    );

    if (matchedProvince) {
      provinceName = matchedProvince;
    } else {
      const content = `未找到省份"${provinceName}"。

支持的省份有：
${Object.keys(provinces).join("、")}

请检查省份名称是否正确。`;
      return formatCommandResponse("省份未找到", content, "🔍", "warning");
    }
  }

  const allCities = getAllCities();
  const provinceCities = provinces[provinceName](allCities);

  if (provinceCities.length === 0) {
    const content = `未找到${provinceName}的城市数据。

请尝试查看其他省份，或使用\`地区列表\`查看所有支持的城市。`;
    return formatCommandResponse("数据未找到", content, "🔍", "warning");
  }

  // 构建HTML内容
  const content = `${provinceName}的城市列表：

<div class="city-grid">
  ${provinceCities
    .map((city) => `<div class="city-item">${city}</div>`)
    .join("")}
</div>

<div class="usage-tip">
  要查看特定城市的区县列表，请发送：<code>查看城市详情：城市名</code>
  <br>例如：<code>查看城市详情：${provinceCities[0]}</code>
</div>`;

  // 创建自定义样式的HTML响应
  const customStyles = `
    .city-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 15px 0;
    }
    .city-item {
      background-color: #f0f8ff;
      border: 1px solid #d0e6ff;
      border-radius: 8px;
      padding: 10px;
      text-align: center;
      font-weight: bold;
      color: #2c3e50;
    }
    .usage-tip {
      background-color: #f0f8ff;
      border-left: 3px solid #3498db;
      padding: 10px 15px;
      margin-top: 15px;
      font-size: 14px;
    }
  `;

  return formatCommandResponse(
    `${provinceName}城市列表`,
    content,
    "🏙️",
    "info",
    customStyles
  );
}

/**
 * 处理查看当前地区的命令
 * @param {String} uid 用户ID
 * @returns {String} 响应消息
 */
function handleGetCurrentLocation(uid) {
  const location = getUserLocationPreference(uid);
  const content = `您当前设置的地区是：**${location.name}**

如需修改，请使用\`设置地区：城市 区县\`命令
例如：\`设置地区：北京 朝阳\``;

  return formatCommandResponse("当前地区信息", content, "📍", "info");
}

/**
 * 处理设置推送时间的命令
 * @param {String} message 用户消息
 * @param {String} uid 用户ID
 * @returns {String} 响应消息
 */
function handleSetPushTime(message, uid) {
  const match = message.match(/^设置推送时间[：:]\s*(\d{1,2}:\d{2})$/);
  if (!match) {
    const content = `格式错误！

请使用以下格式设置推送时间：
\`设置推送时间：小时:分钟\`

例如：\`设置推送时间：8:30\` 或 \`设置推送时间：20:00\``;

    return formatCommandResponse("格式错误", content, "⚠️", "warning");
  }

  const [, time] = match;
  try {
    const success = updatePushTime(uid, time);
    if (success) {
      const content = `您的天气推送时间已成功设置为 **${time}**

系统将在每天的这个时间为您推送天气预报。`;

      return formatCommandResponse("推送时间已设置", content, "⏰", "success");
    } else {
      const content = `设置推送时间失败，时间格式不正确。

请使用时间格式：小时:分钟，例如：8:30、9:50、20:00
小时范围：0-23，分钟范围：00-59。`;

      return formatCommandResponse("设置失败", content, "❌", "error");
    }
  } catch (error) {
    const content = `设置推送时间失败：${error.message}

请检查时间格式是否正确（HH:mm），例如：20:00`;

    return formatCommandResponse("设置失败", content, "❌", "error");
  }
}

/**
 * 获取用户当前的推送时间设置
 * @param {String} uid 用户ID
 * @returns {String} 响应消息
 */
function handleGetPushTime(uid) {
  // 直接从用户偏好文件获取推送时间
  let time = "20:00"; // 默认值

  try {
    const fs = require("fs");
    const path = require("path");

    // 获取用户偏好文件路径（相对于消息处理器的位置向上一层）
    const userPrefPath = path.join(
      __dirname,
      "..",
      "data",
      "userPreferences.json"
    );

    if (fs.existsSync(userPrefPath)) {
      const data = JSON.parse(fs.readFileSync(userPrefPath, "utf8"));

      // 如果用户设置了推送时间，则使用
      if (data.users && data.users[uid] && data.users[uid].pushTime) {
        time = data.users[uid].pushTime;
        console.log(`成功获取用户[${uid}]的推送时间: ${time}`);
      } else {
        console.log(`用户[${uid}]未设置推送时间，使用默认值: ${time}`);
      }
    }
  } catch (error) {
    console.error(`获取用户[${uid}]推送时间失败:`, error);
    // 出错时仍使用默认值
  }

  const content = `您当前的天气推送时间设置为：**${time}**

系统将在每天的这个时间为您推送天气预报。

如需修改，请使用\`设置推送时间：小时:分钟\`命令
例如：\`设置推送时间：8:30\` 或 \`设置推送时间：20:00\``;

  return formatCommandResponse("推送时间信息", content, "⏰", "info");
}

/**
 * 处理帮助命令
 * @returns {String} 响应消息
 */
function handleHelp() {
  const content = `
<div class="help-container">
  <div class="cmd-group location">
    <span class="group-icon">📍</span>
    <span class="group-title">地区相关</span>
    <div class="group-items">
      <div class="cmd-tag">地区列表</div>
      <div class="cmd-tag">查看城市：<span class="param">省份名</span></div>
      <div class="cmd-tag">查看城市详情：<span class="param">城市名</span></div>
      <div class="cmd-tag">设置地区：<span class="param">城市 区县</span></div>
      <div class="cmd-tag">当前地区</div>
    </div>
  </div>
  
  <div class="cmd-group time">
    <span class="group-icon">⏰</span>
    <span class="group-title">推送时间</span>
    <div class="group-items">
      <div class="cmd-tag">查看推送时间</div>
      <div class="cmd-tag">设置推送时间：<span class="param">HH:mm</span></div>
    </div>
  </div>
  
  <div class="cmd-group other">
    <span class="group-icon">ℹ️</span>
    <span class="group-title">其他命令</span>
    <div class="group-items">
      <div class="cmd-tag">帮助</div>
    </div>
  </div>
  
  <div class="examples">
    <div class="example-title">使用示例：</div>
    <div class="example-row">
      <span class="example-cmd">查看城市：江苏</span>
      <span class="example-desc">列出江苏省的所有城市</span>
    </div>
    <div class="example-row">
      <span class="example-cmd">查看城市详情：南京</span>
      <span class="example-desc">查看南京市的所有区县</span>
    </div>
    <div class="example-row">
      <span class="example-cmd">设置地区：南京 江宁</span>
      <span class="example-desc">将地区设为南京江宁</span>
    </div>
    <div class="example-row">
      <span class="example-cmd">设置推送时间：8:30</span>
      <span class="example-desc">设置每天8:30推送天气</span>
    </div>
  </div>
</div>`;

  // 创建自定义样式的HTML响应
  const customStyles = `
    .help-container {
      background: white;
      border-radius: 12px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .cmd-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }
    .cmd-group:last-of-type {
      margin-bottom: 8px;
      border-bottom: none;
    }
    .location .group-icon, .location .group-title {
      color: #3498db;
    }
    .time .group-icon, .time .group-title {
      color: #e67e22;
    }
    .other .group-icon, .other .group-title {
      color: #27ae60;
    }
    .group-icon {
      font-size: 15px;
      margin-right: 4px;
    }
    .group-title {
      font-weight: bold;
      margin-right: 8px;
      font-size: 14px;
      min-width: 55px;
    }
    .group-items {
      display: flex;
      flex-wrap: wrap;
      flex: 1;
      gap: 2px;
    }
    .cmd-tag {
      background: #f5f7fa;
      border-radius: 4px;
      padding: 3px 6px;
      margin: 2px;
      font-size: 12px;
      white-space: nowrap;
      border-left: 2px solid;
    }
    .location .cmd-tag {
      border-left-color: #3498db;
    }
    .time .cmd-tag {
      border-left-color: #e67e22;
    }
    .other .cmd-tag {
      border-left-color: #27ae60;
    }
    .param {
      color: #e74c3c;
      font-style: italic;
    }
    .examples {
      background: #f8f9fa;
      border-radius: 6px;
      padding: 8px;
      font-size: 11px;
    }
    .example-title {
      font-weight: bold;
      margin-bottom: 5px;
      color: #7f8c8d;
    }
    .example-row {
      display: flex;
      margin-bottom: 4px;
      align-items: center;
    }
    .example-row:last-child {
      margin-bottom: 0;
    }
    .example-cmd {
      background: #f0f0f0;
      padding: 2px 5px;
      border-radius: 3px;
      margin-right: 6px;
      color: #333;
      font-family: monospace;
    }
    .example-desc {
      color: #7f8c8d;
      font-size: 11px;
    }
  `;

  return formatCommandResponse("使用帮助", content, "📖", "info", customStyles);
}

/**
 * 处理用户消息
 * @param {String} message 用户消息
 * @param {String} uid 用户ID
 * @returns {Object} 响应消息对象 {content: String, isHtml: Boolean}
 */
function handleMessage(message, uid) {
  console.log(`收到用户[${uid}]消息: "${message}"`);
  let response = null;
  let isHtml = false;

  // 处理设置地区命令
  if (message.startsWith("设置地区")) {
    response = handleSetLocation(message, uid);
    isHtml = true;
  }

  // 处理查看地区列表命令
  else if (message === "地区列表") {
    response = handleListLocations();
    isHtml = true;
  }

  // 处理查看城市详情命令
  else if (message.startsWith("查看城市详情")) {
    const match = message.match(/^查看城市详情[：:]\s*(.+)$/);
    if (match && match[1]) {
      response = handleCityDetail(match[1].trim());
      isHtml = true;
    } else {
      const content = `格式错误！

请使用以下格式查看城市详情：
\`查看城市详情：城市名\`

例如：\`查看城市详情：南京\``;
      response = formatCommandResponse("格式错误", content, "⚠️", "warning");
      isHtml = true;
    }
  }

  // 处理查看省份城市命令
  else if (message.startsWith("查看城市")) {
    const match = message.match(/^查看城市[：:]\s*(.+)$/);
    if (match && match[1]) {
      response = handleProvinceDetail(match[1].trim());
      isHtml = true;
    } else {
      const content = `格式错误！

请使用以下格式查看省份城市：
\`查看城市：省份名\`

例如：\`查看城市：江苏\``;
      response = formatCommandResponse("格式错误", content, "⚠️", "warning");
      isHtml = true;
    }
  }

  // 处理查看当前地区命令
  else if (message === "当前地区") {
    response = handleGetCurrentLocation(uid);
    isHtml = true;
  }

  // 处理设置推送时间命令
  else if (message.startsWith("设置推送时间")) {
    response = handleSetPushTime(message, uid);
    isHtml = true;
  }

  // 处理查看推送时间命令
  else if (message === "查看推送时间") {
    response = handleGetPushTime(uid);
    isHtml = true;
  }

  // 处理帮助命令
  else if (message === "帮助") {
    response = handleHelp();
    isHtml = true;
  }

  // 未知命令
  else {
    const content = `抱歉，我无法理解您的命令。

请发送\`帮助\`查看支持的命令列表。`;

    response = formatCommandResponse("未识别的命令", content, "❓", "warning");
    isHtml = true;
  }

  return { content: response, isHtml };
}

module.exports = {
  handleMessage,
  handleSetLocation,
  handleListLocations,
  handleGetCurrentLocation,
  handleSetPushTime,
  handleGetPushTime,
  handleHelp,
  handleCityDetail,
  handleProvinceDetail,
};
