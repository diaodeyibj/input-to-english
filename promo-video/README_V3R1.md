# Input to English — v3r1

40 秒 / 1920×1080 与 4K / 60 fps / 48 kHz 立体声。

此次修改保留 v3 八语 B 与配乐 C：日语遮挡修复、设置前单浏览器放大、原始 logo、鼠标精确点击、完整英文 `Help me design a more creative new logo` 和新的英语母语男性口语配音。音频可先于字幕开始；字幕显示节奏单独控制。

原工作区中 v1/v2/v3 的素材与成片均保留。修订版工程在 `src/v3r1`，素材在 `public/audio/v3r1`，输出在 `out/v3r1`。Studio 选择 `InputToEnglishV3R1`。

```powershell
npm ci
npm run typecheck
npm test
node scripts/render-v3r1.mjs full
node scripts/render-v3r1.mjs mux
node scripts/verify-v3r1.mjs
```

主要控制：`timeline.mjs` 的镜头、窗口、鼠标与 `englishTextAt`；`Scene.tsx` 的可编辑场景；`Environment.tsx` 的 v3r1 阴影层深度设置。图标和鼠标共享页面坐标变换，设置页仍是原产品设置内容的浮动镜头表现。

`select-english-v3r1.mjs` 仅在用户试听选定候选后使用 `--user-approved`；`mix-v3r1.py` 重新绑定键盘、点击音和声音让位，生成包含实际 SHA256 的音频合同。修改时间或声音后必须重新混音，再 mux。

各语干声、所选原始录音、独立分轨和候选均保留。重新合成需要本机 CosyVoice3 模型环境，模型不含在工程中；已有音轨可直接编辑和播放。

```powershell
node scripts/select-english-v3r1.mjs en-r1-c public/audio/v3r1/english-candidates.json --user-approved
python -B scripts/mix-v3r1.py
```

验收以实际渲染画面、试听和最终解码为准；自动字符时间来自词边界估计，不声称逐音素对齐。
