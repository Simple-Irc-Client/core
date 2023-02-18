/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { parseMessageToCommand } from '../command';

describe('command tests', () => {
  it('test quote command', () => {
    expect(parseMessageToCommand('#channel', '/msg test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', 'test message')).toStrictEqual('test message');
  });
});
