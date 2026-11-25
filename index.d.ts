/**
 * OFD.js TypeScript Type Definitions
 * A Javascript class for reading and rendering ofd files
 * 
 * @license Apache-2.0
 * @author DLTech21 (original), Ycsx (modifications)
 */

/**
 * 页面尺寸信息
 */
export interface PageBox {
  /** 页面宽度（像素） */
  w: number;
  /** 页面高度（像素） */
  h: number;
}

/**
 * 页面对象
 */
export interface Page {
  [pageId: string]: any;
}

/**
 * 文档对象
 */
export interface OFDDocument {
  /** 页面数组 */
  pages: Page[];
  /** 文档信息 */
  document: DocumentInfo;
  /** 模板资源 */
  tpls: any;
  /** 字体资源对象 */
  fontResObj: Record<string, any>;
  /** 绘制参数资源对象 */
  drawParamResObj: Record<string, any>;
  /** 多媒体资源对象 */
  multiMediaResObj: Record<string, any>;
}

/**
 * 文档信息
 */
export interface DocumentInfo {
  [key: string]: any;
}

/**
 * 解析选项
 */
export interface ParseOptions {
  /** 
   * OFD文件源
   * - 文件路径 (字符串)
   * - File 对象 (浏览器)
   * - ArrayBuffer (二进制数据)
   */
  ofd: string | File | ArrayBuffer;
  
  /** 成功回调函数 */
  success?: (document: OFDDocument) => void;
  
  /** 失败回调函数 */
  fail?: (error: Error) => void;
}

/**
 * 解析OFD文档
 * 
 * @param options - 解析选项
 * @example
 * ```typescript
 * parseOfdDocument({
 *   ofd: file,
 *   success: (doc) => console.log('parsed', doc),
 *   fail: (error) => console.error('failed', error)
 * });
 * ```
 */
export function parseOfdDocument(options: ParseOptions): void;

/**
 * 将每页等比渲染到指定宽度
 * 
 * @param screenWidth - 容器中用于显示页面的宽度（CSS 像素）
 * @param ofdDocument - OFD文档对象
 * @returns 页面DOM元素数组
 * 
 * @example
 * ```typescript
 * const pages = renderOfd(1024, ofdDocument);
 * pages.forEach(page => container.appendChild(page));
 * ```
 */
export function renderOfd(screenWidth: number, ofdDocument: OFDDocument): HTMLDivElement[];

/**
 * 根据缩放比例渲染OFD文档
 * 
 * @param ofdDocument - OFD文档对象
 * @returns 页面DOM元素数组
 * 
 * @example
 * ```typescript
 * setPageScale(1.2);
 * const pages = renderOfdByScale(ofdDocument);
 * ```
 */
export function renderOfdByScale(ofdDocument: OFDDocument): HTMLDivElement[];

/**
 * 设置页面缩放比例
 * 
 * @param scale - 缩放比例（1.0 = 100%）
 * 
 * @example
 * ```typescript
 * setPageScale(0.8);  // 80%
 * setPageScale(1.5);  // 150%
 * ```
 */
export function setPageScale(scale: number): void;

/**
 * 获取当前页面缩放比例
 * 
 * @returns 当前缩放比例
 * 
 * @example
 * ```typescript
 * const scale = getPageScale();
 * console.log(`Current scale: ${scale * 100}%`);
 * ```
 */
export function getPageScale(): number;

/**
 * 计算页面按指定宽度等比渲染后的尺寸
 * 
 * @param screenWidth - 页面的目标宽度（CSS 像素）
 * @param document - OFD文档对象
 * @param page - 页面对象
 * @returns 页面尺寸信息
 * 
 * @example
 * ```typescript
 * const box = calPageBox(1024, doc.document, doc.pages[0]);
 * console.log(`Page size: ${box.w}x${box.h}`);
 * ```
 */
export function calPageBox(
  screenWidth: number,
  document: DocumentInfo,
  page: Page
): PageBox;

/**
 * 根据缩放比例计算页面尺寸
 * 
 * @param document - OFD文档对象
 * @param page - 页面对象
 * @returns 页面尺寸信息
 * 
 * @example
 * ```typescript
 * const box = calPageBoxScale(doc.document, doc.pages[0]);
 * console.log(`Scaled page size: ${box.w}x${box.h}`);
 * ```
 */
export function calPageBoxScale(
  document: DocumentInfo,
  page: Page
): PageBox;

/**
 * 在指定DOM元素中渲染单个页面
 * 
 * @param pageDiv - 页面容器DOM元素
 * @param page - 页面对象
 * @param templates - 页面模板资源
 * @param fonts - 字体资源对象
 * @param drawParams - 绘制参数资源对象
 * @param multiMedia - 多媒体资源对象
 * 
 * @remarks
 * 这是一个高级API，通常不需要直接调用。
 * 使用 `renderOfd()` 或 `renderOfdByScale()` 进行高级页面渲染。
 * 
 * @example
 * ```typescript
 * const pageDiv = document.createElement('div');
 * renderPage(
 *   pageDiv,
 *   page,
 *   doc.tpls,
 *   doc.fontResObj,
 *   doc.drawParamResObj,
 *   doc.multiMediaResObj
 * );
 * ```
 */
export function renderPage(
  pageDiv: HTMLDivElement,
  page: Page,
  templates: any,
  fonts: Record<string, any>,
  drawParams: Record<string, any>,
  multiMedia: Record<string, any>
): void;
