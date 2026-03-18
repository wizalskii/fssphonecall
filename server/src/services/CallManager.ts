import { Call, CallInitiation } from '@fssphone/shared';
import { v4 as uuidv4 } from 'uuid';

export class CallManager {
  private calls: Map<string, Call> = new Map();

  create(pilotId: string, data: CallInitiation): Call {
    const call: Call = {
      id: uuidv4(),
      pilotId,
      pilotCallsign: data.pilotCallsign,
      controllerId: data.controllerId,
      status: 'ringing',
      createdAt: Date.now()
    };

    this.calls.set(call.id, call);
    console.log(`Call created: ${call.pilotCallsign} -> Controller ${call.controllerId}`);
    return call;
  }

  findById(callId: string): Call | undefined {
    return this.calls.get(callId);
  }

  findByPilot(pilotId: string): Call | undefined {
    for (const call of this.calls.values()) {
      if (call.pilotId === pilotId && call.status !== 'ended') {
        return call;
      }
    }
    return undefined;
  }

  findByController(controllerId: string): Call | undefined {
    for (const call of this.calls.values()) {
      if (call.controllerId === controllerId && call.status !== 'ended') {
        return call;
      }
    }
    return undefined;
  }

  updateStatus(callId: string, status: Call['status']): Call | undefined {
    const call = this.calls.get(callId);
    if (call) {
      call.status = status;
      console.log(`Call ${callId} status updated: ${status}`);
      return call;
    }
    return undefined;
  }

  end(callId: string): Call | undefined {
    const call = this.calls.get(callId);
    if (call) {
      call.status = 'ended';
      console.log(`Call ended: ${call.id}`);
      // Clean up after a delay
      setTimeout(() => {
        this.calls.delete(callId);
      }, 5000);
      return call;
    }
    return undefined;
  }

  getActive(): Call[] {
    return Array.from(this.calls.values()).filter(c => c.status !== 'ended');
  }
}
