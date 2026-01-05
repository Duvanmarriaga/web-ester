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
  Scale,
  FileText,
  Clock,
  CheckCircle,
  Filter,
  Calendar,
} from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  ProcessService,
  Process,
} from '../../../../infrastructure/services/process.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';
import * as CompanyActions from '../../../../infrastructure/store/company';
@Component({
  selector: 'app-legal-processes-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgApexchartsModule,
    NgSelectModule,
  ],
  templateUrl: './legal-processes-dashboard.component.html',
  styleUrl: './legal-processes-dashboard.component.scss',
})
export class LegalProcessesDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private processService = inject(ProcessService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = { Scale, FileText, Clock, CheckCircle, Filter, Calendar };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  processes = signal<Process[]>([]);
  companies = signal<Company[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.ADMIN);

  filterForm!: FormGroup;

  // Stats computed
  totalProcesses = computed(() => {
    return this.processes().length;
  });

  processesByStatus = computed(() => {
    const statusCount: { [key: string]: number } = {};
    this.processes().forEach((process) => {
      const statusName = process.process_status_id
        ? `Estado ${process.process_status_id}`
        : 'Sin estado';
      statusCount[statusName] = (statusCount[statusName] || 0) + 1;
    });
    return statusCount;
  });

  processesByType = computed(() => {
    const typeCount: { [key: string]: number } = {};
    this.processes().forEach((process) => {
      const type = process.type || 'Sin tipo';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    return typeCount;
  });

  statusKeys = computed(() => {
    return Object.keys(this.processesByStatus());
  });

  // Charts
  statusDistributionChart: any = {};
  typeDistributionChart: any = {};
  monthlyProcessesChart: any = {};
  statusTrendChart: any = {};

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
        this.loadProcesses();
      }
    });

    // Load initial data if form is valid
    if (this.filterForm.valid) {
      this.loadProcesses();
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
    // Filters are now applied server-side in loadProcesses()
    this.loadProcesses();
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
      this.loadProcesses();
    }
  }

  loadProcesses(): void {
    if (!this.filterForm.valid) {
      return;
    }

    const filters = this.filterForm.getRawValue(); // Use getRawValue to get disabled form values
    const companyId = filters.company_id;

    if (!companyId) {
      this.processes.set([]);
      this.updateCharts();
      return;
    }

    this.isLoading.set(true);

    // Load processes with filters applied server-side
    this.processService
      .getAll(
        1,
        1000,
        companyId,
        filters.date_from || undefined,
        filters.date_to || undefined
      )
      .subscribe({
        next: (response) => {
          this.processes.set(response.data || []);
          this.updateCharts();
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          const errorMessage =
            (error as { error?: { message?: string }; message?: string })?.error
              ?.message ||
            (error as { message?: string })?.message ||
            'Error al cargar los procesos legales';
          this.toastr.error(errorMessage, 'Error');
          this.processes.set([]);
          this.updateCharts();
          this.isLoading.set(false);
        },
      });
  }

  updateCharts(): void {
    const processes = this.processes();

    // Status Distribution (Pie)
    const statusCount = this.processesByStatus();
    const statusLabels = Object.keys(statusCount);
    const statusValues = statusLabels.map((label) => statusCount[label]);

    const hasStatusData =
      statusValues.length > 0 && statusValues.some((v) => v > 0);

    this.statusDistributionChart = {
      series: hasStatusData ? statusValues : [1],
      chart: {
        type: 'pie',
        height: 300,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      labels: hasStatusData ? statusLabels : ['Sin datos'],
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      legend: { position: 'bottom' },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`,
      },
    };

    // Type Distribution (Donut)
    const typeCount = this.processesByType();
    const typeLabels = Object.keys(typeCount);
    const typeValues = typeLabels.map((label) => typeCount[label]);

    const hasTypeData = typeValues.length > 0 && typeValues.some((v) => v > 0);

    this.typeDistributionChart = {
      series: hasTypeData ? typeValues : [1],
      chart: {
        type: 'donut',
        height: 300,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      labels: hasTypeData ? typeLabels : ['Sin datos'],
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
      legend: { position: 'bottom' },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
          },
        },
      },
    };

    // Monthly Processes (Bar)
    const monthlyData = this.groupByMonth(processes);
    const months = Object.keys(monthlyData).sort();

    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(
        today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      );
    }

    const monthlyCounts = months.map((m) => monthlyData[m] || 0);

    this.monthlyProcessesChart = {
      series: [
        {
          name: 'Procesos',
          data: monthlyCounts,
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
          formatter: (val: number) => val.toFixed(0),
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Status Trend (Line)
    const statusTrendData = this.getStatusTrend(processes);
    const statusMonths = Object.keys(statusTrendData).sort();

    // Ensure we have at least one month
    if (statusMonths.length === 0) {
      const today = new Date();
      statusMonths.push(
        today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      );
    }

    const statusSeries = this.getStatusSeries(statusTrendData, statusMonths);

    this.statusTrendChart = {
      series:
        statusSeries.length > 0
          ? statusSeries
          : [{ name: 'Sin datos', data: [0] }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
      stroke: { curve: 'smooth', width: 2 },
      xaxis: { categories: statusMonths },
      yaxis: {
        labels: {
          formatter: (val: number) => val.toFixed(0),
        },
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' },
    };
  }

  private groupByMonth(processes: Process[]): { [key: string]: number } {
    const grouped: { [key: string]: number } = {};

    processes.forEach((process) => {
      const date = process.start_date
        ? new Date(process.start_date)
        : new Date();
      const monthKey = date.toLocaleDateString('es-ES', {
        month: 'short',
        year: 'numeric',
      });
      grouped[monthKey] = (grouped[monthKey] || 0) + 1;
    });

    return grouped;
  }

  private getStatusTrend(processes: Process[]): {
    [key: string]: { [status: string]: number };
  } {
    const trend: { [key: string]: { [status: string]: number } } = {};

    processes.forEach((process) => {
      const date = process.start_date
        ? new Date(process.start_date)
        : new Date();
      const monthKey = date.toLocaleDateString('es-ES', {
        month: 'short',
        year: 'numeric',
      });
      const statusName = process.process_status_id
        ? `Estado ${process.process_status_id}`
        : 'Sin estado';

      if (!trend[monthKey]) {
        trend[monthKey] = {};
      }

      trend[monthKey][statusName] = (trend[monthKey][statusName] || 0) + 1;
    });

    return trend;
  }

  private getStatusSeries(
    trendData: { [key: string]: { [status: string]: number } },
    months: string[]
  ): any[] {
    const allStatuses = new Set<string>();
    Object.values(trendData).forEach((monthData) => {
      Object.keys(monthData).forEach((status) => allStatuses.add(status));
    });

    const statusArray = Array.from(allStatuses);
    return statusArray.map((status) => ({
      name: status,
      data: months.map((month) => trendData[month]?.[status] || 0),
    }));
  }
}
