import { describe, expect, it } from 'vitest';
import { analysisFps, packMasks, type SubjectMask } from '../utils/subjectMask';

/** Reads a packed file back the way the server does (backend SubjectMaskStore). */
async function unpack(blob: Blob) {
  const view = new DataView(await blob.arrayBuffer());
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const width = view.getUint16(4, true);
  const height = view.getUint16(6, true);
  const fps = view.getUint32(8, true) / 100;
  const count = view.getUint32(12, true);
  let offset = 16;
  const frames: number[][] = [];
  for (let f = 0; f < count; f++) {
    const len = view.getUint32(offset, true);
    offset += 4;
    const pixels: number[] = [];
    let person = false;
    for (let i = 0; i < len; i += 2) {
      const run = view.getUint16(offset + i, true);
      for (let r = 0; r < run; r++) pixels.push(person ? 1 : 0);
      person = !person;
    }
    offset += len;
    frames.push(pixels);
  }
  return { magic, width, height, fps, frames, rest: view.byteLength - offset };
}

describe('Person outline packing', () => {
  it('round-trips masks in the format the server reads', async () => {
    const a: SubjectMask = { width: 4, height: 2, data: new Uint8Array([0, 0, 255, 255, 10, 200, 200, 0]) };
    const b: SubjectMask = { width: 4, height: 2, data: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]) };
    const out = await unpack(packMasks([a, b], 7.5));

    expect(out).toMatchObject({ magic: 'SSM1', width: 4, height: 2, fps: 7.5, rest: 0 });
    expect(out.frames[0]).toEqual([0, 0, 1, 1, 0, 1, 1, 0]);
    expect(out.frames[1]).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('splits runs longer than 65535 pixels', async () => {
    const big: SubjectMask = { width: 300, height: 300, data: new Uint8Array(90000) };
    const out = await unpack(packMasks([big], 10));
    expect(out.frames[0]).toHaveLength(90000);
    expect(out.frames[0]!.every((p) => p === 0)).toBe(true);
  });

  it('samples long videos less often', () => {
    expect(analysisFps(30)).toBe(10);
    expect(analysisFps(600)).toBe(5);
    expect(analysisFps(3 * 3600)).toBe(2);
  });
});
