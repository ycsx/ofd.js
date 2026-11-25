import xmlParser from 'ofd-xml-parser';
import {attachSourceOrder, parseOfdXml} from '../src/ofd/ordered_page_xml';

const layerXml = `<ofd:Layer ID="27">
  <ofd:PathObject ID="22" Boundary="0 0 50 50" />
  <!-- <ofd:ImageObject ID="10" /> -->
  <ofd:PageBlock>
    <ofd:TextObject ID="9" Boundary="0 0 50 50">
      <ofd:TextCode X="0" Y="0">  &amp; <![CDATA[<ofd:PathObject ID="10"/>]]>  </ofd:TextCode>
    </ofd:TextObject>
    <ofd:PathObject ID="5" Boundary="0 0 50 50" />
  </ofd:PageBlock>
  <ofd:ImageObject ID="10" ResourceID="22" />
  <ofd:PathObject ID="3" Boundary="0 0 50 50" />
</ofd:Layer>`;
const pageXml = `<ofd:Page xmlns:ofd="http://www.ofdspec.org/2016"><ofd:Content>${layerXml}</ofd:Content></ofd:Page>`;

function objectsInSourceOrder(layer) {
    const paths = layer['ofd:PathObject'];
    const block = layer['ofd:PageBlock'];
    return [paths[0], block['ofd:TextObject'], block['ofd:PathObject'], layer['ofd:ImageObject'], paths[1]];
}

test('drawing orders survive grouped tags, nested blocks and a JSON round trip', () => {
    const parsed = parseOfdXml(pageXml, true);
    const [first, text, nested, image, last] = objectsInSourceOrder(
        JSON.parse(JSON.stringify(parsed))['ofd:Page']['ofd:Content']['ofd:Layer']
    );
    const orders = [first, text, nested, image, last].map(object => object.pfIndex);
    expect(orders.every(Number.isInteger)).toBe(true);
    expect(orders).toEqual([...new Set(orders)].sort((a, b) => a - b));
    const original = parseOfdXml(pageXml);
    expect(text['ofd:TextCode']).toEqual(original['ofd:Page']['ofd:Content']['ofd:Layer']['ofd:PageBlock']['ofd:TextObject']['ofd:TextCode']);
});

test('annotation appearance objects retain their source order', () => {
    const xml = `<ofd:PageAnnot><ofd:Annot ID="80"><ofd:Appearance>${layerXml}</ofd:Appearance></ofd:Annot></ofd:PageAnnot>`;
    const appearance = parseOfdXml(xml, true)['ofd:PageAnnot']['ofd:Annot']['ofd:Appearance'];
    const orders = objectsInSourceOrder(appearance['ofd:Layer']).map(object => object.pfIndex);
    expect(orders.every((value, index) => Number.isInteger(value) && (!index || value > orders[index - 1]))).toBe(true);
});

test('legacy page JSON is indexed once and keeps edits and existing indices', () => {
    const page = parseOfdXml(pageXml)['ofd:Page'];
    const [first, text, nested, image] = objectsInSourceOrder(page['ofd:Content']['ofd:Layer']);
    first.pfIndex = -1;
    image['@_ResourceID'] = '900';
    const parse = jest.spyOn(xmlParser, 'parse');
    try {
        attachSourceOrder(pageXml, page);
        attachSourceOrder(pageXml, page);
        expect(parse).toHaveBeenCalledTimes(1);
        expect(first.pfIndex).toBe(-1);
        expect(text.pfIndex).toBeLessThan(nested.pfIndex);
        expect(nested.pfIndex).toBeLessThan(image.pfIndex);
        expect(image['@_ResourceID']).toBe('900');
        const savedPage = JSON.parse(JSON.stringify(page));
        attachSourceOrder(pageXml, savedPage);
        expect(parse).toHaveBeenCalledTimes(1);
    } finally {
        parse.mockRestore();
    }
});
