/* 拱豬夜市 — 對白腳本
 * 每個事件是一組「劇本」，隨機挑一個；劇本是一串 [說話者, 台詞, 表情]。
 * 說話者：allan / arale / hacker / phishy；{who} 會換成事件主角的名字，{card} 換成牌名。
 */
(function (root) {
  'use strict';

  const CAST = {
    allan: { name: 'Allan', title: 'TEAM TAIWAN 資安顧問', color: '#3fb6a8' },
    hacker: { name: '黑帽阿駭', title: '零時差漏洞收藏家', color: '#7cf29a' },
    arale: { name: '阿拉蕾', title: 'Allan 的 AI 小助手', color: '#ffd23f' },
    phishy: { name: '釣魚姐', title: '社交工程一姐', color: '#ff7eb6' },
  };

  const L = {
    intro: [
      [['arale', '叮咚～阿拉蕾上線囉！歡迎來到拱豬夜市！今天的攤位全部由我負責招呼喔！', 'cheer'],
        ['allan', '大家好，我是 Allan。今天這局，我們就當成一次內部稽核：每一張牌，我都會好好「抽樣」。', 'smile'],
        ['hacker', '嘿嘿，稽核員來了？你的防火牆，我上禮拜就看過了。', null],
        ['phishy', '哎唷～帥哥顧問，姐姐這裡有限時優惠，點一下就送你一隻豬喔～', null],
        ['allan', '各位注意：可疑連結不要點，有問題請撥 165。好，開局！', 'lecture']],
      [['allan', 'Team Taiwan，資安不能等！拱豬也不能等！', 'laugh'],
        ['arale', '哇嗚～老師今天好有精神！阿拉蕾已經把豬的位置……呃，還沒偵測到啦。', 'laugh'],
        ['hacker', '豬的位置？我早就埋好後門了。', null],
        ['allan', '很好，那你就是本局第一個「高風險資產」。', 'wink']],
    ],
    handStart: [
      [['arale', '第 {n} 手開始！阿拉蕾幫大家洗好牌了，絕對沒有作弊喔～', 'wink']],
      [['allan', '第 {n} 手。風險評鑑先做：先看手上有沒有豬、羊、變壓器。', 'think']],
      [['arale', '第 {n} 手！老師加油，Taiwan can help～ 但豬不能 help 喔！', 'cheer']],
      [['allan', '新的一手，新的 PDCA。Plan：不要吃到豬。', 'lecture'], ['arale', 'Do：然後把豬塞給別人！', 'laugh']],
      [['phishy', '第 {n} 手囉～各位的手牌記得「驗證一下」，傳給姐姐就好～', null], ['allan', '這叫網路釣魚，標準教材。', 'lecture']],
    ],
    exposeIntro: [
      [['arale', '亮牌時間～拿到豬、羊、變壓器、紅心 A 的人，可以亮出來讓分數加倍！', 'explain']],
    ],
    exposeAllan: {
      S12: [[['allan', '我亮豬！這叫風險公開揭露，透明是最好的治理。', 'lecture'], ['arale', '老師好帥……可是豬變 -200 了耶！', 'surprise']]],
      D11: [[['allan', '亮羊！這隻羊是本季 KPI，加倍！', 'laugh'], ['arale', '大家看到了嗎？羊是老師的！誰都不准搶～', 'cheer']]],
      C10: [[['allan', '變壓器亮出來，倍率直接拉到四倍。高風險、高報酬。', 'wink'], ['arale', '老師這是在賭嗎？阿拉蕾的心臟好緊張！', 'surprise']]],
      H14: [[['allan', '紅心 A 亮牌，紅心通通加倍。誰吃誰知道。', 'smile'], ['arale', '哇，大家要小心紅心囉～', 'explain']]],
    },
    exposeOther: [
      [['arale', '{who} 亮了 {card}！這一手 {card} 的威力加倍！', 'surprise']],
      [['allan', '{who} 亮了 {card}，記下來，這是一個需要追蹤的風險項目。', 'think']],
    ],
    exposeNone: [
      [['arale', '這一手沒有人亮牌，大家都很低調耶～', 'think']],
    ],
    allanFirstTurn: [
      [['arale', '輪到老師囉！點一下你要出的牌，不確定就按「問阿拉蕾」！', 'explain']],
    ],
    pigTaken: {
      allan: [
        [['allan', '……開立不符合事項。我吃到豬了。', 'cry'], ['arale', '嗚嗚，老師被勒索豬加密了……阿拉蕾幫你寫矯正措施！', 'cry']],
        [['allan', '豬來了。這就是殘餘風險，我……接受。', 'confused'], ['arale', '老師不要哭，下一手我們一起把豬推給黑帽阿駭！', 'cheer']],
        [['allan', '等等，這隻豬怎麼繞過我的縱深防禦的？', 'shock'], ['hacker', '零時差，嘿嘿。', null]],
      ],
      arale: [
        [['arale', '嗚哇——豬咬到阿拉蕾了啦！', 'cry'], ['allan', '阿拉蕾，這就是「營運持續」：哭完繼續打。', 'lecture']],
        [['arale', '警報警報！阿拉蕾的系統被勒索豬入侵了……', 'cry'], ['allan', '別擔心，我們有離線備份……喔，拱豬沒有備份。', 'gasp']],
      ],
      hacker: [
        [['allan', '黑帽阿駭吃到豬！這叫做「以彼之道，還施彼身」。', 'laugh'], ['arale', '耶～釣到大魚了！不是，是大豬！', 'laugh']],
        [['hacker', '什麼？！我的後門被反向利用了？', null], ['allan', '威脅情資共享，Team Taiwan 最會。', 'wink']],
      ],
      phishy: [
        [['phishy', '哎唷～這隻豬是誰寄來的？我沒點連結啊！', null], ['arale', '釣魚姐這次被釣了！哈哈哈～', 'laugh']],
        [['allan', '釣魚姐收到豬。社交工程演練，零分。', 'smile']],
      ],
    },
    pigPlayed: [
      [['arale', '偵測到勒索豬！警報警報～', 'surprise']],
      [['allan', '豬出現了！大家注意，這是重大資安事件！', 'gasp']],
    ],
    sheepTaken: {
      allan: [
        [['allan', '羊到手！這是今天最佳 KPI。', 'laugh'], ['arale', '老師好棒！+100 入帳～', 'cheer']],
        [['allan', '收羊，優良實務一則，記在稽核報告裡。', 'wink']],
      ],
      arale: [
        [['arale', '嘿嘿，羊羊是阿拉蕾的了！', 'wink'], ['allan', '好，阿拉蕾的模型這次有校準到。', 'smile']],
      ],
      hacker: [[['hacker', '羊？我順手就拿了，這叫權限提升。', null], ['allan', '權限提升？那我要開始查你的存取紀錄。', 'lecture']]],
      phishy: [[['phishy', '小羊羊乖～跟姐姐回家喔～', null], ['arale', '可惡！羊被騙走了！', 'confused']]],
    },
    tenTaken: {
      allan: [[['allan', '變壓器到手，分數乘兩倍——希望是好的那種乘。', 'think']]],
      arale: [[['arale', '阿拉蕾拿到變壓器！嗶嗶嗶～倍率上升！', 'surprise']]],
      hacker: [[['allan', '黑帽阿駭拿了變壓器，他的分數要被放大檢視了。', 'lecture']]],
      phishy: [[['arale', '釣魚姐拿到變壓器，好分壞分都會加倍喔～', 'explain']]],
    },
    heartsHeavy: {
      allan: [[['allan', '這墩紅心有點重，我先記成「觀察事項」。', 'confused']]],
      arale: [[['arale', '好多紅心……阿拉蕾的心好痛！', 'cry']]],
      hacker: [[['arale', '黑帽阿駭吃了一堆紅心，太好了～', 'laugh']]],
      phishy: [[['allan', '釣魚姐吃紅心，這就是被釣魚的代價。', 'wink']]],
    },
    npcPlay: {
      hacker: [
        '嘿嘿，這張牌經過混淆，你看不出來。',
        '你們的手牌，我都已經掃過 port 了。',
        '我出這張，沒有 log 可以查喔。',
        'Ctrl+C、Ctrl+V，再來一墩。',
        '密碼還在用 123456 的人，舉手？',
      ],
      phishy: [
        '親～恭喜你中獎了，出這張牌就能領取喔！',
        '您的包裹地址有誤，請把豬寄回給姐姐～',
        '我是銀行客服，請提供您的手牌與驗證碼～',
        '限時優惠，只剩最後三分鐘喔～',
        '寶貝，幫姐姐買一下點數卡好不好？',
      ],
    },
    allanReplyNpc: {
      hacker: ['不要以為沒有 log，我們有 SIEM。', '你這是未經授權存取。', '零信任架構，從你開始驗證。'],
      phishy: ['這是詐騙，請撥 165。', '多因子驗證開著，騙不到的。', '先確認寄件者網域，再說。'],
    },
    allanWinsTrickClean: [
      [['allan', '這墩乾淨，沒有分數，主導權回到我手上。', 'smile']],
    ],
    idle: [
      [['arale', '老師，想好了嗎？不確定的話可以問阿拉蕾喔～', 'explain']],
      [['arale', '老師在做風險評鑑嗎？阿拉蕾等你～', 'think']],
    ],
    hintPrefix: [
      ['arale', '阿拉蕾分析中……嗶嗶！建議出 {card}。{why}', 'explain'],
    ],
    handEnd: {
      allanBest: [
        [['allan', '這一手的稽核結論：完全符合，而且還有優良實務。', 'laugh'], ['arale', '老師是本手 MVP！台灣尚勇！', 'cheer']],
      ],
      allanWorst: [
        [['allan', '這一手……我寫一份矯正預防措施，下一手改善。', 'cry'], ['arale', '沒關係，持續改善就是 PDCA 的精神嘛！', 'cheer']],
      ],
      araleBest: [
        [['arale', '阿拉蕾這手最高分！可以加薪嗎？', 'wink'], ['allan', '加薪要走簽核流程，先排進下季預算。', 'smile']],
      ],
      other: [
        [['allan', '這一手結束，大家看一下稽核報告。', 'think'], ['arale', '分數都幫大家算好囉～', 'explain']],
        [['arale', '結算時間到！阿拉蕾的計算機嗶嗶嗶～', 'laugh']],
      ],
    },
    gameOver: {
      allanWin: [
        [['allan', '最終驗證結果：Allan 通過！拱豬管理系統正式取得證書！', 'laugh'], ['arale', '恭喜老師！Team Taiwan 第一名！', 'cheer']],
      ],
      araleWin: [
        [['arale', '耶～阿拉蕾贏了！老師教得好！', 'cheer'], ['allan', '青出於藍。下一局我要重新做風險評鑑。', 'smile']],
      ],
      otherWin: [
        [['allan', '這局被 {who} 拿下了……我們要檢討控制措施的有效性。', 'confused'], ['arale', '老師，再來一局！這次阿拉蕾一定會保護你！', 'cheer']],
      ],
    },
  };

  root.CAST = CAST;
  root.LINES = L;
})(typeof window !== 'undefined' ? window : globalThis);
