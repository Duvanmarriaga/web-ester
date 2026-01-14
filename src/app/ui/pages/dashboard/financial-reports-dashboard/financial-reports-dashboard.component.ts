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
  AlertCircle,
  BarChart3,
  Activity,
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
    AlertCircle,
    BarChart3,
    Activity,
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

  // Financial Indicators - Computed from latest report
  latestReport = computed(() => {
    const reports = this.reports();
    if (reports.length === 0) return null;
    // Get the most recent report
    return reports.sort((a, b) => 
      new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
    )[0];
  });

  // 1. Liquidez corriente: current_asset / current_passive
  currentLiquidity = computed(() => {
    const report = this.latestReport();
    if (!report || !report.current_passive || report.current_passive === 0) return null;
    return (report.current_asset || 0) / report.current_passive;
  });

  // 2. Prueba ácida: (current_asset - inventories) / current_passive
  acidTest = computed(() => {
    const report = this.latestReport();
    if (!report || !report.current_passive || report.current_passive === 0) return null;
    return ((report.current_asset || 0) - (report.inventories || 0)) / report.current_passive;
  });

  // 3. Endeudamiento total: total_passive / total_assets
  totalDebt = computed(() => {
    const report = this.latestReport();
    if (!report || !report.total_assets || report.total_assets === 0) return null;
    return (report.total_passive || 0) / report.total_assets;
  });

  // 4. Margen neto: (net_profit / total_revenue) * 100
  netMargin = computed(() => {
    const report = this.latestReport();
    if (!report || !report.total_revenue || report.total_revenue === 0) return null;
    return ((report.net_profit || 0) / report.total_revenue) * 100;
  });

  // 5. Resultado neto YTD: (current_value_result - initial_value_of_the_year) / initial_value_of_the_year
  netResultYTD = computed(() => {
    const report = this.latestReport();
    if (!report || !report.initial_value_of_the_year || report.initial_value_of_the_year === 0) return null;
    return ((report.current_value_result || 0) - report.initial_value_of_the_year) / report.initial_value_of_the_year;
  });

  // 6. Variación vs Presupuesto: budgeted_value - executed_value
  budgetVariance = computed(() => {
    const report = this.latestReport();
    if (!report) return null;
    return (report.budgeted_value || 0) - (report.executed_value || 0);
  });

  // 7. Caja disponible (runway): current_cash_balance / average_consumption_of_boxes_over_the_last_3_months
  cashRunway = computed(() => {
    const report = this.latestReport();
    if (!report || !report.average_consumption_of_boxes_over_the_last_3_months || 
        report.average_consumption_of_boxes_over_the_last_3_months === 0) return null;
    return (report.current_cash_balance || 0) / report.average_consumption_of_boxes_over_the_last_3_months;
  });

  // Charts
  netResultYTDChart: any = {};
  cashRunwayChart: any = {};

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

    // Sort reports by date for time series
    const sortedReports = [...reports].sort((a, b) => {
      const dateA = new Date(a.report_date).getTime();
      const dateB = new Date(b.report_date).getTime();
      return dateA - dateB;
    });

    // 5. Resultado neto YTD Chart
    const ytdData = sortedReports.map((report) => {
      if (!report.initial_value_of_the_year || report.initial_value_of_the_year === 0) return 0;
      return ((report.current_value_result || 0) - report.initial_value_of_the_year) / report.initial_value_of_the_year;
    });
    const ytdDates = sortedReports.map((report) => {
      const date = new Date(report.report_date);
      return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    });

    this.netResultYTDChart = {
      series: [
        {
          name: 'Resultado Neto YTD',
          data: ytdData,
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
      xaxis: { categories: ytdDates },
      yaxis: {
        labels: {
          formatter: (val: number) => `${(val * 100).toFixed(1)}%`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
      dataLabels: { enabled: false },
    };

    // 7. Caja disponible (runway) Chart
    const runwayData = sortedReports.map((report) => {
      if (!report.average_consumption_of_boxes_over_the_last_3_months || 
          report.average_consumption_of_boxes_over_the_last_3_months === 0) return 0;
      return (report.current_cash_balance || 0) / report.average_consumption_of_boxes_over_the_last_3_months;
    });
    const runwayDates = sortedReports.map((report) => {
      const date = new Date(report.report_date);
      return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    });

    this.cashRunwayChart = {
      series: [
        {
          name: 'Meses de Operación',
          data: runwayData,
        },
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#10b981'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.2,
        },
      },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: { categories: runwayDates },
      yaxis: {
        labels: {
          formatter: (val: number) => `${val.toFixed(1)} meses`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
      dataLabels: { enabled: false },
    };
  }

}
