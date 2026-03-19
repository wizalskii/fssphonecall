import type { Controller, ControllerRegistration } from '@fssphone/shared';

export class ControllerRegistry {
  private controllers: Map<string, Controller> = new Map();

  register(connectionId: string, data: ControllerRegistration, cid: string, name: string): Controller {
    const controller: Controller = {
      id: crypto.randomUUID(),
      cid,
      name,
      connectionId,
      callsign: data.callsign,
      frequency: data.frequency,
      status: 'online',
    };
    this.controllers.set(controller.id, controller);
    return controller;
  }

  restore(controller: Controller): void {
    this.controllers.set(controller.id, controller);
  }

  unregister(controllerId: string): void {
    this.controllers.delete(controllerId);
  }

  findById(controllerId: string): Controller | undefined {
    return this.controllers.get(controllerId);
  }

  findByConnectionId(connectionId: string): Controller | undefined {
    for (const c of this.controllers.values()) {
      if (c.connectionId === connectionId) return c;
    }
    return undefined;
  }

  updateStatus(controllerId: string, status: 'online' | 'busy'): Controller | undefined {
    const c = this.controllers.get(controllerId);
    if (c) c.status = status;
    return c;
  }

  getAll(): Controller[] {
    return Array.from(this.controllers.values());
  }
}
