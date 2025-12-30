import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { LucideAngularModule, DollarSign, TrendingUp, Target, Percent, Filter, Calendar } from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import { BudgetService, Budget } from '../../../../infrastructure/services/budget.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-budgets-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgApexchartsModule, NgSelectModule],
  templateUrl: './budgets-dashboard.component.html',
  styleUrl: './budgets-dashboard.component.scss'
})
export class BudgetsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private budgetService = inject(BudgetService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = { DollarSign, TrendingUp, Target, Percent, Filter, Calendar };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  budgets = signal<Budget[]>([]);
  allBudgets = signal<Budget[]>([]);
  companies = signal<Company[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.ADMIN);
  
  filterForm!: FormGroup;

  // Stats computed
  totalBudget = computed(() => {
    return this.budgets().reduce((sum, b) => sum + (b.budget_amount || 0), 0);
  });

  totalExecuted = computed(() => {
    return this.budgets().reduce((sum, b) => sum + (b.executed_amount || 0), 0);
  });

  totalDifference = computed(() => {
    return this.budgets().reduce((sum, b) => sum + (b.difference_amount || 0), 0);
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
    //   this.loadBudgets();
    // } else {
    //   this.route.parent?.paramMap.subscribe((params) => {
    //     const id = params.get('id');
    //     if (id) {
    //       this.companyId.set(parseInt(id, 10));
    //       this.loadBudgets();
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
    let filteredBudgets = [...this.allBudgets()];

    if (filters.company_id) {
      filteredBudgets = filteredBudgets.filter(b => b.company_id === filters.company_id);
    }

    if (filters.date_from) {
      const fromDate = new Date(filters.date_from);
      filteredBudgets = filteredBudgets.filter(b => {
        const budgetDate = new Date(b.budget_date);
        return budgetDate >= fromDate;
      });
    }

    if (filters.date_to) {
      const toDate = new Date(filters.date_to);
      toDate.setHours(23, 59, 59, 999);
      filteredBudgets = filteredBudgets.filter(b => {
        const budgetDate = new Date(b.budget_date);
        return budgetDate <= toDate;
      });
    }

    this.budgets.set(filteredBudgets);
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
    // Mock budgets data with multiple companies
    const mockBudgets: Budget[] = [
      { id: 1, budget_category_id: 1, company_id: 1, budget_date: '2024-01-15', budget_amount: 50000, executed_amount: 45000, difference_amount: 5000, percentage: 90, user_id: 1 },
      { id: 2, budget_category_id: 2, company_id: 1, budget_date: '2024-02-15', budget_amount: 55000, executed_amount: 52000, difference_amount: 3000, percentage: 94.5, user_id: 1 },
      { id: 3, budget_category_id: 1, company_id: 1, budget_date: '2024-03-15', budget_amount: 60000, executed_amount: 58000, difference_amount: 2000, percentage: 96.7, user_id: 1 },
      { id: 4, budget_category_id: 3, company_id: 1, budget_date: '2024-04-15', budget_amount: 65000, executed_amount: 62000, difference_amount: 3000, percentage: 95.4, user_id: 1 },
      { id: 5, budget_category_id: 2, company_id: 1, budget_date: '2024-05-15', budget_amount: 70000, executed_amount: 68000, difference_amount: 2000, percentage: 97.1, user_id: 1 },
      { id: 6, budget_category_id: 1, company_id: 1, budget_date: '2024-06-15', budget_amount: 75000, executed_amount: 72000, difference_amount: 3000, percentage: 96, user_id: 1 },
      { id: 7, budget_category_id: 3, company_id: 1, budget_date: '2024-07-15', budget_amount: 80000, executed_amount: 78000, difference_amount: 2000, percentage: 97.5, user_id: 1 },
      { id: 8, budget_category_id: 2, company_id: 1, budget_date: '2024-08-15', budget_amount: 85000, executed_amount: 83000, difference_amount: 2000, percentage: 97.6, user_id: 1 },
      { id: 9, budget_category_id: 1, company_id: 1, budget_date: '2024-09-15', budget_amount: 90000, executed_amount: 87000, difference_amount: 3000, percentage: 96.7, user_id: 1 },
      { id: 10, budget_category_id: 3, company_id: 1, budget_date: '2024-10-15', budget_amount: 95000, executed_amount: 92000, difference_amount: 3000, percentage: 96.8, user_id: 1 },
      { id: 11, budget_category_id: 2, company_id: 1, budget_date: '2024-11-15', budget_amount: 100000, executed_amount: 97000, difference_amount: 3000, percentage: 97, user_id: 1 },
      { id: 12, budget_category_id: 1, company_id: 1, budget_date: '2024-12-15', budget_amount: 105000, executed_amount: 102000, difference_amount: 3000, percentage: 97.1, user_id: 1 },
      { id: 13, budget_category_id: 1, company_id: 2, budget_date: '2024-01-20', budget_amount: 40000, executed_amount: 38000, difference_amount: 2000, percentage: 95, user_id: 1 },
      { id: 14, budget_category_id: 2, company_id: 2, budget_date: '2024-02-20', budget_amount: 45000, executed_amount: 43000, difference_amount: 2000, percentage: 95.6, user_id: 1 },
      { id: 15, budget_category_id: 3, company_id: 3, budget_date: '2024-01-10', budget_amount: 60000, executed_amount: 57000, difference_amount: 3000, percentage: 95, user_id: 1 },
    ];
    
    this.allBudgets.set(mockBudgets);
    this.applyFilters();
  }

  loadBudgets(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.budgetService.getAll(1, 100, companyId).subscribe({
      next: (response) => {
        this.budgets.set(response.data);
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
        this.isLoading.set(false);
      },
    });
  }

  updateCharts(): void {
    const budgets = this.budgets();
    
    // Group by month
    const monthlyData = this.groupByMonth(budgets);
    const months = Object.keys(monthlyData).sort();
    
    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }));
    }
    
    const budgetData = months.map(m => monthlyData[m]?.budget || 0);
    const executedData = months.map(m => monthlyData[m]?.executed || 0);
    const differenceData = months.map(m => monthlyData[m]?.difference || 0);
    const percentageData = months.map(m => monthlyData[m]?.percentage || 0);

    // Budget vs Executed Chart (Bar)
    this.budgetVsExecutedChart = {
      series: [
        { name: 'Presupuesto', data: budgetData },
        { name: 'Ejecutado', data: executedData }
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

    // Difference Chart (Line)
    this.differenceChart = {
      series: [{
        name: 'Diferencia',
        data: differenceData
      }],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#ef4444'],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };

    // Percentage Chart (Bar)
    this.percentageChart = {
      series: [{
        name: 'Porcentaje',
        data: percentageData
      }],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#8b5cf6'],
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
          formatter: (val: number) => `${val.toFixed(1)}%`
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };

    // Monthly Comparison (Area)
    this.monthlyComparisonChart = {
      series: [
        { name: 'Presupuesto', data: budgetData },
        { name: 'Ejecutado', data: executedData }
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        stacked: false
      },
      colors: ['#3b82f6', '#10b981'],
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
  }

  private groupByMonth(budgets: Budget[]): { [key: string]: { budget: number; executed: number; difference: number; percentage: number } } {
    const grouped: { [key: string]: { budget: number; executed: number; difference: number; percentage: number } } = {};
    
    budgets.forEach(budget => {
      const date = new Date(budget.budget_date);
      const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = { budget: 0, executed: 0, difference: 0, percentage: 0 };
      }
      
      grouped[monthKey].budget += budget.budget_amount || 0;
      grouped[monthKey].executed += budget.executed_amount || 0;
      grouped[monthKey].difference += budget.difference_amount || 0;
      grouped[monthKey].percentage = budget.percentage || 0;
    });
    
    return grouped;
  }
}

