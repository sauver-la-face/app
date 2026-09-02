import type {
  CreateInstructionCommand,
  Instruction as InstructionDto,
  InstructionListResponse,
} from '@sauver-la-face/shared';

import { logger } from '@shared/logger';

import { Instruction } from '../domain/instruction';
import type { InstructionRepository } from '../domain/instructionRepository';

interface InstructionLogger {
  info(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
}

export class InstructionNotFoundError extends Error {
  readonly code = 'INSTRUCTION_NOT_FOUND';

  constructor(instructionId: string) {
    super(`Instruction ${instructionId} not found`);
  }
}

export class MedicalProcedureNotFoundError extends Error {
  readonly code = 'MEDICAL_PROCEDURE_NOT_FOUND';

  constructor(medicalProcedureId: string) {
    super(`Medical procedure ${medicalProcedureId} not found`);
  }
}

export class InstructionsUsecase {
  constructor(
    private readonly instructionRepository: InstructionRepository,
    private readonly instructionLogger: InstructionLogger = logger,
    private readonly nowFactory: () => Date = () => new Date(),
  ) {}

  async createInstruction(command: CreateInstructionCommand): Promise<InstructionDto> {
    const draft = Instruction.create(command);

    const exists = await this.instructionRepository.procedureExists(draft.medicalProcedureId);

    if (!exists) {
      throw new MedicalProcedureNotFoundError(draft.medicalProcedureId);
    }

    const persisted = await this.instructionRepository.create({
      medicalProcedureId: draft.medicalProcedureId,
      physicianId: draft.physicianId,
      content: draft.content,
      createdAt: this.nowFactory(),
    });

    this.instructionLogger.info(
      {
        instructionId: persisted.instructionId,
        medicalProcedureId: persisted.medicalProcedureId,
        physicianId: persisted.physicianId,
      },
      'Instruction created',
    );

    return Instruction.rehydrate(persisted).toDto();
  }

  async listForPatient(patientId: string): Promise<InstructionListResponse> {
    const records = await this.instructionRepository.listByPatient(patientId);

    return {
      instructions: records.map((record) => Instruction.rehydrate(record).toDto()),
    };
  }

  async acknowledgeInstruction(instructionId: string): Promise<InstructionDto> {
    const record = await this.instructionRepository.findById(instructionId);

    if (!record) {
      throw new InstructionNotFoundError(instructionId);
    }

    const acknowledged = Instruction.rehydrate(record).acknowledge(this.nowFactory());

    if (acknowledged.acknowledgedAt && record.acknowledgedAt === null) {
      const updated = await this.instructionRepository.markAcknowledged(
        instructionId,
        acknowledged.acknowledgedAt,
      );

      if (!updated) {
        throw new InstructionNotFoundError(instructionId);
      }

      this.instructionLogger.info({ instructionId }, 'Instruction acknowledged');
      return Instruction.rehydrate(updated).toDto();
    }

    return Instruction.rehydrate(record).toDto();
  }
}
