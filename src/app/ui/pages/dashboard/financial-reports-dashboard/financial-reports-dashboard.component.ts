import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { LucideAngularModule, FileText, TrendingUp, DollarSign, TrendingDown, Filter, Calendar } from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import { FinancialReportService, FinancialReport } from '../../../../infrastructure/services/financial-report.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-financial-reports-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgApexchartsModule, NgSelectModule],
  templateUrl: './financial-reports-dashboard.component.html',
  styleUrl: './financial-reports-dashboard.component.scss'
})
export class FinancialReportsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private financialReportService = inject(FinancialReportService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = { FileText, TrendingUp, DollarSign, TrendingDown, Filter, Calendar };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  reports = signal<FinancialReport[]>([]);
  allReports = signal<FinancialReport[]>([]);
  companies = signal<Company[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.ADMIN);
  
  filterForm!: FormGroup;

  // Stats computed
  totalIncome = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.income || 0), 0);
  });

  totalExpenses = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.expenses || 0), 0);
  });

  totalProfit = computed(() => {
    return this.reports().reduce((sum, r) => sum + (r.profit || 0), 0);
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

    // Watch for form changes and apply filters
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
      // Set first company as default if available
      if (companies.length > 0 && !this.filterForm.get('company_id')?.value) {
        this.filterForm.patchValue({ company_id: companies[0].id }, { emitEvent: false });
      }
    });
  }

  applyFilters(): void {
    const filters = this.filterForm.value;
    let filteredReports = [...this.allReports()];

    // Filter by company
    if (filters.company_id) {
      filteredReports = filteredReports.filter(r => r.company_id === filters.company_id);
    }

    // Filter by date range
    if (filters.date_from) {
      const fromDate = new Date(filters.date_from);
      filteredReports = filteredReports.filter(r => {
        const reportDate = new Date(r.report_date);
        return reportDate >= fromDate;
      });
    }

    if (filters.date_to) {
      const toDate = new Date(filters.date_to);
      toDate.setHours(23, 59, 59, 999); // Include the entire end date
      filteredReports = filteredReports.filter(r => {
        const reportDate = new Date(r.report_date);
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
    // Mock financial reports data with multiple companies
    const mockReports: FinancialReport[] = [
      { id: 1, company_id: 1, report_date: '2024-01-15', income: 44000, expenses: 32000, profit: 12000, user_id: 1 },
      { id: 2, company_id: 1, report_date: '2024-02-15', income: 55000, expenses: 40000, profit: 15000, user_id: 1 },
      { id: 3, company_id: 1, report_date: '2024-03-15', income: 57000, expenses: 44000, profit: 13000, user_id: 1 },
      { id: 4, company_id: 1, report_date: '2024-04-15', income: 56000, expenses: 39000, profit: 17000, user_id: 1 },
      { id: 5, company_id: 1, report_date: '2024-05-15', income: 61000, expenses: 45000, profit: 16000, user_id: 1 },
      { id: 6, company_id: 1, report_date: '2024-06-15', income: 58000, expenses: 39000, profit: 19000, user_id: 1 },
      { id: 7, company_id: 1, report_date: '2024-07-15', income: 63000, expenses: 41000, profit: 22000, user_id: 1 },
      { id: 8, company_id: 1, report_date: '2024-08-15', income: 60000, expenses: 33000, profit: 27000, user_id: 1 },
      { id: 9, company_id: 1, report_date: '2024-09-15', income: 66000, expenses: 37000, profit: 29000, user_id: 1 },
      { id: 10, company_id: 1, report_date: '2024-10-15', income: 70000, expenses: 44000, profit: 26000, user_id: 1 },
      { id: 11, company_id: 1, report_date: '2024-11-15', income: 72000, expenses: 41000, profit: 31000, user_id: 1 },
      { id: 12, company_id: 1, report_date: '2024-12-15', income: 75000, expenses: 41000, profit: 34000, user_id: 1 },
      { id: 13, company_id: 2, report_date: '2024-01-20', income: 38000, expenses: 28000, profit: 10000, user_id: 1 },
      { id: 14, company_id: 2, report_date: '2024-02-20', income: 42000, expenses: 30000, profit: 12000, user_id: 1 },
      { id: 15, company_id: 2, report_date: '2024-03-20', income: 45000, expenses: 32000, profit: 13000, user_id: 1 },
      { id: 16, company_id: 3, report_date: '2024-01-10', income: 52000, expenses: 38000, profit: 14000, user_id: 1 },
      { id: 17, company_id: 3, report_date: '2024-02-10', income: 58000, expenses: 42000, profit: 16000, user_id: 1 },
      { id: 18, company_id: 3, report_date: '2024-03-10', income: 60000, expenses: 44000, profit: 16000, user_id: 1 },
    ];
    
    this.allReports.set(mockReports);
    this.applyFilters();
  }

  loadReports(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    // Load all reports for dashboard (use a high per_page to get all)
    this.financialReportService.getAll(1, 100, companyId).subscribe({
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
    
    const incomeData = months.map(m => monthlyData[m]?.income || 0);
    const expensesData = months.map(m => monthlyData[m]?.expenses || 0);
    const profitData = months.map(m => monthlyData[m]?.profit || 0);

    // Income vs Expenses Chart (Bar)
    this.incomeExpensesChart = {
      series: [
        { name: 'Ingresos', data: incomeData },
        { name: 'Gastos', data: expensesData }
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        stacked: false
      },
      colors: ['#10b981', '#ef4444'],
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
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' }
    };

    // Profit Trend Chart (Line)
    this.profitChart = {
      series: [{
        name: 'Ganancia',
        data: profitData
      }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#3b82f6'],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };

    // Monthly Trend (Area)
    this.monthlyTrendChart = {
      series: [
        { name: 'Ingresos', data: incomeData },
        { name: 'Gastos', data: expensesData },
        { name: 'Ganancia', data: profitData }
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        stacked: false
      },
      colors: ['#10b981', '#ef4444', '#3b82f6'],
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
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' }
    };

    // Profit Distribution (Pie)
    const positiveMonths = profitData.filter(p => p > 0).length;
    const negativeMonths = profitData.filter(p => p < 0).length;
    const neutralMonths = profitData.filter(p => p === 0).length;
    
    // Ensure we have at least one value for pie chart
    const hasData = positiveMonths > 0 || negativeMonths > 0 || neutralMonths > 0;
    
    this.profitDistributionChart = {
      series: hasData ? [positiveMonths, negativeMonths, neutralMonths] : [1],
      chart: {
        type: 'pie',
        height: 300
      },
      labels: hasData ? ['Meses Positivos', 'Meses Negativos', 'Meses Neutros'] : ['Sin datos'],
      colors: ['#10b981', '#ef4444', '#64748b'],
      legend: { position: 'bottom' },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`
      }
    };
  }

  private groupByMonth(reports: FinancialReport[]): { [key: string]: { income: number; expenses: number; profit: number } } {
    const grouped: { [key: string]: { income: number; expenses: number; profit: number } } = {};
    
    reports.forEach(report => {
      const date = new Date(report.report_date);
      const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = { income: 0, expenses: 0, profit: 0 };
      }
      
      grouped[monthKey].income += report.income || 0;
      grouped[monthKey].expenses += report.expenses || 0;
      grouped[monthKey].profit += report.profit || 0;
    });
    
    return grouped;
  }
}

