export {
  AUTH_HEADER,
  BEARER_PREFIX,
  useCurrentUser,
  getCurrentUser,
  getCurrentUserId,
  getAuthToken,
  setAuthToken,
  setCurrentUser,
  clearCurrentUser,
  type CurrentUser,
  type UserRole,
} from './currentUser';

export {
  ROLE,
  ROLE_LABEL,
  PERMISSION,
  can,
  isManager,
  isSuperAdmin,
  type PermissionCode,
} from './permissions';
