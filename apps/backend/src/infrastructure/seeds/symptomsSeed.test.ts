import { describe, expect, test } from 'bun:test';
import { SYMPTOMS_SEED } from './symptomsSeed';

describe('SYMPTOMS_SEED', () => {
  test('contient au moins un symptôme', () => {
    expect(SYMPTOMS_SEED.length).toBeGreaterThan(0);
  });

  test('tous les codes sont uniques', () => {
    const codes = SYMPTOMS_SEED.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test('tous les codes respectent le format snake_case', () => {
    for (const entry of SYMPTOMS_SEED) {
      expect(entry.code).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test('aucun label FR ou KM vide', () => {
    for (const entry of SYMPTOMS_SEED) {
      expect(entry.label_fr.trim().length).toBeGreaterThan(0);
      expect(entry.label_km.trim().length).toBeGreaterThan(0);
    }
  });

  test('au moins un symptôme déclenche une alerte', () => {
    expect(SYMPTOMS_SEED.some((s) => s.triggers_alert)).toBe(true);
  });
});
