export class ChecksumSHA256 {
  private constructor(readonly value: string) {}

  static create(value: string): ChecksumSHA256 {
    if (!/^[a-f0-9]{64}$/i.test(value)) {
      throw new Error('CHECKSUM_INVALID');
    }
    return new ChecksumSHA256(value.toLowerCase());
  }
}
