import type { CodeFleetBridge } from './index';

declare global {
  interface Window {
    codefleet: CodeFleetBridge;
  }
}
