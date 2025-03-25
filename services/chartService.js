const axios = require("axios");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

// 图表目录路径
const chartsDir = path.join(__dirname, "../public/charts");

// 确保charts目录存在
try {
  if (!fs.existsSync(chartsDir)) {
    logger.info(`创建图表目录: ${chartsDir}`);
    fs.mkdirSync(chartsDir, { recursive: true });
  }
} catch (error) {
  logger.error(`创建图表目录失败: ${error.message}`);
}

/**
 * 通过QuickChart API生成温度趋势图
 * @param {Array} dailyData 每日天气数据数组
 * @param {String} locationCode 地区代码
 * @returns {Promise<String>} 图片URL
 */
async function generateTemperatureChart(dailyData, locationCode) {
  if (!dailyData || dailyData.length < 3) return null;

  // 使用7天的数据或可用的最大天数
  const data = dailyData.slice(0, Math.min(dailyData.length, 7));

  // 准备图表数据
  const labels = data.map((day) => getWeekdayName(day.fxDate));
  const maxTemps = data.map((day) => parseInt(day.tempMax));
  const minTemps = data.map((day) => parseInt(day.tempMin));

  // 计算温度范围，为了设置合适的Y轴范围
  const allTemps = [...maxTemps, ...minTemps];
  const minTemp = Math.min(...allTemps) - 2; // 比最低温度再低2度
  const maxTemp = Math.max(...allTemps) + 2; // 比最高温度再高2度

  // 使用字符串模板定义图表配置
  const chartConfigStr = `{
    "type": "line",
    "data": {
      "labels": ${JSON.stringify(labels)},
      "datasets": [
        {
          "label": "最高温度(°C)",
          "data": ${JSON.stringify(maxTemps)},
          "borderColor": "rgb(255, 59, 92)",
          "backgroundColor": "rgba(255, 59, 92, 0.15)",
          "borderWidth": 4,
          "pointBackgroundColor": "rgb(255, 59, 92)",
          "pointBorderColor": "white",
          "pointBorderWidth": 2,
          "pointRadius": 6,
          "tension": 0.2,
          "fill": true
        },
        {
          "label": "最低温度(°C)",
          "data": ${JSON.stringify(minTemps)},
          "borderColor": "rgb(34, 142, 215)",
          "backgroundColor": "rgba(34, 142, 215, 0.15)",
          "borderWidth": 4,
          "pointBackgroundColor": "rgb(34, 142, 215)",
          "pointBorderColor": "white",
          "pointBorderWidth": 2,
          "pointRadius": 6,
          "tension": 0.2,
          "fill": true
        }
      ]
    },
    "options": {
      "responsive": true,
      "title": {
        "display": true,
        "text": "未来温度走势",
        "fontSize": 24,
        "fontStyle": "bold",
        "padding": 20,
        "fontColor": "#333"
      },
      "legend": {
        "position": "bottom",
        "labels": {
          "usePointStyle": true,
          "padding": 20,
          "fontSize": 14,
          "fontStyle": "bold",
          "fontColor": "#333"
        }
      },
      "tooltips": {
        "enabled": false
      },
      "scales": {
        "yAxes": [{
          "ticks": {
            "min": ${minTemp},
            "max": ${maxTemp},
            "fontColor": "#333",
            "padding": 10,
            "fontSize": 14,
            "fontStyle": "bold"
          },
          "scaleLabel": {
            "display": true,
            "labelString": "温度(°C)",
            "fontColor": "#333",
            "fontSize": 14
          },
          "gridLines": {
            "color": "rgba(0, 0, 0, 0.07)",
            "drawBorder": true,
            "zeroLineColor": "rgba(0, 0, 0, 0.25)",
            "lineWidth": 1
          }
        }],
        "xAxes": [{
          "ticks": {
            "fontColor": "#333",
            "padding": 10,
            "fontSize": 14,
            "fontStyle": "bold"
          },
          "gridLines": {
            "display": false,
            "drawBorder": true,
            "color": "rgba(0, 0, 0, 0.25)",
            "zeroLineColor": "rgba(0, 0, 0, 0.25)"
          }
        }]
      },
      "layout": {
        "padding": {
          "left": 15,
          "right": 25,
          "top": 10,
          "bottom": 15
        }
      }
    }
  }`;

  // 使用字符串配置生成图表
  const filename = await generateChartImageWithString(
    chartConfigStr,
    `temp_chart_${locationCode}`
  );
  if (!filename) return null;

  return `/charts/${filename}`;
}

/**
 * 通过QuickChart API生成降水预测图
 * @param {Array} dailyData 每日天气数据数组
 * @param {String} locationCode 地区代码
 * @returns {Promise<String>} 图片URL
 */
async function generateRainfallChart(dailyData, locationCode) {
  if (!dailyData || dailyData.length < 3) return null;

  // 使用7天的数据或可用的最大天数
  const data = dailyData.slice(0, Math.min(dailyData.length, 7));

  // 准备图表数据
  const labels = data.map((day) => getWeekdayName(day.fxDate));

  // 获取降水概率数据，并确保是数字
  const pop = data.map((day) => {
    const value = parseInt(day.pop || "0");
    return isNaN(value) ? 0 : value;
  });

  // 获取降水量数据
  const precip = data.map((day) => {
    const value = parseFloat(day.precip || "0");
    return isNaN(value) ? 0 : value;
  });

  // 使用字符串模板定义图表配置
  const chartConfigStr = `{
    "type": "line",
    "data": {
      "labels": ${JSON.stringify(labels)},
      "datasets": [
        {
          "label": "降水概率(%)",
          "data": ${JSON.stringify(pop)},
          "borderColor": "rgb(34, 142, 215)",
          "backgroundColor": "rgba(34, 142, 215, 0.4)",
          "borderWidth": 4,
          "pointBackgroundColor": "rgb(34, 142, 215)",
          "pointBorderColor": "white",
          "pointBorderWidth": 2,
          "pointRadius": 6,
          "fill": true,
          "tension": 0.2,
          "yAxisID": "y-left"
        },
        {
          "label": "降水量(mm)",
          "data": ${JSON.stringify(precip)},
          "borderColor": "rgb(75, 192, 192)",
          "backgroundColor": "rgba(75, 192, 192, 0.4)",
          "borderWidth": 3,
          "pointBackgroundColor": "rgb(75, 192, 192)",
          "pointBorderColor": "white",
          "pointBorderWidth": 2,
          "pointRadius": 5,
          "fill": false,
          "tension": 0.2,
          "yAxisID": "y-right"
        }
      ]
    },
    "options": {
      "responsive": true,
      "title": {
        "display": true,
        "text": "降水预测",
        "fontSize": 24,
        "fontStyle": "bold",
        "padding": 20,
        "fontColor": "#333"
      },
      "legend": {
        "position": "bottom",
        "labels": {
          "usePointStyle": true,
          "padding": 20,
          "fontSize": 14,
          "fontStyle": "bold",
          "fontColor": "#333"
        }
      },
      "tooltips": {
        "enabled": false
      },
      "scales": {
        "yAxes": [{
          "id": "y-left",
          "position": "left",
          "ticks": {
            "min": 0,
            "max": 100,
            "stepSize": 20,
            "fontColor": "#333",
            "padding": 10,
            "fontSize": 14,
            "fontStyle": "bold"
          },
          "scaleLabel": {
            "display": true,
            "labelString": "降水概率(%)",
            "fontColor": "#333",
            "fontSize": 14
          },
          "gridLines": {
            "color": "rgba(0, 0, 0, 0.07)",
            "drawBorder": true,
            "zeroLineColor": "rgba(0, 0, 0, 0.25)",
            "lineWidth": 1
          }
        }, {
          "id": "y-right",
          "position": "right",
          "ticks": {
            "min": 0,
            "max": 30,
            "stepSize": 5,
            "fontColor": "#333",
            "padding": 10,
            "fontSize": 14,
            "fontStyle": "bold"
          },
          "scaleLabel": {
            "display": true,
            "labelString": "降水量(mm)",
            "fontColor": "#333",
            "fontSize": 14
          },
          "gridLines": {
            "display": false
          }
        }],
        "xAxes": [{
          "ticks": {
            "fontColor": "#333",
            "padding": 10,
            "fontSize": 14,
            "fontStyle": "bold"
          },
          "gridLines": {
            "display": false,
            "drawBorder": true,
            "color": "rgba(0, 0, 0, 0.25)",
            "zeroLineColor": "rgba(0, 0, 0, 0.25)"
          }
        }]
      },
      "layout": {
        "padding": {
          "left": 15,
          "right": 25,
          "top": 10,
          "bottom": 15
        }
      }
    }
  }`;

  // 使用字符串配置生成图表
  const filename = await generateChartImageWithString(
    chartConfigStr,
    `rain_chart_${locationCode}`
  );
  if (!filename) return null;

  return `/charts/${filename}`;
}

/**
 * 通过QuickChart API生成风力预测图
 * @param {Array} dailyData 每日天气数据数组
 * @param {String} locationCode 地区代码
 * @returns {Promise<String>} 图片URL
 */
async function generateWindChart(dailyData, locationCode) {
  if (!dailyData || dailyData.length < 3) return null;

  // 使用7天的数据或可用的最大天数
  const data = dailyData.slice(0, Math.min(dailyData.length, 7));

  // 准备图表数据
  const labels = data.map((day) => getWeekdayName(day.fxDate));
  const windScales = data.map((day) => parseInt(day.windScaleDay) || 0);

  // 计算最大风力等级，为了设置合适的Y轴范围
  const maxWindScale = Math.max(...windScales);
  const yMax = Math.max(maxWindScale + 1, 6); // 至少显示到6级

  // 使用字符串模板定义图表配置
  const chartConfigStr = `{
    "type": "bar",
    "data": {
      "labels": ${JSON.stringify(labels)},
      "datasets": [
        {
          "label": "风力等级",
          "data": ${JSON.stringify(windScales)},
          "backgroundColor": [
            "rgba(255, 99, 132, 0.75)",
            "rgba(54, 162, 235, 0.75)",
            "rgba(255, 206, 86, 0.75)",
            "rgba(75, 192, 192, 0.75)",
            "rgba(153, 102, 255, 0.75)",
            "rgba(255, 159, 64, 0.75)",
            "rgba(199, 199, 199, 0.75)"
          ],
          "borderColor": [
            "rgba(255, 99, 132, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(75, 192, 192, 1)",
            "rgba(153, 102, 255, 1)",
            "rgba(255, 159, 64, 1)",
            "rgba(199, 199, 199, 1)"
          ],
          "borderWidth": 2,
          "borderRadius": 8,
          "barPercentage": 0.8
        }
      ]
    },
    "options": {
      "responsive": true,
      "title": {
        "display": true,
        "text": "风力预测",
        "fontSize": 24,
        "fontStyle": "bold",
        "padding": 20,
        "fontColor": "#333"
      },
      "legend": {
        "position": "bottom",
        "labels": {
          "usePointStyle": true,
          "padding": 20,
          "fontSize": 14,
          "fontStyle": "bold",
          "fontColor": "#333"
        }
      },
      "tooltips": {
        "enabled": false
      },
      "scales": {
        "yAxes": [{
          "ticks": {
            "min": 0,
            "max": ${yMax},
            "stepSize": 1,
            "fontColor": "#333",
            "padding": 10,
            "fontSize": 14,
            "fontStyle": "bold"
          },
          "scaleLabel": {
            "display": true,
            "labelString": "风力等级",
            "fontColor": "#333",
            "fontSize": 14
          },
          "gridLines": {
            "color": "rgba(0, 0, 0, 0.07)",
            "drawBorder": true,
            "zeroLineColor": "rgba(0, 0, 0, 0.25)",
            "lineWidth": 1
          }
        }],
        "xAxes": [{
          "ticks": {
            "fontColor": "#333",
            "padding": 10,
            "fontSize": 14,
            "fontStyle": "bold"
          },
          "gridLines": {
            "display": false,
            "drawBorder": true,
            "color": "rgba(0, 0, 0, 0.25)",
            "zeroLineColor": "rgba(0, 0, 0, 0.25)"
          }
        }]
      },
      "layout": {
        "padding": {
          "left": 15,
          "right": 25,
          "top": 10,
          "bottom": 15
        }
      }
    }
  }`;

  // 使用字符串配置生成图表
  const filename = await generateChartImageWithString(
    chartConfigStr,
    `wind_chart_${locationCode}`
  );
  if (!filename) return null;

  return `/charts/${filename}`;
}

/**
 * 使用字符串形式的配置通过QuickChart API生成图表图片并保存
 * @param {String} chartConfigStr 图表配置字符串
 * @param {String} filePrefix 文件名前缀
 * @returns {Promise<String>} 生成的文件名
 */
async function generateChartImageWithString(chartConfigStr, filePrefix) {
  try {
    // 将字符串转换为对象，然后再转回格式化的JSON字符串
    // 这样可以避免函数传递问题
    const chartConfig = JSON.parse(chartConfigStr);

    // 使用QuickChart API生成图表
    const quickChartUrl = "https://quickchart.io/chart";
    const chartWidth = 600;
    const chartHeight = 400;

    // 发送请求
    const response = await axios.get(quickChartUrl, {
      params: {
        c: JSON.stringify(chartConfig),
        w: chartWidth,
        h: chartHeight,
        bkg: "white",
      },
      responseType: "arraybuffer",
    });

    if (response.status !== 200) {
      console.error("生成图表失败，API返回状态码:", response.status);
      return null;
    }

    // 生成文件名和路径
    const timestamp = new Date().getTime();
    const filename = `${filePrefix}_${timestamp}.png`;
    const filePath = path.join(chartsDir, filename);

    // 将图片数据写入文件
    fs.writeFileSync(filePath, response.data);
    console.log(`成功生成图表图片: ${filename}`);

    return filename;
  } catch (error) {
    console.error("生成图表图片时出错:", error.message);
    if (error.response) {
      console.error("错误详情:", {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data ? error.response.data.toString() : null,
      });
    }
    return null;
  }
}

/**
 * 根据日期获取星期名称
 * @param {String} dateString 日期字符串，格式为YYYY-MM-DD
 * @returns {String} 星期名称
 */
function getWeekdayName(dateString) {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  try {
    const date = new Date(dateString);
    return weekdays[date.getDay()];
  } catch (error) {
    return "";
  }
}

module.exports = {
  generateTemperatureChart,
  generateRainfallChart,
  generateWindChart,
  generateChartImageWithString,
};
