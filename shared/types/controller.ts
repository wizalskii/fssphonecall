export interface Controller {
  id: string;
  callsign: string;        // e.g., "Seattle Radio"
  frequency: string;       // e.g., "122.200"
  status: 'online' | 'busy';
  socketId: string;
}

export interface ControllerRegistration {
  callsign: string;
  frequency: string;
}
