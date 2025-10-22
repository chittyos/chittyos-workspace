import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export class PinHasher {
  async hashPin(pin: string): Promise<string> {
    if (pin.length < 4 || pin.length > 12) {
      throw new Error('PIN must be between 4 and 12 digits.');
    }

    if (!/^\d+$/.test(pin)) {
      throw new Error('PIN must be numeric.');
    }

    const salt = randomBytes(16);
    const derived = (await scrypt(pin, salt, 32)) as Buffer;
    return `${salt.toString('hex')}:${derived.toString('hex')}`;
  }

  async verifyPin(pin: string, hash: string): Promise<boolean> {
    const [saltHex, derivedHex] = hash.split(':');
    if (!saltHex || !derivedHex) {
      throw new Error('Invalid PIN hash format.');
    }

    const salt = Buffer.from(saltHex, 'hex');
    const derived = Buffer.from(derivedHex, 'hex');
    const test = (await scrypt(pin, salt, derived.length)) as Buffer;
    return timingSafeEqual(test, derived);
  }
}
