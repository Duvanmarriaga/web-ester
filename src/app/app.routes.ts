import { Routes } from '@angular/router';
import { authGuard } from './infrastructure/guards/auth.guard';
import { noAuthGuard } from './infrastructure/guards/no-auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [noAuthGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./ui/pages/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import(
            './ui/pages/auth/forgot-password/forgot-password.component'
          ).then((m) => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import(
            './ui/pages/auth/reset-password/reset-password.component'
          ).then((m) => m.ResetPasswordComponent),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./ui/layout/main-layout/main-layout.component').then(
        (m) => m.MainLayoutComponent
      ),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./ui/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        canActivate: [authGuard],
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./ui/pages/users/users.component').then(
            (m) => m.UsersComponent
          ),
        canActivate: [authGuard],
      },
      {
        path: 'companies',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./ui/pages/companies/companies.component').then(
                (m) => m.CompaniesComponent
              ),
            canActivate: [authGuard],
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./ui/pages/companies/company-detail/company-detail.component').then(
                (m) => m.CompanyDetailComponent
              ),
            canActivate: [authGuard],
            children: [
              {
                path: '',
                redirectTo: 'financial',
                pathMatch: 'full',
              },
              {
                path: 'financial',
                loadComponent: () =>
                  import('./ui/pages/companies/company-detail/financial-reports/financial-reports.component').then(
                    (m) => m.FinancialReportsComponent
                  ),
              },
              {
                path: 'operations',
                loadComponent: () =>
                  import('./ui/pages/companies/company-detail/operations-reports/operations-reports.component').then(
                    (m) => m.OperationsReportsComponent
                  ),
              },
              {
                path: 'budgets',
                loadComponent: () =>
                  import('./ui/pages/companies/company-detail/budgets/budgets.component').then(
                    (m) => m.BudgetsComponent
                  ),
              },
              {
                path: 'legal',
                loadComponent: () =>
                  import('./ui/pages/companies/company-detail/legal-processes/legal-processes.component').then(
                    (m) => m.LegalProcessesComponent
                  ),
              },
              {
                path: 'investments',
                loadComponent: () =>
                  import('./ui/pages/companies/company-detail/investments/investments.component').then(
                    (m) => m.InvestmentsComponent
                  ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];
