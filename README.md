# 拱豬夜市 Gong Zhu Night Market

這是一個四人拱豬紙牌網頁遊戲。你扮演 **Allan**（TEAM TAIWAN 資安顧問），對手是 AI 小助手 **阿拉蕾**、**黑帽阿駭** 和 **釣魚姐**。

- 純靜態網站，不需要建置。直接開 `index.html`，或用任何靜態伺服器（例如 `npx http-server .`）。
- 規則說明在 `rules.html`。
- 語音沿用課程影片的聲線：Allan = `zh-TW-YunJheNeural`（+6%、-2Hz），阿拉蕾 = `zh-TW-HsiaoYuNeural`（+10%、+28Hz）。台詞預先以 edge-tts 合成在 `assets/audio/`；沒有音檔的句子會改用瀏覽器內建語音。

## 檔案

| 路徑 | 內容 |
| --- | --- |
| `js/engine.js` | 規則引擎：發牌、亮牌限制、跟牌、收墩、計分（純邏輯，Node 可測） |
| `js/ai.js` | 電腦玩家策略，也用在「問阿拉蕾」提示 |
| `js/lines.js` | 角色設定與對白腳本 |
| `js/voice.js` | 播放課程配音，找不到音檔時改用瀏覽器語音 |
| `js/audio-manifest.js` | 台詞與音檔對照表（由 `tools/build_audio.py` 產生） |
| `tools/build_audio.py` | 以 edge-tts 合成所有台詞配音 |
| `js/scene.js` | 背景：台北夜空、101、燈籠 |
| `js/app.js` | 遊戲流程、畫面、對話串場、稽核報告與證書 |
| `assets/img/` | Allan 與阿拉蕾的表情和全身圖（從角色設定圖裁切），以及 NPC 的 SVG |

## 修改台詞後重新產生配音

```
pip install edge-tts
python3 tools/build_audio.py
```

只會合成新增或修改過的句子，並自動刪掉不再使用的音檔。聲線、語速、音調設定在 `tools/build_audio.py` 的 `VOICES`。

## 測試

```
node tests/simulate.js
```

這個測試會跑計分單元測試，以及 400 局 AI 自動對局，檢查每一步都是合法出牌、計分前後一致。
