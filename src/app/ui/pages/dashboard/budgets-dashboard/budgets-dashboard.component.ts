import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  DollarSign,
  TrendingUp,
  Target,
  Percent,
  Filter,
  Calendar,
} from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  BudgetService,
  Budget,
} from '../../../../infrastructure/services/budget.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';
import * as CompanyActions from '../../../../infrastructure/store/company';
@Component({
  selector: 'app-budgets-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgApexchartsModule,
    NgSelectModule,
  ],
  templateUrl: './budgets-dashboard.component.html',
  styleUrl: './budgets-dashboard.component.scss',
})
export class BudgetsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private budgetService = inject(BudgetService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = {
    DollarSign,
    TrendingUp,
    Target,
    Percent,
    Filter,
    Calendar,
  };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  budgets = signal<Budget[]>([]);
  companies = signal<Company[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.CLIENT);

  filterForm!: FormGroup;

  // Stats computed
  totalBudget = computed(() => {
    return this.budgets().reduce((sum, b) => sum + (b.budget_amount || 0), 0);
  });

  totalExecuted = computed(() => {
    return this.budgets().reduce((sum, b) => sum + (b.executed_amount || 0), 0);
  });

  totalDifference = computed(() => {
    return this.budgets().reduce(
      (sum, b) => sum + (b.difference_amount || 0),
      0
    );
  });

  averagePercentage = computed(() => {
    const budgets = this.budgets();
    if (budgets.length === 0) return 0;
    const total = budgets.reduce((sum, b) => sum + (b.percentage || 0), 0);
    return total / budgets.length;
  });

  // Charts
  budgetVsExecutedChart: any = {};
  differenceChart: any = {};
  percentageChart: any = {};
  monthlyComparisonChart: any = {};

  ngOnInit() {
    // Get current user
    this.store.select(selectUser).subscribe((user) => {
      this.currentUser.set(user);
      if (user) {
        this.initFilterForm();
        // Only load companies if user is ADMIN
        if (user.type === UserType.CLIENT) {
          this.loadCompanies();
        }
      }
    });
  }

  initFilterForm(): void {
    const today = new Date();
    // Set date_from to 4 years ago
    const fourYearsAgo = new Date(today.getFullYear() - 4, today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );
    const user = this.currentUser();

    // Determine default company
    let defaultCompanyId: number | null = null;
    if (
      user &&
      user.type === UserType.COMPANY &&
      user.companies &&
      user.companies.length > 0
    ) {
      // If client, use company from role (first company)
      defaultCompanyId = user.companies[0];
    }

    this.filterForm = this.fb.group({
      company_id: [defaultCompanyId, Validators.required],
      date_from: [
        fourYearsAgo.toISOString().split('T')[0],
        Validators.required,
      ],
      date_to: [
        lastDayOfMonth.toISOString().split('T')[0],
        Validators.required,
      ],
    });

    this.filterForm.valueChanges.subscribe(() => {
      if (this.filterForm.valid) {
        this.loadBudgets();
      }
    });

    // Load initial data if form is valid
    if (this.filterForm.valid) {
      this.loadBudgets();
    }
  }

  loadCompanies(): void {
    this.store.dispatch(CompanyActions.loadCompanies());
    // This method is only called for ADMIN users
    // Get companies from store
    this.store.select(selectAllCompanies).subscribe((companies) => {
      this.companies.set(companies);
      if (companies.length > 0 && !this.filterForm.get('company_id')?.value) {
        this.filterForm.patchValue({ company_id: companies[0].id });
        // Execute search when company is set for the first time
        if (this.filterForm.valid) {
          this.applyFilters();
        }
      }
    });
  }

  applyFilters(): void {
    // Filters are now applied server-side in loadBudgets()
    this.loadBudgets();
  }

  resetFilters(): void {
    const today = new Date();
    // Set date_from to 4 years ago
    const fourYearsAgo = new Date(today.getFullYear() - 4, today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );
    const user = this.currentUser();

    let defaultCompanyId: number | Company | null = null;
    if (
      user &&
      user.type === UserType.COMPANY &&
      user.companies &&
      user.companies.length > 0
    ) {
      // If client, use company from role
      defaultCompanyId = user.companies[0];
    } else if (user && user.type === UserType.CLIENT) {
      const firstCompany = this.companies()[0];
      defaultCompanyId = firstCompany || null;
    }

    this.filterForm.patchValue(
      {
        company_id: defaultCompanyId,
        date_from: fourYearsAgo.toISOString().split('T')[0],
        date_to: lastDayOfMonth.toISOString().split('T')[0],
      },
      { emitEvent: false }
    );

    // Load data after resetting filters
    if (this.filterForm.valid) {
      this.loadBudgets();
    }
  }

  loadBudgets(): void {
    if (!this.filterForm.valid) {
      return;
    }

    const filters = this.filterForm.getRawValue(); // Use getRawValue to get disabled form values
    const companyId = filters.company_id;

    if (!companyId) {
      this.budgets.set([]);
      this.updateCharts();
      return;
    }

    this.isLoading.set(true);

    // Load budgets with filters applied server-side
    this.budgetService
      .getAll(
        1,
        1000,
        companyId,
        filters.date_from || undefined,
        filters.date_to || undefined
      )
      .subscribe({
        next: (response) => {
          // Sort budgets by date (oldest first)
          const sortedData = (response.data || []).sort((a, b) => {
            const dateA = new Date(a.budget_date).getTime();
            const dateB = new Date(b.budget_date).getTime();
            return dateA - dateB;
          });
          this.budgets.set(sortedData);
          this.updateCharts();
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          const errorMessage =
            (error as { error?: { message?: string }; message?: string })?.error
              ?.message ||
            (error as { message?: string })?.message ||
            'Error al cargar los presupuestos';
          this.toastr.error(errorMessage, 'Error');
          this.budgets.set([]);
          this.updateCharts();
          this.isLoading.set(false);
        },
      });
  }

  updateCharts(): void {
    const budgets = this.budgets();

    // Group by month
    const monthlyData = this.groupByMonth(budgets);
    const months = this.sortMonthsByDate(Object.keys(monthlyData));

    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(
        today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      );
    }

    const budgetData = months.map((m: string) => monthlyData[m]?.budget || 0);
    const executedData = months.map((m: string) => monthlyData[m]?.executed || 0);
    const differenceData = months.map((m: string) => monthlyData[m]?.difference || 0);
    const percentageData = months.map((m: string) => monthlyData[m]?.percentage || 0);

    // Budget vs Executed Chart (Bar)
    this.budgetVsExecutedChart = {
      series: [
        { name: 'Presupuesto', data: budgetData },
        { name: 'Ejecutado', data: executedData },
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6', '#10b981'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '55%',
        },
      },
      dataLabels: { enabled: false },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' },
    };

    // Difference Chart (Line)
    this.differenceChart = {
      series: [
        {
          name: 'Diferencia',
          data: differenceData,
        },
      ],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#ef4444'],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Percentage Chart (Bar)
    this.percentageChart = {
      series: [
        {
          name: 'Porcentaje',
          data: percentageData,
        },
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#8b5cf6'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%',
        },
      },
      dataLabels: { enabled: false },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `${val.toFixed(1)}%`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Monthly Comparison (Area)
    this.monthlyComparisonChart = {
      series: [
        { name: 'Presupuesto', data: budgetData },
        { name: 'Ejecutado', data: executedData },
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        stacked: false,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6', '#10b981'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.2,
        },
      },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' },
    };
  }

  private groupByMonth(budgets: Budget[]): {
    [key: string]: {
      budget: number;
      executed: number;
      difference: number;
      percentage: number;
    };
  } {
    const grouped: {
      [key: string]: {
        budget: number;
        executed: number;
        difference: number;
        percentage: number;
      };
    } = {};

    budgets.forEach((budget) => {
      const date = new Date(budget.budget_date);
      const monthKey = date.toLocaleDateString('es-ES', {
        month: 'short',
        year: 'numeric',
      });

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          budget: 0,
          executed: 0,
          difference: 0,
          percentage: 0,
        };
      }

      grouped[monthKey].budget += budget.budget_amount || 0;
      grouped[monthKey].executed += budget.executed_amount || 0;
      grouped[monthKey].difference += budget.difference_amount || 0;
      grouped[monthKey].percentage = budget.percentage || 0;
    });

    return grouped;
  }

  private sortMonthsByDate(monthKeys: string[]): string[] {
    return monthKeys.sort((a, b) => {
      // Parse month strings like "ene 2020" to dates
      const dateA = this.parseMonthString(a);
      const dateB = this.parseMonthString(b);
      return dateA.getTime() - dateB.getTime();
    });
  }

  private parseMonthString(monthStr: string): Date {
    // Parse Spanish month strings like "ene 2020" or "enero 2020"
    const monthNames: { [key: string]: number } = {
      'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
      'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
      'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
      'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    const parts = monthStr.toLowerCase().split(' ');
    const monthName = parts[0];
    const year = parseInt(parts[1], 10);

    const monthIndex = monthNames[monthName] ?? 0;
    return new Date(year, monthIndex, 1);
  }
}
