export interface Controller {
  id: string;
  cid: string;
  name: string;
  callsign: string;
  frequency: string;
  status: 'online' | 'busy';
  connectionId: string;
}

export interface ControllerRegistration {
  callsign: string;
  frequency: string;
}
