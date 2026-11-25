import { calTextPoint, setPageScal } from '../src/ofd/ofd_util';

test('joins unspaced text at the first matching origin and preserves individually positioned glyphs', () => {
  setPageScal(2);
  const textCodes = [
    { '@_X': '1', '@_Y': '2', '@_DeltaX': '0 3', '#text': 'ABC' },
    { '@_X': '4', '@_Y': '2', '#text': '中文' },
    { '@_X': '1', '@_Y': '2', '#text': '追加' },
    { '@_X': '4', '@_Y': '3', '#text': '另一行' },
    { '@_X': '6', '@_Y': '3', '@_DeltaY': '1', '#text': 'DE' },
    { '@_X': '6', '@_Y': '4', '#text': '末尾' },
  ];
  expect(calTextPoint(textCodes)).toEqual([
    { x: 2, y: 4, text: 'A追加' },
    { x: 2, y: 4, text: 'B' },
    { x: 8, y: 4, text: 'C中文' },
    { x: 8, y: 6, text: '另一行' },
    { x: 12, y: 6, text: 'D' },
    { x: 12, y: 8, text: 'E末尾' },
  ]);
});
