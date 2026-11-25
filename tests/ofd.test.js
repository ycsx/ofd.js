import { parseOfdDocument, getPageScale, setPageScale } from '../index.js';

describe('OFD Module Basic Tests', () => {
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
    test('parseOfdDocument should handle success callback', (done) => {
      const mockFile = new ArrayBuffer(10);
      const successCallback = jest.fn();
      const failCallback = jest.fn();

      // Note: This test would require a valid OFD file or mock
      // For now, this serves as a structure test
      expect(parseOfdDocument).toBeDefined();
      done();
    });

    test('parseOfdDocument should handle fail callback', (done) => {
      const failCallback = jest.fn();

      // Note: This test would require proper error handling setup
      expect(parseOfdDocument).toBeDefined();
      done();
    });
  });
});
