import type { Call, CallInitiation } from '@fssphone/shared';

export class CallManager {
  private calls: Map<string, Call> = new Map();

  create(pilotConnectionId: string, pilotCid: string, controllerConnectionId: string, data: CallInitiation): Call {
    const call: Call = {
      id: crypto.randomUUID(),
      pilotConnectionId,
      pilotCid,
      pilotCallsign: data.pilotCallsign,
      controllerId: data.controllerId,
      controllerConnectionId,
      status: 'ringing',
      createdAt: Date.now(),
    };
    this.calls.set(call.id, call);
    return call;
  }

  restore(call: Call): void {
    this.calls.set(call.id, call);
  }

  findById(callId: string): Call | undefined {
    return this.calls.get(callId);
  }

  findByConnectionId(connectionId: string): Call | undefined {
    for (const c of this.calls.values()) {
      if ((c.pilotConnectionId === connectionId || c.controllerConnectionId === connectionId) && c.status !== 'ended') return c;
    }
    return undefined;
  }

  findByPilot(connectionId: string): Call | undefined {
    for (const c of this.calls.values()) {
      if (c.pilotConnectionId === connectionId && c.status !== 'ended') return c;
    }
    return undefined;
  }

  findByController(controllerId: string): Call | undefined {
    for (const c of this.calls.values()) {
      if (c.controllerId === controllerId && c.status !== 'ended') return c;
    }
    return undefined;
  }

  updateStatus(callId: string, status: Call['status']): Call | undefined {
    const c = this.calls.get(callId);
    if (c) c.status = status;
    return c;
  }

  end(callId: string): Call | undefined {
    const c = this.calls.get(callId);
    if (c) {
      c.status = 'ended';
      this.calls.delete(callId);
    }
    return c;
  }

  getActive(): Call[] {
    return Array.from(this.calls.values()).filter(c => c.status !== 'ended');
  }
}
