import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectUser } from '../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../infrastructure/store/company';
import * as CompanyActions from '../../../infrastructure/store/company/company.actions';
import { LucideAngularModule, FileText, TrendingUp, DollarSign, TrendingDown, Scale } from 'lucide-angular';
import { FinancialReportsDashboardComponent } from './financial-reports-dashboard/financial-reports-dashboard.component';
import { OperationsReportsDashboardComponent } from './operations-reports-dashboard/operations-reports-dashboard.component';
import { BudgetsDashboardComponent } from './budgets-dashboard/budgets-dashboard.component';
import { InvestmentsDashboardComponent } from './investments-dashboard/investments-dashboard.component';
import { LegalProcessesDashboardComponent } from './legal-processes-dashboard/legal-processes-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    FinancialReportsDashboardComponent,
    OperationsReportsDashboardComponent,
    BudgetsDashboardComponent,
    InvestmentsDashboardComponent,
    LegalProcessesDashboardComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private store = inject(Store);

  userName = signal('');
  activeTab = signal<'financial' | 'operations' | 'budgets' | 'investments' | 'legal'>('financial');

  // Lucide icons
  readonly icons = { FileText, TrendingUp, DollarSign, TrendingDown, Scale };

  ngOnInit() {
    this.store.select(selectUser).subscribe(user => {
      if (user) {
        this.userName.set(user.name);
      }
    });

    // Load companies once for all dashboards
    this.store.select(selectAllCompanies).subscribe(companies => {
      // Only dispatch if companies are not already loaded
      if (companies.length === 0) {
        this.store.dispatch(CompanyActions.loadCompanies());
      }
    });
  }

  setActiveTab(tab: 'financial' | 'operations' | 'budgets' | 'investments' | 'legal'): void {
    this.activeTab.set(tab);
  }
}
