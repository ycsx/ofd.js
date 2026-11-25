import { calPageBox, getPageScale, renderOfd, renderOfdByScale, renderPage, setPageScale } from '../index.js';

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

  describe('renderPage', () => {
    test('uses the target page width after other page measurements', () => {
      const [landscape, portrait] = mockOfdDocument.pages;
      const box = calPageBox(1720, mockOfdDocument.document, landscape);
      calPageBox(800, mockOfdDocument.document, landscape);
      calPageBox(1720, mockOfdDocument.document, portrait);
      const previousScale = getPageScale();

      const pageDiv = document.createElement('div');
      pageDiv.style.width = `${box.w}px`;
      pageDiv.style.height = `${box.h}px`;
      renderPage(pageDiv, landscape, {}, {}, {}, {});

      expect(parseFloat(pageDiv.firstElementChild.style.width)).toBeCloseTo(30 * 1720 / 297);
      expect(getPageScale()).toBe(previousScale);
    });
  });

  describe('renderOfdByScale', () => {
    test('restores the fitted scale of an 80 mm receipt', () => {
      const receipt = {
        ...mockOfdDocument,
        pages: [mockOfdDocument.pages[0]],
        document: { 'ofd:CommonData': { 'ofd:PageArea': { 'ofd:PhysicalBox': '0 0 80 150' } } },
      };
      renderOfd(1720, receipt);
      const fittedScale = getPageScale();
      expect(fittedScale).toBe(21.5);

      setPageScale(2);
      setPageScale(fittedScale);
      expect(getPageScale()).toBe(fittedScale);
      const [page] = renderOfdByScale(receipt);
      expect(parseFloat(page.style.width)).toBeCloseTo(1720);
    });

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
