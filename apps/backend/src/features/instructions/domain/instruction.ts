import type { Instruction as InstructionDto } from '@sauver-la-face/shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface InstructionState {
  instructionId?: string;
  medicalProcedureId: string;
  physicianId: string;
  content: string;
  createdAt?: Date;
  acknowledgedAt: Date | null;
}

interface CreateInput {
  medicalProcedureId: string;
  physicianId: string;
  content: string;
}

interface RehydrateInput {
  instructionId: string;
  medicalProcedureId: string;
  physicianId: string;
  content: string;
  createdAt: Date;
  acknowledgedAt: Date | null;
}

export class Instruction {
  private constructor(private readonly state: InstructionState) {}

  static create(input: CreateInput): Instruction {
    return new Instruction({
      medicalProcedureId: assertUuid(
        input.medicalProcedureId,
        'INSTRUCTION_MEDICAL_PROCEDURE_INVALID',
      ),
      physicianId: assertUuid(input.physicianId, 'INSTRUCTION_PHYSICIAN_INVALID'),
      content: normalizeContent(input.content),
      acknowledgedAt: null,
    });
  }

  static rehydrate(input: RehydrateInput): Instruction {
    return new Instruction({
      instructionId: assertUuid(input.instructionId, 'INSTRUCTION_ID_INVALID'),
      medicalProcedureId: assertUuid(
        input.medicalProcedureId,
        'INSTRUCTION_MEDICAL_PROCEDURE_INVALID',
      ),
      physicianId: assertUuid(input.physicianId, 'INSTRUCTION_PHYSICIAN_INVALID'),
      content: normalizeContent(input.content),
      createdAt: input.createdAt,
      acknowledgedAt: input.acknowledgedAt,
    });
  }

  acknowledge(now: Date): Instruction {
    if (this.state.acknowledgedAt !== null) {
      return this;
    }

    return new Instruction({
      ...this.state,
      acknowledgedAt: now,
    });
  }

  get instructionId(): string | undefined {
    return this.state.instructionId;
  }

  get medicalProcedureId(): string {
    return this.state.medicalProcedureId;
  }

  get physicianId(): string {
    return this.state.physicianId;
  }

  get content(): string {
    return this.state.content;
  }

  get createdAt(): Date | undefined {
    return this.state.createdAt;
  }

  get acknowledgedAt(): Date | null {
    return this.state.acknowledgedAt;
  }

  toDto(): InstructionDto {
    if (!this.state.instructionId || !this.state.createdAt) {
      throw new Error('INSTRUCTION_NOT_PERSISTED');
    }

    return {
      instructionId: this.state.instructionId,
      medicalProcedureId: this.state.medicalProcedureId,
      physicianId: this.state.physicianId,
      content: this.state.content,
      createdAt: this.state.createdAt.toISOString(),
      acknowledgedAt: this.state.acknowledgedAt?.toISOString() ?? null,
    };
  }
}

function assertUuid(value: string, errorCode: string): string {
  if (!UUID_REGEX.test(value)) {
    throw new Error(errorCode);
  }

  return value;
}

function normalizeContent(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error('INSTRUCTION_CONTENT_REQUIRED');
  }

  return trimmed;
}
