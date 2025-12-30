import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { LucideAngularModule, Scale, FileText, Clock, CheckCircle, Filter, Calendar } from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProcessService, Process } from '../../../../infrastructure/services/process.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-legal-processes-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgApexchartsModule, NgSelectModule],
  templateUrl: './legal-processes-dashboard.component.html',
  styleUrl: './legal-processes-dashboard.component.scss'
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
  allProcesses = signal<Process[]>([]);
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
    this.processes().forEach(process => {
      const statusName = process.process_status_id ? `Estado ${process.process_status_id}` : 'Sin estado';
      statusCount[statusName] = (statusCount[statusName] || 0) + 1;
    });
    return statusCount;
  });

  processesByType = computed(() => {
    const typeCount: { [key: string]: number } = {};
    this.processes().forEach(process => {
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
    this.store.select(selectUser).subscribe(user => {
      this.currentUser.set(user);
      if (user) {
        this.initFilterForm();
        this.loadCompanies();
        // Use mock data for now
        this.loadMockData();
      }
    });
    
    // Uncomment below to load real data when companyId is available
    // const inputId = this.companyIdInput();
    // if (inputId) {
    //   this.companyId.set(inputId);
    //   this.loadProcesses();
    // } else {
    //   this.route.parent?.paramMap.subscribe((params) => {
    //     const id = params.get('id');
    //     if (id) {
    //       this.companyId.set(parseInt(id, 10));
    //       this.loadProcesses();
    //     }
    //   });
    // }
  }

  initFilterForm(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const user = this.currentUser();
    
    // Determine default company
    let defaultCompanyId: number | null = null;
    if (user && user.type !== UserType.ADMIN && user.companies && user.companies.length > 0) {
      // If not admin, use first company from user's companies
      defaultCompanyId = user.companies[0].id;
    }
    
    this.filterForm = this.fb.group({
      company_id: [defaultCompanyId, Validators.required],
      date_from: [firstDayOfMonth.toISOString().split('T')[0], Validators.required],
      date_to: [lastDayOfMonth.toISOString().split('T')[0], Validators.required]
    });

    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  loadCompanies(): void {
    const user = this.currentUser();
    
    if (user && user.type !== UserType.ADMIN) {
      // If not admin, use companies from user data
      if (user.companies && user.companies.length > 0) {
        const userCompanies: Company[] = user.companies.map((uc: any) => ({
          id: uc.id,
          name: uc.name,
          identification_number: '',
          address: '',
          phone: null,
          email: '',
          created_at: '',
          updated_at: ''
        }));
        this.companies.set(userCompanies);
        // Set first company as default
        if (!this.filterForm.get('company_id')?.value && userCompanies.length > 0) {
          this.filterForm.patchValue({ company_id: userCompanies[0].id }, { emitEvent: false });
        }
      }
      return;
    }
    
    // If admin, get companies from store
    this.store.select(selectAllCompanies).subscribe(companies => {
      this.companies.set(companies);
      if (companies.length > 0 && !this.filterForm.get('company_id')?.value) {
        this.filterForm.patchValue({ company_id: companies[0].id }, { emitEvent: false });
      }
    });
  }

  applyFilters(): void {
    const filters = this.filterForm.value;
    let filteredProcesses = [...this.allProcesses()];

    if (filters.company_id) {
      filteredProcesses = filteredProcesses.filter(p => p.company_id === filters.company_id);
    }

    if (filters.date_from) {
      const fromDate = new Date(filters.date_from);
      filteredProcesses = filteredProcesses.filter(p => {
        if (!p.start_date) return false;
        const processDate = new Date(p.start_date);
        return processDate >= fromDate;
      });
    }

    if (filters.date_to) {
      const toDate = new Date(filters.date_to);
      toDate.setHours(23, 59, 59, 999);
      filteredProcesses = filteredProcesses.filter(p => {
        if (!p.start_date) return false;
        const processDate = new Date(p.start_date);
        return processDate <= toDate;
      });
    }

    this.processes.set(filteredProcesses);
    this.updateCharts();
  }

  resetFilters(): void {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const user = this.currentUser();
    
    let defaultCompanyId: number | null = null;
    if (user && user.type !== UserType.ADMIN && user.companies && user.companies.length > 0) {
      defaultCompanyId = user.companies[0].id;
    } else {
      const firstCompany = this.companies()[0];
      defaultCompanyId = firstCompany?.id || null;
    }
    
    this.filterForm.patchValue({
      company_id: defaultCompanyId,
      date_from: firstDayOfMonth.toISOString().split('T')[0],
      date_to: lastDayOfMonth.toISOString().split('T')[0]
    });
  }

  loadMockData(): void {
    // Mock processes data with multiple companies
    const mockProcesses: Process[] = [
      { id: 1, company_id: 1, docket_number: 'EXP-001', type: 'penal', start_date: '2024-01-15', process_status_id: 1 },
      { id: 2, company_id: 1, docket_number: 'EXP-002', type: 'juridico', start_date: '2024-02-15', process_status_id: 2 },
      { id: 3, company_id: 1, docket_number: 'EXP-003', type: 'penal', start_date: '2024-03-15', process_status_id: 1 },
      { id: 4, company_id: 1, docket_number: 'EXP-004', type: 'juridico', start_date: '2024-04-15', process_status_id: 3 },
      { id: 5, company_id: 1, docket_number: 'EXP-005', type: 'penal', start_date: '2024-05-15', process_status_id: 2 },
      { id: 6, company_id: 1, docket_number: 'EXP-006', type: 'juridico', start_date: '2024-06-15', process_status_id: 1 },
      { id: 7, company_id: 1, docket_number: 'EXP-007', type: 'penal', start_date: '2024-07-15', process_status_id: 4 },
      { id: 8, company_id: 1, docket_number: 'EXP-008', type: 'juridico', start_date: '2024-08-15', process_status_id: 2 },
      { id: 9, company_id: 1, docket_number: 'EXP-009', type: 'penal', start_date: '2024-09-15', process_status_id: 3 },
      { id: 10, company_id: 1, docket_number: 'EXP-010', type: 'juridico', start_date: '2024-10-15', process_status_id: 1 },
      { id: 11, company_id: 1, docket_number: 'EXP-011', type: 'penal', start_date: '2024-11-15', process_status_id: 2 },
      { id: 12, company_id: 1, docket_number: 'EXP-012', type: 'juridico', start_date: '2024-12-15', process_status_id: 4 },
      { id: 13, company_id: 2, docket_number: 'EXP-013', type: 'penal', start_date: '2024-01-20', process_status_id: 1 },
      { id: 14, company_id: 2, docket_number: 'EXP-014', type: 'juridico', start_date: '2024-02-20', process_status_id: 2 },
      { id: 15, company_id: 3, docket_number: 'EXP-015', type: 'penal', start_date: '2024-01-10', process_status_id: 1 },
    ];
    
    this.allProcesses.set(mockProcesses);
    this.applyFilters();
  }

  loadProcesses(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.processService.getAll(1, 100, companyId).subscribe({
      next: (response) => {
        this.processes.set(response.data);
        this.updateCharts();
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los procesos';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  updateCharts(): void {
    const processes = this.processes();
    
    // Status Distribution (Pie)
    const statusCount = this.processesByStatus();
    const statusLabels = Object.keys(statusCount);
    const statusValues = statusLabels.map(label => statusCount[label]);
    
    const hasStatusData = statusValues.length > 0 && statusValues.some(v => v > 0);
    
    this.statusDistributionChart = {
      series: hasStatusData ? statusValues : [1],
      chart: {
        type: 'pie',
        height: 300
      },
      labels: hasStatusData ? statusLabels : ['Sin datos'],
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      legend: { position: 'bottom' },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`
      }
    };

    // Type Distribution (Donut)
    const typeCount = this.processesByType();
    const typeLabels = Object.keys(typeCount);
    const typeValues = typeLabels.map(label => typeCount[label]);
    
    const hasTypeData = typeValues.length > 0 && typeValues.some(v => v > 0);
    
    this.typeDistributionChart = {
      series: hasTypeData ? typeValues : [1],
      chart: {
        type: 'donut',
        height: 300
      },
      labels: hasTypeData ? typeLabels : ['Sin datos'],
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
      legend: { position: 'bottom' },
      plotOptions: {
        pie: {
          donut: {
            size: '70%'
          }
        }
      }
    };

    // Monthly Processes (Bar)
    const monthlyData = this.groupByMonth(processes);
    const months = Object.keys(monthlyData).sort();
    
    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }));
    }
    
    const monthlyCounts = months.map(m => monthlyData[m] || 0);
    
    this.monthlyProcessesChart = {
      series: [{
        name: 'Procesos',
        data: monthlyCounts
      }],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#3b82f6'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '60%',
        }
      },
      dataLabels: { enabled: false },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => val.toFixed(0)
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };

    // Status Trend (Line)
    const statusTrendData = this.getStatusTrend(processes);
    const statusMonths = Object.keys(statusTrendData).sort();
    
    // Ensure we have at least one month
    if (statusMonths.length === 0) {
      const today = new Date();
      statusMonths.push(today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }));
    }
    
    const statusSeries = this.getStatusSeries(statusTrendData, statusMonths);
    
    this.statusTrendChart = {
      series: statusSeries.length > 0 ? statusSeries : [{ name: 'Sin datos', data: [0] }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
      stroke: { curve: 'smooth', width: 2 },
      xaxis: { categories: statusMonths },
      yaxis: {
        labels: {
          formatter: (val: number) => val.toFixed(0)
        }
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' }
    };
  }

  private groupByMonth(processes: Process[]): { [key: string]: number } {
    const grouped: { [key: string]: number } = {};
    
    processes.forEach(process => {
      const date = process.start_date ? new Date(process.start_date) : new Date();
      const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      grouped[monthKey] = (grouped[monthKey] || 0) + 1;
    });
    
    return grouped;
  }

  private getStatusTrend(processes: Process[]): { [key: string]: { [status: string]: number } } {
    const trend: { [key: string]: { [status: string]: number } } = {};
    
    processes.forEach(process => {
      const date = process.start_date ? new Date(process.start_date) : new Date();
      const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      const statusName = process.process_status_id ? `Estado ${process.process_status_id}` : 'Sin estado';
      
      if (!trend[monthKey]) {
        trend[monthKey] = {};
      }
      
      trend[monthKey][statusName] = (trend[monthKey][statusName] || 0) + 1;
    });
    
    return trend;
  }

  private getStatusSeries(trendData: { [key: string]: { [status: string]: number } }, months: string[]): any[] {
    const allStatuses = new Set<string>();
    Object.values(trendData).forEach(monthData => {
      Object.keys(monthData).forEach(status => allStatuses.add(status));
    });
    
    const statusArray = Array.from(allStatuses);
    return statusArray.map(status => ({
      name: status,
      data: months.map(month => trendData[month]?.[status] || 0)
    }));
  }
}

