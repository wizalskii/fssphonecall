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

  // --- restore tests ---

  it('restores a call from a saved object', () => {
    const call = {
      id: 'restored-call',
      pilotConnectionId: 'p-conn',
      pilotCid: '1234',
      pilotCallsign: 'N999',
      controllerId: 'ctrl-1',
      controllerConnectionId: 'c-conn',
      status: 'active' as const,
      createdAt: Date.now(),
    };
    cm.restore(call);
    expect(cm.findById('restored-call')).toBeDefined();
    expect(cm.findById('restored-call')!.status).toBe('active');
  });

  it('restored call is findable by pilot and controller', () => {
    cm.restore({
      id: 'r-call',
      pilotConnectionId: 'p1',
      pilotCid: '111',
      pilotCallsign: 'N1',
      controllerId: 'ctrl1',
      controllerConnectionId: 'c1',
      status: 'ringing',
      createdAt: Date.now(),
    });
    expect(cm.findByPilot('p1')).toBeDefined();
    expect(cm.findByController('ctrl1')).toBeDefined();
  });

  it('restored call appears in getActive', () => {
    cm.restore({
      id: 'active-call',
      pilotConnectionId: 'p1',
      pilotCid: '111',
      pilotCallsign: 'N1',
      controllerId: 'ctrl1',
      controllerConnectionId: 'c1',
      status: 'active',
      createdAt: Date.now(),
    });
    expect(cm.getActive()).toHaveLength(1);
  });

  it('restored call can be ended', () => {
    cm.restore({
      id: 'end-me',
      pilotConnectionId: 'p1',
      pilotCid: '111',
      pilotCallsign: 'N1',
      controllerId: 'ctrl1',
      controllerConnectionId: 'c1',
      status: 'active',
      createdAt: Date.now(),
    });
    cm.end('end-me');
    expect(cm.findById('end-me')).toBeUndefined();
    expect(cm.getActive()).toHaveLength(0);
  });

  it('does not restore ended calls into active list', () => {
    cm.restore({
      id: 'ended-call',
      pilotConnectionId: 'p1',
      pilotCid: '111',
      pilotCallsign: 'N1',
      controllerId: 'ctrl1',
      controllerConnectionId: 'c1',
      status: 'ended',
      createdAt: Date.now(),
    });
    // restore puts it in the map regardless — the lobby filters ended calls before restoring
    // but the manager itself should still store it
    expect(cm.findById('ended-call')).toBeDefined();
    expect(cm.getActive()).toHaveLength(0);
  });
});
