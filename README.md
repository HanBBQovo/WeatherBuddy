# WeatherBuddy

一个基于和风天气API的天气推送服务，支持微信推送。

## 功能特点

- 支持多地区天气查询
- 支持天气推送
- 支持自定义推送时间
- 支持天气图表展示
- 支持穿衣建议

## 安装

1. 克隆项目

```bash
git clone https://github.com/HanBBQovo/WeatherBuddy.git
cd WeatherBuddy
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

```bash
cp .env.example .env
```

然后编辑 `.env` 文件，填入你的配置信息。

4. 生成密钥（如果需要使用JWT认证）

```bash
mkdir -p keys
openssl genpkey -algorithm ED25519 -out keys/ed25519-private.pem
openssl pkey -pubout -in keys/ed25519-private.pem > keys/ed25519-public.pem
```

## 配置说明

1. 和风天气API配置

   - 访问[和风天气开发平台](https://dev.qweather.com/)
   - 创建应用并获取API密钥
   - 配置 `.env` 文件中的 `HEFENG_API_KEY`

2. WxPusher配置

   - 访问[WxPusher](https://wxpusher.zjiecode.com/)
   - 创建应用并获取应用Token
   - 配置 `.env` 文件中的 `WXPUSHER_APP_TOKEN`

3. DeepSeek API配置（可选）
   - 访问[DeepSeek](https://deepseek.com/)
   - 获取API密钥
   - 配置 `.env` 文件中的 `DEEPSEEK_API_KEY`

## 使用

1. 启动服务

```bash
npm start
```

2. 测试推送

```bash
npm run test:push -- --uid=你的用户ID
```

## 开发

1. 运行测试

```bash
npm test
```

2. 代码格式化

```bash
npm run format
```

## 注意事项

- 请确保 `.env` 文件和 `keys/` 目录不会被提交到版本控制系统
- 定期更新依赖包以修复安全漏洞
- 保护好你的API密钥和私钥文件

## 许可证

MIT
