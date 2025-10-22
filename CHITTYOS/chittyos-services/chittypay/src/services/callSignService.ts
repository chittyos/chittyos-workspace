import { randomUUID } from 'node:crypto';
import { RecipientRepository } from '../repositories/types.js';

interface CallSignOptions {
  reserve?: boolean;
  email?: string;
}

export class CallSignService {
  constructor(private readonly repository: RecipientRepository) {}

  async generateCallSign(baseName: string, options: CallSignOptions = {}): Promise<string> {
    const sanitized = baseName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const base = sanitized || `recipient-${randomUUID().slice(0, 8)}`;
    let candidate = base;
    let counter = 1;

    while (await this.lookupCandidate(`/${candidate}`)) {
      counter += 1;
      candidate = `${base}-${counter}`;
    }

    const callSign = `/${candidate}`;

    if (options.reserve) {
      await this.reserveCallSign(callSign, {
        displayName: baseName,
        email: options.email,
      });
    }

    return callSign;
  }

  async reserveCallSign(callSign: string, metadata: { displayName: string; email?: string }): Promise<void> {
    await this.repository.reserveCallSign(callSign, {
      displayName: metadata.displayName,
      email: metadata.email,
    });
  }

  private async lookupCandidate(callSign: string) {
    return this.repository.getRecipientByCallSign(callSign);
  }
}
