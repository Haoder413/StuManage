<template>
  <div class="dashboard">
    <div class="control-panel">
      <div class="logo-area">
        <img :src="defaultImageSrc" class="logo-image" />
      </div>
      <h2>⚙️ 电动车头盔检测系统</h2>

      <div class="control-group">
        <label>1. 选择 AI 模型</label>
        <select v-model="selectedModel" @change="switchModel" :disabled="isSwitching">
          <option value="yolo26n">👷 yolo26n</option>
          <option value="yolov8n">👷 yolov8n </option>
        </select>
        <p style="margin-top: 10px; font-size: 14px; color: #67c23a;">
          🟢 当前运行引擎: <strong>{{ selectedModel === 'yolo26n' ? 'yolo26n' : 'yolov8' }}</strong>
        </p>
      </div>

      <div class="control-group">
        <label>🎥 选择物理摄像头</label>
        <select v-model="selectedCamera" @change="startCamera">
          <option v-for="camera in cameraList" :key="camera.deviceId" :value="camera.deviceId">
            {{ camera.label || '未知摄像头' }}
          </option>
        </select>
      </div>

      <div class="control-group">
        <label>2. 实时视频流</label>
        <div class="button-group">
          <button @click="startCamera" class="btn primary">📷 开启摄像头</button>
          <button @click="handleStopStream" class="btn danger">🛑 停止画面</button>
        </div>
      </div>

      <div class="control-group">
        <label>3. 本地文件检测</label>
        <div class="button-group column">
          <button @click="$refs.videoInput.click()" class="btn outline">🎞️ 上传本地视频</button>
          <input type="file" ref="videoInput" accept="video/*" style="display: none;" @change="handleVideoUpload" />

          <button @click="$refs.imageInput.click()" class="btn outline">🖼️ 批量上传图片</button>
          <input type="file" ref="imageInput" accept="image/*" multiple style="display: none;" @change="handleImageUpload" />

        </div>
      </div>

      <div class="control-group">
        <label>4. 数据中心</label>
        <div class="button-group">
          <button @click="fetchViolations" class="btn primary" style="background-color: #e6a23c; color: white; border: none;">
            🗄️ 查看违规记录
          </button>
        </div>
      </div>
    </div>

    <!-- 🆕 右侧显示区：画面卡片居中 -->
    <div class="display-area">

      <!-- 🆕 默认状态：显示占位提示 -->
      <div v-show="displayMode === 'default'" class="screen-wrapper default-screen">
        <div class="placeholder-content">
          <div class="placeholder-icon">🎥</div>
          <p class="placeholder-text">等待开启摄像头或上传文件</p>
        </div>
      </div>

      <!-- 摄像头实时画面 -->
      <div ref="screenWrapperRef" v-show="displayMode === 'stream'" class="screen-wrapper">
        <video ref="videoRef" autoplay playsinline muted loop class="video-layer"></video>
        <canvas ref="canvasRef" width="640" height="480" class="canvas-layer"></canvas>
      </div>

      <div v-show="displayMode === 'gallery'" class="gallery-wrapper">
        <h3 v-if="isLoading">⏳ 正在努力检测中，请稍候...</h3>
        <div class="image-grid">
          <img v-for="(imgSrc, index) in processedImages" :key="index" :src="imgSrc" class="result-image" />
        </div>
      </div>

      <div v-show="displayMode === 'history'" class="history-wrapper">
        <div class="history-header">
          <h3>🚨 违规抓拍历史记录</h3>
          <button @click="fetchViolations" class="btn outline">🔄 刷新数据</button>
        </div>

        <h3 v-if="isLoadingHistory" style="text-align: center; color: #666;">⏳ 正在读取数据库...</h3>

        <div class="table-container" v-else>
          <table class="violation-table">
            <thead>
            <tr>
              <th>记录 ID</th>
              <th>抓拍时间</th>
              <th>AI 置信度</th>
              <th>现场截图 (点击放大)</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="record in violationRecords" :key="record.id">
              <td># {{ record.id }}</td>
              <td>{{ record.timestamp }}</td>
              <td>
                  <span style="color: #f56c6c; font-weight: bold;">
                    {{ (record.confidence * 100).toFixed(1) }}%
                  </span>
              </td>
              <td>
                <img :src="record.image_url" class="thumbnail" alt="违规抓拍" @click="openImage(record.image_url)" />
              </td>
            </tr>
            <tr v-if="violationRecords.length === 0">
              <td colspan="4" style="text-align: center; padding: 30px; color: #999;">暂无违规记录</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// ==========================================
// 1. 响应式变量与状态定义
// ==========================================
const videoRef = ref(null)
const canvasRef = ref(null)
const screenWrapperRef = ref(null)
const cameraList = ref([])
const selectedCamera = ref('')
const displayMode = ref('default')  // 🆕 默认显示图片
const processedImages = ref([])
const isLoading = ref(false)
const selectedModel = ref('yolo26n')
const isSwitching = ref(false)

// 🆕 图片资源路径
const defaultImageSrc = '/图1.jpg'
const bgImageSrc = '/背景图.jpg'

let ws = null
let frameCounter = 0 // 用于追踪每一帧的编号

// ==========================================
// 2. 生命周期钩子
// ==========================================
onMounted(async () => {
  console.log("🚀 [系统启动] 正在初始化检测台...")
  displayMode.value = 'default' // 默认显示图片，不开摄像头
  connectWebSocket()
  await getCameras()            // 只获取摄像头列表，不自动打开
})

onUnmounted(() => {
  console.log("👋 [系统关闭] 正在释放资源...")
  stopStream()
  if (ws) {
    ws.close()
    ws = null
  }
})

// ==========================================
// 3. 核心功能函数
// ==========================================

// --- WebSocket 通信逻辑 ---
const connectWebSocket = () => {
  console.log("🌐 [网络] 正在连接 WebSocket: ws://127.0.0.1:8000/ws/detect")
  ws = new WebSocket("ws://127.0.0.1:8000/ws/detect")

  ws.onopen = () => {
    console.log("✅ [网络] WebSocket 已连接，通信管道开启。")
    if (displayMode.value === 'stream') {
      sendSingleFrame() // 连接成功后发送首帧启动循环
    }
  }
// WebSocket 接收消息事件：后端一发数据，这里立刻触发
  ws.onmessage = (event) => {
    //把后端发来的 JSON字符串转成 JS 数组
    const detections = JSON.parse(event.data)

    // 只有在视频流模式下才处理并继续循环
    if (displayMode.value === 'stream') {
      console.log(`📥 [帧 ${frameCounter}] 收到结果: ${detections.length} 个目标`)
      // 核心渲染：把后端给的坐标 → 检测框画到视频上（未戴头盔红框、戴了绿框）
      drawDetections(detections)

      //核心：一问一答机制。收到结果后再请求下一帧，防止阻塞
      requestAnimationFrame(sendSingleFrame)
    }
  }

  ws.onerror = (err) => console.error("❌ [网络] WebSocket 发生错误:", err)
  ws.onclose = () => console.warn("🔌 [网络] WebSocket 连接已关闭")
}

// --- 摄像头管理逻辑 ---
const getCameras = async () => {
  try {
    // 请求权限，拿到流后立即关闭（只是为了让 enumerateDevices 返回带标签的设备列表）
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
    tempStream.getTracks().forEach(track => track.stop()) // 用完立即释放

    const devices = await navigator.mediaDevices.enumerateDevices()
    cameraList.value = devices.filter(device => device.kind === 'videoinput')
    console.log("📸 [硬件] 识别到摄像头数量:", cameraList.value.length)

    if (cameraList.value.length > 0) {
      selectedCamera.value = cameraList.value[0].deviceId
    }
  } catch (err) {
    console.error("❌ [硬件] 获取摄像头列表失败:", err)
  }
}

const startCamera = async () => {
  console.log("📷 [操作] 尝试开启摄像头预览...")
  displayMode.value = 'stream'
  stopStream() // 开启前先确保旧流已清理

  try {
    const constraints = {
      video: {
        deviceId: selectedCamera.value ? { exact: selectedCamera.value } : undefined,
        width: 640,
        height: 480
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      videoRef.value.play()
      // 等待视频元数据加载后自适应容器尺寸
      videoRef.value.onloadedmetadata = () => fitWrapperToVideo()
      console.log("✅ [视频] 摄像头已激活")
      sendSingleFrame()
    }
  } catch (err) {
    console.error("❌ [视频] 开启失败:", err)
    alert("无法调用该摄像头，请检查权限或连接！")
  }
}

const stopStream = () => {
  console.log("🛑 [操作] 停止所有视频流并清理画布")

  if (videoRef.value) {
    // 1. 清理摄像头硬件占用
    if (videoRef.value.srcObject) {
      videoRef.value.srcObject.getTracks().forEach(track => track.stop())
      videoRef.value.srcObject = null
    }
    // 2. 清理本地视频文件引用
    if (videoRef.value.src) {
      videoRef.value.pause()
      videoRef.value.src = ""
      videoRef.value.load()
    }
  }

  // 3. 清空 Canvas 上的残留框
  if (canvasRef.value) {
    const ctx = canvasRef.value.getContext('2d')
  }
}

// 🎯 根据视频实际分辨率动态调整容器尺寸，自适应横屏/竖屏
const fitWrapperToVideo = () => {
  const video = videoRef.value
  const wrapper = screenWrapperRef.value
  if (!video || !wrapper) return

  const vw = video.videoWidth
  const vh = video.videoHeight
  if (vw === 0 || vh === 0) return

  const maxW = 640
  const maxH = window.innerHeight * 0.7  // 不超过 70% 视口高度

  let w, h
  if (vw / vh > maxW / maxH) {
    // 横屏/宽视频 — 宽度优先
    w = Math.min(vw, maxW)
    h = w * (vh / vw)
  } else {
    // 竖屏/窄视频 — 高度优先
    h = Math.min(vh, maxH)
    w = h * (vw / vh)
  }

  wrapper.style.width = `${Math.round(w)}px`
  wrapper.style.height = `${Math.round(h)}px`

  // Canvas 内部分辨率同步为 CSS 像素尺寸
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = Math.round(w)
    canvas.height = Math.round(h)
  }
}
// 🆕 停止画面按钮专用：停止视频流并返回默认图片
const handleStopStream = () => {
  stopStream()
  displayMode.value = 'default'
}

// --- 核心推流逻辑 ---
//把视频画面一帧一帧截成 JPG → 通过 WebSocket 发给后端，实现低延迟视频流传输
const sendSingleFrame = () => {
  //三层熔断器：避免报错、避免无效推流、避免黑屏帧
  // 🛡️ 熔断器 1: 检查基础环境。WebSocket 没连接 / 不在推流模式 → 不发
  if (!ws || ws.readyState !== WebSocket.OPEN || displayMode.value !== 'stream') {
    return
  }

  const video = videoRef.value

  // 🛡️ 熔断器 2: 检查视频流是否真正存在且在运行。视频源不存在 / 已关闭 → 停止推流
  if (!video || (!video.srcObject && !video.src)) {
    console.log("⏹️ [停止] 检测到监控源已关闭，停止发送。")
    return
  }

  // 🛡️ 熔断器 3: 检查视频元素是否已加载画面。视频还没加载出画面 → 等 100ms 再重试
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    setTimeout(sendSingleFrame, 100) // 还没准备好就等 100ms 再试
    return
  }

  // 开始截图
  //// 创建一个离屏 canvas，使用视频实际分辨率推流
  const offscreenCanvas = document.createElement('canvas')
  const vw = video.videoWidth
  const vh = video.videoHeight
  offscreenCanvas.width = vw
  offscreenCanvas.height = vh
  //// 获取 2D 绘图上下文
  const ctx = offscreenCanvas.getContext('2d')
  // 按视频原始尺寸截取画面发送给后端
  ctx.drawImage(video, 0, 0, vw, vh)
//canvas 转成 Blob（二进制图片）
// 参数：图片格式 = image/jpeg，质量 0.8（80%，平衡清晰度/体积）
  offscreenCanvas.toBlob(async (blob) => {
    if (blob && blob.size > 0) {
      frameCounter++
      // Blob 转 ArrayBuffer（WebSocket 支持的二进制格式）
      const arrayBuffer = await blob.arrayBuffer()

      // 只在调试时开启这行，避免性能浪费
      // console.log(`📤 [帧 ${frameCounter}] 发送大小: ${Math.round(blob.size / 1024)} KB`)
      // 发送二进制数据到服务端

      ws.send(arrayBuffer)
    }
  }, 'image/jpeg', 0.8)
}

// --- 绘图与模型切换 ---
//接收AI 检测结果，在 Canvas 画布上画出：检测框分类标签（戴安全帽 / 没戴安全帽）颜色区分（绿色 = 戴了，红色 = 没戴）
const drawDetections = (detections) => {
  const canvas = canvasRef.value
  const video = videoRef.value
  if (!canvas || !video) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 计算 object-fit: cover 的映射：视频原始坐标系 → canvas 可见区域
  const vw = video.videoWidth
  const vh = video.videoHeight
  const cw = canvas.width    // 640
  const ch = canvas.height   // 480
  // cover 算法：取最大缩放比，让视频完全覆盖容器
  const scale = Math.max(cw / vw, ch / vh)
  const offsetX = (cw - vw * scale) / 2
  const offsetY = (ch - vh * scale) / 2

  detections.forEach(det => {
    const [x1, y1, x2, y2] = det.box
    const isHelmet = det.cls === 0

    // 从视频原始坐标系映射到 Canvas CSS 像素坐标
    const bx1 = x1 * scale + offsetX
    const by1 = y1 * scale + offsetY
    const bx2 = x2 * scale + offsetX
    const by2 = y2 * scale + offsetY

    // 裁剪到 Canvas 可见区域内
    const cx1 = Math.min(cw, Math.max(0, bx1))
    const cy1 = Math.min(ch, Math.max(0, by1))
    const cx2 = Math.min(cw, Math.max(0, bx2))
    const cy2 = Math.min(ch, Math.max(0, by2))
    if (cx2 <= cx1 || cy2 <= cy1) return

    ctx.strokeStyle = isHelmet ? '#00FF00' : '#FF0000'
    ctx.lineWidth = 3
    ctx.strokeRect(cx1, cy1, cx2 - cx1, cy2 - cy1)

    const label = `${isHelmet ? 'Helmet' : 'No Helmet'} ${(det.conf*100).toFixed(1)}%`
    ctx.fillStyle = isHelmet ? '#00FF00' : '#FF0000'
    ctx.fillRect(cx1, cy1 - 25, 130, 25)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '16px Arial'
    ctx.fillText(label, cx1 + 5, cy1 - 7)
  })
}

const switchModel = async () => {
  if (isSwitching.value) return
  isSwitching.value = true
  console.log(`🔄 [模型] 切换中: ${selectedModel.value}...`)

//--- POST 请求本地接口，传递选中模型名，成功解析返回数据并打印提示

  try {
    const response = await fetch('http://127.0.0.1:8000/api/model/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: selectedModel.value })
    })
    const data = await response.json()
    console.log("✅ [模型] 切换回复:", data.message)
  } catch (error) {
    console.error('❌ [模型] 切换异常:', error)
  } finally {
    isSwitching.value = false
  }
}

// --- 文件上传处理 ---
//上传视频
//视频上传处理函数，用户选择视频文件后自动触发，event 是上传事件，里面包含选中的文件
const handleVideoUpload = (event) => {
  //切换页面显示模式为「视频流模式」
  displayMode.value = 'stream'
  //从上传事件中拿到用户选择的视频文件
  const file = event.target.files[0]
  if (!file) return

  stopStream()
  //给本地视频文件生成一个临时可播放地址
  const videoURL = URL.createObjectURL(file)
  if(videoRef.value) {
    videoRef.value.srcObject = null
    //把临时视频地址赋值给视频标签
    videoRef.value.src = videoURL
    //自动开始播放视频
    videoRef.value.play()
    // 等待视频元数据加载后自适应容器尺寸
    videoRef.value.onloadedmetadata = () => fitWrapperToVideo()
    console.log("🎞️ [文件] 本地视频已载入")
    sendSingleFrame()
  }
  event.target.value = ''
}
//上传照片
//这是异步函数（因为要发请求）从上传事件里拿到用户选中的图片文件列表
const handleImageUpload = async (event) => {
  const files = event.target.files
  if (!files || files.length === 0) return

  stopStream()
  displayMode.value = 'gallery'
  isLoading.value = true
  processedImages.value = []

  const formData = new FormData()
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i])
  }

  console.log(`🖼️ [批量] 正在检测 ${files.length} 张图片...`)
  try {
    const response = await fetch('http://127.0.0.1:8000/api/detect/images', {
      method: 'POST',
      body: formData
    })
    if (response.ok) {
      const data = await response.json()
      processedImages.value = data.processed_images
    }
  } catch (error) {
    console.error("❌ [批量] 检测失败:", error)
  } finally {
    isLoading.value = false
    event.target.value = ''
  }
}

// ==========================================
// 新增：违规记录查看相关逻辑
// ==========================================
const violationRecords = ref([])
const isLoadingHistory = ref(false)

// 向 Python 后端请求违规数据
const fetchViolations = async () => {
  console.log("🗄️ [数据] 正在请求历史违规记录...")

  // 1. 停止视频流，切换右侧显示模式
  stopStream()
  displayMode.value = 'history'
  isLoadingHistory.value = true
  violationRecords.value = []

  try {
    // 2. 发起 GET 请求去拉取数据
    const response = await fetch('http://127.0.0.1:8000/api/violations')
    if (response.ok) {
      const data = await response.json()
      violationRecords.value = data.data // 赋值给表格绑定的数组
      console.log(`✅ [数据] 成功获取 ${violationRecords.value.length} 条记录`)
    } else {
      console.error("❌ [数据] 后端返回错误状态码")
    }
  } catch (error) {
    console.error("❌ [数据] 请求数据库接口失败:", error)
    alert("无法连接数据库，请检查后端服务是否启动！")
  } finally {
    isLoadingHistory.value = false
  }
}

// 点击缩略图，在新标签页打开高清原图
const openImage = (url) => {
  window.open(url, '_blank')
}
</script>

<style scoped>
/* ==========================================
   方案 A — 毛玻璃 + 深色主题
========================================== */

/* 🌑 整页底色 + 背景图氛围 */
.dashboard {
  display: flex;
  gap: 24px;
  padding: 24px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  min-height: 100vh;
  /* 半透明深色渐变叠加在背景图上，让花草底图清晰可见 */
  background:
    linear-gradient(135deg, rgba(10, 15, 20, 0.50) 0%, rgba(20, 30, 35, 0.50) 100%),
    url('/背景图.jpg') center / cover no-repeat fixed;
  color: #e0e0e0;
}

/* 🪟 毛玻璃控制面板 */
.control-panel {
  width: 280px;
  background: rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 24px 20px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}
.control-panel h2 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.control-group {
  margin-top: 22px;
}

.control-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.55);
}

/* 🎛️ 下拉框 */
select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}
select:focus {
  border-color: rgba(100, 180, 255, 0.6);
}
select:disabled {
  opacity: 0.4;
}

/* 🔘 按钮 */
.button-group {
  display: flex;
  gap: 10px;
}
.button-group.column {
  flex-direction: column;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
}
.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.btn:active {
  transform: translateY(0);
}
.btn.primary {
  background: linear-gradient(135deg, #4fc3f7, #29b6f6);
  color: #0d2137;
}
.btn.danger {
  background: rgba(244, 67, 54, 0.25);
  color: #ff8a80;
  border: 1px solid rgba(244, 67, 54, 0.3);
}
.btn.outline {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #c0c0d0;
}
.btn.outline:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

/* 📺 右侧显示区 */
.display-area {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12px;
}

/* 📦 摄像/图片画面卡片 */
.screen-wrapper {
  position: relative;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05),
    0 16px 48px rgba(0, 0, 0, 0.4);
}

/* 默认占位 — 暗色居中 */
.default-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 640px;
  height: 480px;
  background: rgba(0, 0, 0, 0.55);
}
.placeholder-content {
  text-align: center;
}
.placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}
.placeholder-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.35);
  margin: 0;
  letter-spacing: 1px;
}

/* 🏷️ 控制面板 Logo */
.logo-area {
  text-align: center;
  margin-bottom: 12px;
  padding: 8px 0 4px;
}
.logo-image {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 30px rgba(79, 195, 247, 0.15);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.logo-image:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.5), 0 0 40px rgba(79, 195, 247, 0.25);
}

/* 视频 + Canvas */
.video-layer {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.canvas-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 🖼️ 批量图片画廊 — 暗色卡片 */
.gallery-wrapper {
  width: 100%;
  max-width: 800px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 24px;
  overflow-y: auto;
  max-height: 80vh;
}
.gallery-wrapper h3 {
  color: #c0c0d0;
}
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  margin-top: 14px;
}
.result-image {
  width: 100%;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s;
}
.result-image:hover {
  transform: scale(1.03);
}

/* 🗄️ 数据表格 — 暗色 */
.history-wrapper {
  width: 100%;
  max-width: 820px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  max-height: 85vh;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 12px;
}
.history-header h3 {
  color: #ffffff;
  margin: 0;
}

.table-container {
  overflow-y: auto;
  flex: 1;
}

.violation-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}
.violation-table th {
  background: rgba(255, 255, 255, 0.06);
  padding: 12px 14px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
  z-index: 1;
}
.violation-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #c0c0d0;
  vertical-align: middle;
}
.violation-table tr:hover td {
  background: rgba(255, 255, 255, 0.03);
}

.thumbnail {
  height: 56px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: transform 0.2s, border-color 0.2s;
}
.thumbnail:hover {
  transform: scale(1.12);
  border-color: #4fc3f7;
}
</style>
