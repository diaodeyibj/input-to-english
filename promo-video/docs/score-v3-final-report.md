# 最终 C 混音

用户已确认八语 B、英文 B、配乐 C 与键盘/鼠标音效。中文请求已统一为“帮我设计一个更有创意的新标志吧。”，英文为“Help me design a new logo.”。参考音轨未能取得，未声称已听取、复制或测量参考音乐。

全部正式分轨 drums / bass / melody / keyboard / mouse / motion / voices / music / effects / master 均为 40 秒、48 kHz、双声道 PCM24。八语于 100、200、…800 帧启动，每段 120 帧；已确认的尾音淡出与下一句重叠 20 帧。只对旋律 700–4800 Hz 频带让位，鼓贝斯保持律动。EN 点击前 1390–1400 帧完全静音，39.65 秒后干净归零。

键盘已按当前选定的实际可见字符重绑，共 248 次；鼠标采用输入框 98、198、…798 帧以及设置 1100、DeepSeek 1230、EN 1400 帧。ui-events-final.json 保存逐字帧、采样点及源文件哈希。A/B/旧 C 试听文件哈希保持一致，正式语音清单没有改写。

手机试听：public/audio/v3/master-phone-mono.mp3，单声道 128 kbps。中文单独试听：public/audio/v3/preview-chinese-mono.wav，与选定中文源文件逐字节一致。40 秒视频预览用 preview-master-native-b-c.wav，与正式 master 内容一致；PREVIEW 指视频用途。英文至 Logo 的 output-logo.wav 截取 1400–2259 帧，长 14.333 秒；英文于片段 6.667 秒开始，品牌落点在 13.333 秒。

| 文件 | Integrated LUFS | True peak dBTP |
|---|---:|---:|
| drums | -24.18 | -8.91 |
| bass | -23.10 | -12.81 |
| melody | -28.09 | -13.77 |
| keyboard | -37.91 | -14.08 |
| mouse | -46.10 | -18.32 |
| motion | -38.73 | -20.79 |
| voices | -15.75 | -1.91 |
| music | -20.24 | -6.71 |
| effects | -37.80 | -14.08 |
| master | -16.15 | -1.66 |
| output_logo | -16.89 | -1.66 |
| phone_mono | -17.71 | -2.83 |

以上响度均测自写出的实际文件。正式音轨与试听副本保持 40 秒；中文独立片段和 Logo 截段按各自时长保留。
