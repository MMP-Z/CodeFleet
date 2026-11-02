import type { CodeFleetBridge } from '@shared/ipc';

declare global {
  interface Window {
    codefleet: CodeFleetBridge;
  }
}
