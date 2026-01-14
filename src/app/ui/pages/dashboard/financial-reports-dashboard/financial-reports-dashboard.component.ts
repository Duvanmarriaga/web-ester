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
  FileText,
  TrendingUp,
  DollarSign,
  TrendingDown,
  Filter,
  Calendar,
} from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  FinancialReportService,
  FinancialReport,
} from '../../../../infrastructure/services/financial-report.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';
import * as CompanyActions from '../../../../infrastructure/store/company';
@Component({
  selector: 'app-financial-reports-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgApexchartsModule,
    NgSelectModule,
  ],
  templateUrl: './financial-reports-dashboard.component.html',
  styleUrl: './financial-reports-dashboard.component.scss',
})
export class FinancialReportsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private financialReportService = inject(FinancialReportService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = {
    FileText,
    TrendingUp,
    DollarSign,
    TrendingDown,
    Filter,
    Calendar,
  };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  reports = signal<FinancialReport[]>([]);
  companies = signal<Company[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.CLIENT);

  filterForm!: FormGroup;

  // Stats computed
  totalIncome = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.total_revenue || 0), 0);
  });

  totalExpenses = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.executed_value || 0), 0);
  });

  totalProfit = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.net_profit || 0), 0);
  });

  averageProfit = computed(() => {
    const reports = this.reports();
    if (reports.length === 0) return 0;
    return this.totalProfit() / reports.length;
  });

  // Charts
  incomeExpensesChart: any = {};
  profitChart: any = {};
  monthlyTrendChart: any = {};
  profitDistributionChart: any = {};

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
      // If client, use company from token (first company from array)
      defaultCompanyId = user.companies[0];
      this.companyId.set(defaultCompanyId);
      // Disable company_id control for clients
      this.filterForm = this.fb.group({
        company_id: [
          { value: defaultCompanyId, disabled: true },
          Validators.required,
        ],
        date_from: [
          fourYearsAgo.toISOString().split('T')[0],
          Validators.required,
        ],
        date_to: [
          lastDayOfMonth.toISOString().split('T')[0],
          Validators.required,
        ],
      });
    } else {
      // For admin, company_id will be set later when companies are loaded
      this.filterForm = this.fb.group({
        company_id: [this.companyId() || null, Validators.required],
        date_from: [
          fourYearsAgo.toISOString().split('T')[0],
          Validators.required,
        ],
        date_to: [
          lastDayOfMonth.toISOString().split('T')[0],
          Validators.required,
        ],
      });
    }

    // Watch for form changes and load data with filters
    this.filterForm.valueChanges.subscribe(() => {
      if (this.filterForm.valid) {
        this.loadReports();
      }
    });

    // Load initial data if form is valid (for clients with company from token)
    if (this.filterForm.valid && user && user.type === UserType.COMPANY) {
      this.loadReports();
    }
  }

  loadCompanies(): void {
    this.store.dispatch(CompanyActions.loadCompanies());
    // This method is only called for ADMIN users
    // Get companies from store
    this.store.select(selectAllCompanies).subscribe((companies) => {
      this.companies.set(companies);
      // Set first company as default if available
      console.log('companies', companies);
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
    // Filters are now applied server-side in loadReports()
    this.loadReports();
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
      this.loadReports();
    }
  }

  loadReports(): void {
    if (!this.filterForm.valid) {
      return;
    }

    const filters = this.filterForm.getRawValue(); // Use getRawValue to get disabled form values
    const companyId = filters.company_id;

    if (!companyId) {
      this.reports.set([]);
      this.updateCharts();
      return;
    }

    this.isLoading.set(true);

    // Load reports with filters applied server-side
    // Use a high per_page to get all results in the date range
    this.financialReportService
      .getAll(
        1,
        1000,
        companyId,
        filters.date_from || undefined,
        filters.date_to || undefined
      )
      .subscribe({
        next: (response) => {
          // Sort reports by date (oldest first)
          const sortedData = (response.data || []).sort((a, b) => {
            const dateA = new Date(a.report_date).getTime();
            const dateB = new Date(b.report_date).getTime();
            return dateA - dateB;
          });
          this.reports.set(sortedData);
          this.updateCharts();
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          const errorMessage =
            (error as { error?: { message?: string }; message?: string })?.error
              ?.message ||
            (error as { message?: string })?.message ||
            'Error al cargar los reportes financieros';
          this.toastr.error(errorMessage, 'Error');
          this.reports.set([]);
          this.updateCharts();
          this.isLoading.set(false);
        },
      });
  }

  updateCharts(): void {
    const reports = this.reports();

    // Group by month
    const monthlyData = this.groupByMonth(reports);
    const months = this.sortMonthsByDate(Object.keys(monthlyData));

    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(
        today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      );
    }

    const incomeData = months.map((m: string) => monthlyData[m]?.income || 0);
    const expensesData = months.map((m: string) => monthlyData[m]?.expenses || 0);
    const profitData = months.map((m: string) => monthlyData[m]?.profit || 0);

    // Income vs Expenses Chart (Bar)
    this.incomeExpensesChart = {
      series: [
        { name: 'Ingresos', data: incomeData },
        { name: 'Gastos', data: expensesData },
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        stacked: false,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#10b981', '#ef4444'],
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
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' },
    };

    // Profit Trend Chart (Line)
    this.profitChart = {
      series: [
        {
          name: 'Ganancia',
          data: profitData,
        },
      ],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6'],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Monthly Trend (Area)
    this.monthlyTrendChart = {
      series: [
        { name: 'Ingresos', data: incomeData },
        { name: 'Gastos', data: expensesData },
        { name: 'Ganancia', data: profitData },
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        stacked: false,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#10b981', '#ef4444', '#3b82f6'],
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

    // Profit Distribution (Pie)
    const positiveMonths = profitData.filter((p: number) => p > 0).length;
    const negativeMonths = profitData.filter((p: number) => p < 0).length;
    const neutralMonths = profitData.filter((p: number) => p === 0).length;

    // Ensure we have at least one value for pie chart
    const hasData =
      positiveMonths > 0 || negativeMonths > 0 || neutralMonths > 0;

    this.profitDistributionChart = {
      series: hasData ? [positiveMonths, negativeMonths, neutralMonths] : [1],
      chart: {
        type: 'pie',
        height: 300,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      labels: hasData
        ? ['Meses Positivos', 'Meses Negativos', 'Meses Neutros']
        : ['Sin datos'],
      colors: ['#10b981', '#ef4444', '#64748b'],
      legend: { position: 'bottom' },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`,
      },
    };
  }

  private groupByMonth(reports: FinancialReport[]): {
    [key: string]: { income: number; expenses: number; profit: number };
  } {
    const grouped: {
      [key: string]: { income: number; expenses: number; profit: number };
    } = {};

    reports.forEach((report) => {
      const date = new Date(report.report_date);
      const monthKey = date.toLocaleDateString('es-ES', {
        month: 'short',
        year: 'numeric',
      });

      if (!grouped[monthKey]) {
        grouped[monthKey] = { income: 0, expenses: 0, profit: 0 };
      }

      grouped[monthKey].income += report.total_revenue || 0;
      grouped[monthKey].expenses += report.executed_value || 0;
      grouped[monthKey].profit += report.net_profit || 0;
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
