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
import {
  ProcessStatusService,
  ProcessStatus,
} from '../../../../infrastructure/services/process-status.service';
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
  private processStatusService = inject(ProcessStatusService);
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
  statuses = signal<ProcessStatus[]>([]);
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
      const currentStatusId = this.getCurrentStatusId(process);
      const statusName = this.getStatusName(currentStatusId);
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
    // Load statuses first
    this.loadStatuses();
    
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

  loadStatuses(): void {
    this.processStatusService.getAll().subscribe({
      next: (statuses) => {
        this.statuses.set(statuses);
      },
      error: () => {
        this.statuses.set([]);
      },
    });
  }

  // Helper function to get current status ID from process (using status_history if available)
  getCurrentStatusId(process: Process): number | null {
    // If status_history exists and has items, use the last one
    if (process.status_history && Array.isArray(process.status_history) && process.status_history.length > 0) {
      const lastStatusHistory = process.status_history[process.status_history.length - 1];
      return lastStatusHistory?.process_status_id || null;
    }
    // Otherwise, use process_status_id
    return process.process_status_id || null;
  }

  // Helper function to get status name by ID
  getStatusName(statusId: number | null): string {
    if (!statusId) return 'Sin estado';
    const status = this.statuses().find((s) => s.id === statusId);
    return status ? status.name : `Estado ${statusId}`;
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
        date_from: fourYearsAgo.toISOString().split('T')[0],
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
          // Sort processes by date (oldest first)
          const sortedData = (response.data || []).sort((a, b) => {
            const dateA = new Date(a.start_date).getTime();
            const dateB = new Date(b.start_date).getTime();
            return dateA - dateB;
          });
          this.processes.set(sortedData);
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
    const months = this.sortMonthsByDate(Object.keys(monthlyData));

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
    const statusMonths = this.sortMonthsByDate(Object.keys(statusTrendData));

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
      
      // Use status_history to get the status at the time of the process start_date
      // If status_history exists, find the status that was active at that time
      let statusId: number | null = null;
      if (process.status_history && Array.isArray(process.status_history) && process.status_history.length > 0) {
        // Find the status that was active at the start_date
        // Sort by status_date and find the one closest to but not after start_date
        const sortedHistory = [...process.status_history].sort((a, b) => {
          const dateA = a.status_date ? new Date(a.status_date).getTime() : 0;
          const dateB = b.status_date ? new Date(b.status_date).getTime() : 0;
          return dateA - dateB;
        });
        
        const processStartDate = date.getTime();
        let activeStatus = sortedHistory[0]; // Default to first status
        
        for (const historyItem of sortedHistory) {
          if (historyItem.status_date) {
            const historyDate = new Date(historyItem.status_date).getTime();
            if (historyDate <= processStartDate) {
              activeStatus = historyItem;
            } else {
              break;
            }
          }
        }
        
        statusId = activeStatus?.process_status_id || null;
      } else {
        // If no status_history, use process_status_id
        statusId = process.process_status_id || null;
      }
      
      const statusName = this.getStatusName(statusId);

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
