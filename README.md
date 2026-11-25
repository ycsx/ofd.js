# @ycsx/ofdjs

一个用于读取和渲染OFD（开放式文档格式）文件的JavaScript库。

[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@ycsx/ofdjs?label=npm)](https://www.npmjs.com/package/@ycsx/ofdjs)

## 功能特性

- 📄 **OFD 文档解析** - 完整支持OFD格式文件的解析和加载
- 🎨 **文档渲染** - 支持多种渲染模式（Template、PathContent）
- 📐 **缩放控制** - 灵活的页面缩放功能
- ✍️ **签名验证** - 支持OFD电子签名的验证
- 🖼️ **JBIG2支持** - 支持JBIG2压缩图像
- 🔧 **丰富的API** - 提供灵活的编程接口

## 安装

使用npm安装：

```bash
npm install @ycsx/ofdjs
```

或使用yarn：

```bash
yarn add @ycsx/ofdjs
```

## 快速开始

### 基础使用

```javascript
import { parseOfdDocument, renderOfd } from '@ycsx/ofdjs';

// 1. 解析OFD文件
parseOfdDocument({
  ofd: 'path/to/file.ofd',  // 文件路径、File对象或ArrayBuffer
  success: (ofdDocument) => {
    console.log('解析成功', ofdDocument);
    
    // 2. 渲染文档到页面
    const screenWidth = window.innerWidth;
    const pages = renderOfd(screenWidth, ofdDocument[0]);
    
    // 3. 添加到DOM
    pages.forEach(pageDiv => {
      document.getElementById('container').appendChild(pageDiv);
    });
  },
  fail: (error) => {
    console.error('解析失败', error);
  }
});
```

### 使用缩放功能

```javascript
import { parseOfdDocument, renderOfdByScale, setPageScale, getPageScale } from '@ycsx/ofdjs';

// 设置缩放比例（1.0 = 100%）
setPageScale(1.2);

parseOfdDocument({
  ofd: file,
  success: (ofdDocument) => {
    // 根据设置的缩放比例渲染
    const pages = renderOfdByScale(ofdDocument[0]);
    document.getElementById('container').appendChild(...pages);
  }
});

// 获取当前缩放比例
console.log('Current scale:', getPageScale());
```

### 原生 HTML 中使用

仓库里的 `examples/basic.html` 就是一个完整的原生浏览器示例。它演示了：

- 选择本地 OFD 文件
- 调用 `parseOfdDocument()` 解析文档
- 使用 `renderPage()` 渲染当前页
- 使用 `calPageBox()` 计算页面尺寸
- 手动实现分页与缩放

如果你是直接引用源码入口，推荐这样写：

```html
<script type="module">
  import { parseOfdDocument, renderPage, calPageBox } from '../index.js';

  let currentDocument = null;
  let currentPageIndex = 0;
  let currentScale = 1;

  function getOFDDocument() {
    return currentDocument?.document || currentDocument;
  }

  function getRenderWidth() {
    const container = document.getElementById('ofdContainer');
    return Math.max((container.clientWidth || 1024) * currentScale, 320);
  }

  function renderCurrentPage() {
    const container = document.getElementById('ofdContainer');
    container.innerHTML = '';

    if (!currentDocument?.pages?.length) return;

    const doc = getOFDDocument();
    const page = currentDocument.pages[currentPageIndex];
    const box = calPageBox(getRenderWidth(), doc, page);

    const pageDiv = document.createElement('div');
    pageDiv.style.cssText = `
      position: relative;
      width: ${box.w}px;
      height: ${box.h}px;
      background: white;
    `;

    renderPage(
      pageDiv,
      page,
      currentDocument.tpls,
      currentDocument.fontResObj,
      currentDocument.drawParamResObj,
      currentDocument.multiMediaResObj
    );

    container.appendChild(pageDiv);
  }

  document.getElementById('ofdInput').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    parseOfdDocument({
      ofd: file,
      success: (ofdDocument) => {
        currentDocument = ofdDocument;
        currentPageIndex = 0;
        currentScale = 1;
        renderCurrentPage();
      },
      fail: (error) => {
        console.error('文件解析失败', error);
      }
    });
  });

  document.getElementById('scaleInput').addEventListener('input', (event) => {
    currentScale = Number(event.target.value) / 100;
    if (currentDocument) renderCurrentPage();
  });
</script>
```

如果你想直接使用打包后的 `dist/ofd.min.js`，则不要用 `import`，而是用普通 `<script>` 引入后从全局对象取 API：

```html
<script src="../dist/ofd.min.js"></script>
<script>
  const { parseOfdDocument, renderPage, calPageBox } = window.OFD;
</script>
```

### 在 Vue 3 中使用

仓库里的 `examples/vue/3/src/vue-viewer.vue` 是一个 Vue 3 的集成示例。组件方式的核心思路是：

- 用 `ref` 保存加载状态、错误信息、文件信息和页面容器
- 在 `change` 事件里调用 `parseOfdDocument()`
- 解析成功后使用 `renderOfd()` 生成页面 DOM
- 把生成的页面元素挂到 `ref` 容器里

示例代码如下：

```vue
<template>
  <div class="ofd-viewer">
    <div class="controls">
      <input
        type="file"
        accept=".ofd"
        @change="handleFileChange"
        :disabled="loading"
      />
      <button v-if="fileInfo" @click="handleClear">清空文档</button>
    </div>

    <div v-if="loading">正在加载...</div>
    <div v-if="error">{{ error }}</div>

    <div v-if="fileInfo">
      <p><strong>文件名:</strong> {{ fileInfo.name }}</p>
      <p><strong>页数:</strong> {{ fileInfo.pageCount }}</p>
      <p><strong>大小:</strong> {{ formatSize(fileInfo.size) }}</p>
    </div>

    <div ref="containerRef" class="viewer">
      <div ref="pageRef"></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { parseOfdDocument, renderOfd } from '@ycsx/ofdjs';

const loading = ref(false);
const error = ref(null);
const fileInfo = ref(null);
const containerRef = ref(null);
const pageRef = ref(null);
const pageElements = ref([]);

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const handleFileChange = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  pageElements.value = [];
  pageRef.value.innerHTML = '';
  loading.value = true;
  error.value = null;

  parseOfdDocument({
    ofd: file,
    success: (ofdDoc) => {
      const screenWidth = containerRef.value?.offsetWidth || 1024;
      pageElements.value = renderOfd(screenWidth, ofdDoc[0]);
      pageElements.value.forEach((element) => pageRef.value.appendChild(element));
      fileInfo.value = {
        name: file.name,
        pageCount: ofdDoc[0]?.pages?.length || 0,
        size: file.size,
      };
      loading.value = false;
    },
    fail: (err) => {
      error.value = err.message || '文件加载失败';
      loading.value = false;
    },
  });
};

const handleClear = () => {
  pageElements.value = [];
  fileInfo.value = null;
  error.value = null;
  pageRef.value.innerHTML = '';
};
</script>
```

> 说明：Vue 3 示例目前以“加载后一次渲染页面”为主，后续如果需要分页、缩放、单页预览等交互，可以在这个模板基础上继续扩展。

> React 和 Vue 2 的示例会在后续补充。

## API 文档

### parseOfdDocument(options)

解析OFD文档文件。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `options` | Object | 配置对象 |
| `options.ofd` | string \| File \| ArrayBuffer | OFD文件源（文件路径、File对象或二进制数据） |
| `options.success` | Function | 成功回调，接收解析后的文档对象 |
| `options.fail` | Function | 失败回调，接收错误对象 |

**返回值：** 无

**示例：**

```javascript
parseOfdDocument({
  ofd: fileInput.files[0],
  success: (document) => {
    console.log('页数:', document.pages.length);
  },
  fail: (error) => {
    console.error('错误:', error);
  }
});
```

---

### renderOfd(screenWidth, ofdDocument)

每页按 `screenWidth` 指定的 CSS 像素宽度等比渲染，返回 DOM 页面数组。传入容器可用于显示页面的内容宽度，内边距和预留空白由调用方扣除。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `screenWidth` | number | 页面显示宽度（像素） |
| `ofdDocument` | Object | 通过 `parseOfdDocument` 获得的文档对象 |

**返回值：** Array&lt;HTMLDivElement&gt; - 页面DOM元素数组

**示例：**

```javascript
const pages = renderOfd(1024, ofdDocument);
pages.forEach(pageDiv => {
  // 每个pageDiv包含一个页面
  console.log('页面ID:', pageDiv.id);
  container.appendChild(pageDiv);
});
```

---

### renderOfdByScale(ofdDocument)

根据设置的缩放比例渲染OFD文档。需先使用 `setPageScale()` 设置缩放值。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `ofdDocument` | Object | 通过 `parseOfdDocument` 获得的文档对象 |

**返回值：** Array&lt;HTMLDivElement&gt; - 页面DOM元素数组

**示例：**

```javascript
setPageScale(1.5);  // 150%
const pages = renderOfdByScale(ofdDocument);
```

---

### setPageScale(scale)

设置全局页面缩放比例。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `scale` | number | 缩放比例（1.0 = 100%，可设置0.5-2.0之间的值） |

**返回值：** 无

**示例：**

```javascript
setPageScale(0.8);   // 80%
setPageScale(1.2);   // 120%
```

---

### getPageScale()

获取当前设置的缩放比例。

**参数：** 无

**返回值：** number - 当前缩放比例

**示例：**

```javascript
const currentScale = getPageScale();
console.log(`当前缩放: ${currentScale * 100}%`);
```

---

### calPageBox(screenWidth, document, page)

按与 `renderOfd` 相同的比例计算页面尺寸。传入页面的目标宽度（CSS 像素），高度按页面原始宽高比计算。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `screenWidth` | number | 屏幕宽度（像素） |
| `document` | Object | OFD文档对象 |
| `page` | Object | 页面对象 |

**返回值：** Object - 包含 `w`（宽度）和 `h`（高度）的对象

**示例：**

```javascript
const box = calPageBox(1024, ofdDocument.document, ofdDocument.pages[0]);
console.log(`页面尺寸: ${box.w}x${box.h}`);
```

---

### calPageBoxScale(document, page)

根据设置的缩放比例计算页面尺寸。

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `document` | Object | OFD文档对象 |
| `page` | Object | 页面对象 |

**返回值：** Object - 包含 `w`（宽度）和 `h`（高度）的对象

**示例：**

```javascript
setPageScale(1.2);
const box = calPageBoxScale(ofdDocument.document, ofdDocument.pages[0]);
console.log(`缩放后页面尺寸: ${box.w}x${box.h}`);
```

---

### renderPage(pageDiv, page, templates, fonts, drawParams, multiMedia)

在指定的DOM元素中渲染单个页面。（高级API，通常无需直接调用）

**参数：**

| 参数 | 类型 | 描述 |
|------|------|------|
| `pageDiv` | HTMLDivElement | 页面容器DOM元素 |
| `page` | Object | 页面对象 |
| `templates` | Object | 页面模板资源 |
| `fonts` | Object | 字体资源 |
| `drawParams` | Object | 绘制参数 |
| `multiMedia` | Object | 多媒体资源 |

**返回值：** 无

---

## 错误处理

```javascript
parseOfdDocument({
  ofd: file,
  success: (document) => {
    console.log('解析成功');
  },
  fail: (error) => {
    // 常见错误类型
    if (error.message.includes('not a valid zip')) {
      console.error('不是有效的OFD文件');
    } else if (error.message.includes('XML parse')) {
      console.error('文档结构错误');
    } else {
      console.error('未知错误:', error);
    }
  }
});
```

## 支持的OFD版本

- OFD 1.0
- OFD 1.2

## 浏览器兼容性

| 浏览器 | 最低版本 | 备注 |
|--------|---------|------|
| Chrome | 50+ | ✅ 完全支持 |
| Firefox | 45+ | ✅ 完全支持 |
| Safari | 10+ | ✅ 完全支持 |
| Edge | 15+ | ✅ 完全支持 |
| IE | 不支持 | ❌ 需要使用polyfills |

**注：** 需要支持 ES6 Module 和 Promise。如需支持IE11，请使用相应的polyfills。

## 依赖项

- **jszip** - ZIP文件解析
- **@xmldom/xmldom** - XML解析
- **jsrsasign** - 数字签名验证
- **js-sha1** - SHA1哈希算法
- **js-md5** - MD5哈希算法
- **@lapo/asn1js** - ASN.1编码/解码
- **ofd-xml-parser** - OFD XML解析
- **@sharp9/ofdjs** - OFD格式处理
- **web-streams-polyfill** - Stream API polyfill

## 常见问题

### Q: 如何在Node.js中使用？

A: 由于该库依赖于浏览器DOM API，暂不支持Node.js环境。未来可能提供Headless实现。

### Q: 支持大文件吗？

A: 支持，但建议文件不超过100MB。对于特别大的文件，可能需要分页加载。

### Q: 可以修改渲染样式吗？

A: 可以。通过CSS修改返回的页面DOM元素的样式。

### Q: 支持导出功能吗？

A: 当前版本仅支持渲染和查看。导出功能建议使用html2pdf等库。

### Q: 可以获取文本内容吗？

A: 可以通过遍历文档对象的内容节点获取。具体方法请参考源代码或提出Issue。

## 版本历史

请查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新信息。

## 许可证

本项目采用 Apache License 2.0 许可证。

**原始项目：** [DLTech21/ofd.js](https://github.com/DLTech21/ofd.js) © 2020 DLTech21

**修改版本：** 2026 Ycsx

详情请见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交Issue和Pull Request！

在贡献前，请：

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 相关资源

- [OFD官方规范](https://www.ofd-spec.com/)
- [原始项目](https://github.com/DLTech21/ofd.js)
- [Issue追踪](https://github.com/ycsx/ofd.js/issues)

## 联系方式

如有问题或建议，欢迎：

- 提交 [GitHub Issues](https://github.com/ycsx/ofd.js/issues)
- 发送邮件至: 4081360972qq.com

---

**最后更新：** 2026年6月26日
