# Input to English — v3

40 秒 / 60 fps / 2400 帧。Three.js 玻璃浏览器与空间路径由 Remotion 帧号驱动。

采用已确认的八语 B（中文请求与新 logo 输出对应）、英语 B、原创配乐 C，以及逐字键盘、鼠标点击音效。八语每 100 帧启动，连续句尾淡出至第 120 帧；窗口随后缩小。所有已选录音、时间标记与独立分轨均随工程保留。

## 预览与编辑

需要 Node.js 与 FFmpeg。当前工作区已安装依赖；在独立工程目录首次运行 `npm ci`，随后：

```powershell
npm run studio
npm run typecheck
npm test
```

Studio 选择 `InputToEnglishV3`。主要编辑文件：

- `src/v3/timeline.mjs`：镜头、鼠标、窗口、叙事事件；单位为帧。
- `src/v3/voice-timing.json`：已选语音首字、字符、尾音结束及录音哈希。
- `src/v3/localized-ui.ts`、`settings-ui.ts`：八语界面与服务设置页。
- `src/v3/Scene.tsx`、`GlassPane.tsx`：玻璃、汇流、优势图形及连续 logo 成形。
- `public/audio/v3/voices-manifest.json`：最终音色、实际发声与淡出标记、原始录音路径。
- `public/audio/v3/{drums,bass,melody,keyboard,mouse,motion,voices}.wav`：独立可编辑分轨。

字符帧依自动词边界插值，标点和空格保留；不声称逐音素对齐。设置页凭据是遮蔽的演示状态，没有伪造连接测试结果。等待与 token 图形是定性示意，没有实测数字。

## 导出

```powershell
npm run render
npm run mux
npm run verify
```

`render` 输出 `out/v3/picture-4k.mp4`（3840×2160 的画面中间文件）；`mux` 校验已确认音轨与时间轴哈希，输出 4K 和 1920×1080 成片。修改声音或字符时间后，需要重新生成混音合同，避免使用旧素材：

```powershell
node scripts/bind-v3-timing.mjs
python -B scripts/generate-score-v3.py --final-c
```

重制配乐需要 Python、NumPy、SciPy、SoundFile。已生成的录音和混音可直接编辑与播放，无需安装 CosyVoice 模型。重新合成语音使用主工作区内的 CosyVoice3 脚本和本机模型环境；模型不包含在交付工程中。

验收脚本核验两个成片的分辨率、60 fps、2400 帧、40 秒、48 kHz 双声道与全片解码，并生成关键帧。

原工作区的 v1/v2 成片、旧试听与原始录音均保留。独立工程只注册 v3 合成，不修改浏览器插件代码。
