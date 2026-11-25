import { calPageBox, renderOfd, renderOfdByScale, setPageScale } from '../index.js';

describe('OFD Rendering Functions', () => {
  const mockOfdDocument = {
    pages: [
      {
        'page-1': {
          json: { 'ofd:Template': [] },
          annotation: [{ appearance: { '@_Boundary': '10 20 30 40' } }],
        },
      },
      {
        'page-2': {
          json: {
            'ofd:Template': [],
            'ofd:Area': { 'ofd:PhysicalBox': '0 0 210 297' },
          },
        },
      },
    ],
    document: {
      'ofd:CommonData': {
        'ofd:PageArea': { 'ofd:PhysicalBox': '0 0 297 210' },
      },
    },
    tpls: {},
    fontResObj: {},
    drawParamResObj: {},
    multiMediaResObj: {},
  };

  describe('renderOfd', () => {
    test.each([1720, 800.25, 120.5])('fits each page to %s CSS pixels', (width) => {
      const box = calPageBox(width, mockOfdDocument.document, mockOfdDocument.pages[0]);
      expect(box.w).toBeCloseTo(width);
      expect(box.h).toBeCloseTo(width * 210 / 297);

      setPageScale(1);
      const [landscape, portrait] = renderOfd(width, mockOfdDocument);
      expect(parseFloat(landscape.style.width)).toBeCloseTo(width);
      expect(parseFloat(landscape.style.height)).toBeCloseTo(width * 210 / 297);
      expect(parseFloat(portrait.style.width)).toBeCloseTo(width);
      expect(parseFloat(portrait.style.height)).toBeCloseTo(width * 297 / 210);

      const annotation = landscape.firstElementChild;
      expect(parseFloat(annotation.style.left)).toBeCloseTo(width * 10 / 297);
      expect(parseFloat(annotation.style.width)).toBeCloseTo(width * 30 / 297);
    });

    test('renderOfd should handle null document gracefully', () => {
      const screenWidth = 1024;
      const result = renderOfd(screenWidth, null);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('renderOfd should handle undefined document gracefully', () => {
      const screenWidth = 1024;
      const result = renderOfd(screenWidth, undefined);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('renderOfdByScale', () => {
    test('can use an explicit scale after fitting a narrow container', () => {
      renderOfd(120.5, mockOfdDocument);
      setPageScale(2);
      const [landscape, portrait] = renderOfdByScale(mockOfdDocument);
      expect(parseFloat(landscape.style.width)).toBeCloseTo(297 * 2);
      expect(parseFloat(portrait.style.width)).toBeCloseTo(210 * 2);
    });

    test('renderOfdByScale should handle null document gracefully', () => {
      const result = renderOfdByScale(null);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('renderOfdByScale should handle undefined document gracefully', () => {
      const result = renderOfdByScale(undefined);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });
});
