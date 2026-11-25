/*
 * ofd.js - A Javascript class for reading and rendering ofd files
 * <https://github.com/DLTech21/ofd.js>
 *
 * Copyright (c) 2020. DLTech21 All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

import {
    calPathPoint,
    calTextPoint,
    converterDpi, convertPathAbbreviatedDatatoPoint,
    getFontFamily,
    parseColor,
    parseCtm,
    parseStBox,
    getPageScal,
    setPageScal,
    converterBox,
} from "./ofd_util";
import {attachSourceOrder} from "./ordered_page_xml";

export const renderPageBox = function (screenWidth, pages, document) {
    let pageBoxs = [];
    for (const page of pages) {
        let boxObj = {};
        boxObj['id'] = Object.keys(page)[0];
        boxObj['box'] = calPageBox(screenWidth, document, page);
        pageBoxs.push(boxObj);
    }
    return pageBoxs;
}

// renderPage receives no document, so retain the physical width resolved during measurement.
const measuredPageWidths = new WeakMap();

const getPageBox = function (document, page) {
    const pageId = Object.keys(page)[0];
    const area = page[pageId].json['ofd:Area'] || document['ofd:CommonData']['ofd:PageArea'];
    const box = parseStBox(area['ofd:PhysicalBox'] || area.PhysicalBox
        || area['ofd:ApplicationBox'] || area.ApplicationBox
        || area['ofd:ContentBox'] || area.ContentBox);
    measuredPageWidths.set(page, box.w);
    return box;
}

export const calPageBox = function (screenWidth, document, page) {
    const box = getPageBox(document, page);
    setPageScal(screenWidth / box.w);
    return converterBox(box);
}

export const calPageBoxScale = function (document, page) {
    return converterBox(getPageBox(document, page));
}

export const renderPage = function (pageDiv, page, tpls, fontResObj, drawParamResObj, multiMediaResObj) {
    const previousScale = getPageScal();
    const physicalWidth = measuredPageWidths.get(page);
    const cssWidth = pageDiv.style.width;
    try {
        if (physicalWidth > 0 && cssWidth.endsWith('px')) {
            setPageScal(parseFloat(cssWidth) / physicalWidth);
        }
        renderPageContent(pageDiv, page, tpls, fontResObj, drawParamResObj, multiMediaResObj);
    } finally {
        setPageScal(previousScale);
    }
}

const renderPageLayers = function (pageDiv, pageData, tpls, fontResObj, drawParamResObj, multiMediaResObj, isStampAnnot) {
    const backgrounds = [];
    const foregrounds = [];
    for (const ref of [].concat(pageData.json['ofd:Template'] || [])) {
        const template = tpls?.[ref['@_TemplateID']];
        if (template) {
            const list = ref['@_ZOrder'] === 'Foreground' ? foregrounds : backgrounds;
            list.push(template);
        }
    }
    for (const data of [...backgrounds, pageData, ...foregrounds]) {
        attachSourceOrder(data.xml, data.json);
        const layers = data.json['ofd:Content']?.['ofd:Layer'];
        for (const layer of [].concat(layers || [])) {
            renderLayer(pageDiv, fontResObj, drawParamResObj, multiMediaResObj, layer, isStampAnnot);
        }
    }
}

export const renderPageContent = function (pageDiv, page, tpls, fontResObj, drawParamResObj, multiMediaResObj) {
    const pageId = Object.keys(page)[0];
    renderPageLayers(pageDiv, page[pageId], tpls, fontResObj, drawParamResObj, multiMediaResObj, false);
    if (page[pageId].stamp) {
        for (const stamp of page[pageId].stamp) {
          if (stamp.type === 'ofd') {
            renderSealPage(pageDiv, stamp.obj.document, stamp.obj.pages, stamp.obj.tpls, true, stamp.stamp.stampAnnot, stamp.obj.fontResObj, stamp.obj.drawParamResObj, stamp.obj.multiMediaResObj, stamp.stamp.sealObj.SES_Signature, stamp.stamp.signedInfo);
          } else if (stamp.type === 'png') {
              let sealBoundary = converterBox(stamp.obj.boundary);
              const oid = Array.isArray(stamp.stamp.stampAnnot)?stamp.stamp.stampAnnot[0]['pfIndex']:stamp.stamp.stampAnnot['pfIndex'];
              let element = renderImageOnDiv(pageDiv.style.width, pageDiv.style.height, stamp.obj.img, sealBoundary, stamp.obj.clip, true, stamp.stamp.sealObj.SES_Signature, stamp.stamp.signedInfo,oid);
              pageDiv.appendChild(element);
          }
        }
    }
    if (page[pageId].annotation) {
        for (const annotation of page[pageId].annotation) {
            renderAnnotation(pageDiv, annotation, fontResObj, drawParamResObj, multiMediaResObj);
        }
    }
}

const renderAnnotation = function (pageDiv, annotation, fontResObj, drawParamResObj, multiMediaResObj) {
    let div = document.createElement('div');
    div.setAttribute('style', `overflow: hidden;z-index:${annotation['pfIndex']};position:relative;`)
    let boundary = annotation['appearance']?.['@_Boundary'];
    if (boundary) {
        let divBoundary = converterBox(parseStBox(boundary));
        div.setAttribute('style', `overflow: hidden;z-index:${annotation['pfIndex']};position:absolute; left: ${divBoundary.x}px; top: ${divBoundary.y}px; width: ${divBoundary.w}px; height: ${divBoundary.h}px`)
    }
    const contentLayer = annotation['appearance'];
    renderLayer(div, fontResObj, drawParamResObj, multiMediaResObj, contentLayer, false);
    pageDiv.appendChild(div);

}

const renderSealPage = function (pageDiv, docObj, pages, tpls, isStampAnnot, stampAnnot, fontResObj, drawParamResObj, multiMediaResObj, SES_Signature, signedInfo) {
    for (const page of pages) {
        const pageId = Object.keys(page)[0];
        let stampAnnotBoundary = {x: 0, y: 0, w: 0, h: 0};
        if (isStampAnnot && stampAnnot) {
            stampAnnotBoundary = stampAnnot.boundary;
        }
        let divBoundary = converterBox(stampAnnotBoundary);
        const sealBox = calPageBoxScale(docObj, page);
        const scaleX = sealBox.w ? divBoundary.w / sealBox.w : 1;
        const scaleY = sealBox.h ? divBoundary.h / sealBox.h : 1;
        let div = document.createElement('div');
        div.setAttribute("name","seal_img_div");
        div.setAttribute('style', `cursor: pointer; overflow:hidden; position:absolute; left: ${divBoundary.x}px; top: ${divBoundary.y}px; width: ${divBoundary.w}px; height: ${divBoundary.h}px`)
        div.setAttribute('data-ses-signature', `${JSON.stringify(SES_Signature)}`);
        div.setAttribute('data-signed-info', `${JSON.stringify(signedInfo)}`);
        const contentWrapper = document.createElement('div');
        contentWrapper.setAttribute('style', `position:absolute;left:0;top:0;width:${sealBox.w}px;height:${sealBox.h}px;transform:scale(${scaleX}, ${scaleY});transform-origin:0 0;`);
        renderPageLayers(contentWrapper, page[pageId], tpls, fontResObj, drawParamResObj, multiMediaResObj, isStampAnnot);
        div.appendChild(contentWrapper);
        pageDiv.appendChild(div);
    }
}

const collectLayerObjects = function (layer, objects) {
    for (const type of Object.keys(layer || {})) {
        if (type !== 'ofd:PageBlock' && type !== 'ofd:ImageObject'
            && type !== 'ofd:PathObject' && type !== 'ofd:TextObject') {
            continue;
        }
        for (const object of [].concat(layer[type] || [])) {
            if (type === 'ofd:PageBlock') {
                collectLayerObjects(object, objects);
            } else if (object) {
                objects.push({type, object});
            }
        }
    }
}

const renderLayer = function (pageDiv, fontResObj, drawParamResObj, multiMediaResObj, layer, isStampAnnot) {
    let fillColor = null;
    let strokeColor = null;
    let lineWith = converterDpi(0.353);
    let fragment = document.createDocumentFragment();
    let drawParam = layer?.['@_DrawParam'] || layer?.['ofd:PageBlock']?.['@_DrawParam'];
    if (drawParam && Object.keys(drawParamResObj).length > 0 && drawParamResObj[drawParam]) {
        if (drawParamResObj[drawParam]['relative']) {
            drawParam = drawParamResObj[drawParam]['relative'];
            if (drawParamResObj[drawParam]['FillColor']) {
                fillColor = parseColor(drawParamResObj[drawParam]['FillColor']);
            }
            if (drawParamResObj[drawParam]['StrokeColor']) {
                strokeColor = parseColor(drawParamResObj[drawParam]['StrokeColor']);
            }
            if (drawParamResObj[drawParam]['LineWidth']) {
                lineWith = converterDpi(drawParamResObj[drawParam]['LineWidth']);
            }
        }
        if (drawParamResObj[drawParam]['FillColor']) {
            fillColor = parseColor(drawParamResObj[drawParam]['FillColor']);
        }
        if (drawParamResObj[drawParam]['StrokeColor']) {
            strokeColor = parseColor(drawParamResObj[drawParam]['StrokeColor']);
        }
        if (drawParamResObj[drawParam]['LineWidth']) {
            lineWith = converterDpi(drawParamResObj[drawParam]['LineWidth']);
        }
    }
    const objects = [];
    collectLayerObjects(layer, objects);
    if (objects.every(({object}) => Number.isFinite(object.pfIndex))) {
        objects.sort((a, b) => a.object.pfIndex - b.object.pfIndex);
    }
    let paths = [];
    const flushPaths = () => {
        if (paths.length) {
            fragment.appendChild(renderPathObjectsOnCanvas(pageDiv, drawParamResObj, paths, fillColor, strokeColor, lineWith, isStampAnnot));
            paths = [];
        }
    };
    for (const {type, object} of objects) {
        if (type === 'ofd:PathObject') {
            paths.push(object);
            continue;
        }
        flushPaths();
        const element = type === 'ofd:ImageObject'
            ? renderImageObject(pageDiv.style.width, pageDiv.style.height, multiMediaResObj, object)
            : renderTextObject(fontResObj, object, fillColor);
        if (element) fragment.appendChild(element);
    }
    flushPaths();
    pageDiv.appendChild(fragment);
}

const createSvgTextElement = function (textCodePoint, textObject, style, fillColor, fillOpacity, ctm, hScale) {
    let text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', textCodePoint.x);
    text.setAttribute('y', textCodePoint.y);
    text.setAttribute('xml:space', 'preserve');
    text.textContent = textCodePoint.text;
    const transforms = [];
    if (ctm) {
        const ctms = parseCtm(ctm);
        transforms.push(`matrix(${ctms[0]} ${ctms[1]} ${ctms[2]} ${ctms[3]} ${converterDpi(ctms[4])} ${converterDpi(ctms[5])})`);
    }
    if (hScale) {
        transforms.push(`matrix(${hScale} 0 0 1 ${(1 - hScale) * textCodePoint.x} 0)`);
    }
    if (transforms.length) text.setAttribute('transform', transforms.join(' '));
    text.setAttribute('fill', fillColor);
    text.setAttribute('fill-opacity', fillOpacity);
    text.setAttribute('style', style)
    text.setAttribute('data-oid', textObject['@_ID']);
    return text;
}

export const renderImageObject = function (pageWidth, pageHeight, multiMediaResObj, imageObject){
    const resId = imageObject['@_ResourceID'];
    const media = multiMediaResObj?.[resId];
    if (!media) {
        console.warn(`OFD image resource not found: ${resId}`);
        return null;
    }
    const physicalBox = parseStBox(imageObject['@_Boundary']);
    if (!physicalBox || physicalBox.w <= 0 || physicalBox.h <= 0) return null;
    const box = converterBox(physicalBox);
    const container = document.createElement('div');
    container.style.cssText = `overflow:hidden;position:absolute;left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
    let image;
    if (media.format === 'gbig2') {
        image = renderImageOnCanvas(media.img, media.width, media.height);
        image.style.imageRendering = 'pixelated';
    } else {
        image = document.createElement('img');
        image.src = media.img;
        image.decoding = 'sync';
    }
    image.style.display = 'block';
    image.style.width = '100%';
    image.style.height = '100%';
    const ctm = imageObject['@_CTM'];
    if (ctm) {
        // Image CTMs map a unit square into the boundary's local millimeter coordinates.
        const [a, b, c, d, e, f] = parseCtm(ctm);
        image.style.transformOrigin = '0 0';
        image.style.transform = `matrix(${a / physicalBox.w}, ${b / physicalBox.w}, ${c / physicalBox.h}, ${d / physicalBox.h}, ${converterDpi(e)}, ${converterDpi(f)})`;
    }
    container.appendChild(image);
    return container;
}

const renderImageOnCanvas = function (img, imgWidth, imgHeight){
    const arr = new Uint8ClampedArray(4 * imgWidth * imgHeight);
    for (var i = 0; i < img.length; i++) {
        arr[4 * i] = img[i];
        arr[4 * i + 1] = img[i];
        arr[4 * i + 2] = img[i];
        arr[4 * i + 3] = 255;
    }
    let imageData = new ImageData(arr, imgWidth, imgHeight);
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = imgWidth;
    sourceCanvas.height = imgHeight;
    const sourceContext = sourceCanvas.getContext('2d');
    sourceContext.putImageData(imageData, 0, 0);

    return sourceCanvas;
}

const renderImageOnHighDpiCanvas = function (imgSrc, width, height, isStampAnnot) {
    const canvas = document.createElement('canvas');
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.ceil(width * pixelRatio));
    canvas.height = Math.max(1, Math.ceil(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.setAttribute('style', `display:block;width:100%;height:100%;${isStampAnnot ? 'image-rendering:auto;' : ''}`);

    const img = new Image();
    img.onload = function () {
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
    };
    img.src = imgSrc;
    return canvas;
}

export const renderImageOnDiv = function (pageWidth, pageHeight, imgSrc, boundary, clip, isStampAnnot, SES_Signature, signedInfo, oid) {
    let div = document.createElement('div');
    if(isStampAnnot)
    {
        div.setAttribute("name","seal_img_div");
        div.setAttribute('data-ses-signature', `${JSON.stringify(SES_Signature)}`);
        div.setAttribute('data-signed-info', `${JSON.stringify(signedInfo)}`);
    }
    const pw = parseFloat(pageWidth.replace('px', ''));
    const ph = parseFloat(pageHeight.replace('px', ''));
    const w = boundary.w > pw ? pw : boundary.w;
    const h = boundary.h > ph ? ph : boundary.h;
    if (isStampAnnot) {
        div.appendChild(renderImageOnHighDpiCanvas(imgSrc, w, h, true));
    } else {
        let img = document.createElement('img');
        img.src = imgSrc;
        img.decoding = 'sync';
        img.setAttribute('width', '100%');
        img.setAttribute('height', '100%');
        img.setAttribute('style', 'display:block;width:100%;height:100%;object-fit:fill;image-rendering:auto;');
        div.appendChild(img);
    }
    let c = '';
    if (clip) {
        clip = converterBox(clip);
        c = `clip: rect(${clip.y}px, ${clip.w + clip.x}px, ${clip.h + clip.y}px, ${clip.x}px)`
    }
    div.setAttribute('style', `cursor: pointer; overflow: hidden; position: absolute; left: ${c ? boundary.x : boundary.x < 0 ? 0 : boundary.x}px; top: ${c ? boundary.y : boundary.y < 0 ? 0 : boundary.y}px; width: ${w}px; height: ${h}px; ${c};z-index: ${oid};`)
    return div;
}

export const renderTextObject = function (fontResObj, textObject, defaultFillColor) {
    let defaultFillOpacity = 1;
    let boundary = parseStBox(textObject['@_Boundary']);
    boundary = converterBox(boundary);
    const ctm = textObject['@_CTM'];
    const hScale = textObject['@_HScale'];
    const font = textObject['@_Font'];
    const weight = textObject['@_Weight'];
    const size = converterDpi(parseFloat(textObject['@_Size']));
    let array = [];
    array = array.concat(textObject['ofd:TextCode']);
    const textCodePointList = calTextPoint(array);
    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('version', '1.1');
    const fillColor = textObject['ofd:FillColor'];
    if (fillColor) {
        defaultFillColor = parseColor(fillColor['@_Value']);
        let alpha = fillColor['@_Alpha'];
        if (alpha) {
            defaultFillOpacity = alpha>1? alpha/255:alpha;
        }
    }
    const textStyle = `font-weight: ${weight};font-size:${size}px;font-family: ${getFontFamily(fontResObj[font])};`;
    for (const textCodePoint of textCodePointList) {
        if (textCodePoint && !isNaN(textCodePoint.x)) {
            const text = createSvgTextElement(textCodePoint, textObject, textStyle, defaultFillColor, defaultFillOpacity, ctm, hScale);
            svg.appendChild(text);
        }

    }
    let width = boundary.w;
    let height = boundary.h;
    let left = boundary.x;
    let top = boundary.y;
    svg.setAttribute('style', `overflow:visible;position:absolute;width:${width}px;height:${height}px;left:${left}px;top:${top}px`);
    return svg;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

const getDrawParam = function (drawParamResObj, drawParam) {
    let drawParamObj = drawParamResObj?.[drawParam];
    if (drawParamObj?.relative) {
        drawParamObj = drawParamResObj?.[drawParamObj.relative] || drawParamObj;
    }
    return drawParamObj;
}

const getDrawParamColor = function (drawParamResObj, drawParam, colorKey) {
    const color = getDrawParam(drawParamResObj, drawParam)?.[colorKey];
    return color ? parseColor(color) : null;
}

const parseAlpha = function (alpha) {
    if (alpha === undefined || alpha === null || alpha === '') {
        return 1;
    }
    const value = parseFloat(alpha);
    if (isNaN(value)) {
        return 1;
    }
    return value > 1 ? value / 255 : value;
}

const getColorAlpha = function (colorObject) {
    return parseAlpha(colorObject?.['@_Alpha']);
}

const getCanvasLineCap = function (lineCap) {
    if (lineCap === 'Butt') {
        return 'butt';
    }
    if (lineCap === 'Round') {
        return 'round';
    }
    if (lineCap === 'Square') {
        return 'square';
    }
    return 'butt';
}

const getCanvasLineJoin = function (join) {
    if (join === 'Round') {
        return 'round';
    }
    if (join === 'Bevel') {
        return 'bevel';
    }
    return 'miter';
}

const getCanvasFillRule = function (rule) {
    return rule === 'Even-Odd' || rule === 'evenodd' ? 'evenodd' : 'nonzero';
}

const getPathD = function (points) {
    let d = '';
    for (const point of points) {
        if (point.type === 'M') {
            d += `M${point.x} ${point.y} `;
        } else if (point.type === 'L') {
            d += `L${point.x} ${point.y} `;
        } else if (point.type === 'Q') {
            d += `Q${point.x1} ${point.y1} ${point.x2} ${point.y2} `;
        } else if (point.type === 'B') {
            d += `C${point.x1} ${point.y1} ${point.x2} ${point.y2} ${point.x3} ${point.y3} `;
        } else if (point.type === 'C') {
            d += `Z`;
        }
    }
    return d;
}

const getPathRenderStyle = function (drawParamResObj, pathObject, defaultFillColor, defaultStrokeColor, defaultLineWith) {
    let lineWidth = pathObject['@_LineWidth'];
    let fillAlpha = 1;
    let strokeAlpha = 1;
    let lineCap = pathObject['@_Cap'];
    let lineJoin = pathObject['@_Join'];
    let miterLimit = pathObject['@_MiterLimit'];
    if (lineWidth) {
        defaultLineWith = converterDpi(lineWidth);
    }
    const drawParam = pathObject['@_DrawParam'];
    if (drawParam && drawParamResObj?.[drawParam]) {
        const drawParamObj = getDrawParam(drawParamResObj, drawParam);
        lineWidth = drawParamObj?.LineWidth;
        if (lineWidth) {
            defaultLineWith = converterDpi(lineWidth);
        }
        defaultFillColor = getDrawParamColor(drawParamResObj, drawParam, 'FillColor') || defaultFillColor;
        defaultStrokeColor = getDrawParamColor(drawParamResObj, drawParam, 'StrokeColor') || defaultStrokeColor;
        fillAlpha = getColorAlpha(drawParamObj?.FillColorObject) || fillAlpha;
        strokeAlpha = getColorAlpha(drawParamObj?.StrokeColorObject) || strokeAlpha;
        lineCap = lineCap || drawParamObj?.Cap;
        lineJoin = lineJoin || drawParamObj?.Join;
        miterLimit = miterLimit || drawParamObj?.MiterLimit;
    }
    const strokeColor = pathObject['ofd:StrokeColor'];
    if (strokeColor) {
        defaultStrokeColor = parseColor(strokeColor['@_Value'])
        strokeAlpha = getColorAlpha(strokeColor);
    }
    const fillColor = pathObject['ofd:FillColor'];
    if (fillColor) {
        defaultFillColor = parseColor(fillColor['@_Value'])
        fillAlpha = getColorAlpha(fillColor);
    }
    if (defaultLineWith > 0 && !defaultStrokeColor && defaultFillColor) {
        defaultStrokeColor = defaultFillColor;
        strokeAlpha = fillAlpha;
    }
    return {
        lineWidth: defaultLineWith,
        strokeColor: pathObject['@_Stroke'] == 'false' ? null : defaultStrokeColor,
        fillColor: pathObject['@_Fill'] != 'false' ? defaultFillColor : null,
        strokeAlpha,
        fillAlpha,
        lineCap: getCanvasLineCap(lineCap),
        lineJoin: getCanvasLineJoin(lineJoin),
        miterLimit: miterLimit ? parseFloat(miterLimit) : 10,
        fillRule: getCanvasFillRule(pathObject['@_Rule']),
    };
}

const drawPathPoints = function (context, points) {
    context.beginPath();
    for (const point of points) {
        if (point.type === 'M') {
            context.moveTo(point.x, point.y);
        } else if (point.type === 'L') {
            context.lineTo(point.x, point.y);
        } else if (point.type === 'Q') {
            context.quadraticCurveTo(point.x1, point.y1, point.x2, point.y2);
        } else if (point.type === 'B') {
            context.bezierCurveTo(point.x1, point.y1, point.x2, point.y2, point.x3, point.y3);
        } else if (point.type === 'C') {
            context.closePath();
        }
    }
}

export const renderPathObjectsOnCanvas = function (pageDiv, drawParamResObj, pathObjects, defaultFillColor, defaultStrokeColor, defaultLineWith, isStampAnnot) {
    const pageWidth = parseFloat(pageDiv.style.width.replace('px', ''));
    const pageHeight = parseFloat(pageDiv.style.height.replace('px', ''));
    const pixelRatio = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = Math.ceil(pageWidth * pixelRatio);
    canvas.height = Math.ceil(pageHeight * pixelRatio);
    canvas.style.width = `${pageWidth}px`;
    canvas.style.height = `${pageHeight}px`;
    canvas.setAttribute('style', `position:absolute;left:0;top:0;width:${pageWidth}px;height:${pageHeight}px;pointer-events:none;`);
    context.scale(pixelRatio, pixelRatio);
    context.textRendering = 'geometricPrecision';
    for (const pathObject of pathObjects) {
        let boundary = parseStBox(pathObject['@_Boundary']);
        boundary = converterBox(boundary);
        const abbreviatedData = pathObject['ofd:AbbreviatedData'];
        if (!abbreviatedData || boundary.w <= 0 || boundary.h <= 0) {
            continue;
        }
        const style = getPathRenderStyle(drawParamResObj, pathObject, defaultFillColor, defaultStrokeColor, defaultLineWith, isStampAnnot);
        // if(!style.strokeColor){
        //     style.strokeColor = '#000000'
        // }
        if (!style.fillColor && !style.strokeColor) {
           style.strokeColor = '#000000'
        }
        const points = calPathPoint(convertPathAbbreviatedDatatoPoint(abbreviatedData));
        context.save();
        context.translate(boundary.x, boundary.y);
        const ctm = pathObject['@_CTM'];
        if (ctm) {
            const ctms = parseCtm(ctm);
            context.transform(ctms[0], ctms[1], ctms[2], ctms[3], converterDpi(ctms[4]), converterDpi(ctms[5]));
        }
        context.lineCap = style.lineCap;
        context.lineJoin = style.lineJoin;
        context.miterLimit = style.miterLimit;
        drawPathPoints(context, points);
        if (style.fillColor) {
            context.globalAlpha = style.fillAlpha;
            context.fillStyle = style.fillColor;
            context.fill(style.fillRule);
        }
        if (style.strokeColor) {
            context.globalAlpha = style.strokeAlpha;
            context.strokeStyle = style.strokeColor;
            context.lineWidth = style.lineWidth;
            context.stroke();
        }
        context.restore();
    }
    return canvas;
}

export const renderPathObject = function (drawParamResObj, pathObject, defaultFillColor, defaultStrokeColor, defaultLineWith, isStampAnnot) {
    let boundary = parseStBox(pathObject['@_Boundary']);
    boundary = converterBox(boundary);
    const abbreviatedData = pathObject['ofd:AbbreviatedData'];
    if (!abbreviatedData || boundary.w <= 0 || boundary.h <= 0) {
        return null;
    }
    const points = calPathPoint(convertPathAbbreviatedDatatoPoint(abbreviatedData));
    const style = getPathRenderStyle(drawParamResObj, pathObject, defaultFillColor, defaultStrokeColor, defaultLineWith, isStampAnnot);
    
    if (!style.fillColor && !style.strokeColor) {
        return null;
    }
    const ctm = pathObject['@_CTM'];
    let svg = document.createElementNS(SVG_NS, 'svg');
    let path = document.createElementNS(SVG_NS, 'path');
    if (ctm) {
        const ctms = parseCtm(ctm);
        path.setAttribute('transform', `matrix(${ctms[0]} ${ctms[1]} ${ctms[2]} ${ctms[3]} ${converterDpi(ctms[4])} ${converterDpi(ctms[5])})`)
    }
    const strokeStyle = style.strokeColor ? `stroke:${style.strokeColor};stroke-width:${style.lineWidth}px;` : '';
    const fillStyle = style.fillColor ? `fill:${style.fillColor};` : 'fill:none;';
    path.setAttribute('style', `${strokeStyle};${fillStyle}`)
    path.setAttribute('d', getPathD(points));
    svg.appendChild(path);
    let width = isStampAnnot ? boundary.w : Math.ceil(boundary.w);
    let height = isStampAnnot ? boundary.h : Math.ceil(boundary.h);
    let left = boundary.x;
    let top = boundary.y;
    svg.setAttribute('style', `overflow:visible;position:absolute;width:${width}px;height:${height}px;left:${left}px;top:${top}px;z-index:${pathObject['pfIndex']}`);
    return svg;
}
