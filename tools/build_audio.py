#!/usr/bin/env python3
"""產生拱豬夜市的對白配音（Microsoft Edge 神經語音，台灣口音），聲線與課程影片相同。

用法：
    pip install edge-tts
    python3 tools/build_audio.py            # 只產生新增／修改過的台詞
    python3 tools/build_audio.py --force    # 全部重新產生

流程：用 Node 讀出 js/lines.js 的對白、js/ai.js 的出牌理由與 52 張牌名 → 展開 {n}/{who}/{card} 等變數
→ 逐句以 edge-tts 合成 mp3 到 assets/audio/ → 寫出 js/audio-manifest.js。
檔名取自「聲線設定＋台詞」的雜湊值，台詞沒改就不會重新合成。
找不到音檔的句子（例如之後新增的台詞），遊戲會自動改用瀏覽器內建語音。
"""
import asyncio, hashlib, json, os, re, ssl, subprocess, sys
from pathlib import Path

import edge_tts
import edge_tts.communicate as _comm

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / 'assets' / 'audio'
MANIFEST = ROOT / 'js' / 'audio-manifest.js'

VOICES = {
    # Allan：台灣男聲（與 Cybersecurity_Promotion / ISO27001 課程相同）
    'allan': dict(voice='zh-TW-YunJheNeural', rate='+6%', pitch='-2Hz'),
    # 阿拉蕾：可愛女聲（提高音調、稍快，與課程助教相同）
    'arale': dict(voice='zh-TW-HsiaoYuNeural', rate='+10%', pitch='+28Hz'),
    # 黑帽阿駭：壓低、稍快，跟 Allan 區隔
    'hacker': dict(voice='zh-TW-YunJheNeural', rate='+12%', pitch='-22Hz'),
    # 釣魚姐：甜膩的客服腔
    'phishy': dict(voice='zh-TW-HsiaoChenNeural', rate='-6%', pitch='+8Hz'),
}

HAND_NUMBERS = range(1, 16)   # handStart 的 {n}

_ca = os.environ.get('SSL_CERT_FILE') or ('/root/.ccr/ca-bundle.crt' if Path('/root/.ccr/ca-bundle.crt').exists() else None)
if _ca:
    _comm._SSL_CTX = ssl.create_default_context(cafile=_ca)
PROXY = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')

SPOKEN = [
    (r'～', ''),
    (r'♠', '黑桃'), (r'♥', '紅心'), (r'♣', '梅花'), (r'♦', '方塊'),
    (r'\bKPI\b', 'K P I'), (r'\bPDCA\b', 'P D C A'), (r'\bMVP\b', 'M V P'), (r'\bSIEM\b', 'S I E M'),
    (r'165', '一六五'), (r'123456', '一二三四五六'), (r'Ctrl\+', 'Ctrl '),
    (r'\+(\d+)', r'加\1'), (r'-(\d+)', r'負\1'),
]


def spoken(text):
    for pat, rep in SPOKEN:
        text = re.sub(pat, rep, text)
    return text


def sentences(text):
    """與 js/voice.js 的 sentences() 相同的斷句方式"""
    return [s.strip() for s in re.findall(r'[^。！？]+[。！？]?', text) if s.strip()]


def load_sources():
    js = r"""
const fs = require('fs');
global.GZ = require('./js/engine.js');
require('./js/lines.js');
const ai = fs.readFileSync('./js/ai.js', 'utf8');
const whys = [...ai.matchAll(/'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g)].map((m) => m[1]);
console.log(JSON.stringify({ lines: LINES, cast: CAST, whys, labels: GZ.newDeck().map(GZ.label) }));
"""
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))


def collect():
    src = load_sources()
    L, cast = src['lines'], src['cast']
    names = {k: v['name'] for k, v in cast.items()}
    special = ['豬', '羊', '變壓器', '紅心 A']
    jobs = set()

    def add(who, text):
        if '{' in text:
            return
        jobs.add((who, text))

    def expand(who, text):
        if '{n}' in text:
            for n in HAND_NUMBERS:
                add(who, text.replace('{n}', str(n)))
        elif '{who}' in text or '{card}' in text:
            for w in ('hacker', 'arale', 'phishy'):
                for c in special:
                    add(who, text.replace('{who}', names[w]).replace('{card}', c))
        else:
            add(who, text)

    def walk(node, key=None):
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, k)
        elif isinstance(node, list):
            if len(node) >= 2 and all(isinstance(x, str) or x is None for x in node[:3]) and node[0] in VOICES and isinstance(node[1], str):
                expand(node[0], node[1])
            else:
                for x in node:
                    walk(x, key)

    hint = L.pop('hintPrefix')
    for npc, texts in L.pop('npcPlay').items():      # NPC 出牌時的嘴砲
        for t in texts:
            add(npc, t)
    for texts in L.pop('allanReplyNpc').values():    # Allan 回嘴
        for t in texts:
            add('allan', t)
    walk(L)

    # 「問阿拉蕾」：阿拉蕾分析中……嗶嗶！建議出 {card}。{why} → 逐句拼接播放
    who, tpl, _ = hint[0]
    head, tail = tpl.split('{card}')
    for s in sentences(head):
        if s[-1] in '。！？':
            jobs.add((who, s))
    for label in src['labels']:
        for s in sentences('建議出 ' + label + tail.replace('{why}', '')):
            jobs.add((who, s))
    for why in src['whys']:
        for s in sentences(why):
            jobs.add((who, s))
    return sorted(jobs)


def fname(who, text):
    key = hashlib.sha1(json.dumps([VOICES[who], spoken(text)], ensure_ascii=False).encode()).hexdigest()[:14]
    return f'{who}_{key}.mp3'


async def synth(who, text, path, retries=8):
    cfg = VOICES[who]
    for i in range(retries):
        try:
            await edge_tts.Communicate(spoken(text), cfg['voice'], rate=cfg['rate'], pitch=cfg['pitch'], proxy=PROXY).save(str(path) + '.tmp')
            if Path(str(path) + '.tmp').stat().st_size > 0:
                os.replace(str(path) + '.tmp', path)
                return
        except Exception as e:  # 網路不穩時重試
            print('  retry', i + 1, e)
        await asyncio.sleep(min(30, 2 ** (i + 1)))
    raise RuntimeError('TTS failed: ' + text)


async def main():
    force = '--force' in sys.argv
    AUDIO.mkdir(parents=True, exist_ok=True)
    jobs = collect()
    manifest, todo = {}, []
    for who, text in jobs:
        name = fname(who, text)
        manifest[f'{who}|{text}'] = f'assets/audio/{name}'
        path = AUDIO / name
        if force or not path.exists() or path.stat().st_size == 0:
            todo.append((who, text, path))
    print(f'{len(jobs)} 句，需要合成 {len(todo)} 句')
    sem = asyncio.Semaphore(4)

    async def one(job):
        async with sem:
            await synth(*job)
            print('  ✓', job[0], job[1])
    await asyncio.gather(*(one(j) for j in todo))

    keep = {Path(p).name for p in manifest.values()}
    for f in AUDIO.glob('*.mp3'):
        if f.name not in keep:
            f.unlink()
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        f.write('/* 由 tools/build_audio.py 產生，請勿手動修改。key = 說話者|台詞 */\n')
        f.write('window.AUDIO_MANIFEST = ')
        json.dump(manifest, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write(';\n')
    total = sum(f.stat().st_size for f in AUDIO.glob('*.mp3'))
    print(f'完成：{len(manifest)} 個音檔，共 {total / 1e6:.1f} MB')


if __name__ == '__main__':
    asyncio.run(main())
