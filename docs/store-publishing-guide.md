# Input to English：Chrome 与 Edge 商店上架指南

本文适用于当前的 Manifest V3 版本。商店后台可能调整字段名称；提交时以页面实际显示和官方文档为准。

## 1. 发布前准备

### 代码与安装包

每次发布前执行：

```powershell
npm test
npm run typecheck
npm run zip:chrome
npm run zip:edge
```

首次发布可使用当前版本 `0.1.0`。以后每次上传更新，都必须提高 `package.json` 中的版本号，再重新生成 ZIP。

上传文件：

- Chrome：`.output/input-to-english-0.1.0-chrome.zip`
- Edge：`.output/input-to-english-0.1.0-edge.zip`

不要把整个项目、`node_modules` 或外层目录重新压缩。商店要求 `manifest.json` 位于 ZIP 根目录，WXT 生成的 ZIP 已满足这一要求。

### 商店素材

当前扩展包已包含 16、32、48、128 像素 PNG 图标。

Chrome 还应准备：

- 128×128 PNG 商店图标。
- 至少 1 张、最多 5 张截图，推荐 1280×800，也接受 640×400。
- 440×280 小型宣传图。
- 可选 1400×560 大型宣传图。

Edge 还应准备：

- 方形扩展 Logo；推荐 300×300，最低 128×128。
- 最多 6 张截图，尺寸为 1280×800 或 640×480。
- 可选 440×280 小型宣传图和 1400×560 大型宣传图。

截图建议展示：

1. ChatGPT 输入框旁的 `→ EN` 按钮。
2. 翻译前与翻译后的输入内容。
3. 中文设置页及翻译服务选择。
4. English 设置页。
5. 日本語设置页。

截图中不要出现真实 API 密钥、个人聊天内容、邮箱、头像或其他个人信息。

### 隐私政策与支持页面

发布前准备一个可公开访问的 HTTPS 隐私政策 URL，并建议同时准备支持页面或支持邮箱。隐私政策至少说明：

- 扩展读取用户主动放入 ChatGPT、Claude、Gemini 或 X 输入框、并主动请求翻译的文本；X 只操作用户自己的发帖、回复、引用附言或串帖正文，不读取私信、Grok 或被引用的原推文。
- Browser Local 模式不会把文本发送到开发者服务器。
- 选择 DeepSeek 或 Kimi 时，文本会发送到用户选择的服务商官方 API。
- API 密钥和设置保存在浏览器扩展本地存储中，不使用同步存储。
- 不提供广告，不出售数据，不建立翻译历史，不运行遥测。
- 用户可通过删除 API 密钥、清除扩展数据或卸载扩展删除本地数据。
- 开发者联系邮箱和隐私政策更新日期。

## 2. Chrome Web Store

官方入口：

- 开发者控制台：<https://chrome.google.com/webstore/devconsole>
- 官方发布说明：<https://developer.chrome.com/docs/webstore/publish/>
- 图片要求：<https://developer.chrome.com/docs/webstore/images>

### 注册开发者账号

1. 使用长期维护的 Google 账号登录开发者控制台。
2. 接受开发者协议和政策。
3. 支付一次性开发者注册费；金额以控制台当前显示为准。
4. 完成开发者名称、联系邮箱和账号验证。
5. 建议启用账号双重验证，并确保审核邮件不会进入垃圾邮件。

### 创建并上传扩展

1. 点击 **Add new item**。
2. 选择 `.output/input-to-english-0.1.0-chrome.zip`。
3. 等待清单和 ZIP 自动校验。
4. 如果上传失败，确认 ZIP 根目录直接包含 `manifest.json`，并检查版本号是否高于已发布版本。

### Store listing

建议填写：

- 名称：`Input to English`
- 类别：`Productivity`（生产力工具）
- 简短定位：`Translate your input to English in place on ChatGPT, Claude, Gemini and X.`
- 详细描述开头：明确说明扩展只翻译输入框内容、不会自动发送消息。
- 支持语言：先建立英文主列表，再根据需要添加简体中文和日文商店列表。

详细描述应覆盖三种服务模式、支持的网站、用户主动触发机制、隐私差异和主要限制。不要堆砌关键词，不要声称与 OpenAI、Anthropic、DeepSeek 或 Moonshot AI 官方存在合作关系。

上传 128×128 图标、至少一张截图和 440×280 宣传图。Chrome 官方建议图标主体约占 96×96，并在 128×128 画布四周保留透明空间。

### Privacy practices

单一用途建议填写：

> Translate text that the user has typed into a supported ChatGPT, Claude, Gemini or X editor into English, using the translation provider explicitly selected by the user. Never submit a prompt or publish a post automatically.

权限解释建议：

- `storage`：保存用户选择的翻译服务、界面语言、模型名称和用户主动提供的 API 密钥；仅使用扩展本地存储。
- `https://chatgpt.com/*`：在 ChatGPT 输入编辑器旁显示翻译按钮，并仅在用户点击按钮后读取和替换当前输入内容。
- `https://claude.ai/*`：在 Claude 输入编辑器旁显示翻译按钮，并仅在用户点击按钮后读取和替换当前输入内容。
- `https://gemini.google.com/*`：聚焦 Gemini 网页对话输入框后提供翻译与撤销，不添加 Gemini API 服务。
- `https://x.com/*`：聚焦用户自己的发帖、回复、引用附言或串帖编辑器后提供翻译与撤销，不自动发布。
- `https://api.deepseek.com/*`：仅当用户选择 DeepSeek 并点击翻译或连接测试时调用官方 API。
- `https://api.moonshot.cn/*`：仅当用户选择 Kimi 并点击翻译或连接测试时调用官方 API。

远程代码请选择 **No**：扩展会发送 API 请求，但不会下载或执行远程 JavaScript/Wasm 代码。

数据披露必须如实注明扩展会处理用户输入的文本。使用云端服务时，该文本会被传输给用户选择的第三方翻译提供商；不得把这种情况填写为“完全不传输数据”。隐私政策 URL 应与这里的声明保持一致。

### Distribution 与测试说明

1. 选择发布地区。
2. 首次审核可选择 **Private** 或 **Unlisted** 做受控测试，也可以直接选择 **Public**；三种可见性都要经过政策审核。
3. 在 Test instructions 中说明：安装后点击工具栏图标打开设置页、选择服务商、返回支持的站点、聚焦自己的输入框、输入非英文文本并点击 `→ EN`。Gemini/X 首批验收目标是 Edge；按 `docs/manual-test-checklist.md` 记录真实验收，不能把自动测试记作网站实测。
4. 如审核必须使用云端服务，使用控制台的测试说明字段提供临时测试凭据，不要把密钥写入 ZIP、截图或公开描述。
5. 点击 **Submit for Review**。可选择审核通过后自动发布，或使用 deferred publishing 手动发布。

## 3. Microsoft Edge Add-ons

官方入口：

- Partner Center：<https://partner.microsoft.com/dashboard/microsoftedge/overview>
- 官方发布步骤：<https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension>
- Edge 扩展政策：<https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies>

### 注册 Partner Center

1. 使用 Microsoft 账号登录 Partner Center。
2. 注册 Microsoft Edge 扩展开发者计划。
3. 账号必须有一个 Microsoft Account 作为 Primary Owner。
4. 完成身份、开发者名称、联系方式以及后台要求的验证。

### 创建扩展并上传包

1. 在 Partner Center 首页进入 **Edge** 工作区。
2. 点击 **Create new extension**。
3. 上传 `.output/input-to-english-0.1.0-edge.zip`。
4. 等待包验证完成；确认名称、版本、权限和清单信息正确。
5. 点击 **Continue**。

### Availability

1. 选择可见性：正式上架通常选择 **Public**。
2. 选择销售/分发市场。
3. 如果先做小范围审核或测试，可按后台提供的私有分发选项设置。

### Properties 与 Privacy

1. 选择最贴近的生产力类别。
2. 填写支持邮箱、网站和隐私政策 HTTPS URL。
3. 如实回答是否收集、存储或传输用户数据。
4. 说明扩展不会把文本发送给开发者服务器；但在用户选择 DeepSeek 或 Kimi 时，会把当前待翻译文本发送给对应官方 API。
5. 说明 API 密钥仅保存在扩展本地存储。

### Store listings

为每一种商店语言分别创建列表。Edge 会从清单读取名称和简短描述；若要修改名称，需要修改清单并重新上传 ZIP。

每个语言列表填写：

- 至少 250 字符、最多 10,000 字符的完整描述。
- 方形扩展 Logo，建议 300×300、最低 128×128。
- 可选宣传图。
- 最多 6 张实际功能截图。
- 支持与隐私相关链接。

可以先完成英文列表，再使用 Partner Center 的 Duplicate 功能复制图片到中文和日文列表，然后替换各语言文案。

### Certification notes 与提交

审核说明建议包含：

1. 点击工具栏图标会打开完整设置页。
2. 选择 Browser Local、DeepSeek 或 Kimi 中的一个服务。
3. 打开 ChatGPT、Claude、Gemini 或 X，聚焦自己的输入框，输入中文或日文，然后点击 `→ EN`。
4. 扩展只替换当前输入内容，不会自动提交消息。
5. Browser Local 的可用性取决于审核设备；如需云端测试，应在认证备注中提供临时测试方式。

完成所有必填项后点击 **Publish**。Microsoft 官方说明认证通常可能需要最多 7 个工作日。审核通过后状态会变为 **In the Store**。

## 4. 审核被拒绝时优先检查

- 商店描述是否明确披露云端翻译会把用户输入发送给所选服务商。
- 隐私政策、后台数据声明和产品实际行为是否完全一致。
- 是否申请了没有实际使用的权限。
- 截图是否包含密钥、私人对话或误导性功能。
- ZIP 根目录是否直接包含 `manifest.json`。
- 更新版本号是否高于商店现有版本。
- 审核人员是否能根据测试说明找到设置页和 `→ EN` 按钮。
- 名称、图标或描述是否暗示与第三方品牌存在官方关系。

## 5. 后续版本更新

1. 提高 `package.json` 的版本号，例如从 `0.1.0` 改为 `0.1.1`。
2. 执行测试、类型检查和两个 ZIP 命令。
3. 分别在 Chrome Developer Dashboard 与 Edge Partner Center 上传对应新 ZIP。
4. 填写更新说明和审核测试说明。
5. 提交审核；不要复用旧版本号。
