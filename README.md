# 😀 表情包雷达 — 表情/动作识别 · 表情包匹配

摄像头**实时识别**你的表情和动作（微笑、大笑、惊讶、生气、难过、嫌弃、害怕，
以及点头、摇头、歪头、眨眼、吐舌），自动从 **Giphy** 搜索**最接近的表情包**。

> 用于课程展示 / 小组演示。全部识别在浏览器本地完成，画面不上传。

---

## 🌐 发布到公网（推荐：别人拿到链接一键打开，你无需跑服务器）

把网站发到 GitHub Pages，得到 `https://你的用户名.github.io/face-meme/`，
**任何人**（电脑/手机）打开链接就能用，无需装 Python、无需连你的网络。

### 第 1 步：准备 Giphy Key（一次性）

1. 按上文申请到 Giphy API Key 后，用编辑器打开 `app.js`
2. 找到这行并填入你的 Key：

```js
const DEFAULT_GIPHY_KEY = '';
// 改成 ↓
const DEFAULT_GIPHY_KEY = '你的key';
```

3. 保存。这样**所有访问者免配置**即可搜索表情包
   （⚠️ 网站公开后此 Key 人人可见，免费额度仅供课堂演示，够用）

### 第 2 步：上传到 GitHub（任选一种）

**方式 A：网页拖拽（零命令行，推荐）**
1. 注册/登录 https://github.com
2. 右上角 **+** → **New repository** → 仓库名填 `face-meme` → **Public** → 不要勾选任何初始化项 → **Create repository**
3. 进入仓库 → **Add file** → **Upload files** → 把 `face-meme/` 文件夹里的**所有内容**（含 `assets/` 整个文件夹）拖进去
4. 等上传完 → 点 **Commit changes**

**方式 B：命令行推送（项目已初始化 git）**
```bash
cd face-meme
git remote add origin https://github.com/你的用户名/face-meme.git
git branch -M main
git push -u origin main
```

### 第 3 步：开启 Pages 并访问

1. 仓库页面 → **Settings** → 左侧 **Pages**
2. **Build and deployment** → Source 选 **Deploy from a branch** → Branch 选 `main` / `root` → **Save**
3. 等 1~2 分钟，访问（把用户名换掉）：
   **`https://你的用户名.github.io/face-meme/`**
4. 打开后点「📷 开启摄像头」，浏览器会询问权限，点**允许**即可
   （公网必须 HTTPS，GitHub Pages 已自动提供；摄像头画面仍只在访问者本地处理）

**以后更新**：改了代码后重新上传/推送，Pages 会自动重新发布（约 1 分钟生效）。

## 📤 备选：局域网 / 发文件（不需要公网账号时）

整个 `face-meme/` 文件夹直接压缩打包（微信/QQ/优盘）发过去即可，里面已包含全部 AI 模型（约 23MB，无需对方下载任何依赖）。

**对方电脑有 Python 3**（大学机房基本都有）：
- Windows：解压后双击 **`启动服务器.bat`**，再打开 `http://localhost:8000`
- macOS / Linux：双击 **`start.sh`**（或在终端 `./start.sh`）

> 对方没有 Python 3？两种办法：
> 1. 让对方装：https://www.python.org/downloads/ （安装时勾选 "Add Python to PATH"）
> 2. **最省事**：你自己电脑起服务器，把地址 `http://<你的IP>:8000` 发给对方，手机/电脑连**同一 WiFi** 直接访问，对方什么都不用装

> ⚠️ Key 提示：若你在 `app.js` 的 `DEFAULT_GIPHY_KEY` 填了 Key，对方打开即用；
> 若留空，对方需在右上角「⚙️ 设置」里填一次自己的 Key（存各人浏览器，不随文件传输）

> ⚠️ 不要直接双击 `index.html` 打开 —— 浏览器会拦截本地 AI 模型加载，
> 必须通过上面的服务器方式访问（这是浏览器安全策略，不是 bug）。

## 🚀 快速开始

```bash
# 1. 进入项目文件夹
cd face-meme

# 2. 启动本地服务器（Mac / Windows 都自带 python3）
python3 serve.py

# 3. 浏览器打开
#    本机:   http://localhost:8000
#    局域网: http://<本机IP>:8000   （手机/同学的电脑连同一 WiFi 即可访问）
```

> ⚠️ **不要直接双击 index.html 打开** —— 浏览器会拦截本地 AI 模型加载，
> 必须通过上面的服务器方式访问（这是浏览器安全策略，不是 bug）。

## 🔑 配置 Giphy API Key（必做，只需 1 分钟）

表情包搜索来自 Giphy 免费 API，需要申请一个 Key：

1. 打开 <https://developers.giphy.com/dashboard/> ，用 Google / GitHub 账号登录
2. 点击 **Create an App** → 产品类型选 **API** → 随便填个名字（如 `meme-radar`）→ 创建
3. 创建后页面显示一串 **API Key**，复制它
4. 打开网站右上角 **⚙️ 设置** → 粘贴 Key → 点 **测试 Key**（显示 ✓ 即成功）→ **保存**

Key 只保存在你的浏览器本地（localStorage），不会上传到任何地方。
如果只是演示识别流程、不需要搜索图片，也可以不配 Key，页面其余功能照常工作。

---

## 🎬 演示脚本（给老师展示时照着说）

| 步骤 | 操作 | 页面表现 |
| --- | --- | --- |
| 1 | 点「📷 开启摄像头」，允许权限 | 出现实时人脸网格 + FPS 帧率 |
| 2 | 微笑 😄 | 右侧显示「开心」+ 匹配强度条 |
| 3 | 张大嘴 😮 | 显示「惊讶」 |
| 4 | 皱眉抿嘴 😠 | 显示「生气」 |
| 5 | 歪头 🙃 | 事件栏记录「歪头」+ 搜索 confused |
| 6 | 摇头 / 点头 | 事件栏记录「摇头」「点头」（需连续摇 2 下） |
| 7 | 吐舌 😜 / 眨眼 😉 | 事件栏记录 + 搜索对应表情包 |
| 8 | 点击任意表情包 | 弹出大图，可一键复制 GIF 链接 |

**讲解要点**：识别用 Google MediaPipe（面部 468 个关键点 + 52 种微表情数值），
全在本地浏览器运行；只有表情包搜索请求发往 Giphy。

## 🧠 识别原理（PPT 可用素材）

- **MediaPipe FaceLandmarker**：实时检测面部 **478 个关键点**（468 人脸 + 10 虹膜）
- **Blendshapes（52 种微表情数值）**：嘴部 17 种、眉毛 4 种、眼睛 14 种、鼻/颊等
- 本项目用它们组合出情绪：微笑/张嘴→开心大笑、挑眉+张嘴→惊讶、皱眉+抿嘴→生气……
- 动作识别：利用头部关键点几何关系估算 **roll / pitch / yaw**（歪头/点头/摇头），
  对点头摇头做 **1.2 秒滑动窗口的振荡检测**（连续方向翻转 ≥ 2 次判定）

## 🗂️ 文件结构

```
face-meme/
├── index.html          # 页面结构
├── style.css           # 样式
├── app.js              # 识别 + 情绪映射 + 动作检测 + Giphy 搜索
├── serve.py            # 本地服务器（自带正确 MIME）
├── 启动服务器.bat      # Windows 一键启动
├── start.sh            # macOS / Linux 一键启动
├── assets/             # 已打包的 AI 资源（无需网络，共 ~18MB）
│   ├── face_landmarker.task        # MediaPipe 模型 (3.7MB)
│   ├── vision_bundle.mjs           # MediaPipe JS 库
│   └── wasm/                       # 推理引擎（WASM）
└── README.md
```

**打包带走**：整个 `face-meme/` 文件夹拷贝到优盘/任何电脑，装好依赖？不需要——
`assets/` 已包含全部 AI 资源，只要有 python3 和网络（搜表情包）就能跑。

## ❓ 常见问题

| 问题 | 解决 |
| --- | --- |
| 页面空白/黑色 | 确认是用 `python3 serve.py` 打开的，不是双击 html |
| 点了按钮没反应 | 检查浏览器是否允许摄像头；Chrome 地址栏左侧 🔒 可管理权限 |
| 模型加载失败 | 提示会自动回退到 CDN 加载，需联网；请稍等几秒 |
| 搜不到表情包 | 在「⚙️ 设置」里点「测试 Key」，确认 Key 有效；或检查网络 |
| 手机打不开 | 手机与电脑连**同一 WiFi**；Windows 需在防火墙允许 python |
| 端口被占用 | 改 `serve.py` 里 `PORT = 8000` 为其他值，如 `8001` |

## 🔒 隐私说明

- 摄像头画面**只在你本地浏览器**处理（MediaPipe WASM 推理），不会上传
- 唯一的外部请求是：识别出情绪后，把**关键词**（如 `happy`）发给 Giphy 搜索表情包
- API Key 仅存本机浏览器 localStorage

## 技术栈

- [MediaPipe Tasks Vision (FaceLandmarker)](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) — 人脸关键点 + 微表情
- [Giphy API](https://developers.giphy.com/) — 表情包搜索
- 纯前端：HTML + CSS + JavaScript (ES Modules)，零构建工具
