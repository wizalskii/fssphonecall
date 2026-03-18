import { Controller, ControllerRegistration } from '@fssphone/shared';
import { v4 as uuidv4 } from 'uuid';

export class ControllerRegistry {
  private controllers: Map<string, Controller> = new Map();

  register(socketId: string, data: ControllerRegistration): Controller {
    const controller: Controller = {
      id: uuidv4(),
      socketId,
      callsign: data.callsign,
      frequency: data.frequency,
      status: 'online'
    };

    this.controllers.set(controller.id, controller);
    console.log(`Controller registered: ${controller.callsign} (${controller.frequency})`);
    return controller;
  }

  unregister(controllerId: string): void {
    const controller = this.controllers.get(controllerId);
    if (controller) {
      this.controllers.delete(controllerId);
      console.log(`Controller unregistered: ${controller.callsign}`);
    }
  }

  unregisterBySocketId(socketId: string): Controller | undefined {
    const controller = this.findBySocketId(socketId);
    if (controller) {
      this.controllers.delete(controller.id);
      console.log(`Controller unregistered by socket: ${controller.callsign}`);
      return controller;
    }
    return undefined;
  }

  findById(controllerId: string): Controller | undefined {
    return this.controllers.get(controllerId);
  }

  findBySocketId(socketId: string): Controller | undefined {
    for (const controller of this.controllers.values()) {
      if (controller.socketId === socketId) {
        return controller;
      }
    }
    return undefined;
  }

  updateStatus(controllerId: string, status: 'online' | 'busy'): Controller | undefined {
    const controller = this.controllers.get(controllerId);
    if (controller) {
      controller.status = status;
      return controller;
    }
    return undefined;
  }

  getAll(): Controller[] {
    return Array.from(this.controllers.values());
  }

  getAvailable(): Controller[] {
    return this.getAll().filter(c => c.status === 'online');
  }
}
