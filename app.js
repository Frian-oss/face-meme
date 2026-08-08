/* ============================================================
 * 表情包雷达 — app.js
 * 摄像头实时人脸表情/动作识别 (MediaPipe FaceLandmarker)
 * 识别结果映射为情绪关键词 → 调用 Giphy API 搜索表情包
 * ============================================================ */
import { FaceLandmarker, FilesetResolver } from './assets/vision_bundle.js';

/* ---------------- 配置 ---------------- */
const CONFIG = {
  // 本地资源（打包随行）；加载失败会自动回退到下面的 CDN
  wasmRoot: 'assets/wasm/',
  modelPath: 'assets/face_landmarker.task',
  // 回退 CDN
  cdnWasmRoot: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm',
  cdnModel: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
  // 搜索
  limit: 8,
  searchCooldownMs: 1200,     // 搜索冷却
  eventCooldownMs: 3000,      // 同类动作事件冷却
  keyStorage: 'giphyApiKey',
};

// ============================================================
// 可选：把你自己申请的 Giphy API Key 填在这里，
// 别人打开页面就能直接用表情包搜索（无需各自配置）。
// 注意：网站公开后此 Key 对所有人可见，仅供课堂/小组演示使用。
// 留空则每个访问者需在页面右上角「⚙️ 设置」里自行填写。
// ============================================================
const DEFAULT_GIPHY_KEY = 'e1mauv8DEXyy3IEwcNorFXna28U9zC8u';

/* ---------------- 情绪 → 表情包 映射 ---------------- */
// check 返回 0~1 的匹配强度；prio 高的先判定
const EMOTIONS = [
  { id: 'laugh',    emoji: '😂', name: '大笑', prio: 6,
    keywords: ['laughing', 'lol', 'laughing hard'],
    check: s => s.mouthSmile > 0.45 && s.jawOpen > 0.35 ? 0.8 : 0 },
  { id: 'happy',    emoji: '😄', name: '开心', prio: 5,
    keywords: ['happy', 'happy dance', 'smiling'],
    check: s => s.mouthSmile > 0.22 ? Math.min(1, s.mouthSmile) : 0 },
  { id: 'surprised', emoji: '😮', name: '惊讶', prio: 5,
    keywords: ['surprised', 'shocked', 'mind blown'],
    check: s => (s.jawOpen > 0.35 && s.browInnerUp > 0.22) ? Math.max(s.jawOpen, s.browInnerUp) : 0 },
  { id: 'angry',    emoji: '😠', name: '生气', prio: 4,
    keywords: ['angry', 'mad', 'rage'],
    check: s => (s.browDown > 0.32 && s.mouthPress > 0.12) ? s.browDown : 0 },
  { id: 'sad',      emoji: '😢', name: '难过', prio: 3,
    keywords: ['sad', 'crying', 'sad puppy'],
    check: s => s.mouthFrown > 0.28 ? Math.min(1, s.mouthFrown + s.browInnerUp * 0.5) : 0 },
  { id: 'disgusted', emoji: '🤢', name: '嫌弃', prio: 3,
    keywords: ['disgusted', 'gross', 'eww'],
    check: s => s.noseSneer > 0.28 ? s.noseSneer : 0 },
  { id: 'fear',     emoji: '😨', name: '害怕', prio: 3,
    keywords: ['scared', 'afraid', 'scream'],
    check: s => (s.eyeWide > 0.32 && s.browInnerUp > 0.28 && s.jawOpen > 0.15) ? s.eyeWide : 0 },
  { id: 'neutral',  emoji: '🙂', name: '平静', prio: 1,
    keywords: ['chill', 'relaxed', 'cool'],
    check: () => 0.5 },
];

/* 动作事件 → 表情包 映射 */
const EVENTS = [
  { id: 'nod',    emoji: '👍', name: '点头', keywords: ['yes', 'nodding', 'agreed'] },
  { id: 'shake',  emoji: '👎', name: '摇头', keywords: ['no', 'shaking head', 'nope'] },
  { id: 'tilt',   emoji: '🙃', name: '歪头', keywords: ['confused', 'head tilt', 'what'] },
  { id: 'wink',   emoji: '😉', name: '眨眼', keywords: ['wink', 'flirting'] },
  { id: 'tongue', emoji: '😜', name: '吐舌', keywords: ['tongue out', 'goofy', 'bleh'] },
];

/* ---------------- 状态 ---------------- */
let landmarker = null;
let video = null, overlay = null, ctx = null;
let running = false;
let rafId = null;
let lastVideoTime = -1;
let lastEmotion = null;
let lastSearchAt = 0;
let lastEventAt = {};          // id -> timestamp
let fpsFrames = 0, fpsTimer = 0, fpsValue = 0;
let bsUpdateAt = 0;
const pitchHistory = [], yawHistory = [], rollHistory = [];
let tiltSince = 0;             // 歪头连续计时

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
  toast: $('toast'),
};

/* ---------------- 工具 ---------------- */
function getKey() {
  return (localStorage.getItem(CONFIG.keyStorage) || '').trim() || DEFAULT_GIPHY_KEY;
}

function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add('hidden'), 2600);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// HTML 转义（用于渲染来自 API 的文本）
function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').split('"').join('&quot;');
}

/* ============================================================
 * 1. 摄像头
 * ============================================================ */
function stopCamera() {
  if (el.video.srcObject) {
    el.video.srcObject.getTracks().forEach(t => t.stop());
    el.video.srcObject = null;
  }
}

// 停止识别循环（重启时调用，避免多个 rAF 循环叠加）
function stopApp() {
  running = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// 启动失败时，在摄像头区域持久显示错误信息（不会一闪而过）
function showStartError(msg) {
  el.placeholder.innerHTML = `
    <div class="ph-icon">⚠️</div>
    <p style="color:#fff;font-weight:600">启动失败</p>
    <p class="ph-sub" style="max-width:300px">${msg}</p>
    <p class="ph-sub">修复后可重新点击上方按钮重试</p>`;
  el.placeholder.classList.remove('hidden');
}

async function getUserMediaWithFallback() {
  // 优先带约束（前置摄像头+理想尺寸）；部分手机浏览器不支持 facingMode/尺寸，
  // 会抛 OverconstrainedError —— 此时降级为裸请求，保证摄像头能开
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
  // 先挂 onloadedmetadata 再赋值 srcObject，避免竞态
  const ready = new Promise(res => { el.video.onloadedmetadata = res; });
  el.video.srcObject = stream;
  await ready;
  await el.video.play();
  overlay.width = el.video.videoWidth;
  overlay.height = el.video.videoHeight;
  ctx = overlay.getContext('2d');
  el.placeholder.classList.add('hidden');
}

/* ============================================================
 * 2. MediaPipe 初始化（本地 → CDN 回退）
 * ============================================================ */
async function createLandmarker(wasmRoot, modelPath, delegate) {
  const fileset = await FilesetResolver.forVisionTasks(wasmRoot);
  return await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelPath, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

async function initLandmarker() {
  try {
    return await createLandmarker(CONFIG.wasmRoot, CONFIG.modelPath, 'GPU');
  } catch (e) {
    console.warn('本地资源加载失败（可能被浏览器拦截），尝试 GPU/本地 重试…', e);
    try {
      return await createLandmarker(CONFIG.wasmRoot, CONFIG.modelPath, 'CPU');
    } catch (e2) {
      console.warn('本地加载失败，回退到 CDN 资源…', e2);
      return await createLandmarker(CONFIG.cdnWasmRoot, CONFIG.cdnModel, 'GPU');
    }
  }
}

/* ============================================================
 * 3. 主循环
 * ============================================================ */
function loop(now) {
  if (!running || !landmarker) return;
  if (el.video.readyState >= 2 && el.video.currentTime !== lastVideoTime) {
    lastVideoTime = el.video.currentTime;
    try {
      const result = landmarker.detectForVideo(el.video, now);
      handleResult(result, now);
    } catch (err) {
      // 帧级异常（如 GPU 上下文丢失）：停止识别并提示，避免循环静默中断
      console.error('识别帧异常:', err);
      stopApp();
      try { landmarker.close(); } catch (e) { /* ignore */ }
      landmarker = null;
      el.startBtn.disabled = false;
      el.startBtn.textContent = '📷 开启摄像头';
      toast('⚠️ 识别出错，请重新开启：' + (err.message || err));
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

function handleResult(result, now) {
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    el.faceStat.textContent = '人脸: 0';
    ctx && ctx.clearRect(0, 0, overlay.width, overlay.height);
    return;
  }
  el.faceStat.textContent = `人脸: ${result.faceLandmarks.length}`;

  const lm = result.faceLandmarks[0];
  const scores = getScores(result.faceBlendshapes ? result.faceBlendshapes[0] : []);
  const angles = calcAngles(lm);

  // 画网格
  drawLandmarks(lm, angles);

  // 实时角度
  el.angleStat.textContent =
    `roll: ${angles.roll.toFixed(0)}°  pitch: ${angles.pitch.toFixed(0)}  yaw: ${angles.yaw.toFixed(0)}`;

  // 更新数值条（限频 100ms）
  if (now - bsUpdateAt > 100) {
    bsUpdateAt = now;
    updateBars(scores);
  }

  // 动作检测
  const evt = detectEvent(scores, angles, now);

  // 情绪判定
  const emotion = pickEmotion(scores);

  // 情绪变化 → 触发搜索
  if (!lastEmotion || emotion.id !== lastEmotion.id) {
    lastEmotion = emotion;
    setCurrentUI(emotion);
    triggerSearch(emotion.keywords, `${emotion.emoji} ${emotion.name}`, now);
  } else {
    setCurrentUI(emotion);
  }

  // 动作事件 → 触发搜索（与情绪分开，冷却更严格）
  if (evt) {
    logEvent(evt, now);
    triggerSearch(evt.keywords, `${evt.emoji} ${evt.name}`, now, true);
  }
}

/* ---------------- 表情数据 ---------------- */
function getScores(bs) {
  const m = {};
  for (const b of bs) m[b.categoryName] = b.score;
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
    smileL: m.mouthSmileLeft || 0, smileR: m.mouthSmileRight || 0,
    browInnerUpL: m.browInnerUp || 0,
  };
}

/* ---------------- 头部角度（用关键点估算） ---------------- */
function calcAngles(lm) {
  const L = lm[234], R = lm[454], N = lm[1];          // 左耳 / 右耳 / 鼻尖
  const midX = (L.x + R.x) / 2, midY = (L.y + R.y) / 2;
  const dist = Math.hypot(R.x - L.x, R.y - L.y) || 1e-6;
  const roll = Math.atan2(R.y - L.y, R.x - L.x) * 180 / Math.PI;
  return {
    roll,
    pitch: ((N.y - midY) / dist) * 100,
    yaw: ((N.x - midX) / dist) * 100,
  };
}

/* ---------------- 动作事件检测 ---------------- */
function pushSample(arr, v, t) {
  arr.push({ v, t });
  while (arr.length && t - arr[0].t > 1200) arr.shift();
}

// 检测窗口内是否出现“符号翻转≥minFlips 次”的振荡
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
  // 点头 / 摇头：时序振荡
  pushSample(pitchHistory, angles.pitch, now);
  pushSample(yawHistory, angles.yaw, now);
  if (detectOscillation(pitchHistory, 6, 2)) {
    pitchHistory.length = 0;
    return EVENT_OK('nod', now);
  }
  if (detectOscillation(yawHistory, 8, 2)) {
    yawHistory.length = 0;
    return EVENT_OK('shake', now);
  }

  // 歪头：|roll| > 18° 持续 0.5s
  pushSample(rollHistory, angles.roll, now);
  if (Math.abs(angles.roll) > 18) {
    if (!tiltSince) tiltSince = now;
    else if (now - tiltSince > 450) {
      tiltSince = 0;
      rollHistory.length = 0;
      return EVENT_OK('tilt', now);
    }
  } else tiltSince = 0;

  // 眨眼 / 吐舌：瞬时
  if (scores.eyeBlink > 0.6) return EVENT_OK('wink', now);
  if (scores.tongueOut > 0.5) return EVENT_OK('tongue', now);
  return null;

  function EVENT_OK(id, t) {
    const e = EVENTS.find(x => x.id === id);
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
 * 4. UI 更新
 * ============================================================ */
function setCurrentUI(emotion) {
  // 匹配强度实时刷新
  el.confidenceBar.style.width = `${Math.min(100, emotion.score * 100)}%`;
  el.confValue.textContent = `${Math.min(100, Math.round(emotion.score * 100))}%`;
  if (el.emotionName.textContent === emotion.name) return;
  el.emotionEmoji.textContent = emotion.emoji;
  el.emotionName.textContent = emotion.name;
  el.emotionDetail.textContent =
    emotion.id === 'neutral' ? '表情放松中… 试试 微笑 / 张嘴 / 皱眉' : `匹配强度 ${Math.round(emotion.score * 100)}%`;
  el.emotionEmoji.classList.remove('pop');
  void el.emotionEmoji.offsetWidth; // 重触发动画
  el.emotionEmoji.classList.add('pop');
}

function updateBars(s) {
  const bars = [
    ['微笑 😊', s.mouthSmile], ['张嘴 😮', s.jawOpen], ['挑眉 🤨', s.browInnerUp],
    ['皱眉 😠', s.browDown], ['撇嘴 😕', s.mouthFrown], ['眨眼 👁️', s.eyeBlink],
    ['皱鼻 🤢', s.noseSneer], ['吐舌 😜', s.tongueOut],
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

/* ---------------- 绘制 468 点网格 ---------------- */
function drawLandmarks(lm, angles) {
  const cw = overlay.width, ch = overlay.height;
  ctx.clearRect(0, 0, cw, ch);
  const pts = lm.map(p => ({ x: p.x * cw, y: p.y * ch }));

  // 人脸轮廓（青色）
  ctx.strokeStyle = 'rgba(79, 140, 255, 0.85)';
  ctx.lineWidth = 1.5;
  drawConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, pts);

  // 五官轮廓（霓虹粉）
  ctx.strokeStyle = 'rgba(180, 77, 255, 0.85)';
  drawConnections(FaceLandmarker.FACE_LANDMARKS_CONTOURS, pts);

  // 关键点
  ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
  for (const p of pts) ctx.fillRect(p.x - 1, p.y - 1, 2, 2);

  // 虹膜（468-477）
  ctx.fillStyle = 'rgba(80, 220, 255, 0.95)';
  for (let i = 468; i < Math.min(lm.length, 478); i++) {
    ctx.fillRect(lm[i].x * cw - 2, lm[i].y * ch - 2, 4, 4);
  }

  // 歪头指示（右上角）
  if (Math.abs(angles.roll) > 15) {
    ctx.fillStyle = 'rgba(255, 209, 102, 0.95)';
    ctx.font = '16px sans-serif';
    ctx.fillText(`歪头 ${angles.roll.toFixed(0)}°`, 12, 24);
  }
}

function drawConnections(conns, pts) {
  ctx.beginPath();
  for (const c of conns) {
    if (pts[c.start] && pts[c.end]) {
      ctx.moveTo(pts[c.start].x, pts[c.start].y);
      ctx.lineTo(pts[c.end].x, pts[c.end].y);
    }
  }
  ctx.stroke();
}

/* ============================================================
 * 5. Giphy 搜索
 * ============================================================ */
async function triggerSearch(keywords, label, now, isEvent = false) {
  if (now - lastSearchAt < CONFIG.searchCooldownMs) return;
  lastSearchAt = now;
  const query = pick(keywords);
  el.resultQuery.textContent = `“${query}”`;
  setSearchingState();

  const key = getKey();
  if (!key) {
    renderEmpty('🔑 未配置 Giphy API Key — 点右上角「⚙️ 设置」填写');
    el.keyBanner.classList.remove('hidden');
    return;
  }

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}` +
      `&q=${encodeURIComponent(query)}&limit=${CONFIG.limit}&rating=g&lang=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Giphy HTTP ${res.status}`);
    const json = await res.json();
    renderResults(json.data || [], query, label);
  } catch (err) {
    console.error('Giphy 搜索失败:', err);
    renderEmpty('⚠️ 搜索失败（网络不通或 Key 无效），请检查设置');
  }
}

function setSearchingState() {
  el.results.innerHTML = '<div class="hint big-hint"><div class="ph-icon">🔍</div><p>正在搜索…</p></div>';
}

function renderResults(gifs, query, label) {
  if (!gifs.length) {
    renderEmpty('😅 没有搜到结果，换个表情试试');
    return;
  }
  el.results.innerHTML = '';
  for (const g of gifs) {
    const img = g.images && (g.images.fixed_height_small || g.images.preview_gif || g.images.fixed_height);
    const srcOk = img && ((img.url || '').startsWith('http://') || (img.url || '').startsWith('https://'));
    if (!img || !srcOk) continue;
    const card = document.createElement('div');
    card.className = 'result-card';
    const title = esc((g.title || query).slice(0, 32) || query);
    card.innerHTML = `<img src="${img.url}" alt="${esc(g.title || query)}" loading="lazy">
      <div class="caption">${title}</div>`;
    card.onclick = () => openModal(g, query);
    el.results.appendChild(card);
  }
}

function renderEmpty(msg) {
  el.results.innerHTML = `<div class="hint big-hint"><div class="ph-icon">🖼️</div><p>${msg}</p></div>`;
}

/* ---------------- 大图预览 ---------------- */
let currentGifUrl = '';
function openModal(g, query) {
  const img = g.images && (g.images.fixed_height || g.images.downsized_medium || g.images.original);
  currentGifUrl = img ? img.url : '';
  el.modalImg.src = currentGifUrl;
  el.openGiphyBtn.href = g.url || `https://giphy.com/search/${encodeURIComponent(query)}`;
  el.modal.classList.remove('hidden');
}

async function copyGifLink() {
  if (!currentGifUrl) return;
  try {
    await navigator.clipboard.writeText(currentGifUrl);
    toast('✅ 已复制 GIF 链接');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentGifUrl;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('✅ 已复制 GIF 链接');
  }
}

/* ============================================================
 * 6. 设置面板（Giphy API Key）
 * ============================================================ */
function updateKeyStatus() {
  const has = !!getKey();
  el.keyStatus.textContent = has ? 'Key: 已配置 ✓' : 'Key: 未配置';
  el.keyStatus.classList.toggle('ok', has);
  el.keyBanner.classList.toggle('hidden', has);
}

async function testKey() {
  const key = el.keyInput.value.trim();
  el.keyTestResult.className = 'key-test-result';
  if (!key) {
    el.keyTestResult.textContent = '请先粘贴 API Key';
    return;
  }
  el.keyTestResult.textContent = '测试中…';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=test&limit=1&rating=g`, { signal: ctrl.signal });
    if (res.ok) {
      const j = await res.json();
      el.keyTestResult.className = 'key-test-result ok';
      el.keyTestResult.textContent = `✓ Key 有效，可以搜索到 ${(j.data || []).length}+ 个结果`;
    } else {
      el.keyTestResult.className = 'key-test-result err';
      el.keyTestResult.textContent = `✗ Key 无效（HTTP ${res.status}），请检查是否复制完整`;
    }
  } catch {
    el.keyTestResult.className = 'key-test-result err';
    el.keyTestResult.textContent = '✗ 无法连接 Giphy，请检查网络';
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
 * 7. 启动
 * ============================================================ */
function setupUI() {
  el.startBtn.addEventListener('click', async () => {
    // 重启：停止旧的识别循环并释放 AI 模型资源
    stopApp();
    if (landmarker) {
      try { landmarker.close(); } catch (e) { console.warn('关闭模型失败:', e); }
      landmarker = null;
    }
    fpsFrames = 0; fpsTimer = 0; bsUpdateAt = 0;
    el.startBtn.disabled = true;
    el.startBtn.textContent = '⏳ 正在启动…';
    try {
      await initCamera();
      el.startBtn.textContent = '⏳ 加载 AI 模型…';
      landmarker = await initLandmarker();
      el.startBtn.textContent = '🟢 识别中（点击可重启）';
      running = true;
      rafId = requestAnimationFrame(loop);
      toast('🎉 识别已启动！对着摄像头做表情吧');
    } catch (err) {
      console.error(err);
      el.startBtn.disabled = false;
      el.startBtn.textContent = '📷 开启摄像头';
      const msg = (
        err.name === 'NotAllowedError' ? '摄像头权限被拒绝。请在浏览器地址栏点击 🔒 → 网站设置 → 摄像头 → 改为「允许」，然后刷新页面重试'
        : err.name === 'NotFoundError' ? '未找到摄像头，请确认设备有摄像头且未被其他软件占用'
        : err.name === 'SecurityError' ? '当前环境不允许使用摄像头（请用 HTTPS 或 localhost 访问）'
        : err.name === 'TypeError' ? '浏览器不支持摄像头，请换用最新版 Safari / Chrome'
        : err.message || '未知错误，请检查网络后重试');
      toast('⚠️ 启动失败：' + msg);
      showStartError(msg);
    }
  });

  // 设置
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
    toast(key ? '✅ Key 已保存' : '已清除 Key');
  });
  $('testKeyBtn').addEventListener('click', testKey);
  el.keyBannerLink.addEventListener('click', e => { e.preventDefault(); el.settingsBtn.click(); });

  // 弹层关闭
  document.querySelectorAll('.modal-close').forEach(b =>
    b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden')));
  for (const m of [el.modal, el.settingsModal]) {
    m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
  }
  el.copyLinkBtn.addEventListener('click', copyGifLink);

  updateKeyStatus();
}

setupUI();
