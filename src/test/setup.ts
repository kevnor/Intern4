import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// No semester setting configured: components fall back to the default hours.
vi.mock('../server/dao/semesterSettingsDAO', () => ({
  getRequiredHours: vi.fn().mockResolvedValue(undefined),
  setRequiredHours: vi.fn().mockResolvedValue(undefined),
}));

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = TestResizeObserver;
