import {
  calculateRectangularFrameProfileMeters,
  calculateScrapWeight,
  scaleBomQuantity,
} from '../calculations';

describe('native manufacturing calculations', () => {
  it('calculates pilot scrap weight deterministically', () => {
    expect(calculateScrapWeight(0.05, 0.85)).toBe(0.0425);
  });

  it('scales a BOM material quantity to planned output', () => {
    expect(scaleBomQuantity(4, 1, 3)).toBe(12);
  });

  it('calculates rectangular frame profile in meters', () => {
    expect(calculateRectangularFrameProfileMeters({
      widthMm: 1000,
      heightMm: 2000,
      quantity: 2,
      allowanceMmPerFrame: 250,
    })).toBe(12.5);
  });

  it('rejects invalid physical inputs', () => {
    expect(() => calculateScrapWeight(-1, 0.85)).toThrow();
    expect(() => scaleBomQuantity(4, 0, 1)).toThrow();
  });
});
