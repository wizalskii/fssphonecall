import { describe, it, expect, beforeEach } from 'vitest';
import { CallManager } from '../CallManager';

describe('CallManager', () => {
  let cm: CallManager;

  beforeEach(() => {
    cm = new CallManager();
  });

  it('creates a call with ringing status', () => {
    const call = cm.create('pilot-1', '1234567', 'ctrl-conn-1', {
      controllerId: 'ctrl-1',
      pilotCallsign: 'N12345',
    });
    expect(call.id).toBeTruthy();
    expect(call.status).toBe('ringing');
    expect(call.pilotConnectionId).toBe('pilot-1');
    expect(call.pilotCid).toBe('1234567');
    expect(call.pilotCallsign).toBe('N12345');
    expect(call.controllerId).toBe('ctrl-1');
    expect(call.controllerConnectionId).toBe('ctrl-conn-1');
    expect(call.createdAt).toBeTypeOf('number');
  });

  it('finds a call by id', () => {
    const call = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    expect(cm.findById(call.id)).toBe(call);
    expect(cm.findById('nonexistent')).toBeUndefined();
  });

  it('finds active call by pilot connection', () => {
    const call = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    expect(cm.findByPilot('p1')).toBe(call);
    expect(cm.findByPilot('unknown')).toBeUndefined();
  });

  it('ignores ended calls when finding by pilot', () => {
    const call = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    cm.end(call.id);
    expect(cm.findByPilot('p1')).toBeUndefined();
  });

  it('finds active call by controller id', () => {
    const call = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    expect(cm.findByController('ctrl1')).toBe(call);
    expect(cm.findByController('unknown')).toBeUndefined();
  });

  it('ignores ended calls when finding by controller', () => {
    const call = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    cm.end(call.id);
    expect(cm.findByController('ctrl1')).toBeUndefined();
  });

  it('updates call status', () => {
    const call = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    expect(cm.updateStatus(call.id, 'active')?.status).toBe('active');
    expect(cm.updateStatus('nonexistent', 'active')).toBeUndefined();
  });

  it('ends a call and removes it', () => {
    const call = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    const ended = cm.end(call.id);
    expect(ended?.status).toBe('ended');
    expect(cm.findById(call.id)).toBeUndefined();
  });

  it('getActive returns only non-ended calls', () => {
    const c1 = cm.create('p1', 'cid1', 'c1', { controllerId: 'ctrl1', pilotCallsign: 'N1' });
    const c2 = cm.create('p2', 'cid2', 'c2', { controllerId: 'ctrl2', pilotCallsign: 'N2' });
    cm.end(c1.id);
    const active = cm.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(c2.id);
  });
});
