import { describe, expect, it } from 'bun:test';
import { Instruction } from './instruction';

const VALID_INSTRUCTION_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_PHYSICIAN_UUID = '22222222-2222-4222-8222-222222222222';
const VALID_PROCEDURE_UUID = '33333333-3333-4333-8333-333333333333';

describe('Instruction entity', () => {
  describe('create', () => {
    it('builds a draft instruction with trimmed content', () => {
      const draft = Instruction.create({
        medicalProcedureId: VALID_PROCEDURE_UUID,
        physicianId: VALID_PHYSICIAN_UUID,
        content: '   Appliquer la pommade matin et soir.   ',
      });

      expect(draft.medicalProcedureId).toBe(VALID_PROCEDURE_UUID);
      expect(draft.physicianId).toBe(VALID_PHYSICIAN_UUID);
      expect(draft.content).toBe('Appliquer la pommade matin et soir.');
      expect(draft.acknowledgedAt).toBeNull();
      expect(draft.instructionId).toBeUndefined();
      expect(draft.createdAt).toBeUndefined();
    });

    it('rejects empty content', () => {
      expect(() =>
        Instruction.create({
          medicalProcedureId: VALID_PROCEDURE_UUID,
          physicianId: VALID_PHYSICIAN_UUID,
          content: '   ',
        }),
      ).toThrow('INSTRUCTION_CONTENT_REQUIRED');
    });

    it('rejects invalid medicalProcedureId UUID', () => {
      expect(() =>
        Instruction.create({
          medicalProcedureId: 'not-a-uuid',
          physicianId: VALID_PHYSICIAN_UUID,
          content: 'valid',
        }),
      ).toThrow('INSTRUCTION_MEDICAL_PROCEDURE_INVALID');
    });

    it('rejects invalid physicianId UUID', () => {
      expect(() =>
        Instruction.create({
          medicalProcedureId: VALID_PROCEDURE_UUID,
          physicianId: 'not-a-uuid',
          content: 'valid',
        }),
      ).toThrow('INSTRUCTION_PHYSICIAN_INVALID');
    });
  });

  describe('rehydrate + toDto', () => {
    it('serialises dates to ISO strings and preserves nullable acknowledgedAt', () => {
      const dto = Instruction.rehydrate({
        instructionId: VALID_INSTRUCTION_UUID,
        medicalProcedureId: VALID_PROCEDURE_UUID,
        physicianId: VALID_PHYSICIAN_UUID,
        content: 'Consigne',
        createdAt: new Date('2026-04-01T10:00:00Z'),
        acknowledgedAt: null,
      }).toDto();

      expect(dto.createdAt).toBe('2026-04-01T10:00:00.000Z');
      expect(dto.acknowledgedAt).toBeNull();
    });

    it('serialises acknowledgedAt when set', () => {
      const dto = Instruction.rehydrate({
        instructionId: VALID_INSTRUCTION_UUID,
        medicalProcedureId: VALID_PROCEDURE_UUID,
        physicianId: VALID_PHYSICIAN_UUID,
        content: 'Consigne',
        createdAt: new Date('2026-04-01T10:00:00Z'),
        acknowledgedAt: new Date('2026-04-02T15:30:00Z'),
      }).toDto();

      expect(dto.acknowledgedAt).toBe('2026-04-02T15:30:00.000Z');
    });

    it('throws when calling toDto on a non-persisted draft', () => {
      const draft = Instruction.create({
        medicalProcedureId: VALID_PROCEDURE_UUID,
        physicianId: VALID_PHYSICIAN_UUID,
        content: 'Consigne',
      });

      expect(() => draft.toDto()).toThrow('INSTRUCTION_NOT_PERSISTED');
    });
  });

  describe('acknowledge', () => {
    const baseRehydrate = {
      instructionId: VALID_INSTRUCTION_UUID,
      medicalProcedureId: VALID_PROCEDURE_UUID,
      physicianId: VALID_PHYSICIAN_UUID,
      content: 'Consigne',
      createdAt: new Date('2026-04-01T10:00:00Z'),
    };

    it('sets acknowledgedAt when not yet acknowledged', () => {
      const acknowledged = Instruction.rehydrate({
        ...baseRehydrate,
        acknowledgedAt: null,
      }).acknowledge(new Date('2026-04-03T08:00:00Z'));

      expect(acknowledged.acknowledgedAt).toEqual(new Date('2026-04-03T08:00:00Z'));
    });

    it('is idempotent : keeps the original acknowledgedAt when already acknowledged', () => {
      const previous = new Date('2026-04-02T15:30:00Z');
      const acknowledged = Instruction.rehydrate({
        ...baseRehydrate,
        acknowledgedAt: previous,
      }).acknowledge(new Date('2026-04-03T08:00:00Z'));

      expect(acknowledged.acknowledgedAt).toEqual(previous);
    });
  });
});
