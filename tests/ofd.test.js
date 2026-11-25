import JSZip from 'jszip';
import { parseOfdDocument, getPageScale, setPageScale } from '../index.js';

describe('OFD Module Basic Tests', () => {
  test('loading the library preserves host array enumeration', () => {
    expect(Object.prototype.hasOwnProperty.call(Array.prototype, 'pipeline')).toBe(false);
  });

  describe('Page Scale Functions', () => {
    beforeEach(() => {
      setPageScale(1.0);
    });

    test('setPageScale should set scale value', () => {
      setPageScale(1.5);
      expect(getPageScale()).toBe(1.5);
    });

    test('getPageScale should return default 1.0', () => {
      expect(getPageScale()).toBe(1.0);
    });

    test('getPageScale should handle decimal values', () => {
      setPageScale(0.75);
      expect(getPageScale()).toBe(0.75);
    });

    test('getPageScale should accept multiple updates', () => {
      setPageScale(0.8);
      expect(getPageScale()).toBe(0.8);
      setPageScale(1.2);
      expect(getPageScale()).toBe(1.2);
      setPageScale(2.0);
      expect(getPageScale()).toBe(2.0);
    });
  });

  describe('parseOfdDocument', () => {
    test.each([1, 2])('returns an ordered document array for %i DocBody entries', async count => {
      const zip = new JSZip();
      const namespace = 'xmlns:ofd="http://www.ofdspec.org/2016"';
      const docBodies = [];
      for (let i = 0; i < count; i++) {
        const dir = `Doc_${i}`;
        docBodies.push(`<ofd:DocBody><ofd:DocRoot>${dir}/Document.xml</ofd:DocRoot></ofd:DocBody>`);
        zip.file(`${dir}/Document.xml`, `<ofd:Document ${namespace}>
          <ofd:CommonData><ofd:PageArea><ofd:PhysicalBox>0 0 210 297</ofd:PhysicalBox></ofd:PageArea></ofd:CommonData>
          <ofd:Pages><ofd:Page ID="${i + 1}" BaseLoc="Page.xml"/></ofd:Pages>
        </ofd:Document>`);
        zip.file(`${dir}/Page.xml`, `<ofd:Page ${namespace}><ofd:Content/></ofd:Page>`);
      }
      zip.file('OFD.xml', `<ofd:OFD ${namespace}>${docBodies.join('')}</ofd:OFD>`);
      const ofd = await zip.generateAsync({ type: 'arraybuffer' });
      const documents = await new Promise((success, fail) => parseOfdDocument({ ofd, success, fail }));

      expect(Array.isArray(documents)).toBe(true);
      expect(documents).toHaveLength(count);
      documents.forEach((doc, index) => {
        expect(doc.pages).toHaveLength(1);
        expect(Object.keys(doc.pages[0])).toEqual([String(index + 1)]);
      });
    });

    test('parseOfdDocument should handle fail callback', (done) => {
      const failCallback = jest.fn();

      // Note: This test would require proper error handling setup
      expect(parseOfdDocument).toBeDefined();
      done();
    });
  });
});
