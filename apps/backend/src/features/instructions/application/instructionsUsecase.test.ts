import { describe, expect, it } from 'bun:test';
import { InMemoryInstructionRepository } from '../infrastructure/instructionRepository';
import {
  InstructionNotFoundError,
  InstructionsUsecase,
  MedicalProcedureNotFoundError,
} from './instructionsUsecase';

const PHYSICIAN_UUID = '22222222-2222-4222-8222-222222222222';
const PROCEDURE_UUID = '33333333-3333-4333-8333-333333333333';
const PATIENT_UUID = '44444444-4444-4444-8444-444444444444';
const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';

const silentLogger = {
  info: () => undefined,
  warn: () => undefined,
};

describe('InstructionsUsecase', () => {
  describe('createInstruction', () => {
    it('persists a new instruction with the current date when the procedure exists', async () => {
      const now = new Date('2026-04-01T10:00:00Z');
      const repository = new InMemoryInstructionRepository({
        procedures: [{ medicalProcedureId: PROCEDURE_UUID, patientId: PATIENT_UUID }],
      });
      const usecase = new InstructionsUsecase(repository, silentLogger, () => now);

      const dto = await usecase.createInstruction({
        medicalProcedureId: PROCEDURE_UUID,
        physicianId: PHYSICIAN_UUID,
        content: 'Appliquer la pommade matin et soir.',
      });

      expect(dto.physicianId).toBe(PHYSICIAN_UUID);
      expect(dto.medicalProcedureId).toBe(PROCEDURE_UUID);
      expect(dto.content).toBe('Appliquer la pommade matin et soir.');
      expect(dto.createdAt).toBe(now.toISOString());
      expect(dto.acknowledgedAt).toBeNull();
      expect(dto.instructionId).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('throws MedicalProcedureNotFoundError when the procedure does not exist', async () => {
      const repository = new InMemoryInstructionRepository();
      const usecase = new InstructionsUsecase(repository, silentLogger);

      await expect(
        usecase.createInstruction({
          medicalProcedureId: UNKNOWN_UUID,
          physicianId: PHYSICIAN_UUID,
          content: 'Consigne',
        }),
      ).rejects.toBeInstanceOf(MedicalProcedureNotFoundError);
    });
  });

  describe('listForPatient', () => {
    it('returns instructions for procedures attached to the patient, newest first', async () => {
      const repository = new InMemoryInstructionRepository({
        procedures: [{ medicalProcedureId: PROCEDURE_UUID, patientId: PATIENT_UUID }],
        instructions: [
          {
            instructionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            medicalProcedureId: PROCEDURE_UUID,
            physicianId: PHYSICIAN_UUID,
            content: 'Premiere consigne',
            createdAt: new Date('2026-04-01T10:00:00Z'),
            acknowledgedAt: null,
          },
          {
            instructionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            medicalProcedureId: PROCEDURE_UUID,
            physicianId: PHYSICIAN_UUID,
            content: 'Deuxieme consigne',
            createdAt: new Date('2026-04-05T12:00:00Z'),
            acknowledgedAt: null,
          },
        ],
      });
      const usecase = new InstructionsUsecase(repository, silentLogger);

      const response = await usecase.listForPatient(PATIENT_UUID);

      expect(response.instructions).toHaveLength(2);
      expect(response.instructions[0].content).toBe('Deuxieme consigne');
      expect(response.instructions[1].content).toBe('Premiere consigne');
    });

    it('returns an empty list when the patient has no procedures', async () => {
      const repository = new InMemoryInstructionRepository();
      const usecase = new InstructionsUsecase(repository, silentLogger);

      const response = await usecase.listForPatient(UNKNOWN_UUID);

      expect(response.instructions).toEqual([]);
    });
  });

  describe('acknowledgeInstruction', () => {
    it('sets acknowledgedAt to now when the instruction has not been read yet', async () => {
      const now = new Date('2026-04-10T08:00:00Z');
      const repository = new InMemoryInstructionRepository({
        procedures: [{ medicalProcedureId: PROCEDURE_UUID, patientId: PATIENT_UUID }],
        instructions: [
          {
            instructionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            medicalProcedureId: PROCEDURE_UUID,
            physicianId: PHYSICIAN_UUID,
            content: 'Consigne',
            createdAt: new Date('2026-04-01T10:00:00Z'),
            acknowledgedAt: null,
          },
        ],
      });
      const usecase = new InstructionsUsecase(repository, silentLogger, () => now);

      const dto = await usecase.acknowledgeInstruction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

      expect(dto.acknowledgedAt).toBe(now.toISOString());
    });

    it('is idempotent : keeps the original acknowledgedAt if already acknowledged', async () => {
      const original = new Date('2026-04-02T15:30:00Z');
      const later = new Date('2026-04-10T08:00:00Z');
      const repository = new InMemoryInstructionRepository({
        procedures: [{ medicalProcedureId: PROCEDURE_UUID, patientId: PATIENT_UUID }],
        instructions: [
          {
            instructionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            medicalProcedureId: PROCEDURE_UUID,
            physicianId: PHYSICIAN_UUID,
            content: 'Consigne',
            createdAt: new Date('2026-04-01T10:00:00Z'),
            acknowledgedAt: original,
          },
        ],
      });
      const usecase = new InstructionsUsecase(repository, silentLogger, () => later);

      const dto = await usecase.acknowledgeInstruction('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

      expect(dto.acknowledgedAt).toBe(original.toISOString());
    });

    it('throws InstructionNotFoundError when the instruction does not exist', async () => {
      const repository = new InMemoryInstructionRepository();
      const usecase = new InstructionsUsecase(repository, silentLogger);

      await expect(usecase.acknowledgeInstruction(UNKNOWN_UUID)).rejects.toBeInstanceOf(
        InstructionNotFoundError,
      );
    });
  });
});
