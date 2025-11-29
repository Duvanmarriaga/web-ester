import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../services/user.service';
import * as UserActions from './user.actions';

@Injectable()
export class UserEffects {
  private actions$ = inject(Actions);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);

  loadUsers$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.loadUsers),
      switchMap(() =>
        this.userService.getAll().pipe(
          map((users) => UserActions.loadUsersSuccess({ users })),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al cargar usuarios';
            this.toastr.error(errorMessage, 'Error');
            return of(UserActions.loadUsersFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  loadUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.loadUser),
      switchMap(({ id }) =>
        this.userService.getById(id).pipe(
          map((user) => UserActions.loadUserSuccess({ user })),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al cargar usuario';
            this.toastr.error(errorMessage, 'Error');
            return of(UserActions.loadUserFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  createUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.createUser),
      switchMap(({ user }) =>
        this.userService.create(user).pipe(
          map((createdUser) => {
            this.toastr.success('Usuario creado exitosamente', 'Creación de usuario');
            return UserActions.createUserSuccess({ user: createdUser });
          }),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al crear usuario';
            this.toastr.error(errorMessage, 'Error');
            return of(UserActions.createUserFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  updateUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.updateUser),
      switchMap(({ user }) =>
        this.userService.update(user).pipe(
          map((updatedUser) => {
            this.toastr.success('Usuario actualizado exitosamente', 'Actualización de usuario');
            return UserActions.updateUserSuccess({ user: updatedUser });
          }),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al actualizar usuario';
            this.toastr.error(errorMessage, 'Error');
            return of(UserActions.updateUserFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  deleteUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.deleteUser),
      switchMap(({ id }) =>
        this.userService.delete(id).pipe(
          map(() => {
            this.toastr.success('Usuario eliminado exitosamente', 'Eliminación de usuario');
            return UserActions.deleteUserSuccess({ id });
          }),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al eliminar usuario';
            this.toastr.error(errorMessage, 'Error');
            return of(UserActions.deleteUserFailure({ error: errorMessage }));
          })
        )
      )
    )
  );
}

