/* ============================================================
 * 表情包雷达 v2 — 表情/动作/手势识别 · 流行表情包匹配
 * 人脸表情 + 头部动作 + 手部手势 → 本地流行图库 / Giphy 搜索
 * 摄像头与模型错误分开诊断
 * ============================================================ */
import { FaceLandmarker, HandLandmarker, FilesetResolver } from './assets/vision_bundle.js';
import { CULTURE_GESTURES, HEAD_CULTURE } from './culture.js';

/* ---------------- 配置 ---------------- */
const CONFIG = {
  faceModel: 'assets/face_landmarker.task',
  handModel: 'assets/hand_landmarker.task',
  wasmRoot: 'assets/wasm/',
  cdnWasmRoot: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
  cdnFace: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
  cdnHand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
  // jsDelivr 仓库 CDN：国内可达性比 GitHub Pages / Google 更好
  cdnFaceJsdelivr: 'https://cdn.jsdelivr.net/gh/Frian-oss/face-meme@main/assets/face_landmarker.task',
  cdnHandJsdelivr: 'https://cdn.jsdelivr.net/gh/Frian-oss/face-meme@main/assets/hand_landmarker.task',
  memesJson: 'assets/memes/memes.json',
  limit: 8,
  searchCooldownMs: 900,
  eventCooldownMs: 2500,
  keyStorage: 'giphyApiKey',
};

// 可选：把你的 Giphy API Key 填在这里，别人打开页面免配置即可搜索（网站公开后 Key 可见）
const DEFAULT_GIPHY_KEY = 'e1mauv8DEXyy3IEwcNorFXna28U9zC8u';

/* ---------------- facial expression → meme category ---------------- */
const EMOTIONS = [
  { id: 'laugh',    emoji: '😂', name: 'laughing', prio: 6, keywords: ['laughing', 'laughing hard', 'lol'],
    check: s => s.mouthSmile > 0.35 && s.jawOpen > 0.3 ? 0.8 : 0 },
  { id: 'happy',    emoji: '😄', name: 'happy', prio: 5, keywords: ['happy', 'smiling', 'happy dance'],
    check: s => s.mouthSmile > 0.15 ? Math.min(1, s.mouthSmile) : 0 },
  { id: 'surprised', emoji: '😮', name: 'surprised', prio: 5, keywords: ['surprised', 'shocked', 'wow'],
    check: s => (s.jawOpen > 0.25 && s.browInnerUp > 0.18) ? Math.max(s.jawOpen, s.browInnerUp) : 0 },
  { id: 'angry',    emoji: '😠', name: 'angry', prio: 4, keywords: ['angry', 'mad', 'furious'],
    check: s => (s.browDown > 0.25 && s.mouthPress > 0.1) ? s.browDown : 0 },
  { id: 'sad',      emoji: '😢', name: 'sad', prio: 3, keywords: ['sad', 'crying', 'sad cat'],
    check: s => s.mouthFrown > 0.2 ? Math.min(1, s.mouthFrown + s.browInnerUp * 0.5) : 0 },
  { id: 'disgusted', emoji: '🤢', name: 'disgusted', prio: 3, keywords: ['disgusted', 'gross', 'eww'],
    check: s => s.noseSneer > 0.22 ? s.noseSneer : 0 },
  { id: 'fear',     emoji: '😨', name: 'scared', prio: 3, keywords: ['scared', 'afraid', 'scream'],
    check: s => (s.eyeWide > 0.25 && s.browInnerUp > 0.22 && s.jawOpen > 0.12) ? s.eyeWide : 0 },
  { id: 'neutral',  emoji: '🙂', name: 'neutral', prio: 1, keywords: ['chill', 'relaxed', 'cool'],
    check: () => 0.5 },
];

/* head movement → meme category */
const EVENTS = [
  { id: 'nod',    emoji: '👍', name: 'nodding', keywords: ['nodding', 'yes', 'agree'] },
  { id: 'shake',  emoji: '👎', name: 'shaking head', keywords: ['shaking head', 'no', 'nope'] },
  { id: 'tilt',   emoji: '🙃', name: 'head tilt', keywords: ['confused', 'head tilt', 'what'] },
  { id: 'wink',   emoji: '😉', name: 'wink', keywords: ['wink', 'flirting'] },
  { id: 'tongue', emoji: '😜', name: 'tongue out', keywords: ['tongue out', 'goofy', 'bleh'] },
];

/* hand gestures → meme category */
const HAND_GESTURES = [
  { id: 'peace',   emoji: '✌️', name: 'peace sign', keywords: ['peace sign', 'victory', 'v sign'] },
  { id: 'thumbsup', emoji: '👍', name: 'thumbs up', keywords: ['thumbs up', 'good job', 'like'] },
  { id: 'ok',      emoji: '👌', name: 'OK', keywords: ['ok hand', 'perfect', 'alright'] },
  { id: 'wave',    emoji: '👋', name: 'waving', keywords: ['waving', 'hello', 'bye'] },
  { id: 'fist',    emoji: '✊', name: 'fist', keywords: ['fist', 'fist bump', 'power'] },
  { id: 'one',     emoji: '☝️', name: 'number one', keywords: ['number one', 'first', 'one'] },
];

/* ---------------- 状态 ---------------- */
let faceLandmarker = null;
let handLandmarker = null;
let overlay = null, ctx = null;
let running = false;
let rafId = null;
let lastVideoTime = -1;
let lastEmotion = null;
let lastSearchAt = 0;
let lastEventAt = {};
let fpsFrames = 0, fpsTimer = 0, fpsValue = 0;
let bsUpdateAt = 0;
const pitchHistory = [], yawHistory = [], rollHistory = [];
let tiltSince = 0;
let localMemes = {};   // 分类 -> [url,...]（来自 memes.json）
let mode = 'meme';     // 'meme' | 'culture'

/* ---------------- DOM ---------------- */
const $ = id => document.getElementById(id);
const el = {
  video: $('video'), overlay: $('overlay'), placeholder: $('videoPlaceholder'),
  startBtn: $('startBtn'), settingsBtn: $('settingsBtn'),
  fpsStat: $('fpsStat'), faceStat: $('faceStat'), angleStat: $('angleStat'),
  bsBars: $('bsBars'), emotionEmoji: $('emotionEmoji'), emotionName: $('emotionName'),
  emotionDetail: $('emotionDetail'), confidenceBar: $('confidenceBar'), confValue: $('confValue'),
  eventLog: $('eventLog'), results: $('results'), resultQuery: $('resultQuery'),
  modal: $('modal'), modalImg: $('modalImg'), copyLinkBtn: $('copyLinkBtn'), openGiphyBtn: $('openGiphyBtn'),
  settingsModal: $('settingsModal'), keyInput: $('keyInput'), keyTestResult: $('keyTestResult'),
  keyStatus: $('keyStatus'), keyBanner: $('keyBanner'), keyBannerLink: $('keyBannerLink'),
  tabMeme: $('tabMeme'), tabCulture: $('tabCulture'),
  memePanel: $('memePanel'), culturePanel: $('culturePanel'),
  cultureCurrent: $('cultureCurrent'), cultureGallery: $('cultureGallery'),
  toast: $('toast'),
};

/* ---------------- 工具 ---------------- */
function getKey() { return (localStorage.getItem(CONFIG.keyStorage) || '').trim() || DEFAULT_GIPHY_KEY; }
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add('hidden'), 2600);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function esc(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('"').join('&quot;'); }

/* ============================================================
 * 1. 摄像头（带约束降级 + mediaDevices 诊断）
 * ============================================================ */
function stopCamera() {
  if (el.video.srcObject) {
    el.video.srcObject.getTracks().forEach(t => t.stop());
    el.video.srcObject = null;
  }
}
function stopLoop() {
  running = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}
function closeLandmarkers() {
  for (const m of [faceLandmarker, handLandmarker]) {
    if (m) { try { m.close(); } catch (e) { /* ignore */ } }
  }
  faceLandmarker = null; handLandmarker = null;
}

async function getUserMediaWithFallback() {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    const e = new Error('No camera API in this environment');
    e.name = 'NoMediaDevices';
    throw e;
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (e) {
    if (e.name === 'OverconstrainedError' || e.name === 'NotReadableError' || e.name === 'NotFoundError') {
      console.warn('约束过严，降级为默认摄像头请求:', e);
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    throw e;
  }
}

async function initCamera() {
  stopCamera();
  const stream = await getUserMediaWithFallback();
  const ready = new Promise(res => { el.video.onloadedmetadata = res; });
  el.video.srcObject = stream;
  await ready;
  await el.video.play();
  overlay = el.overlay;
  overlay.width = el.video.videoWidth;
  overlay.height = el.video.videoHeight;
  ctx = overlay.getContext('2d');
  el.placeholder.classList.add('hidden');
}

/* ============================================================
 * 2. AI 模型（人脸 + 手部；手部失败不阻塞人脸）
 * ============================================================ */
async function createLM(Cls, wasmRoot, modelPath, delegate) {
  const fileset = await FilesetResolver.forVisionTasks(wasmRoot);
  return await Cls.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: 'VIDEO',
    numFaces: Cls === FaceLandmarker ? 1 : undefined,
    numHands: Cls === HandLandmarker ? 2 : undefined,
    outputFaceBlendshapes: true,
  });
}
async function createWithRetry(Cls, localPath, cdnPaths) {
  const tries = [
    [CONFIG.wasmRoot, localPath, 'GPU'],
    [CONFIG.wasmRoot, localPath, 'CPU'],
    ...cdnPaths.map(([w, m]) => [w, m, 'GPU']),
  ];
  let lastErr;
  for (const [w, m, d] of tries) {
    try { return await createLM(Cls, w, m, d); }
    catch (e) { lastErr = e; console.warn('模型加载失败，尝试下一方案:', Cls.name, d, e); }
  }
  throw lastErr || new Error(Cls.name + ' 模型加载失败');
}
async function initLandmarkers() {
  const face = await createWithRetry(FaceLandmarker, CONFIG.faceModel, [
    [CONFIG.cdnWasmRoot, CONFIG.cdnFaceJsdelivr],
    [CONFIG.cdnWasmRoot, CONFIG.cdnFace],
  ]);
  let hand = null;
  try {
    hand = await createWithRetry(HandLandmarker, CONFIG.handModel, [
      [CONFIG.cdnWasmRoot, CONFIG.cdnHandJsdelivr],
      [CONFIG.cdnWasmRoot, CONFIG.cdnHand],
    ]);
  } catch (e) { console.warn('手部模型加载失败，仅使用人脸识别:', e); }
  return { face, hand };
}

/* ============================================================
 * 3. 本地流行表情包图库（memes.json 按分类登记）
 * ============================================================ */
async function loadLocalMemes() {
  try {
    const res = await fetch(CONFIG.memesJson, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    localMemes = j || {};
    console.log('本地表情包图库已加载:', Object.keys(localMemes).length, '个分类');
  } catch (e) {
    console.warn('memes.json 加载失败（图库为空时回退 Giphy 搜索）:', e);
    localMemes = {};
  }
}
function pickLocalMeme(category) {
  const list = localMemes[category];
  if (list && list.length) return list[Math.floor(Math.random() * list.length)];
  return null;
}

/* ============================================================
 * 4. 主循环（人脸 + 手部）
 * ============================================================ */
function loop(now) {
  if (!running || !faceLandmarker) return;
  if (el.video.readyState >= 2 && el.video.currentTime !== lastVideoTime) {
    lastVideoTime = el.video.currentTime;
    try {
      const t0 = performance.now();
      const faceRes = faceLandmarker.detectForVideo(el.video, now);
      handleFaceResult(faceRes, now);
      if (handLandmarker) {
        const handRes = handLandmarker.detectForVideo(el.video, now);
        handleHandResult(handRes);
      }
      void t0;
    } catch (err) {
      console.error('识别帧异常:', err);
      stopLoop();
      closeLandmarkers();
      el.startBtn.disabled = false;
      el.startBtn.textContent = '📷 Start Camera';
      toast('⚠️ Recognition error, restart: ' + (err.message || err));
      return;
    }
  }
  fpsFrames++;
  if (now - fpsTimer >= 500) {
    fpsValue = Math.round((fpsFrames * 1000) / (now - fpsTimer));
    fpsFrames = 0; fpsTimer = now;
    el.fpsStat.textContent = `${fpsValue} FPS`;
  }
  rafId = requestAnimationFrame(loop);
}

/* ---------------- 人脸结果 ---------------- */
function handleFaceResult(result, now) {
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    el.faceStat.textContent = 'Faces: 0';
    ctx && ctx.clearRect(0, 0, overlay.width, overlay.height);
    return;
  }
  el.faceStat.textContent = `Faces: ${result.faceLandmarks.length}`;

  const lm = result.faceLandmarks[0];
  const bsArr = (result.faceBlendshapes && Array.isArray(result.faceBlendshapes) && result.faceBlendshapes.length)
    ? result.faceBlendshapes[0] : [];
  const scores = getScores(bsArr);
  const angles = calcAngles(lm);

  drawFace(lm, angles);

  el.angleStat.textContent =
    `roll: ${angles.roll.toFixed(0)}°  pitch: ${angles.pitch.toFixed(0)}  yaw: ${angles.yaw.toFixed(0)}`;

  if (now - bsUpdateAt > 100) { bsUpdateAt = now; updateBars(scores); }

  const evt = detectEvent(scores, angles, now);
  const emotion = pickEmotion(scores);

  if (!lastEmotion || emotion.id !== lastEmotion.id) {
    lastEmotion = emotion;
    setCurrentUI(emotion);
    triggerMeme(emotion.id, `${emotion.emoji} ${emotion.name}`, emotion.keywords, now);
  } else {
    setCurrentUI(emotion);
  }

  if (evt) {
    logEvent(evt);
    if (mode === 'culture' && HEAD_CULTURE.some(c => c.id === evt.id)) {
      renderCultureHead(evt.id);
    } else {
      triggerMeme(evt.id, `${evt.emoji} ${evt.name}`, evt.keywords, now);
    }
  }
}

/* ---------------- 手部结果 ---------------- */
function handleHandResult(result) {
  const hands = (result && Array.isArray(result.landmarks)) ? result.landmarks : [];
  if (hands.length) drawHands(hands);
  for (const lm of hands) {
    if (!Array.isArray(lm) || lm.length < 21) continue;
    const id = detectHandGesture(lm);
    if (!id) continue;
    if (mode === 'culture') { renderCultureGesture(id); continue; }
    const g = HAND_GESTURES.find(x => x.id === id);
    if (g) {
      logEvent(g);
      triggerMeme(g.id, `${g.emoji} ${g.name}`, g.keywords, performance.now());
    }
  }
}

/* ---------------- 表情数据 ---------------- */
function getScores(bs) {
  const m = {};
  if (!Array.isArray(bs)) return {
    mouthSmile: 0, jawOpen: 0, browInnerUp: 0, browDown: 0, mouthPress: 0,
    mouthFrown: 0, noseSneer: 0, eyeWide: 0, eyeBlink: 0, tongueOut: 0,
  };   // 防御：数据异常时返回全零，不崩溃
  for (const b of bs) if (b && b.categoryName) m[b.categoryName] = b.score;
  const max = (a, b) => Math.max(m[a] || 0, m[b] || 0);
  return {
    mouthSmile: max('mouthSmileLeft', 'mouthSmileRight'),
    jawOpen: m.jawOpen || 0,
    browInnerUp: m.browInnerUp || 0,
    browDown: max('browDownLeft', 'browDownRight'),
    mouthPress: max('mouthPressLeft', 'mouthPressRight'),
    mouthFrown: max('mouthFrownLeft', 'mouthFrownRight'),
    noseSneer: max('noseSneerLeft', 'noseSneerRight'),
    eyeWide: max('eyeWideLeft', 'eyeWideRight'),
    eyeBlink: max('eyeBlinkLeft', 'eyeBlinkRight'),
    tongueOut: m.tongueOut || 0,
  };
}

/* ---------------- 头部角度 ---------------- */
function calcAngles(lm) {
  const L = lm[234], R = lm[454], N = lm[1];
  const midX = (L.x + R.x) / 2, midY = (L.y + R.y) / 2;
  const dist = Math.hypot(R.x - L.x, R.y - L.y) || 1e-6;
  const roll = Math.atan2(R.y - L.y, R.x - L.x) * 180 / Math.PI;
  return {
    roll,
    pitch: ((N.y - midY) / dist) * 100,
    yaw: ((N.x - midX) / dist) * 100,
  };
}

/* ---------------- 头部动作检测 ---------------- */
function pushSample(arr, v, t) {
  arr.push({ v, t });
  while (arr.length && t - arr[0].t > 1200) arr.shift();
}
function detectOscillation(arr, threshold, minFlips) {
  if (arr.length < 12) return false;
  const mean = arr.reduce((s, p) => s + p.v, 0) / arr.length;
  let flips = 0, sign = 0, maxAmp = 0;
  for (const p of arr) {
    const d = p.v - mean;
    maxAmp = Math.max(maxAmp, Math.abs(d));
    const s = d > threshold ? 1 : d < -threshold ? -1 : 0;
    if (s !== 0 && s !== sign) { if (sign !== 0) flips++; sign = s; }
  }
  return flips >= minFlips && maxAmp > threshold * 1.5;
}
function detectEvent(scores, angles, now) {
  pushSample(pitchHistory, angles.pitch, now);
  pushSample(yawHistory, angles.yaw, now);
  if (detectOscillation(pitchHistory, 5, 1)) { pitchHistory.length = 0; return EVENT_OK('nod', now); }
  if (detectOscillation(yawHistory, 6, 1)) { yawHistory.length = 0; return EVENT_OK('shake', now); }

  pushSample(rollHistory, angles.roll, now);
  if (Math.abs(angles.roll) > 15) {
    if (!tiltSince) tiltSince = now;
    else if (now - tiltSince > 300) { tiltSince = 0; rollHistory.length = 0; return EVENT_OK('tilt', now); }
  } else tiltSince = 0;

  if (scores.eyeBlink > 0.5) return EVENT_OK('wink', now);
  if (scores.tongueOut > 0.4) return EVENT_OK('tongue', now);
  return null;

  function EVENT_OK(id, t) {
    const e = EVENTS.find(x => x.id === id);
    if (!e) return null;
    if (lastEventAt[id] && t - lastEventAt[id] < CONFIG.eventCooldownMs) return null;
    lastEventAt[id] = t;
    return e;
  }
}

/* ---------------- 情绪判定 ---------------- */
function pickEmotion(s) {
  const sorted = [...EMOTIONS].sort((a, b) => b.prio - a.prio);
  for (const e of sorted) {
    const score = e.check(s);
    if (score > 0) return { ...e, score };
  }
  return { ...EMOTIONS[EMOTIONS.length - 1], score: 0.5 };
}

/* ============================================================
 * 5. 手部手势识别（21 关键点规则）
 * ============================================================ */
const H = {
  WRIST: 0, THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4], [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12], [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20], [0,17],
];
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function fingerExt(lm, tip, mcp) {
  const w = lm[H.WRIST];
  return d2(lm[tip], w) / (d2(lm[mcp], w) || 1e-6);
}
function detectHandGesture(lm) {
  const ext = {
    thumb: fingerExt(lm, H.THUMB_TIP, H.THUMB_MCP),
    index: fingerExt(lm, H.INDEX_TIP, H.INDEX_MCP),
    middle: fingerExt(lm, H.MIDDLE_TIP, H.MIDDLE_MCP),
    ring: fingerExt(lm, H.RING_TIP, H.RING_MCP),
    pinky: fingerExt(lm, H.PINKY_TIP, H.PINKY_MCP),
  };
  const straight = v => v > 1.2;
  const bent = v => v < 1.15;
  // pinch（捏手指）：拇指尖与食指尖接近成圈，其余手指弯
  const dTI = d2(lm[H.THUMB_TIP], lm[H.INDEX_TIP]);
  if (dTI < 0.07 && bent(ext.middle) && bent(ext.ring) && bent(ext.pinky)) return 'pinch';

  if (straight(ext.index) && straight(ext.middle) && bent(ext.ring) && bent(ext.pinky)) return 'peace';
  if (straight(ext.thumb) && bent(ext.index) && bent(ext.middle) && bent(ext.ring) && bent(ext.pinky)) return 'thumbsup';
  if (straight(ext.index) && bent(ext.middle) && bent(ext.ring) && bent(ext.pinky) && !straight(ext.thumb)) return 'ok';
  if (bent(ext.index) && bent(ext.middle) && bent(ext.ring) && bent(ext.pinky)) return 'fist';
  if (straight(ext.index) && bent(ext.middle) && bent(ext.ring) && bent(ext.pinky)) return 'one';
  if (straight(ext.index) && straight(ext.middle) && straight(ext.ring) && straight(ext.pinky)) return 'wave';
  return null;
}

/* ============================================================
 * 6. 表情包触发（本地图库优先 → Giphy 回退）
 * ============================================================ */
function triggerMeme(category, label, keywords, now) {
  if (now - lastSearchAt < CONFIG.searchCooldownMs) return;
  lastSearchAt = now;

  const local = pickLocalMeme(category);
  el.resultQuery.textContent = local ? `Library · ${label}` : `Giphy · ${label}`;
  if (local) {
    setSearchingState('picking a meme…');
    setTimeout(() => showMemes([{ url: local, title: label }], label), 250);
    return;
  }
  searchGiphy(keywords, label);
}

function setSearchingState(text) {
  el.results.innerHTML = `<div class="hint big-hint"><div class="ph-icon">🎭</div><p>${text || 'searching…'}</p></div>`;
}

function showMemes(items, label) {
  if (!items.length) { renderEmpty('😅 no memes found — try another face'); return; }
  el.results.innerHTML = '';
  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `<img src="${esc(it.url)}" alt="${esc(it.title || label)}" loading="lazy">`;
    card.onclick = () => openModal(it.url);
    el.results.appendChild(card);
  }
}

async function searchGiphy(keywords, label) {
  setSearchingState();
  const key = getKey();
  if (!key) {
    renderEmpty('🔑 No Giphy API Key — open Settings (top right)');
    el.keyBanner.classList.remove('hidden');
    return;
  }
  try {
    const q = pick(keywords);
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}` +
      `&q=${encodeURIComponent(q)}&limit=${CONFIG.limit}&rating=g&lang=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Giphy HTTP ${res.status}`);
    const json = await res.json();
    const items = (json.data || []).map(g => {
      const img = g.images && (g.images.fixed_height_small || g.images.preview_gif || g.images.fixed_height);
      return img && (img.url.startsWith('http://') || img.url.startsWith('https://'))
        ? { url: img.url, title: g.title || label } : null;
    }).filter(Boolean);
    showMemes(items, label);
  } catch (err) {
    console.error('Giphy 搜索失败:', err);
    renderEmpty('⚠️ meme search failed (network or key)');
  }
}

function renderEmpty(msg) {
  el.results.innerHTML = `<div class="hint big-hint"><div class="ph-icon">🎭</div><p>${msg}</p></div>`;
}

/* 页面加载时展示 Giphy 当下流行热榜（全球实时热门表情包） */
async function loadTrending() {
  const key = getKey();
  if (!key) return;
  try {
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(key)}&limit=8&rating=g`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const items = (json.data || []).map(g => {
      const img = g.images && (g.images.fixed_height_small || g.images.preview_gif || g.images.fixed_height);
      return img && (img.url.startsWith('http://') || img.url.startsWith('https://'))
        ? { url: img.url, title: g.title || 'trending' } : null;
    }).filter(Boolean);
    if (items.length) {
      el.resultQuery.textContent = '🔥 Trending on Giphy';
      showMemes(items, 'trending');
    }
  } catch (e) {
    console.warn('热榜加载失败（不影响识别）:', e);
  }
}

/* ---------------- 大图预览 ---------------- */
let currentGifUrl = '';
function openModal(url) {
  currentGifUrl = url || '';
  el.modalImg.src = currentGifUrl;
  el.openGiphyBtn.href = url || '#';
  el.modal.classList.remove('hidden');
}
async function copyGifLink() {
  if (!currentGifUrl) return;
  try {
    await navigator.clipboard.writeText(currentGifUrl);
    toast('✅ link copied');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentGifUrl;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('✅ link copied');
  }
}

/* ============================================================
 * 7. UI
 * ============================================================ */
function setCurrentUI(emotion) {
  el.confidenceBar.style.width = `${Math.min(100, emotion.score * 100)}%`;
  el.confValue.textContent = `${Math.min(100, Math.round(emotion.score * 100))}%`;
  if (el.emotionName.textContent === emotion.name) return;
  el.emotionEmoji.textContent = emotion.emoji;
  el.emotionName.textContent = emotion.name;
  el.emotionDetail.textContent =
    emotion.id === 'neutral' ? 'relaxed… try smiling, opening your mouth, or a thumbs up' : `confidence ${Math.round(emotion.score * 100)}%`;
  el.emotionEmoji.classList.remove('pop');
  void el.emotionEmoji.offsetWidth;
  el.emotionEmoji.classList.add('pop');
}

function updateBars(s) {
  const bars = [
    ['Smile 😊', s.mouthSmile], ['Mouth open 😮', s.jawOpen], ['Brows up 🤨', s.browInnerUp],
    ['Brows down 😠', s.browDown], ['Frown 😕', s.mouthFrown], ['Blink 👁️', s.eyeBlink],
    ['Nose 🤢', s.noseSneer], ['Tongue 😜', s.tongueOut],
  ];
  el.bsBars.innerHTML = bars.map(([name, v]) => `
    <div class="bs-row">
      <span>${name}</span>
      <div class="bs-track"><div class="bs-fill" style="width:${(v * 100).toFixed(0)}%"></div></div>
      <span class="bs-val">${(v * 100).toFixed(0)}%</span>
    </div>`).join('');
}

function logEvent(evt) {
  const t = new Date().toTimeString().slice(0, 8);
  const item = document.createElement('div');
  item.className = 'event-item';
  item.innerHTML = `<span>${evt.emoji} ${evt.name}</span><span class="t">${t}</span>`;
  el.eventLog.prepend(item);
  while (el.eventLog.children.length > 8) el.eventLog.lastChild.remove();
  el.eventLog.querySelector('.hint')?.remove();
}

/* ============================================================
 * 7.5 CULTURE MODE — same gesture, different languages
 * ============================================================ */
let currentCultureId = null;

function setMode(m) {
  mode = m;
  el.tabMeme.classList.toggle('active', m === 'meme');
  el.tabCulture.classList.toggle('active', m === 'culture');
  el.memePanel.hidden = m !== 'meme';
  el.culturePanel.hidden = m !== 'culture';
}

function buildCultureCard(c) {
  return `
    <div class="culture-card">
      <div class="cc-head">
        <span class="cc-emoji">${c.emoji}</span>
        <div>
          <div class="cc-name">${c.name}</div>
          <div class="cc-desc">${c.desc}</div>
        </div>
      </div>
      ${c.tagline ? `<p class="cc-tagline">${c.tagline}</p>` : ''}
      <div class="cc-meanings">
        ${c.meanings.map(m => `
          <div class="cc-item">
            <span class="cc-flag">${m.flag}</span>
            <div class="cc-body">
              <span class="cc-country">${m.country}</span>
              <span class="cc-meaning">${m.meaning}</span>
            </div>
          </div>`).join('')}
      </div>
      <p class="cc-takeaway">${c.takeaway}</p>
    </div>`;
}

function renderCultureGesture(id) {
  const c = CULTURE_GESTURES.find(x => x.id === id);
  if (!c) return;
  currentCultureId = id;
  el.cultureCurrent.innerHTML = buildCultureCard(c);
  highlightCultureCard(id);
}

function renderCultureHead(id) {
  const c = HEAD_CULTURE.find(x => x.id === id);
  if (!c) return;
  currentCultureId = id;
  el.cultureCurrent.innerHTML = buildCultureCard(c);
  highlightCultureCard(id);
}

function renderCultureGallery() {
  el.cultureGallery.innerHTML = CULTURE_GESTURES.map(c => `
    <button class="gesture-cell" data-id="${c.id}" title="preview">
      <span class="gc-emoji">${c.emoji}</span>
      <span class="gc-name">${c.name}</span>
    </button>`).join('');
  el.cultureGallery.querySelectorAll('.gesture-cell').forEach(btn => {
    btn.addEventListener('click', () => {
      setMode('culture');
      renderCultureGesture(btn.dataset.id);
    });
  });
}

function highlightCultureCard(id) {
  el.cultureGallery.querySelectorAll('.gesture-cell').forEach(b =>
    b.classList.toggle('active', b.dataset.id === id));
}

function setupCultureMode() {
  renderCultureGallery();
  el.tabMeme.addEventListener('click', () => setMode('meme'));
  el.tabCulture.addEventListener('click', () => setMode('culture'));
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k >= '1' && k <= '7') {
      const c = CULTURE_GESTURES[Number(k) - 1];
      if (c) { setMode('culture'); renderCultureGesture(c.id); }
    }
  });
}

/* ---------------- 绘制 ---------------- */
function drawFace(lm, angles) {
  const cw = overlay.width, ch = overlay.height;
  ctx.clearRect(0, 0, cw, ch);
  const pts = lm.map(p => ({ x: p.x * cw, y: p.y * ch }));
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  drawConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, pts);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  drawConnections(FaceLandmarker.FACE_LANDMARKS_CONTOURS, pts);
  ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
  for (const p of pts) ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
  ctx.fillStyle = 'rgba(120, 220, 255, 0.95)';
  for (let i = 468; i < Math.min(lm.length, 478); i++) ctx.fillRect(lm[i].x * cw - 2, lm[i].y * ch - 2, 4, 4);
  if (Math.abs(angles.roll) > 15) {
    ctx.fillStyle = 'rgba(255,209,102,0.95)';
    ctx.font = '14px sans-serif';
    ctx.fillText(`tilt ${angles.roll.toFixed(0)}°`, 12, 24);
  }
}
function drawConnections(conns, pts) {
  if (!Array.isArray(conns) || !conns.length) return;
  ctx.beginPath();
  for (const c of conns) {
    if (pts[c.start] && pts[c.end]) {
      ctx.moveTo(pts[c.start].x, pts[c.start].y);
      ctx.lineTo(pts[c.end].x, pts[c.end].y);
    }
  }
  ctx.stroke();
}
function drawHands(hands) {
  if (!Array.isArray(hands)) return;
  const cw = overlay.width, ch = overlay.height;
  for (const lm of hands) {
    if (!Array.isArray(lm) || lm.length < 21) continue;
    const pts = lm.map(p => ({ x: p.x * cw, y: p.y * ch }));
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [i, j] of HAND_CONNECTIONS) {
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[j].x, pts[j].y);
    }
    ctx.stroke();
    for (let i = 0; i < pts.length; i++) {
      ctx.fillStyle = i === H.WRIST ? '#ffd166' : 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, i === H.WRIST ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ============================================================
 * 8. 设置面板（Giphy API Key）
 * ============================================================ */
function updateKeyStatus() {
  const has = !!getKey();
  el.keyStatus.textContent = has ? 'Key: on' : 'Key: off';
  el.keyStatus.classList.toggle('ok', has);
  el.keyBanner.classList.toggle('hidden', has);
}
async function testKey() {
  const key = el.keyInput.value.trim();
  el.keyTestResult.className = 'key-test-result';
  if (!key) { el.keyTestResult.textContent = 'Paste your key first'; return; }
  el.keyTestResult.textContent = 'testing…';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=test&limit=1&rating=g`, { signal: ctrl.signal });
    if (res.ok) {
      const j = await res.json();
      el.keyTestResult.className = 'key-test-result ok';
      el.keyTestResult.textContent = `✓ Key works — ${(j.data || []).length}+ results`;
    } else {
      el.keyTestResult.className = 'key-test-result err';
      el.keyTestResult.textContent = `✗ Invalid key (HTTP ${res.status})`;
    }
  } catch {
    el.keyTestResult.className = 'key-test-result err';
    el.keyTestResult.textContent = '✗ Cannot reach Giphy, check your network';
  } finally { clearTimeout(timer); }
}

/* ============================================================
 * 9. 启动（摄像头 / 模型 分开诊断）
 * ============================================================ */
function showCameraError(err) {
  const ua = navigator.userAgent || '';
  const msg = (
    err.name === 'NoMediaDevices' ? 'No camera API in this browser/address. Use the latest Chrome or Safari over https:// or localhost'
    : err.name === 'NotAllowedError' ? 'Camera permission denied. Click 🔒 in the address bar → Site settings → Camera → Allow, then reload'
    : err.name === 'NotFoundError' ? 'No camera found — check your device and close apps using the camera'
    : err.name === 'SecurityError' ? 'Camera not allowed here (use HTTPS or localhost)'
    : `Camera failed (${err.name || 'unknown'}): ${err.message || 'try again'}`);
  el.placeholder.innerHTML = `
    <div class="ph-icon">⚠️</div>
    <p style="color:#fff;font-weight:600">Camera failed to start</p>
    <p class="ph-sub" style="max-width:320px">${msg}</p>
    <p class="ph-sub" style="max-width:340px;font-size:11px;word-break:break-all;text-align:left;background:rgba(255,255,255,0.06);padding:8px 10px;border-radius:6px">
      Diagnostics: ${err.name}<br>URL: ${location.href}<br>Browser: ${ua.slice(0, 90)}
    </p>
    <p class="ph-sub">Fix the issue, then click the button above to retry</p>`;
  el.placeholder.classList.remove('hidden');
}
function showModelError(err) {
  el.placeholder.innerHTML = `
    <div class="ph-icon">🛠️</div>
    <p style="color:#fff;font-weight:600">AI model failed to load</p>
    <p class="ph-sub" style="max-width:320px">Camera is ready, but the AI model failed: ${err.name || 'network issue'}. Reload and try again.</p>
    <p class="ph-sub">(Your camera feed is not affected)</p>`;
  el.placeholder.classList.remove('hidden');
}

function setupUI() {
  loadLocalMemes();
  loadTrending();

  el.startBtn.addEventListener('click', async () => {
    stopLoop();
    closeLandmarkers();
    fpsFrames = 0; fpsTimer = 0; bsUpdateAt = 0;
    pitchHistory.length = 0; yawHistory.length = 0; rollHistory.length = 0; tiltSince = 0;
    el.startBtn.disabled = true;
    el.startBtn.textContent = '⏳ Starting…';
    try {
      // ① 摄像头
      try {
        await initCamera();
      } catch (err) {
        console.error('摄像头失败:', err);
        showCameraError(err);
        el.startBtn.disabled = false;
        el.startBtn.textContent = '📷 Start Camera';
        return;
      }
      // ② AI model (first load ~20MB)
      el.startBtn.textContent = '⏳ Loading AI model (first time ~20MB)…';
      let models;
      try {
        models = await initLandmarkers();
      } catch (err) {
        console.error('模型失败:', err);
        showModelError(err);
        el.startBtn.disabled = false;
        el.startBtn.textContent = '📷 Try again';
        return;
      }
      faceLandmarker = models.face;
      handLandmarker = models.hand;
      el.startBtn.textContent = handLandmarker ? '🟢 Recognizing — face & gestures' : '🟢 Recognizing — face only';
      running = true;
      rafId = requestAnimationFrame(loop);
      toast(handLandmarker ? '🎉 Ready! Make a face or gesture' : '🎉 Ready! Make a face');
    } catch (err) {
      console.error(err);
      el.startBtn.disabled = false;
      el.startBtn.textContent = '📷 Start Camera';
      toast('⚠️ Failed to start: ' + (err.message || err));
    }
  });

  el.settingsBtn.addEventListener('click', () => {
    el.keyInput.value = getKey();
    el.keyTestResult.className = 'key-test-result';
    el.keyTestResult.textContent = '';
    el.settingsModal.classList.remove('hidden');
  });
  $('saveKeyBtn').addEventListener('click', () => {
    const key = el.keyInput.value.trim();
    if (key) localStorage.setItem(CONFIG.keyStorage, key);
    else localStorage.removeItem(CONFIG.keyStorage);
    updateKeyStatus();
    el.settingsModal.classList.add('hidden');
    toast(key ? '✅ Key saved' : 'Key cleared');
  });
  $('testKeyBtn').addEventListener('click', testKey);
  el.keyBannerLink.addEventListener('click', e => { e.preventDefault(); el.settingsBtn.click(); });

  document.querySelectorAll('.modal-close').forEach(b =>
    b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden')));
  for (const m of [el.modal, el.settingsModal]) {
    m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
  }
  el.copyLinkBtn.addEventListener('click', copyGifLink);

  setupCultureMode();
  updateKeyStatus();
}

setupUI();
