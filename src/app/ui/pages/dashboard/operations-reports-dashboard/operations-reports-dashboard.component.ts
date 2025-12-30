import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { LucideAngularModule, TrendingUp, DollarSign, Calendar, Filter } from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import { OperationReportService, OperationReport } from '../../../../infrastructure/services/operation-report.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-operations-reports-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgApexchartsModule, NgSelectModule],
  templateUrl: './operations-reports-dashboard.component.html',
  styleUrl: './operations-reports-dashboard.component.scss'
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
  allReports = signal<OperationReport[]>([]);
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
    //   this.loadReports();
    // } else {
    //   this.route.parent?.paramMap.subscribe((params) => {
    //     const id = params.get('id');
    //     if (id) {
    //       this.companyId.set(parseInt(id, 10));
    //       this.loadReports();
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
    let filteredReports = [...this.allReports()];

    if (filters.company_id) {
      filteredReports = filteredReports.filter(r => r.company_id === filters.company_id);
    }

    if (filters.date_from) {
      const fromDate = new Date(filters.date_from);
      filteredReports = filteredReports.filter(r => {
        const reportDate = new Date(r.operation_date);
        return reportDate >= fromDate;
      });
    }

    if (filters.date_to) {
      const toDate = new Date(filters.date_to);
      toDate.setHours(23, 59, 59, 999);
      filteredReports = filteredReports.filter(r => {
        const reportDate = new Date(r.operation_date);
        return reportDate <= toDate;
      });
    }

    this.reports.set(filteredReports);
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
    // Mock operation reports data with multiple companies
    const mockReports: OperationReport[] = [
      { id: 1, operation_category_id: 1, company_id: 1, operation_date: '2024-01-15', description: 'Operación 1', monthly_cost: 15000, annual_cost: 180000, user_id: 1 },
      { id: 2, operation_category_id: 2, company_id: 1, operation_date: '2024-02-15', description: 'Operación 2', monthly_cost: 18000, annual_cost: 216000, user_id: 1 },
      { id: 3, operation_category_id: 1, company_id: 1, operation_date: '2024-03-15', description: 'Operación 3', monthly_cost: 16000, annual_cost: 192000, user_id: 1 },
      { id: 4, operation_category_id: 3, company_id: 1, operation_date: '2024-04-15', description: 'Operación 4', monthly_cost: 20000, annual_cost: 240000, user_id: 1 },
      { id: 5, operation_category_id: 2, company_id: 1, operation_date: '2024-05-15', description: 'Operación 5', monthly_cost: 17000, annual_cost: 204000, user_id: 1 },
      { id: 6, operation_category_id: 1, company_id: 1, operation_date: '2024-06-15', description: 'Operación 6', monthly_cost: 19000, annual_cost: 228000, user_id: 1 },
      { id: 7, operation_category_id: 3, company_id: 1, operation_date: '2024-07-15', description: 'Operación 7', monthly_cost: 21000, annual_cost: 252000, user_id: 1 },
      { id: 8, operation_category_id: 2, company_id: 1, operation_date: '2024-08-15', description: 'Operación 8', monthly_cost: 22000, annual_cost: 264000, user_id: 1 },
      { id: 9, operation_category_id: 1, company_id: 1, operation_date: '2024-09-15', description: 'Operación 9', monthly_cost: 23000, annual_cost: 276000, user_id: 1 },
      { id: 10, operation_category_id: 3, company_id: 1, operation_date: '2024-10-15', description: 'Operación 10', monthly_cost: 24000, annual_cost: 288000, user_id: 1 },
      { id: 11, operation_category_id: 2, company_id: 1, operation_date: '2024-11-15', description: 'Operación 11', monthly_cost: 25000, annual_cost: 300000, user_id: 1 },
      { id: 12, operation_category_id: 1, company_id: 1, operation_date: '2024-12-15', description: 'Operación 12', monthly_cost: 26000, annual_cost: 312000, user_id: 1 },
      { id: 13, operation_category_id: 1, company_id: 2, operation_date: '2024-01-20', description: 'Operación 13', monthly_cost: 12000, annual_cost: 144000, user_id: 1 },
      { id: 14, operation_category_id: 2, company_id: 2, operation_date: '2024-02-20', description: 'Operación 14', monthly_cost: 14000, annual_cost: 168000, user_id: 1 },
      { id: 15, operation_category_id: 3, company_id: 3, operation_date: '2024-01-10', description: 'Operación 15', monthly_cost: 16000, annual_cost: 192000, user_id: 1 },
    ];
    
    this.allReports.set(mockReports);
    this.applyFilters();
  }

  loadReports(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.operationReportService.getAll(1, 100, companyId).subscribe({
      next: (response) => {
        this.reports.set(response.data);
        this.updateCharts();
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los reportes';
        this.toastr.error(errorMessage, 'Error');
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
      months.push(today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }));
    }
    
    const monthlyCostData = months.map(m => monthlyData[m]?.monthlyCost || 0);
    const annualCostData = months.map(m => monthlyData[m]?.annualCost || 0);

    // Monthly Cost Chart (Bar)
    this.monthlyCostChart = {
      series: [{
        name: 'Costo Mensual',
        data: monthlyCostData
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
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };

    // Annual Cost Chart (Line)
    this.annualCostChart = {
      series: [{
        name: 'Costo Anual',
        data: annualCostData
      }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#10b981'],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };

    // Cost Comparison (Bar)
    this.costComparisonChart = {
      series: [
        { name: 'Costo Mensual', data: monthlyCostData },
        { name: 'Costo Anual', data: annualCostData }
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#3b82f6', '#10b981'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: '55%',
        }
      },
      dataLabels: { enabled: false },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
        }
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' }
    };

    // Monthly Trend (Area)
    this.monthlyTrendChart = {
      series: [{
        name: 'Costo Mensual',
        data: monthlyCostData
      }],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#8b5cf6'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.2,
        }
      },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };
  }

  private groupByMonth(reports: OperationReport[]): { [key: string]: { monthlyCost: number; annualCost: number } } {
    const grouped: { [key: string]: { monthlyCost: number; annualCost: number } } = {};
    
    reports.forEach(report => {
      const date = new Date(report.operation_date);
      const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = { monthlyCost: 0, annualCost: 0 };
      }
      
      grouped[monthKey].monthlyCost += report.monthly_cost || 0;
      grouped[monthKey].annualCost += report.annual_cost || 0;
    });
    
    return grouped;
  }
}

