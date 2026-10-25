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

// No finished vakt: components show zero vakt hours.
vi.mock('../server/dao/vaktHoursDAO', () => ({
  getCompletedShiftCounts: vi.fn().mockResolvedValue({}),
}));

// No rooms or room history: components show their empty states.
vi.mock('../server/dao/roomsDAO', () => ({
  getRooms: vi.fn().mockResolvedValue([]),
  getRoomHistory: vi.fn().mockResolvedValue([]),
  getUserRoomHistory: vi.fn().mockResolvedValue([]),
  getRoomWork: vi.fn().mockResolvedValue([]),
  assignResidentToRoom: vi.fn().mockResolvedValue(undefined),
  updateRoomType: vi.fn().mockResolvedValue(undefined),
  setRoomTypes: vi.fn().mockResolvedValue(0),
  getResidentsForRooms: vi.fn().mockResolvedValue([]),
  setHusfar: vi.fn().mockResolvedValue(undefined),
}));

// No room reports.
vi.mock('../server/dao/roomReportsDAO', () => ({
  getRoomReports: vi.fn().mockResolvedValue([]),
  createRoomReport: vi.fn().mockResolvedValue(undefined),
  setReportStatus: vi.fn().mockResolvedValue(undefined),
  linkReportToTask: vi.fn().mockResolvedValue(undefined),
  withdrawRoomReport: vi.fn().mockResolvedValue(undefined),
}));

// No romslipp running.
vi.mock('../server/dao/romslippDAO', () => ({
  getLatestRomslipp: vi.fn().mockResolvedValue(null),
  getAvailableRooms: vi.fn().mockResolvedValue([]),
  getRomslippTurn: vi.fn().mockResolvedValue(null),
  startRomslipp: vi.fn().mockResolvedValue(undefined),
  answerRomslipp: vi.fn().mockResolvedValue(undefined),
  skipRomslipp: vi.fn().mockResolvedValue(undefined),
  closeRomslipp: vi.fn().mockResolvedValue(undefined),
  cancelRomslipp: vi.fn().mockResolvedValue(undefined),
}));

// No history, and a move-out that changes nothing.
vi.mock('../server/dao/offboardingDAO', () => ({
  getOffboardingPreview: vi.fn().mockResolvedValue({
    roomNumber: null,
    futureShifts: 0,
    openSwaps: 0,
    waitingRomslipp: 0,
    openReports: 0,
    roleReset: null,
  }),
  planMoveOut: vi.fn().mockResolvedValue(undefined),
  cancelMoveOut: vi.fn().mockResolvedValue(undefined),
  getResidentEvents: vi.fn().mockResolvedValue([]),
}));
