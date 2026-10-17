# 拱豬夜市 Gong Zhu Night Market

這是一個四人拱豬紙牌網頁遊戲。你扮演 **Allan**（TEAM TAIWAN 資安顧問），對手是 AI 小助手 **阿拉蕾**、**黑帽阿駭** 和 **釣魚姐**。

- 純靜態網站，不需要建置。直接開 `index.html`，或用任何靜態伺服器（例如 `npx http-server .`）。
- 規則說明在 `rules.html`。
- 語音使用瀏覽器內建的 Web Speech API（台灣華語）。用 Microsoft Edge 開啟，可以取得 Allan 的台灣男聲（YunJhe）和阿拉蕾的台灣女聲（HsiaoYu）。到牌桌的「設定」可以改聲線、音高和語速。

## 檔案

| 路徑 | 內容 |
| --- | --- |
| `js/engine.js` | 規則引擎：發牌、亮牌限制、跟牌、收墩、計分（純邏輯，Node 可測） |
| `js/ai.js` | 電腦玩家策略，也用在「問阿拉蕾」提示 |
| `js/lines.js` | 角色設定與對白腳本 |
| `js/voice.js` | 語音合成與聲線挑選 |
| `js/scene.js` | 背景：台北夜空、101、燈籠 |
| `js/app.js` | 遊戲流程、畫面、對話串場、稽核報告與證書 |
| `assets/img/` | Allan 與阿拉蕾的表情和全身圖（從角色設定圖裁切），以及 NPC 的 SVG |

## 測試

```
node tests/simulate.js
```

這個測試會跑計分單元測試，以及 400 局 AI 自動對局，檢查每一步都是合法出牌、計分前後一致。
