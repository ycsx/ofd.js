# basic-viewer.html 使用说明

## 概述

这是一个完整的OFD文档查看器演示页面，展示如何在浏览器中实现OFD文件的上传、解析和渲染功能。

## 功能特性

- ✅ 文件上传和选择
- ✅ OFD文档解析
- ✅ 页面渲染展示
- ✅ 缩放控制（50% - 200%）
- ✅ 文件信息显示（名称、大小、页数）
- ✅ 响应式设计
- ✅ 加载动画和错误处理
- ✅ 文档清空功能

## 文件结构

```
examples/
└── basic-viewer.html          # 本文件 - 完整的查看器示例
```

## 使用方式

### 方式1：直接打开HTML文件（本地开发）

```bash
# Windows
start examples/basic-viewer.html

# macOS
open examples/basic-viewer.html

# Linux
xdg-open examples/basic-viewer.html
```

### 方式2：通过HTTP服务器（推荐）

由于使用了ES6 Module，需要通过HTTP服务器访问。

```bash
# 使用Python 3
python -m http.server 8000

# 使用Node.js http-server
npm install -g http-server
http-server

# 使用Live Server扩展（VSCode）
# 在VSCode中右键点击HTML文件，选择"Open with Live Server"
```

然后访问：`http://localhost:8000/examples/basic-viewer.html`

## 工作原理

### 导入流程

```javascript
// 从相对路径导入库函数
import { 
  parseOfdDocument,    // 解析OFD文件
  renderOfd,           // 渲染文档到DOM
  setPageScale,        // 设置缩放比例
  getPageScale         // 获取当前缩放比例
} from '../index.js';
```

### 使用流程

1. **选择文件**
   - 用户通过input[type="file"]选择OFD文件
   - 触发`change`事件

2. **解析文件**
   ```javascript
   parseOfdDocument({
     ofd: file,                    // File对象
     success: (documents) => { ... }, // 文档数组
     fail: (error) => { ... }      // 解析失败回调
   });
   ```

3. **渲染页面**
   ```javascript
   const pages = renderOfd(screenWidth, ofdDocument);
   pages.forEach(pageDiv => {
     viewer.appendChild(pageDiv);
   });
   ```

4. **交互控制**
   - 缩放滑块：调整显示大小
   - 清空按钮：清除当前文档

## API调用示例

### 解析OFD文件

```javascript
import { parseOfdDocument } from '../index.js';

const file = document.getElementById('fileInput').files[0];

parseOfdDocument({
  ofd: file,
  success: (documents) => {
    console.log('解析成功:', documents);
    documents.forEach(doc => console.log('页数:', doc.pages.length));
  },
  fail: (error) => {
    console.error('解析失败:', error.message);
  }
});
```

### 渲染文档

```javascript
import { renderOfd } from '../index.js';

// 获取返回的DOM元素数组
const pages = renderOfd(1024, ofdDocument);

// 添加到页面
pages.forEach(pageDiv => {
  document.getElementById('viewer').appendChild(pageDiv);
});
```

### 缩放控制

```javascript
import { setPageScale, getPageScale } from '../index.js';

// 设置缩放比例
setPageScale(1.5);  // 150%

// 获取当前缩放比例
const scale = getPageScale();  // 1.5
```

## 关键代码段

### 文件选择处理

```javascript
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // 显示加载动画
  showLoading();

  // 调用库函数解析
  parseOfdDocument({
    ofd: file,
    success: ([doc]) => {
      if (doc) renderDocument(doc);  // 渲染第一个文档
    },
    fail: (error) => {
      showError(error);     // 显示错误
    },
  });
});
```

### 缩放处理

```javascript
scaleSlider.addEventListener('input', (e) => {
  const scale = parseFloat(e.target.value);
  setPageScale(scale);  // 设置缩放比例

  // 重新渲染
  if (currentDocument) {
    const screenWidth = (window.innerWidth - 60) * scale;
    const pages = renderOfd(screenWidth, currentDocument);
    viewer.innerHTML = '';
    pages.forEach((pageDiv) => {
      viewer.appendChild(pageDiv);
    });
  }
});
```

## 状态管理

### 关键状态变量

```javascript
let currentDocument = null;  // 存储当前解析的文档
```

### DOM引用

```javascript
const fileInput = document.getElementById('fileInput');
const scaleSlider = document.getElementById('scaleSlider');
const viewer = document.getElementById('viewer');
const fileStatus = document.getElementById('fileStatus');
const pageCount = document.getElementById('pageCount');
const fileSize = document.getElementById('fileSize');
```

## 错误处理

### 常见错误

1. **模块导入错误**
   ```
   Error: Failed to resolve module specifier "ofd"
   ```
   **解决**：确保使用相对路径 `../index.js` 而不是 npm 包名

2. **CORS错误**（某些浏览器）
   ```
   Error: Cross-Origin Request Blocked
   ```
   **解决**：通过HTTP服务器而不是file://协议访问

3. **解析失败**
   - 检查OFD文件是否有效
   - 查看浏览器控制台错误信息

### 错误处理函数

```javascript
function showError(error) {
  const errorMsg = error.message || '未知错误';
  viewer.innerHTML = `
    <div class="error-box">
      <strong>错误：</strong> ${errorMsg}
    </div>
  `;
  fileStatus.textContent = '加载失败';
  fileStatus.classList.add('status-error');
}
```

## 性能优化

### 当前实现

- ✅ 异步解析（不阻塞UI）
- ✅ 响应式缩放（实时渲染）
- ✅ DOM复用（清空而非创建）

### 建议优化

1. **大文件处理**
   - 实现分页加载
   - 虚拟滚动

2. **内存优化**
   - 页面缓存
   - 垃圾回收

3. **渲染优化**
   - WebWorker处理解析
   - Canvas渲染替代DOM

## 扩展示例

### 添加下载功能

```javascript
function downloadCurrentPage() {
  if (!currentDocument) return;
  
  const page = currentDocument.pages[0];
  const canvas = viewer.querySelector('canvas');
  
  if (canvas) {
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = 'page.png';
    link.click();
  }
}
```

### 添加打印功能

```javascript
function printDocument() {
  if (!currentDocument) return;
  window.print();
}
```

### 添加页面导航

```javascript
function goToPage(pageNum) {
  if (!currentDocument || pageNum < 1 || pageNum > currentDocument.pages.length) {
    return;
  }
  
  const page = currentDocument.pages[pageNum - 1];
  // 重新渲染该页
}
```

## 浏览器兼容性

✅ Chrome 50+
✅ Firefox 45+
✅ Safari 10+
✅ Edge 15+

更多详见 [BROWSER_COMPATIBILITY.md](../BROWSER_COMPATIBILITY.md)

## 常见问题

**Q: 为什么必须使用HTTP服务器？**
A: 由于安全政策，浏览器不允许从`file://`协议直接加载ES6模块。

**Q: 支持大文件吗？**
A: 支持，但超过100MB会较慢。建议使用虚拟滚动。

**Q: 如何集成到我的项目中？**
A: 参考[examples/README.md](README.md)的集成指南。

**Q: 支持离线使用吗？**
A: 支持。文件加载后无需网络连接。

## 相关资源

- 📖 [完整README](../README.md)
- 📋 [API文档](../README.md#api-文档)
- 🔗 [GitHub仓库](https://github.com/DLTech21/ofd.js)
- 💡 [更多示例](README.md)

---

**最后更新**: 2026年6月26日
