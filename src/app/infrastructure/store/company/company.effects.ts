import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { CompanyService } from '../../services/company.service';
import * as CompanyActions from './company.actions';

@Injectable()
export class CompanyEffects {
  private actions$ = inject(Actions);
  private companyService = inject(CompanyService);
  private toastr = inject(ToastrService);

  loadCompanies$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CompanyActions.loadCompanies),
      switchMap(() =>
        this.companyService.getAll().pipe(
          map((companies) => CompanyActions.loadCompaniesSuccess({ companies })),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al cargar compañías';
            this.toastr.error(errorMessage, 'Error');
            return of(CompanyActions.loadCompaniesFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  loadCompany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CompanyActions.loadCompany),
      switchMap(({ id }) =>
        this.companyService.getById(id).pipe(
          map((company) => CompanyActions.loadCompanySuccess({ company })),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al cargar compañía';
            this.toastr.error(errorMessage, 'Error');
            return of(CompanyActions.loadCompanyFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  createCompany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CompanyActions.createCompany),
      switchMap(({ company }) =>
        this.companyService.create(company).pipe(
          map((createdCompany) => {
            this.toastr.success('Compañía creada exitosamente', 'Creación de compañía');
            return CompanyActions.createCompanySuccess({ company: createdCompany });
          }),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al crear compañía';
            this.toastr.error(errorMessage, 'Error');
            return of(CompanyActions.createCompanyFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  updateCompany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CompanyActions.updateCompany),
      switchMap(({ company }) =>
        this.companyService.update(company).pipe(
          map((updatedCompany) => {
            this.toastr.success('Compañía actualizada exitosamente', 'Actualización de compañía');
            return CompanyActions.updateCompanySuccess({ company: updatedCompany });
          }),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al actualizar compañía';
            this.toastr.error(errorMessage, 'Error');
            return of(CompanyActions.updateCompanyFailure({ error: errorMessage }));
          })
        )
      )
    )
  );

  deleteCompany$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CompanyActions.deleteCompany),
      switchMap(({ id }) =>
        this.companyService.delete(id).pipe(
          map(() => {
            this.toastr.success('Compañía eliminada exitosamente', 'Eliminación de compañía');
            return CompanyActions.deleteCompanySuccess({ id });
          }),
          catchError((error) => {
            const errorMessage = error.error?.message || error.message || 'Error al eliminar compañía';
            this.toastr.error(errorMessage, 'Error');
            return of(CompanyActions.deleteCompanyFailure({ error: errorMessage }));
          })
        )
      )
    )
  );
}

