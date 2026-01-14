import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectUser } from '../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../infrastructure/store/company';
import * as CompanyActions from '../../../infrastructure/store/company/company.actions';
import {
  LucideAngularModule,
  FileText,
  TrendingUp,
  DollarSign,
  TrendingDown,
  Scale,
} from 'lucide-angular';
import { FinancialReportsDashboardComponent } from './financial-reports-dashboard/financial-reports-dashboard.component';
import { OperationBudgetsDashboardComponent } from './operation-budgets-dashboard/operation-budgets-dashboard.component';
import { InvestmentBudgetsDashboardComponent } from './investment-budgets-dashboard/investment-budgets-dashboard.component';
import { LegalProcessesDashboardComponent } from './legal-processes-dashboard/legal-processes-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    FinancialReportsDashboardComponent,
    OperationBudgetsDashboardComponent,
    InvestmentBudgetsDashboardComponent,
    LegalProcessesDashboardComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private store = inject(Store);

  userName = signal('');
  activeTab = signal<
    'financial' | 'operation-budgets' | 'investment-budgets' | 'legal'
  >('financial');

  // Lucide icons
  readonly icons = { FileText, TrendingUp, DollarSign, TrendingDown, Scale };

  ngOnInit() {
    this.store.select(selectUser).subscribe((user) => {
      if (user) {
        this.userName.set(user.name);
      }
    });
  }

  setActiveTab(
    tab: 'financial' | 'operation-budgets' | 'investment-budgets' | 'legal'
  ): void {
    this.activeTab.set(tab);
  }
}
