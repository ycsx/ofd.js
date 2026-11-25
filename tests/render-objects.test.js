import JSZip from 'jszip';
import { parseOfdDocument, renderOfd, setPageScale } from '../index.js';
import { renderImageObject, renderTextObject } from '../src/ofd/ofd_render.js';

jest.unmock('@xmldom/xmldom');

function mapPoint(transform, x, y) {
  // jsdom does not implement SVG getCTM. Apply the emitted matrices right to left.
  const matrices = Array.from(transform.matchAll(/matrix\(([^)]+)\)/g));
  expect(matrices.length).toBeGreaterThan(0);
  return matrices.reverse().reduce(([px, py], [, matrix]) => {
    const [a, b, c, d, e, f] = matrix.trim().split(/[\s,]+/).map(Number);
    return [a * px + c * py + e, b * px + d * py + f];
  }, [x, y]);
}

afterEach(() => jest.restoreAllMocks());

test('paints only consecutive paths together, in XML order across page blocks', async () => {
  const starts = new Map();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const points = [];
    starts.set(this, points);
    return {
      scale() {}, save() {}, restore() {}, translate() {},
      beginPath() {}, moveTo(x) { points.push(x); }, lineTo() {}, stroke() {},
    };
  });
  const namespace = 'xmlns:ofd="http://www.ofdspec.org/2016"';
  const path = id => `<ofd:PathObject ID="${id}" Boundary="0 0 20 20">
    <ofd:AbbreviatedData>M ${id / 10} 1 L 19 19</ofd:AbbreviatedData></ofd:PathObject>`;
  const zip = new JSZip();
  zip.file('OFD.xml', `<ofd:OFD ${namespace}><ofd:DocBody>
    <ofd:DocRoot>Doc/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`);
  zip.file('Doc/Document.xml', `<ofd:Document ${namespace}><ofd:CommonData><ofd:PageArea>
    <ofd:PhysicalBox>0 0 100 100</ofd:PhysicalBox></ofd:PageArea>
    <ofd:DocumentRes>Res.xml</ofd:DocumentRes></ofd:CommonData>
    <ofd:Pages><ofd:Page ID="1" BaseLoc="Page.xml"/></ofd:Pages></ofd:Document>`);
  zip.file('Doc/Res.xml', `<ofd:Res ${namespace}><ofd:MultiMedias>
    <ofd:MultiMedia ID="2" Type="Image"><ofd:MediaFile>pixel.png</ofd:MediaFile>
    </ofd:MultiMedia></ofd:MultiMedias></ofd:Res>`);
  zip.file('Doc/pixel.png', 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC', { base64: true });
  zip.file('Doc/Page.xml', `<ofd:Page ${namespace}><ofd:Content><ofd:Layer ID="3">
    ${path(80)}${path(70)}<ofd:PageBlock ID="60">
    <ofd:ImageObject ID="50" ResourceID="2" Boundary="0 0 20 20" CTM="20 0 0 20 0 0"/>
    </ofd:PageBlock>${path(40)}</ofd:Layer></ofd:Content></ofd:Page>`);

  const ofd = await zip.generateAsync({ type: 'arraybuffer' });
  const [doc] = await new Promise((success, fail) => parseOfdDocument({ ofd, success, fail }));
  const [page] = renderOfd(200, doc);
  const objects = Array.from(page.children);
  expect(objects.map(node => node.tagName)).toEqual(['CANVAS', 'DIV', 'CANVAS']);
  expect(starts.get(objects[0])).toEqual([16, 14]);
  expect(starts.get(objects[2])).toEqual([8]);
  expect(objects[1].querySelector('img')).toBeTruthy();
  const levels = objects.map(node => Number(node.style.zIndex) || 0);
  expect(levels[0]).toBeLessThanOrEqual(levels[1]);
  expect(levels[1]).toBeLessThanOrEqual(levels[2]);
});

test.each([
  ['png', '0 0 40 24', '0px', '0px'],
  ['gbig2', '3 5 40 24', '6px', '10px'],
])('rotates the %s image in its local boundary', (format, boundary, left, top) => {
  setPageScale(2);
  const bitmap = { format, img: new Uint8Array([255, 0]), width: 2, height: 1 };
  const media = format === 'png' ? { format, img: 'pixel.png' } : bitmap;
  const originalImageData = global.ImageData;
  try {
    global.ImageData = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      putImageData() {}, createImageData: () => ({ data: new Uint8ClampedArray(8) }),
      scale() {}, drawImage() {},
    });
    const frame = renderImageObject('200px', '200px', { 1: media }, {
      '@_ResourceID': '1', '@_Boundary': boundary, '@_CTM': '0 24 -40 0 40 0',
    });
    expect(frame.style.overflow).toBe('hidden');
    expect([frame.style.left, frame.style.top, frame.style.width, frame.style.height])
      .toEqual([left, top, '80px', '48px']);
    const image = frame.querySelector(format === 'png' ? 'img' : 'canvas');
    expect(image).toBeTruthy();
    expect([image.style.width, image.style.height]).toEqual(['100%', '100%']);
    expect(image.style.transformOrigin).toMatch(/^0(px)? 0(px)?$/);
    expect(mapPoint(image.style.transform, 0, 0)).toEqual([80, 0]);
    expect(mapPoint(image.style.transform, 80, 0)).toEqual([80, 48]);
    const [x, y] = mapPoint(image.style.transform, 0, 48);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  } finally {
    if (originalImageData === undefined) delete global.ImageData;
    else global.ImageData = originalImageData;
  }
});

test('horizontal glyph scaling preserves the text CTM and the glyph anchor', () => {
  setPageScale(2);
  const svg = renderTextObject({}, {
    '@_Boundary': '0 0 80 60', '@_Size': '4', '@_CTM': '0 1 -1 0 20 5', '@_HScale': '0.5',
    'ofd:TextCode': { '@_X': '10', '@_Y': '10', '#text': 'A' },
  });
  const text = svg.querySelector('text');
  const transform = text.getAttribute('transform');
  // Local (20,20) remains the anchor. A 10px advance rotates into a 5px vertical advance.
  expect(mapPoint(transform, 20, 20)).toEqual([20, 30]);
  expect(mapPoint(transform, 30, 20)).toEqual([20, 35]);
});

test('paints foreground templates above content and accepts pages without a template', () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const content = id => ({
    'ofd:Content': { 'ofd:Layer': { 'ofd:TextObject': {
      '@_ID': id, '@_Boundary': '0 0 30 30', '@_Size': '4',
      'ofd:TextCode': { '@_X': '1', '@_Y': '5', '#text': id },
    } } },
  });
  const doc = {
    document: { 'ofd:CommonData': { 'ofd:PageArea': { 'ofd:PhysicalBox': '0 0 100 100' } } },
    tpls: { 5: { json: content('foreground') }, 6: { json: content('background') } },
    pages: [
      { 1: { json: {
        ...content('body'),
        'ofd:Template': [
          { '@_TemplateID': '5', '@_ZOrder': 'Foreground' }, { '@_TemplateID': '6' },
        ],
      } } },
      { 2: { json: content('plain') } },
    ],
    fontResObj: {}, drawParamResObj: {}, multiMediaResObj: {},
  };
  const [withTemplates, plain] = renderOfd(200, doc);
  const order = page => Array.from(page.querySelectorAll('text'), node => node.textContent);
  expect(order(withTemplates)).toEqual(['background', 'body', 'foreground']);
  expect(order(plain)).toEqual(['plain']);
  expect(consoleError).not.toHaveBeenCalled();
});
