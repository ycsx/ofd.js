import xmlParser from 'ofd-xml-parser';

const xmlOptions = {
    attributeNamePrefix: '@_',
    ignoreAttributes: false,
    parseNodeValue: false,
    trimValues: false,
};
const indexedPages = new WeakSet();
const drawingTags = new Set([
    'ofd:PathObject', 'ofd:ImageObject', 'ofd:TextObject', 'ofd:PageBlock',
]);

function readDrawingXml(xml) {
    // OFD drawing object IDs are unique. The parser reads their attributes in
    // source order, before grouping sibling elements by tag name in its JSON.
    const positions = new Map();
    const json = xmlParser.parse(xml, {
        ...xmlOptions,
        attrValueProcessor(value, name) {
            if (name === 'ID' && !positions.has(value)) positions.set(value, positions.size);
            return value;
        },
    });
    return {json, positions};
}

function visitDrawingObjects(node, visit) {
    for (const [tag, value] of Object.entries(node)) {
        if (!tag.startsWith('ofd:') || !value || typeof value !== 'object') continue;
        for (const child of Array.isArray(value) ? value : [value]) {
            if (!child || typeof child !== 'object') continue;
            if (drawingTags.has(tag)) visit(child);
            if (tag === 'ofd:PageBlock' || !drawingTags.has(tag)) visitDrawingObjects(child, visit);
        }
    }
}

function applyPositions(json, positions) {
    visitDrawingObjects(json, object => {
        const id = object['@_ID'];
        if (object.pfIndex === undefined && positions.has(id)) object.pfIndex = positions.get(id);
    });
}

export function parseOfdXml(xml, drawing = false) {
    if (!drawing) return xmlParser.parse(xml, xmlOptions);
    const {json, positions} = readDrawingXml(xml);
    applyPositions(json, positions);
    const page = json['ofd:Page'];
    if (page && typeof page === 'object') indexedPages.add(page);
    return json;
}

export function attachSourceOrder(xml, pageJson) {
    if (!xml || !pageJson || typeof pageJson !== 'object' || indexedPages.has(pageJson)) return;
    // Legacy serialized pages still carry the XML. Only read it when an object
    // actually lacks its order, and retain any edits to the parsed page.
    let positions;
    visitDrawingObjects(pageJson, object => {
        if (object.pfIndex !== undefined || object['@_ID'] === undefined) return;
        if (!positions) positions = readDrawingXml(xml).positions;
        if (positions.has(object['@_ID'])) object.pfIndex = positions.get(object['@_ID']);
    });
    indexedPages.add(pageJson);
}
