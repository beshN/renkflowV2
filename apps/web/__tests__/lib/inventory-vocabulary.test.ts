import { COUNT_UNITS, movementSourceLabel, normalizeStates, unitLabel, warehouseTypeLabel } from '@/lib/features/inventory/vocabulary';
import { assertQuantityPrecision } from '@/lib/features/warehouse/contracts';

describe('stock vocabulary', () => {
  it('shows warehouse types, units and movement sources in Turkish, keeping unknown codes visible', () => {
    expect(['RAW', 'WIP', 'FINISHED', 'REJECTED'].map(warehouseTypeLabel)).toEqual(['Hammadde deposu', 'Üretim (yarı mamul)', 'Mamul deposu', 'Red / iade']);
    expect(warehouseTypeLabel('NEW_TYPE')).toBe('NEW_TYPE');
    expect([unitLabel('takim'), unitLabel('boy'), unitLabel('m')]).toEqual(['takım', 'boy (profil)', 'metre']);
    expect([movementSourceLabel('cutting_plan'), movementSourceLabel('manual'), movementSourceLabel(null)]).toEqual(['Kesim planı', 'Elle giriş', 'Kaynak yok']);
  });

  it('puts processed states in one order and drops unknown ones, so identity matches', () => {
    expect(normalizeStates(['delikli', 'boyali', 'boyali', 'parlak'])).toEqual(['boyali', 'delikli']);
  });

  it('counts adet, takım and boy in whole pieces only', () => {
    expect([...COUNT_UNITS].sort()).toEqual(['adet', 'boy', 'takim']);
    expect(() => assertQuantityPrecision(2.5, 'takim')).toThrow(/takım biriminde tam sayı/);
    expect(() => assertQuantityPrecision(3, 'boy')).not.toThrow();
    expect(() => assertQuantityPrecision(2.5, 'm')).not.toThrow();
  });
});
