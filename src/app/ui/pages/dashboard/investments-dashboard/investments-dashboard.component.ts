import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { LucideAngularModule, TrendingDown, DollarSign, Package, BarChart3, Filter, Calendar } from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import { InvestmentService, Investment } from '../../../../infrastructure/services/investment.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-investments-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, NgApexchartsModule, NgSelectModule],
  templateUrl: './investments-dashboard.component.html',
  styleUrl: './investments-dashboard.component.scss'
})
export class InvestmentsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private investmentService = inject(InvestmentService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = { TrendingDown, DollarSign, Package, BarChart3, Filter, Calendar };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  investments = signal<Investment[]>([]);
  allInvestments = signal<Investment[]>([]);
  companies = signal<Company[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.ADMIN);
  
  filterForm!: FormGroup;

  // Stats computed
  totalInvestment = computed(() => {
    return this.investments().reduce((sum, i) => sum + (i.total_cost || 0), 0);
  });

  totalQuantity = computed(() => {
    return this.investments().reduce((sum, i) => sum + (i.quantity || 0), 0);
  });

  averageUnitCost = computed(() => {
    const investments = this.investments();
    if (investments.length === 0) return 0;
    const total = investments.reduce((sum, i) => sum + (i.unit_cost || 0), 0);
    return total / investments.length;
  });

  // Charts
  investmentTrendChart: any = {};
  totalCostChart: any = {};
  quantityChart: any = {};
  monthlyInvestmentChart: any = {};

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
    //   this.loadInvestments();
    // } else {
    //   this.route.parent?.paramMap.subscribe((params) => {
    //     const id = params.get('id');
    //     if (id) {
    //       this.companyId.set(parseInt(id, 10));
    //       this.loadInvestments();
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
    let filteredInvestments = [...this.allInvestments()];

    if (filters.company_id) {
      filteredInvestments = filteredInvestments.filter(i => i.company_id === filters.company_id);
    }

    if (filters.date_from) {
      const fromDate = new Date(filters.date_from);
      filteredInvestments = filteredInvestments.filter(i => {
        const investmentDate = new Date(i.investment_date);
        return investmentDate >= fromDate;
      });
    }

    if (filters.date_to) {
      const toDate = new Date(filters.date_to);
      toDate.setHours(23, 59, 59, 999);
      filteredInvestments = filteredInvestments.filter(i => {
        const investmentDate = new Date(i.investment_date);
        return investmentDate <= toDate;
      });
    }

    this.investments.set(filteredInvestments);
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
    // Mock investments data with multiple companies
    const mockInvestments: Investment[] = [
      { id: 1, investment_category_id: 1, company_id: 1, investment_date: '2024-01-15', unit_cost: 1000, quantity: 50, total_cost: 50000, user_id: 1 },
      { id: 2, investment_category_id: 2, company_id: 1, investment_date: '2024-02-15', unit_cost: 1200, quantity: 45, total_cost: 54000, user_id: 1 },
      { id: 3, investment_category_id: 1, company_id: 1, investment_date: '2024-03-15', unit_cost: 1100, quantity: 55, total_cost: 60500, user_id: 1 },
      { id: 4, investment_category_id: 3, company_id: 1, investment_date: '2024-04-15', unit_cost: 1300, quantity: 40, total_cost: 52000, user_id: 1 },
      { id: 5, investment_category_id: 2, company_id: 1, investment_date: '2024-05-15', unit_cost: 1400, quantity: 50, total_cost: 70000, user_id: 1 },
      { id: 6, investment_category_id: 1, company_id: 1, investment_date: '2024-06-15', unit_cost: 1500, quantity: 48, total_cost: 72000, user_id: 1 },
      { id: 7, investment_category_id: 3, company_id: 1, investment_date: '2024-07-15', unit_cost: 1600, quantity: 52, total_cost: 83200, user_id: 1 },
      { id: 8, investment_category_id: 2, company_id: 1, investment_date: '2024-08-15', unit_cost: 1700, quantity: 50, total_cost: 85000, user_id: 1 },
      { id: 9, investment_category_id: 1, company_id: 1, investment_date: '2024-09-15', unit_cost: 1800, quantity: 55, total_cost: 99000, user_id: 1 },
      { id: 10, investment_category_id: 3, company_id: 1, investment_date: '2024-10-15', unit_cost: 1900, quantity: 50, total_cost: 95000, user_id: 1 },
      { id: 11, investment_category_id: 2, company_id: 1, investment_date: '2024-11-15', unit_cost: 2000, quantity: 48, total_cost: 96000, user_id: 1 },
      { id: 12, investment_category_id: 1, company_id: 1, investment_date: '2024-12-15', unit_cost: 2100, quantity: 52, total_cost: 109200, user_id: 1 },
      { id: 13, investment_category_id: 1, company_id: 2, investment_date: '2024-01-20', unit_cost: 800, quantity: 60, total_cost: 48000, user_id: 1 },
      { id: 14, investment_category_id: 2, company_id: 2, investment_date: '2024-02-20', unit_cost: 900, quantity: 55, total_cost: 49500, user_id: 1 },
      { id: 15, investment_category_id: 3, company_id: 3, investment_date: '2024-01-10', unit_cost: 1500, quantity: 40, total_cost: 60000, user_id: 1 },
    ];
    
    this.allInvestments.set(mockInvestments);
    this.applyFilters();
  }

  loadInvestments(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.investmentService.getAll(1, 100, companyId).subscribe({
      next: (response) => {
        this.investments.set(response.data);
        this.updateCharts();
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar las inversiones';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  updateCharts(): void {
    const investments = this.investments();
    
    // Group by month
    const monthlyData = this.groupByMonth(investments);
    const months = Object.keys(monthlyData).sort();
    
    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }));
    }
    
    const totalCostData = months.map(m => monthlyData[m]?.totalCost || 0);
    const quantityData = months.map(m => monthlyData[m]?.quantity || 0);
    const unitCostData = months.map(m => monthlyData[m]?.unitCost || 0);

    // Investment Trend Chart (Line)
    this.investmentTrendChart = {
      series: [{
        name: 'Costo Total',
        data: totalCostData
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

    // Total Cost Chart (Bar)
    this.totalCostChart = {
      series: [{
        name: 'Costo Total',
        data: totalCostData
      }],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false }
      },
      colors: ['#10b981'],
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

    // Quantity Chart (Bar)
    this.quantityChart = {
      series: [{
        name: 'Cantidad',
        data: quantityData
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
          formatter: (val: number) => val.toFixed(0)
        }
      },
      grid: { borderColor: '#e2e8f0' }
    };

    // Monthly Investment (Area)
    this.monthlyInvestmentChart = {
      series: [
        { name: 'Costo Total', data: totalCostData },
        { name: 'Cantidad', data: quantityData.map(q => q * 1000) } // Scale for visibility
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        stacked: false
      },
      colors: ['#3b82f6', '#8b5cf6'],
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

  private groupByMonth(investments: Investment[]): { [key: string]: { totalCost: number; quantity: number; unitCost: number } } {
    const grouped: { [key: string]: { totalCost: number; quantity: number; unitCost: number } } = {};
    
    investments.forEach(investment => {
      const date = new Date(investment.investment_date);
      const monthKey = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = { totalCost: 0, quantity: 0, unitCost: 0 };
      }
      
      grouped[monthKey].totalCost += investment.total_cost || 0;
      grouped[monthKey].quantity += investment.quantity || 0;
      grouped[monthKey].unitCost += investment.unit_cost || 0;
    });
    
    return grouped;
  }
}

