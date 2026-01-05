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
  TrendingUp,
  DollarSign,
  Calendar,
  Filter,
} from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  OperationReportService,
  OperationReport,
} from '../../../../infrastructure/services/operation-report.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-operations-reports-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgApexchartsModule,
    NgSelectModule,
  ],
  templateUrl: './operations-reports-dashboard.component.html',
  styleUrl: './operations-reports-dashboard.component.scss',
})
export class OperationsReportsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private operationReportService = inject(OperationReportService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = { TrendingUp, DollarSign, Calendar, Filter };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  reports = signal<OperationReport[]>([]);
  companies = signal<Company[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.ADMIN);

  filterForm!: FormGroup;

  // Stats computed
  totalMonthlyCost = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.monthly_cost || 0), 0);
  });

  totalAnnualCost = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.annual_cost || 0), 0);
  });

  averageMonthlyCost = computed(() => {
    const reports = this.reports();
    if (reports.length === 0) return 0;
    return this.totalMonthlyCost() / reports.length;
  });

  // Charts
  monthlyCostChart: any = {};
  annualCostChart: any = {};
  costComparisonChart: any = {};
  monthlyTrendChart: any = {};

  ngOnInit() {
    // Get current user
    this.store.select(selectUser).subscribe((user) => {
      this.currentUser.set(user);
      if (user) {
        this.initFilterForm();
        // Only load companies if user is ADMIN
        if (user.type === UserType.ADMIN) {
          this.loadCompanies();
        }
      }
    });
  }

  initFilterForm(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
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
      user.type === UserType.CLIENT &&
      user.companies &&
      user.companies.length > 0
    ) {
      // If client, use company from role (first company)
      defaultCompanyId = user.companies[0];
    }

    this.filterForm = this.fb.group({
      company_id: [defaultCompanyId, Validators.required],
      date_from: [
        firstDayOfMonth.toISOString().split('T')[0],
        Validators.required,
      ],
      date_to: [
        lastDayOfMonth.toISOString().split('T')[0],
        Validators.required,
      ],
    });

    this.filterForm.valueChanges.subscribe(() => {
      if (this.filterForm.valid) {
        this.loadReports();
      }
    });

    // Load initial data if form is valid
    if (this.filterForm.valid) {
      this.loadReports();
    }
  }

  loadCompanies(): void {
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
    // Filters are now applied server-side in loadReports()
    this.loadReports();
  }

  resetFilters(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );
    const user = this.currentUser();

    let defaultCompanyId: number | Company | null = null;
    if (
      user &&
      user.type === UserType.CLIENT &&
      user.companies &&
      user.companies.length > 0
    ) {
      // If client, use company from role
      defaultCompanyId = user.companies[0];
    } else if (user && user.type === UserType.ADMIN) {
      const firstCompany = this.companies()[0];
      defaultCompanyId = firstCompany || null;
    }

    this.filterForm.patchValue(
      {
        company_id: defaultCompanyId,
        date_from: firstDayOfMonth.toISOString().split('T')[0],
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
    this.operationReportService
      .getAll(
        1,
        1000,
        companyId,
        filters.date_from || undefined,
        filters.date_to || undefined
      )
      .subscribe({
        next: (response) => {
          this.reports.set(response.data || []);
          this.updateCharts();
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          const errorMessage =
            (error as { error?: { message?: string }; message?: string })?.error
              ?.message ||
            (error as { message?: string })?.message ||
            'Error al cargar los reportes de operaciones';
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
    const months = Object.keys(monthlyData).sort();

    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(
        today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      );
    }

    const monthlyCostData = months.map((m) => monthlyData[m]?.monthlyCost || 0);
    const annualCostData = months.map((m) => monthlyData[m]?.annualCost || 0);

    // Monthly Cost Chart (Bar)
    this.monthlyCostChart = {
      series: [
        {
          name: 'Costo Mensual',
          data: monthlyCostData,
        },
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6'],
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
      grid: { borderColor: '#e2e8f0' },
    };

    // Annual Cost Chart (Line)
    this.annualCostChart = {
      series: [
        {
          name: 'Costo Anual',
          data: annualCostData,
        },
      ],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#10b981'],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Cost Comparison (Bar)
    this.costComparisonChart = {
      series: [
        { name: 'Costo Mensual', data: monthlyCostData },
        { name: 'Costo Anual', data: annualCostData },
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

    // Monthly Trend (Area)
    this.monthlyTrendChart = {
      series: [
        {
          name: 'Costo Mensual',
          data: monthlyCostData,
        },
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#8b5cf6'],
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
      grid: { borderColor: '#e2e8f0' },
    };
  }

  private groupByMonth(reports: OperationReport[]): {
    [key: string]: { monthlyCost: number; annualCost: number };
  } {
    const grouped: {
      [key: string]: { monthlyCost: number; annualCost: number };
    } = {};

    reports.forEach((report) => {
      const date = new Date(report.operation_date);
      const monthKey = date.toLocaleDateString('es-ES', {
        month: 'short',
        year: 'numeric',
      });

      if (!grouped[monthKey]) {
        grouped[monthKey] = { monthlyCost: 0, annualCost: 0 };
      }

      grouped[monthKey].monthlyCost += report.monthly_cost || 0;
      grouped[monthKey].annualCost += report.annual_cost || 0;
    });

    return grouped;
  }
}
