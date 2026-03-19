import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../jwt';

const testUser = {
  cid: '1234567',
  name: 'Test Pilot',
  rating: 3,
  ratingShort: 'S3',
  ratingLong: 'Senior Student 3',
};

const SECRET = 'test-secret-key-for-vitest';

describe('JWT utils', () => {
  it('round-trips a user through sign and verify', async () => {
    const token = await signToken(testUser, SECRET);
    const result = await verifyToken(token, SECRET);
    expect(result).toEqual(testUser);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signToken(testUser, SECRET);
    await expect(verifyToken(token, 'wrong-secret')).rejects.toThrow();
  });

  it('rejects a tampered token', async () => {
    const token = await signToken(testUser, SECRET);
    const parts = token.split('.');
    const sig = parts[2];
    const flipped = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);
    const tampered = [parts[0], parts[1], flipped].join('.');
    await expect(verifyToken(tampered, SECRET)).rejects.toThrow();
  });

  it('produces a token with HS256 algorithm', async () => {
    const token = await signToken(testUser, SECRET);
    const header = JSON.parse(atob(token.split('.')[0]));
    expect(header.alg).toBe('HS256');
  });
});
