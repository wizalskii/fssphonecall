import { describe, it, expect, beforeEach } from 'vitest';
import { ControllerRegistry } from '../ControllerRegistry';

describe('ControllerRegistry', () => {
  let reg: ControllerRegistry;

  beforeEach(() => {
    reg = new ControllerRegistry();
  });

  it('registers a controller with online status', () => {
    const ctrl = reg.register('conn-1', { callsign: 'SLC_DEL', frequency: '121.100' }, '1234567', 'John Doe');
    expect(ctrl.id).toBeTruthy();
    expect(ctrl.status).toBe('online');
    expect(ctrl.connectionId).toBe('conn-1');
    expect(ctrl.callsign).toBe('SLC_DEL');
    expect(ctrl.frequency).toBe('121.100');
    expect(ctrl.cid).toBe('1234567');
    expect(ctrl.name).toBe('John Doe');
  });

  it('finds controller by id', () => {
    const ctrl = reg.register('conn-1', { callsign: 'SLC_DEL', frequency: '121.100' }, 'cid1', 'Name');
    expect(reg.findById(ctrl.id)).toBe(ctrl);
    expect(reg.findById('garbage')).toBeUndefined();
  });

  it('finds controller by connection id', () => {
    const ctrl = reg.register('conn-1', { callsign: 'SLC_DEL', frequency: '121.100' }, 'cid1', 'Name');
    expect(reg.findByConnectionId('conn-1')).toBe(ctrl);
    expect(reg.findByConnectionId('unknown')).toBeUndefined();
  });

  it('unregisters a controller', () => {
    const ctrl = reg.register('conn-1', { callsign: 'SLC_DEL', frequency: '121.100' }, 'cid1', 'Name');
    reg.unregister(ctrl.id);
    expect(reg.findById(ctrl.id)).toBeUndefined();
  });

  it('updates controller status', () => {
    const ctrl = reg.register('conn-1', { callsign: 'SLC_DEL', frequency: '121.100' }, 'cid1', 'Name');
    reg.updateStatus(ctrl.id, 'busy');
    expect(ctrl.status).toBe('busy');
    reg.updateStatus(ctrl.id, 'online');
    expect(ctrl.status).toBe('online');
    expect(reg.updateStatus('nonexistent', 'busy')).toBeUndefined();
  });

  it('getAll returns all registered controllers', () => {
    expect(reg.getAll()).toHaveLength(0);
    reg.register('conn-1', { callsign: 'SLC_DEL', frequency: '121.100' }, 'cid1', 'Name1');
    reg.register('conn-2', { callsign: 'BOI_DEL', frequency: '121.200' }, 'cid2', 'Name2');
    expect(reg.getAll()).toHaveLength(2);
  });

  // --- restore tests ---

  it('restores a controller from a saved object', () => {
    reg.restore({
      id: 'restored-id',
      cid: '9999',
      name: 'Restored User',
      connectionId: 'conn-99',
      callsign: 'SEA_RAD',
      frequency: '122.600',
      status: 'online',
    });
    const found = reg.findById('restored-id');
    expect(found).toBeDefined();
    expect(found!.callsign).toBe('SEA_RAD');
    expect(found!.connectionId).toBe('conn-99');
  });

  it('restore does not duplicate if called twice with same id', () => {
    const controller = {
      id: 'dup-id',
      cid: '1111',
      name: 'Dup User',
      connectionId: 'conn-dup',
      callsign: 'DUP_CTR',
      frequency: '123.456',
      status: 'online' as const,
    };
    reg.restore(controller);
    reg.restore(controller);
    expect(reg.getAll()).toHaveLength(1);
  });

  it('restored controller is findable by connectionId', () => {
    reg.restore({
      id: 'r-id',
      cid: '8888',
      name: 'Test',
      connectionId: 'conn-r',
      callsign: 'TST_CTR',
      frequency: '100.000',
      status: 'busy',
    });
    const found = reg.findByConnectionId('conn-r');
    expect(found).toBeDefined();
    expect(found!.status).toBe('busy');
  });

  it('restored controller can be unregistered', () => {
    reg.restore({
      id: 'del-id',
      cid: '7777',
      name: 'Del',
      connectionId: 'conn-del',
      callsign: 'DEL_CTR',
      frequency: '111.111',
      status: 'online',
    });
    reg.unregister('del-id');
    expect(reg.findById('del-id')).toBeUndefined();
    expect(reg.getAll()).toHaveLength(0);
  });
});
