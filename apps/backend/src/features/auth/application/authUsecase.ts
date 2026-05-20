import { PatientCodeValue } from '@sauver-la-face/shared';
import { generateCode, isExpired } from '../domain/authDomain';
import type { PatientCode, PatientCodeRepository } from '../domain/patientCodeRepository';
import type { TokenProvider } from './tokenProvider';

export type ValidateResult =
  | { success: true; patientCode: PatientCode; token: string }
  | {
      success: false;
      error: 'INVALID_CODE' | 'EXPIRED_CODE' | 'DELETED_CODE' | 'REVOKED_CODE' | 'INACTIVE_CODE';
    };

export class AuthUsecase {
  constructor(
    private readonly repository: PatientCodeRepository,
    private readonly tokenProvider: TokenProvider,
  ) {}

  async generatePatientCode(
    uuid_patient: string,
    random: () => string = () => Math.floor(100000 + Math.random() * 900000).toString(),
  ): Promise<PatientCode> {
    let code: PatientCodeValue;
    let existing: PatientCode | null;

    do {
      code = generateCode(random);
      existing = await this.repository.findByCode(code);
    } while (existing !== null);

    const patientCode: PatientCode = {
      uuid_patient_code: crypto.randomUUID(),
      uuid_patient,
      code,
      created_at: new Date(),
      used_at: null,
      deleted_at: null,
      is_active: true,
      revoked_at: null,
    };

    await this.repository.save(patientCode);
    return patientCode;
  }

  async validatePatientCode(codeRaw: string): Promise<ValidateResult> {
    let codeValue: PatientCodeValue;
    try {
      codeValue = PatientCodeValue.create(codeRaw);
    } catch {
      return { success: false, error: 'INVALID_CODE' };
    }

    const patientCode = await this.repository.findByCode(codeValue);

    if (!patientCode) {
      return { success: false, error: 'INVALID_CODE' };
    }

    const now = new Date();

    if (!patientCode.is_active) return { success: false, error: 'INACTIVE_CODE' };
    if (patientCode.deleted_at) return { success: false, error: 'DELETED_CODE' };
    if (patientCode.revoked_at) return { success: false, error: 'REVOKED_CODE' };
    if (isExpired(patientCode, now)) return { success: false, error: 'EXPIRED_CODE' };

    if (patientCode.used_at === null) {
      patientCode.used_at = now;
      await this.repository.save(patientCode);
    }

    const token = await this.tokenProvider.sign({
      uuid_patient: patientCode.uuid_patient,
      uuid_patient_code: patientCode.uuid_patient_code,
      role: 'patient',
    });

    return { success: true, patientCode, token };
  }

  async renewPatientCode(uuid_patient: string): Promise<PatientCode> {
    const active = await this.repository.findActiveByPatient(uuid_patient);
    if (active && active.used_at === null) {
      active.is_active = false;
      active.deleted_at = new Date();
      await this.repository.save(active);
    }
    return this.generatePatientCode(uuid_patient);
  }
}
