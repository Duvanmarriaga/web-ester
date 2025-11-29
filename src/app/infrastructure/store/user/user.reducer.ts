import { createReducer, on } from '@ngrx/store';
import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { User } from '../../../entities/interfaces';
import * as UserActions from './user.actions';

export interface UserState extends EntityState<User> {
  selectedUserId: number | null;
  isLoading: boolean;
  error: string | null;
}

export const userAdapter: EntityAdapter<User> = createEntityAdapter<User>();

export const initialState: UserState = userAdapter.getInitialState({
  selectedUserId: null,
  isLoading: false,
  error: null
});

export const userReducer = createReducer(
  initialState,
  
  // Load Users
  on(UserActions.loadUsers, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(UserActions.loadUsersSuccess, (state, { users }) =>
    userAdapter.setAll(users, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(UserActions.loadUsersFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Load User
  on(UserActions.loadUser, (state, { id }) => ({
    ...state,
    selectedUserId: id,
    isLoading: true,
    error: null
  })),
  
  on(UserActions.loadUserSuccess, (state, { user }) =>
    userAdapter.upsertOne(user, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(UserActions.loadUserFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Create User
  on(UserActions.createUser, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(UserActions.createUserSuccess, (state, { user }) =>
    userAdapter.addOne(user, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(UserActions.createUserFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Update User
  on(UserActions.updateUser, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(UserActions.updateUserSuccess, (state, { user }) =>
    userAdapter.updateOne(
      { id: user.id, changes: user },
      {
        ...state,
        isLoading: false,
        error: null
      }
    )
  ),
  
  on(UserActions.updateUserFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  })),
  
  // Delete User
  on(UserActions.deleteUser, (state) => ({
    ...state,
    isLoading: true,
    error: null
  })),
  
  on(UserActions.deleteUserSuccess, (state, { id }) =>
    userAdapter.removeOne(id, {
      ...state,
      isLoading: false,
      error: null
    })
  ),
  
  on(UserActions.deleteUserFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error
  }))
);

export const {
  selectIds,
  selectEntities,
  selectAll,
  selectTotal
} = userAdapter.getSelectors();

