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

import JsZip from "jszip";
import {parseStBox, getExtensionByPath, replaceFirstSlash} from "./ofd_util";
import {parseOfdXml} from './ordered_page_xml';
import {Jbig2Image} from '../jbig2/jbig2';
import {parseSesSignature} from "./ses_signature_parser";

export const unzipOfd = function (file) {
    return JsZip.loadAsync(file);
}

export const parseOfdArchive = async function (file) {
    const zip = await unzipOfd(file);
    return parseSingleDoc(await getDocRoots(zip));
}

export const getDocRoots = async function (zip) {
    const data = await getJsonFromXmlContent(zip, 'OFD.xml');
    const docbodys = data['json']['ofd:OFD']['ofd:DocBody'];
    let array = [];
    array = array.concat(docbodys);
    return [zip, array]
}

export const parseSingleDoc = async function ([zip, array]) {
    let docs = [];
    for (let docbody of array) {
        if (docbody) {
            let res = await doGetDocRoot(zip, docbody);
            res = await getDocument(res);
            const files = documentFiles(zip);
            res = await getDocumentRes(res, files);
            res = await getPublicRes(res, files);
            res = await getTemplatePage(res, files);
            res = await getPage(res, files);
            docs.push(res);
        }
    }
    return docs;
}

export const doGetDocRoot = async function (zip, docbody) {
    let docRoot = docbody['ofd:DocRoot'];
    docRoot = replaceFirstSlash(docRoot);
    const doc = directoryOf(docRoot);
    const signatures = docbody['ofd:Signatures'];
    const stampAnnot = await getSignature(zip, signatures, doc);
    let stampAnnotArray = {};
    for (const stamp of stampAnnot) {
        if (stamp.sealObj && Object.keys(stamp.sealObj).length > 0) {
            if (stamp.sealObj.type === 'ofd') {
                const stampObjs = await getSealDocumentObj(stamp);
                for (let stampObj of stampObjs) {
                    stamp.stampAnnot.boundary = parseStBox(stamp.stampAnnot['@_Boundary']);
                    stamp.stampAnnot.pageRef = stamp.stampAnnot['@_PageRef'];
                    if (!stampAnnotArray[stamp.stampAnnot['@_PageRef']]) {
                        stampAnnotArray[stamp.stampAnnot['@_PageRef']] = [];
                    }
                    stampAnnotArray[stamp.stampAnnot['@_PageRef']].push({type: 'ofd', obj: stampObj, stamp});
                }
            } else if (stamp.sealObj.type === 'png') {
                let img = 'data:image/png;base64,' + btoa(String.fromCharCode.apply(null, stamp.sealObj.ofdArray));
                let stampArray = [];
                stampArray = stampArray.concat(stamp.stampAnnot);
                for (const annot of stampArray) {
                    if (annot) {
                        const stampObj = {img, pageId: annot['@_PageRef'], 'boundary': parseStBox(annot['@_Boundary']), 'clip': parseStBox(annot['@_Clip'])};
                        if (!stampAnnotArray[annot['@_PageRef']]) {
                            stampAnnotArray[annot['@_PageRef']] = [];
                        }
                        stampAnnotArray[annot['@_PageRef']].push({type: 'png', obj: stampObj, stamp});
                    }
                }
            }
        }
    }
    return [zip, doc, docRoot, stampAnnotArray];
}

export const getDocument = async function ([zip, doc, docRoot, stampAnnot]) {
    const data = await getJsonFromXmlContent(zip, docRoot);
    const documentObj = data['json']['ofd:Document'];
    let annotations = documentObj['ofd:Annotations'];
    let array = [];
    let annoBase;
    if (annotations) {
        if (annotations.indexOf('/') !== -1) {
            annoBase = annotations.substring(0, annotations.indexOf('/'));
        }
        if (annotations.indexOf(doc) === -1) {
            annotations = `${doc}/${annotations}`;
        }
        if (zip.files[annotations]) {
            annotations = await getJsonFromXmlContent(zip, annotations);
            array = array.concat(annotations['json']['ofd:Annotations']['ofd:Page']);
        }
    }
    const annotationObjs = await getAnnotations(annoBase, array, doc, zip)
    return [zip, doc, documentObj, stampAnnot, annotationObjs];
}

const getAnnotations = async function (annoBase, annotations, doc, zip) {
    let annotationObjs = {};
    for (let anno of annotations) {
        if (!anno) {
            continue
        }
        const pageId = anno['@_PageID'];
        let fileLoc = anno['ofd:FileLoc'];
        fileLoc = replaceFirstSlash(fileLoc);
        if (annoBase && fileLoc.indexOf(annoBase) === -1) {
            fileLoc = `${annoBase}/${fileLoc}`;
        }
        if (fileLoc.indexOf(doc) === -1) {
            fileLoc = `${doc}/${fileLoc}`;
        }

        if (zip.files[fileLoc]) {
            const data = await getJsonFromXmlContent(zip, fileLoc, true);

            let array = [];
            array = array.concat(data['json']['ofd:PageAnnot']['ofd:Annot']);
            if (!annotationObjs[pageId]) {
                annotationObjs[pageId] = [];
            }
            for (let annot of array) {
                if (!annot) {
                    continue
                }
                const type = annot['@_Type'];
                const visible = annot['@_Visible'] ? annot['@_Visible']:true;
                const appearance = annot['ofd:Appearance'];
                let appearanceObj = {type, appearance, visible};
                annotationObjs[pageId].push(appearanceObj);
            }
        }
    }
    return annotationObjs;
}

const directoryOf = path => path.substring(0, path.lastIndexOf('/'));

// OFD references are relative to the containing file (or start at the ZIP root with '/').
const resolvePath = function (directory, reference) {
    const parts = [];
    const path = reference.startsWith('/') ? reference : directory + '/' + reference;
    for (const part of path.split('/')) {
        if (part === '..') parts.pop();
        else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
}

const documentFiles = function (zip) {
    let caseIndex;
    return {
        images: new Map(),
        find(...paths) {
            for (const path of paths) {
                const entry = zip.file(path);
                if (entry) return entry;
            }
            // Some producers vary the case between XML and ZIP. Never guess between two entries.
            if (!caseIndex) {
                caseIndex = new Map();
                zip.forEach((path, entry) => {
                    if (entry.dir) return;
                    const key = path.toLowerCase();
                    caseIndex.set(key, caseIndex.has(key) ? null : entry);
                });
            }
            for (const path of paths) {
                const entry = caseIndex.get(path.toLowerCase());
                if (entry) return entry;
            }
            return null;
        },
    };
}

const documentEntry = function (files, doc, path) {
    const relative = resolvePath(doc, path);
    return path.startsWith(doc + '/') ? files.find(relative, resolvePath('', path)) : files.find(relative);
}

const readResourceCatalogs = async function (zip, doc, paths, files, fonts, drawParams, media) {
    for (const path of [].concat(paths || [])) {
        if (!path) continue;
        const entry = documentEntry(files, doc, path);
        if (!entry) continue;
        const data = await getJsonFromXmlContent(zip, entry.name);
        const res = data.json['ofd:Res'];
        if (!res) continue;
        Object.assign(fonts, await getFont(res));
        Object.assign(drawParams, await getDrawParam(res));
        Object.assign(media, await getMultiMediaRes(files, res, entry.name, doc));
    }
}

export const getDocumentRes = async function ([zip, doc, Document, stampAnnot, annotationObjs], files = documentFiles(zip)) {
    const fonts = {}, drawParams = {}, media = {};
    await readResourceCatalogs(zip, doc, Document['ofd:CommonData']['ofd:DocumentRes'], files, fonts, drawParams, media);
    return [zip, doc, Document, stampAnnot, annotationObjs, fonts, drawParams, media];
}

export const getPublicRes = async function ([zip, doc, Document, stampAnnot, annotationObjs, fonts, drawParams, media], files = documentFiles(zip)) {
    await readResourceCatalogs(zip, doc, Document['ofd:CommonData']['ofd:PublicRes'], files, fonts, drawParams, media);
    return [zip, doc, Document, stampAnnot, annotationObjs, fonts, drawParams, media];
}

export const getTemplatePage = async function ([zip, doc, Document, stampAnnot, annotationObjs, fontResObj, drawParamResObj, multiMediaResObj], files = documentFiles(zip)) {
    let templatePages = Document['ofd:CommonData']['ofd:TemplatePage'];
    let array = [];
    array = array.concat(templatePages);
    let tpls = {};
    for (const templatePage of array) {
        if (templatePage) {
            let pageObj = await parsePage(zip, templatePage, doc, files);
            tpls[Object.keys(pageObj)[0]] = pageObj[Object.keys(pageObj)[0]];
        }
    }
    return [zip, doc, Document, stampAnnot, annotationObjs, tpls, fontResObj, drawParamResObj, multiMediaResObj];
}

export const getPage = async function ([zip, doc, Document, stampAnnot, annotationObjs, tpls, fontResObj, drawParamResObj, multiMediaResObj], files = documentFiles(zip)) {
    let pages = Document['ofd:Pages']['ofd:Page'];
    let array = [];
    array = array.concat(pages);
    let res = [];
    for (const page of array) {
        if (page) {
            let pageObj = await parsePage(zip, page, doc, files);
            const pageId = Object.keys(pageObj)[0];
            const currentPageStamp = stampAnnot[pageId];
            if (currentPageStamp) {
                pageObj[pageId].stamp = currentPageStamp;
            }
            const annotationObj = annotationObjs[pageId];
            if (annotationObj) {
                pageObj[pageId].annotation = annotationObj;
            }
            res.push(pageObj);
        }
    }
    return {
        'doc': doc,
        'document': Document,
        'pages': res,
        'tpls': tpls,
        'stampAnnot': stampAnnot,
        fontResObj,
        drawParamResObj,
        multiMediaResObj
    };
}

const getFont = async function (res) {
    const fonts = res['ofd:Fonts'];
    let fontResObj = {};
    if (fonts) {
        let fontArray = [];
        fontArray = fontArray.concat(fonts['ofd:Font']);
        for (const font of fontArray) {
            if (font) {
                if (font['@_FamilyName']) {
                    fontResObj[font['@_ID']] = font['@_FamilyName'];
                } else {
                    fontResObj[font['@_ID']] = font['@_FontName'];
                }
            }
        }
    }
    return fontResObj;
}

const getDrawParam = async function (res) {
    const drawParams = res['ofd:DrawParams'];
    let drawParamResObj = {};
    if (drawParams) {
        let array = [];
        array = array.concat(drawParams['ofd:DrawParam']);
        for (const item of array) {
            if (item) {
                drawParamResObj[item['@_ID']] = {
                    'LineWidth': item['@_LineWidth'],
                    'FillColor': item['ofd:FillColor'] ? item['ofd:FillColor']['@_Value'] : '',
                    'StrokeColor': item['ofd:StrokeColor'] ? item['ofd:StrokeColor']['@_Value'] : "",
                    'relative': item['@_Relative'],
                };
            }
        }
    }
    return drawParamResObj;
}

const imageTypes = {
    jpg: 'jpeg', jpeg: 'jpeg', png: 'png', bmp: 'bmp', gif: 'gif', tif: 'tiff', tiff: 'tiff', webp: 'webp',
    jbig2: 'gbig2', gbig2: 'gbig2', jb2: 'gbig2',
};

const getMultiMediaRes = async function (files, res, catalogPath, doc) {
    const result = {};
    const catalogDir = directoryOf(catalogPath);
    const baseLoc = res['@_BaseLoc'] || '';
    const mediaDir = resolvePath(catalogDir, baseLoc);
    for (const item of [].concat(res['ofd:MultiMedias']?.['ofd:MultiMedia'] || [])) {
        const id = item['@_ID'];
        const path = item['ofd:MediaFile'];
        const mediaPath = resolvePath(mediaDir, path);
        // Older packages sometimes repeat the document directory or BaseLoc in MediaFile.
        const candidates = [mediaPath];
        if (baseLoc && path.startsWith(baseLoc + '/')) candidates.push(resolvePath(catalogDir, path));
        if (doc && path.startsWith(doc + '/')) candidates.push(resolvePath('', path));
        if (doc && baseLoc.startsWith(doc + '/')) candidates.push(resolvePath(baseLoc, path));
        const entry = files.find(...candidates);
        if (item['@_Type'].toLowerCase() !== 'image') {
            result[id] = entry ? entry.name : mediaPath;
            continue;
        }
        if (!entry) throw new Error('OFD image not found: ' + mediaPath);
        const ext = getExtensionByPath(entry.name).toLowerCase();
        const declared = (item['@_Format'] || '').toLowerCase();
        const format = imageTypes[ext] === 'gbig2' ? 'gbig2' : imageTypes[declared] || imageTypes[ext] || 'png';
        const key = format + ':' + entry.name;
        if (!files.images.has(key)) {
            const image = format === 'gbig2' ? await readJbig2Image(entry) : {
                format, img: 'data:image/' + format + ';base64,' + await entry.async('base64'),
            };
            files.images.set(key, image);
        }
        result[id] = { ...files.images.get(key) };
    }
    return result;
}

const parsePage = async function (zip, obj, doc, files) {
    const path = obj['@_BaseLoc'];
    const entry = documentEntry(files, doc, path);
    if (!entry) throw new Error('OFD page not found: ' + resolvePath(doc, path));
    const data = await getJsonFromXmlContent(zip, entry.name, true);
    let pageObj = {};
    pageObj[obj['@_ID']] = {'json': data['json']['ofd:Page'], 'xml': data['xml']};
    return pageObj;
}

const getSignature = async function (zip, signatures, doc) {
    let stampAnnot = [];
    if (signatures) {
        signatures = replaceFirstSlash(signatures);
        if (signatures.indexOf(doc) === -1) {
            signatures = `${doc}/${signatures}`
        }
        if (zip.files[signatures]) {
            let data = await getJsonFromXmlContent(zip, signatures);
            let signature = data['json']['ofd:Signatures']['ofd:Signature'];
            let signatureArray = [];
            signatureArray = signatureArray.concat(signature);
            for (const sign of signatureArray) {
                if (sign) {
                    let signatureLoc = sign['@_BaseLoc'];
                    let signatureID = sign['@_ID'];
                    signatureLoc = replaceFirstSlash(signatureLoc);
                    if (signatureLoc.indexOf('Signs') === -1) {
                        signatureLoc = `Signs/${signatureLoc}`
                    }
                    if (signatureLoc.indexOf(doc) === -1) {
                        signatureLoc = `${doc}/${signatureLoc}`
                    }
                    stampAnnot.push(await getSignatureData(zip, signatureLoc, signatureID));
                }
            }
        }
    }
    return stampAnnot;
}

const getFileData = async function (zip, name){
    return zip.files[name].async('uint8array');
}

const getSignatureData = async function (zip, signature, signatureID) {
    const data = await getJsonFromXmlContent(zip, signature);
    let signedValue = (data['json']['ofd:Signature']['ofd:SignedValue'])
    signedValue = signedValue.toString().replace('/', '');
    if (!zip.files[signedValue]) {
        signedValue = `${signature.substring(0, signature.lastIndexOf('/'))}/${signedValue}`
    }
    let sealObj = await parseSesSignature(zip, signedValue);
    const checkMethod = data['json']['ofd:Signature']['ofd:SignedInfo']['ofd:References']['@_CheckMethod'];
    global.toBeChecked = new Map();
    let arr = new Array();
    data['json']['ofd:Signature']['ofd:SignedInfo']['ofd:References']['ofd:Reference'].forEach(async reference=>{
        if(Object.keys(reference).length==0 || Object.keys(reference['@_FileRef']).length==0){
            return true;
        }
        const hashed = reference['ofd:CheckValue'];
        const key = reference['@_FileRef'].replace('/','');
        let fileData = await getFileData(zip, key);
        arr.push({fileData,hashed,checkMethod});
    });
    global.toBeChecked.set(signatureID, arr);
    return {
        'stampAnnot': data['json']['ofd:Signature']['ofd:SignedInfo']['ofd:StampAnnot'],
        'sealObj': sealObj,
        'signedInfo':{
            'signatureID': signatureID,
            'VerifyRet':sealObj.verifyRet,
            'Provider':data['json']['ofd:Signature']['ofd:SignedInfo']['ofd:Provider'],
            'SignatureMethod':data['json']['ofd:Signature']['ofd:SignedInfo']['ofd:SignatureMethod'],
            'SignatureDateTime':data['json']['ofd:Signature']['ofd:SignedInfo']['ofd:SignatureDateTime'],
        },
    };
}

const getSealDocumentObj = function (stampAnnot) {
    return parseOfdArchive(stampAnnot.sealObj.ofdArray);
}

const getJsonFromXmlContent = async function (zip, xmlName, drawing = false) {
    const content = await zip.files[xmlName].async('string');
    const json = parseOfdXml(content, drawing);
    return {xml: content, json};
}

const readJbig2Image = async function (entry) {
    const bytes = await entry.async('uint8array');
    const jbig2 = new Jbig2Image();
    const img = jbig2.parse(bytes);
    return {img, width: jbig2.width, height: jbig2.height, format: 'gbig2'};
}
