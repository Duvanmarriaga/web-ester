import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserState, selectAll } from './user.reducer';

export const selectUserState = createFeatureSelector<UserState>('user');

export const selectAllUsers = createSelector(selectUserState, selectAll);

export const selectUserEntities = createSelector(
  selectUserState,
  (state) => state.entities
);

export const selectSelectedUserId = createSelector(
  selectUserState,
  (state) => state.selectedUserId
);

export const selectSelectedUser = createSelector(
  selectUserEntities,
  selectSelectedUserId,
  (entities, selectedId) => selectedId ? entities[selectedId] : null
);

export const selectUserIsLoading = createSelector(
  selectUserState,
  (state) => state.isLoading
);

export const selectUserError = createSelector(
  selectUserState,
  (state) => state.error
);

export const selectUsersCount = createSelector(
  selectAllUsers,
  (users) => users.length
);

