# 28 秒节奏 Demo：观看与修改

这是用于判断节奏、镜头和叙事的动态粗版。960×540、60fps，使用选定 A 音乐；无旁白。简化 UI、透视和线条只表达运动关系，尚未制作成品材质。

## 建议先看这四处

| 时间 | 当前安排 | 反馈重点 |
| --- | --- | --- |
| 0–5.5s | Get more from AI → 同一条 Logo 请求经过七个操作 | 开头是否吸引；切页是否让人感到繁琐 |
| 5.5–10.5s | 窗口收拢，7.45s 点击 → EN，8.8s 英文完成 | 点击是否有爽感；结果是否读得清 |
| 14.67–18.3s | 英文请求离开 UI，Prompt in English / Move faster | 音乐增强时，画面是否跟得上 |
| 18.3–28s | 英文基线变成三条路径，21.9s 原始 Logo 落定 | “设计 Logo”与品牌是否呼应；收尾是否合拍 |

支持平台通过 ChatGPT → Claude 的同位置输入框衔接呈现。产品操作演示停留在译文待提交状态；Logo 汇聚是片子的品牌动效。

画面底部有秒数、镜头标签和时间进度。反馈可以直接说“7.45 秒点击太轻”“18–21 秒汇聚太慢”，无需描述代码。每个镜头可独立改时长与运动。

## 可编辑工程与复现

本次使用独立入口 `src/demo28/entry.tsx`，没有修改旧 Composition 注册入口。时间与点击位置在 `src/demo28/timing.mjs`，画面在 `src/demo28/Demo.tsx`。

在仓库根目录 F:\chatGPT\Second-Class 运行：

```powershell
python promo-video/scripts/mix-demo28.py
node promo-video/scripts/render-demo28.mjs checks
node promo-video/scripts/render-demo28.mjs full
```

单帧：`node promo-video/scripts/render-demo28.mjs still 447`。已导出文件检查：`node promo-video/scripts/render-demo28.mjs verify`。

输出位于 `promo-video/out/demo28/`：完整 Demo、实际 MP4 解码的联系表及 verification.json。音频位于 `promo-video/public/audio/demo28/`，包含 A 源文件哈希、操作音效峰值落点和混音记录。原始 A 未修改，没有重采样时间伸缩；尾部混音淡出 0.6s。

脚本只覆盖本 Demo 自己的固定输出文件，执行时不会删除文件，也不修改旧视频。当前 Windows 使用已安装的 Chrome / Edge 进行渲染。

## 本轮工作边界

先交付 Demo，根据观看反馈修改节奏和叙事。确定方向后，再升级到 1080p 成片，并从实际迭代过程整理复用工作流；本轮不安装个人 skill、不发布视频、不引入 Drive 大型生成流程。
