import { canAccessRoomManagement } from '../users/permissions';

// Admin, Romsjef and Data administer rooms. Keep in sync with is_room_manager() in the database.
export const canManageRooms = canAccessRoomManagement;
