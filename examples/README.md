# OFD.js 使用示例

本目录包含了多个OFD.js的使用示例，演示如何在不同的场景和框架中集成和使用该库。

## 示例列表

### 1. basic-viewer.html
**描述**: 纯HTML/JavaScript示例，无任何框架依赖。

**特点**:
- 完整的HTML页面
- 包含文件上传、缩放控制
- 响应式设计，现代UI
- 状态管理和错误处理

**使用**:
```bash
# 直接在浏览器中打开
open examples/basic-viewer.html
```

**文件结构**:
```html
<!DOCTYPE html>
<html>
  <head><!-- 样式 --></head>
  <body>
    <!-- HTML 结构 -->
    <script type="module">
      import { parseOfdDocument, renderOfd } from '@ycsx/ofdjs';
      // 使用代码
    </script>
  </body>
</html>
```

---

### 2. react-viewer.jsx
**描述**: React函数组件示例，展示如何在React中集成OFD.js。

**特点**:
- 使用React Hooks（useState, useRef）
- 组件化设计
- 完整的生命周期管理
- 文件信息展示

**使用**:
```bash
# 在你的React项目中导入
import OfdViewer from './examples/react-viewer.jsx';

// 使用组件
<OfdViewer />
```

**集成步骤**:
1. 安装OFD包: `npm install @ycsx/ofdjs`
2. 复制 `react-viewer.jsx` 到你的项目
3. 在你的组件中导入并使用

**示例代码**:
```jsx
import { OfdViewer } from 'path/to/react-viewer.jsx';

export default function App() {
  return <OfdViewer />;
}
```

---

### 3. vue-viewer.vue
**描述**: Vue 3组件示例，展示如何在Vue中集成OFD.js。

**特点**:
- Vue 3 Composition API
- 响应式数据绑定
- 模板语法和事件处理
- 作用域样式

**使用**:
```bash
# 在你的Vue 3项目中使用
```

**集成步骤**:
1. 确保你的项目使用Vue 3
2. 安装OFD包: `npm install @ycsx/ofdjs`
3. 复制 `vue-viewer.vue` 到你的项目
4. 注册并使用组件

**示例代码**:
```vue
<template>
  <div>
    <OfdViewer />
  </div>
</template>

<script setup>
import OfdViewer from 'path/to/vue-viewer.vue';
</script>
```

---

## 快速开始

### 1. 原生JavaScript

```javascript
import { parseOfdDocument, renderOfd } from '@ycsx/ofdjs';

// 选择文件
const file = document.getElementById('fileInput').files[0];

// 解析文档
parseOfdDocument({
  ofd: file,
  success: ([ofdDoc]) => {
    // 渲染页面
    const pages = renderOfd(window.innerWidth, ofdDoc);
    pages.forEach(page => {
      document.body.appendChild(page);
    });
  },
  fail: (error) => {
    console.error('解析失败:', error);
  }
});
```

### 2. React中使用

```jsx
import { parseOfdDocument, renderOfd } from '@ycsx/ofdjs';
import { useState, useRef } from 'react';

export function OfdViewer() {
  const [pages, setPages] = useState([]);
  const containerRef = useRef(null);

  const handleFile = (file) => {
    parseOfdDocument({
      ofd: file,
      success: ([doc]) => {
        const pageElements = renderOfd(1024, doc);
        setPages(pageElements.map(el => ({
          id: el.id,
          html: el.outerHTML
        })));
      }
    });
  };

  return (
    <div ref={containerRef}>
      {pages.map(page => (
        <div
          key={page.id}
          dangerouslySetInnerHTML={{ __html: page.html }}
        />
      ))}
    </div>
  );
}
```

### 3. Vue中使用

```vue
<template>
  <div>
    <input type="file" @change="handleFile" />
    <div v-for="page in pages" :key="page.id" v-html="page.html" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { parseOfdDocument, renderOfd } from '@ycsx/ofdjs';

const pages = ref([]);

const handleFile = (event) => {
  const file = event.target.files[0];
  parseOfdDocument({
    ofd: file,
    success: ([doc]) => {
      const pageElements = renderOfd(1024, doc);
      pages.value = pageElements.map(el => ({
        id: el.id,
        html: el.outerHTML
      }));
    }
  });
};
</script>
```

---

## 常见问题

### Q: 如何处理大文件？
A: 可以显示加载动画，在`success`回调中逐步渲染页面。

### Q: 如何实现页面预览缩略图？
A: 可以在渲染时设置较小的宽度，生成缩略图。

### Q: 支持移动设备吗？
A: 支持。示例中已包含响应式设计，会自适应屏幕宽度。

### Q: 如何导出为PDF？
A: 可以使用html2pdf等库将DOM导出为PDF。

### Q: 可以自定义样式吗？
A: 可以。渲染后修改返回的DOM元素的CSS样式。

---

## 文件对照表

| 文件 | 框架 | 适用场景 |
|------|------|---------|
| basic-viewer.html | 无 | 快速演示、嵌入静态页面 |
| react-viewer.jsx | React | React项目集成 |
| vue-viewer.vue | Vue 3 | Vue项目集成 |

---

## 更多资源

- 📖 [完整API文档](../README.md)
- 🔗 [GitHub仓库](https://github.com/DLTech21/ofd.js)
- 💬 [问题反馈](https://github.com/yourrepo/issues)

---

**最后更新**: 2026年6月26日
