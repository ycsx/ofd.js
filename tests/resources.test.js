import JSZip from 'jszip';
import { parseSingleDoc } from '../src/ofd/ofd_parser';

function makeArchive(commonData = '') {
  const zip = new JSZip();
  zip.file('Doc_0/Document.xml', `<ofd:Document><ofd:CommonData>${commonData}</ofd:CommonData>
    <ofd:Pages><ofd:Page ID="1" BaseLoc="Pages/Page.xml"/></ofd:Pages></ofd:Document>`);
  zip.file('Doc_0/Pages/Page.xml', '<ofd:Page><ofd:Content/></ofd:Page>');
  return zip;
}

async function parse(zip) {
  const [doc] = await parseSingleDoc([zip, [{ 'ofd:DocRoot': 'Doc_0/Document.xml' }]]);
  return doc;
}

const fonts = (id) => `<ofd:Res><ofd:Fonts><ofd:Font ID="${id}" FontName="F${id}"/></ofd:Fonts></ofd:Res>`;
const image = (id, file, format = 'JPEG') => `<ofd:MultiMedia ID="${id}" Type="Image" Format="${format}">
  <ofd:MediaFile>${file}</ofd:MediaFile></ofd:MultiMedia>`;
const catalog = (images) => `<ofd:Res BaseLoc="../Media"><ofd:MultiMedias>${images}</ofd:MultiMedias></ofd:Res>`;

beforeEach(() => { global.xmlParseFlag = 0; });

test('merges all public and document resource catalogs in order', async () => {
  const zip = makeArchive(`<ofd:DocumentRes>D.xml</ofd:DocumentRes><ofd:DocumentRes>E.xml</ofd:DocumentRes>
    <ofd:PublicRes>A.xml</ofd:PublicRes><ofd:PublicRes>/Doc_0/B.xml</ofd:PublicRes>
    <ofd:PublicRes>Empty.xml</ofd:PublicRes>`);
  ['D', 'E', 'A', 'B'].forEach((name, i) => zip.file(`Doc_0/${name}.xml`, fonts(i + 1)));
  zip.file('Doc_0/Empty.xml', '<ofd:Res/>');
  expect((await parse(zip)).fontResObj).toEqual({ 1: 'F1', 2: 'F2', 3: 'F3', 4: 'F4' });
});

test('prefers the exact template path and accepts an unambiguous case mismatch', async () => {
  const zip = makeArchive('<ofd:TemplatePage ID="2" BaseLoc="TPLS/Tpl_0/Content.xml"/>');
  zip.file('Doc_0/Tpls/Tpl_0/Content.xml', '<ofd:Page><ofd:Content>legacy</ofd:Content></ofd:Page>');
  expect((await parse(zip)).tpls[2].json['ofd:Content']).toBe('legacy');
  zip.file('Doc_0/TPLS/Tpl_0/Content.xml', '<ofd:Page><ofd:Content>exact</ofd:Content></ofd:Page>');
  expect((await parse(zip)).tpls[2].json['ofd:Content']).toBe('exact');
  zip.remove('Doc_0/TPLS/Tpl_0/Content.xml');
  zip.file('Doc_0/tpls/Tpl_0/Content.xml', '<ofd:Page/>');
  await expect(parse(zip)).rejects.toThrow('OFD page not found');
});

test('resolves images relative to their catalog and reads shared data once per format', async () => {
  const zip = makeArchive('<ofd:DocumentRes>Resources/First.xml</ofd:DocumentRes><ofd:PublicRes>Resources/Second.xml</ofd:PublicRes>');
  zip.file('Doc_0/Resources/First.xml', catalog(image('2', 'Photo.jpg')));
  zip.file('Doc_0/Resources/Second.xml', catalog(image('3', '/DOC_0/Media/Photo.jpg') + image('4', 'Photo.jpg', 'PNG')));
  zip.file('DOC_0/Media/Photo.jpg', 'first');
  const entry = zip.file('DOC_0/Media/Photo.jpg');
  const read = jest.spyOn(entry, 'async');
  const media = (await parse(zip)).multiMediaResObj;
  expect(media[2].img).toBe('data:image/jpeg;base64,Zmlyc3Q=');
  expect(media[3]).toEqual(media[2]);
  expect(media[4].img).toBe('data:image/png;base64,Zmlyc3Q=');
  expect(read).toHaveBeenCalledTimes(2);

  zip.file('Collection/Doc_1/Document.xml', await zip.file('Doc_0/Document.xml').async('string'));
  zip.file('Collection/Doc_1/Pages/Page.xml', '<ofd:Page/>');
  zip.file('Collection/Doc_1/Resources/First.xml', catalog(image('2', 'Photo.jpg')));
  zip.file('Collection/Doc_1/Media/Photo.jpg', 'second');
  const roots = ['Doc_0', 'Collection/Doc_1'].map(dir => ({ 'ofd:DocRoot': dir + '/Document.xml' }));
  const [firstDoc, secondDoc] = await parseSingleDoc([zip, roots]);
  expect(firstDoc.multiMediaResObj[2].img).toBe(media[2].img);
  expect(secondDoc.multiMediaResObj[2].img).toBe('data:image/jpeg;base64,c2Vjb25k');
});
