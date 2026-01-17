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
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
  Filter,
  Calendar,
} from 'lucide-angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { NgSelectModule } from '@ng-select/ng-select';
import {
  InvestmentService,
  Investment,
} from '../../../../infrastructure/services/investment.service';
import {
  InvestmentBudgetYearService,
  InvestmentBudgetYear,
} from '../../../../infrastructure/services/investment-budget-year.service';
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';
import * as CompanyActions from '../../../../infrastructure/store/company';
@Component({
  selector: 'app-investment-budgets-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgApexchartsModule,
    NgSelectModule,
  ],
  templateUrl: './investment-budgets-dashboard.component.html',
  styleUrl: './investment-budgets-dashboard.component.scss',
})
export class InvestmentBudgetsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private investmentService = inject(InvestmentService);
  private budgetYearService = inject(InvestmentBudgetYearService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private store = inject(Store);

  readonly icons = {
    TrendingDown,
    TrendingUp,
    DollarSign,
    Package,
    BarChart3,
    Filter,
    Calendar,
  };

  companyIdInput = input<number | null>(null);
  companyId = signal<number | null>(null);
  isLoading = signal(false);
  isLoadingCompanies = signal(false);
  investments = signal<Investment[]>([]);
  companies = signal<Company[]>([]);
  budgetYears = signal<InvestmentBudgetYear[]>([]);
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.CLIENT);

  filterForm!: FormGroup;

  // Investments for selected year
  investmentsForSelectedYear = computed(() => {
    const selectedYear = this.selectedYear();
    if (!selectedYear) return [];
    const budgetYear = this.budgetYears().find(by => by.year === selectedYear);
    if (!budgetYear) return [];
    return this.investmentsByYear().get(budgetYear.id) || [];
  });

  // Stats computed
  totalInvestment = computed(() => {
    return this.investmentsForSelectedYear().reduce((sum, i) => sum + (i.amount || 0), 0);
  });

  totalCount = computed(() => {
    return this.investmentsForSelectedYear().length;
  });

  averageAmount = computed(() => {
    const investments = this.investmentsForSelectedYear();
    if (investments.length === 0) return 0;
    return this.totalInvestment() / investments.length;
  });

  topInvestments = computed(() => {
    const investments = this.investmentsForSelectedYear();
    const sorted = [...investments].sort((a, b) => (b.amount || 0) - (a.amount || 0)).slice(0, 10);
    const maxAmount = sorted[0]?.amount || 0;
    return sorted.map((investment, index) => {
      const amount = investment.amount || 0;
      return {
        id: investment.id || index + 1,
        rank: index + 1,
        name: `Inversión #${investment.id || index + 1}`,
        amount,
        tone: this.getAmountTone(amount, maxAmount),
      };
    });
  });

  // Available years for selection
  availableYears = computed(() => {
    const years = this.budgetYears().map(by => by.year).sort((a, b) => b - a);
    return years.length > 0 ? years : [new Date().getFullYear()];
  });

  // Budget status for selected year
  budgetStatus = computed(() => {
    const selectedYear = this.selectedYear();
    if (!selectedYear) return null;
    
    const budgetYears = this.budgetYears();
    const budgetYear = budgetYears.find(by => by.year === selectedYear);
    const budgetAmount = budgetYear?.amount || 0;
    
    // Use getTotalInvestmentsForYear to get the correct total for the selected year
    const totalInvestments = budgetYear ? this.getTotalInvestmentsForYear(budgetYear.id) : 0;
    const percentage = budgetAmount > 0 ? (totalInvestments / budgetAmount) * 100 : 0;
    
    let status: 'green' | 'orange' | 'red' = 'green';
    if (percentage >= 100) {
      status = 'red';
    } else if (percentage >= 85) {
      status = 'orange';
    }
    
    return {
      budgetAmount,
      totalInvestments,
      percentage,
      status,
      difference: budgetAmount - totalInvestments, // Presupuesto - Inversiones (positivo = sobrante, negativo = excedido)
    };
  });

  // Selected year for filtering
  selectedYear = signal<number | null>(null);
  
  // Comparison years
  comparisonYear1 = signal<number | null>(null);
  comparisonYear2 = signal<number | null>(null);

  // Charts - Initialize with default empty structure
  budgetStatusChart: any = {
    series: [{ name: 'Presupuesto', data: [0] }, { name: 'Inversiones', data: [0] }],
    chart: { type: 'bar', height: 300, toolbar: { show: false } },
    colors: ['#3b82f6', '#10b981'],
    plotOptions: { bar: { borderRadius: 8, horizontal: false, columnWidth: '60%' } },
    dataLabels: { enabled: true, formatter: (val: number) => `$${(val / 1000).toFixed(0)}k` },
    xaxis: { categories: ['Sin datos'] },
    yaxis: { labels: { formatter: (val: number) => `$${(val / 1000).toFixed(0)}k` } },
    grid: { borderColor: '#e2e8f0' },
    legend: { position: 'top' },
  };
  
  twoYearComparisonChart: any = {
    series: [{ name: 'Año 1', data: [0] }, { name: 'Año 2', data: [0] }],
    chart: { type: 'bar', height: 300, toolbar: { show: false } },
    colors: ['#8b5cf6', '#ec4899'],
    plotOptions: { bar: { borderRadius: 8, horizontal: false, columnWidth: '60%' } },
    dataLabels: { enabled: true, formatter: (val: number) => `$${(val / 1000).toFixed(0)}k` },
    xaxis: { categories: ['Inversiones'] },
    yaxis: { labels: { formatter: (val: number) => `$${(val / 1000).toFixed(0)}k` } },
    grid: { borderColor: '#e2e8f0' },
    legend: { position: 'top' },
  };

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

  // Comparison year filters (separate from main form)
  comparisonYear1Form = this.fb.control<number | null>(null);
  comparisonYear2Form = this.fb.control<number | null>(null);

  // Helper method to get the closest available year
  getClosestYear(targetYear: number, availableYears: number[]): number {
    if (availableYears.length === 0) return targetYear;
    if (availableYears.includes(targetYear)) return targetYear;
    
    // Find the closest year (prefer future years, then past years)
    const sortedYears = [...availableYears].sort((a, b) => b - a); // Descending order
    const futureYears = sortedYears.filter(y => y >= targetYear);
    const pastYears = sortedYears.filter(y => y < targetYear);
    
    if (futureYears.length > 0) {
      return futureYears[futureYears.length - 1]; // Closest future year
    }
    if (pastYears.length > 0) {
      return pastYears[0]; // Closest past year
    }
    
    return sortedYears[0]; // Fallback to most recent year
  }

  initFilterForm(): void {
    const today = new Date();
    const currentYear = today.getFullYear();
    const user = this.currentUser();

    // Determine default company
    let defaultCompanyId: number | null = null;
    if (
      user &&
      user.type === UserType.COMPANY &&
      user.companies &&
      user.companies.length > 0
    ) {
      // If client, use company from role (first company)
      defaultCompanyId = user.companies[0];
    }

    this.filterForm = this.fb.group({
      company_id: [defaultCompanyId, Validators.required],
      year: [currentYear, Validators.required],
    });

    // Initialize comparison year forms - will be set when budget years are loaded
    // They will be set to the closest available year and the previous year
    this.comparisonYear1Form.setValue(null);
    this.comparisonYear2Form.setValue(null);
    
    // Set initial comparison year signals
    this.comparisonYear1.set(null);
    this.comparisonYear2.set(null);

    this.filterForm.valueChanges.subscribe(() => {
      if (this.filterForm.valid) {
        const formValue = this.filterForm.value;
        this.selectedYear.set(formValue.year);
        this.loadInvestments();
      }
    });

    // Set initial values - main year is current year
    this.selectedYear.set(currentYear);

    // Watch comparison year forms
    this.comparisonYear1Form.valueChanges.subscribe((year) => {
      this.comparisonYear1.set(year);
      this.updateCharts();
    });

    this.comparisonYear2Form.valueChanges.subscribe((year) => {
      this.comparisonYear2.set(year);
      this.updateCharts();
    });

    // Load initial data if form is valid
    if (this.filterForm.valid) {
      this.loadInvestments();
    }
  }

  loadCompanies(): void {
    this.store.dispatch(CompanyActions.loadCompanies());
    // This method is only called for ADMIN users
    // Get companies from store
    this.store.select(selectAllCompanies).subscribe((companies) => {
      this.companies.set(companies);
      if (companies.length > 0 && !this.filterForm.get('company_id')?.value) {
        const selectedCompanyId = companies[0].id;
        this.filterForm.patchValue({ company_id: selectedCompanyId });
        
        // Load budget years first to get available years, then update default year
        this.loadBudgetYears(selectedCompanyId);
        
        // Execute search when company is set for the first time
        if (this.filterForm.valid) {
          this.applyFilters();
        }
      }
    });
  }

  applyFilters(): void {
    // Filters are now applied server-side in loadInvestments()
    this.loadInvestments();
  }

  resetFilters(): void {
    const today = new Date();
    const currentYear = today.getFullYear();
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
        year: currentYear,
        comparison_year_1: currentYear - 1,
        comparison_year_2: currentYear,
      },
      { emitEvent: false }
    );

    this.selectedYear.set(currentYear);
    this.comparisonYear1.set(currentYear - 1);
    this.comparisonYear2.set(currentYear);

    // Load data after resetting filters
    if (this.filterForm.valid) {
      this.loadInvestments();
    }
  }

  allInvestments = signal<Investment[]>([]);
  investmentsByYear = signal<Map<number, Investment[]>>(new Map());

  loadInvestments(): void {
    if (!this.filterForm.valid) {
      return;
    }

    const filters = this.filterForm.getRawValue();
    const companyId = filters.company_id;
    const selectedYear = filters.year;

    if (!companyId || !selectedYear) {
      this.investments.set([]);
      this.allInvestments.set([]);
      this.investmentsByYear.set(new Map());
      this.updateCharts();
      return;
    }

    this.isLoading.set(true);

    // Load all budget years first
    this.loadBudgetYears(companyId);

    // Load ALL investments for the company (no year filter) to enable comparisons
    // Using same approach as investment-budgets.component.ts
    this.investmentService
      .getAll(1, 1000, companyId)
      .subscribe({
        next: (response) => {
          // Sort investments by id (oldest first)
          const sortedData = (response.data || []).sort((a, b) => {
            return (a.id || 0) - (b.id || 0);
          });
          this.allInvestments.set(sortedData);
          
          // Group investments by year (same logic as investment-budgets.component.ts)
          this.groupInvestmentsByYear(sortedData);
          
          // Filter investments for the selected year
          // Wait for budget years to be loaded first
          setTimeout(() => {
            const selectedYearBudget = this.budgetYears().find(by => by.year === selectedYear);
            const selectedYearBudgetId = selectedYearBudget?.id;
            const filteredInvestments = selectedYearBudgetId 
              ? sortedData.filter(inv => inv.investment_budget_annual_id === selectedYearBudgetId)
              : [];
            this.investments.set(filteredInvestments);
            
            // Update charts after filtering
            this.updateCharts();
            this.isLoading.set(false);
          }, 500);
        },
        error: (error: unknown) => {
          const errorMessage =
            (error as { error?: { message?: string }; message?: string })?.error
              ?.message ||
            (error as { message?: string })?.message ||
            'Error al cargar las inversiones';
          this.toastr.error(errorMessage, 'Error');
          this.investments.set([]);
          this.allInvestments.set([]);
          this.investmentsByYear.set(new Map());
          this.updateCharts();
          this.isLoading.set(false);
        },
      });
  }

  // Group investments by year (same logic as investment-budgets.component.ts)
  groupInvestmentsByYear(investments: Investment[]): void {
    const investmentsByYear = new Map<number, Investment[]>();

    investments.forEach((investment) => {
      if (investment.investment_budget_annual_id) {
        if (!investmentsByYear.has(investment.investment_budget_annual_id)) {
          investmentsByYear.set(investment.investment_budget_annual_id, []);
        }
        investmentsByYear.get(investment.investment_budget_annual_id)!.push(investment);
      }
    });

    this.investmentsByYear.set(investmentsByYear);
  }

  // Get total investments for a specific year (using budget year ID)
  getTotalInvestmentsForYear(budgetYearId: number | undefined): number {
    if (!budgetYearId) return 0;
    const investments = this.investmentsByYear().get(budgetYearId) || [];
    return investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  }

  getAmountTone(amount: number, maxAmount: number): 'high' | 'medium' | 'low' {
    if (!maxAmount || maxAmount <= 0) return 'low';
    const ratio = amount / maxAmount;
    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.35) return 'medium';
    return 'low';
  }


  loadBudgetYears(companyId: number, year?: number): void {
    this.budgetYearService.getAll(companyId, year).subscribe({
      next: (years) => {
        // If loading all years, update the signal
        if (!year) {
          this.budgetYears.set(years || []);
          
          // Update default year selections if current year is not available
          const availableYears = (years || []).map(by => by.year);
          const currentYear = new Date().getFullYear();
          
          // Update main year filter if current year is not available
          const currentYearValue = this.filterForm.get('year')?.value;
          if (currentYearValue && !availableYears.includes(currentYearValue)) {
            const closestYear = this.getClosestYear(currentYearValue, availableYears);
            this.filterForm.patchValue({ year: closestYear }, { emitEvent: false });
            this.selectedYear.set(closestYear);
          }
          
          // Initialize comparison years if not set: closest year and previous year
          if (availableYears.length > 0) {
            const currentYear = new Date().getFullYear();
            const closestYear = this.getClosestYear(currentYear, availableYears);
            const sortedYears = [...availableYears].sort((a, b) => b - a); // Descending
            const closestIndex = sortedYears.indexOf(closestYear);
            const previousYear = closestIndex < sortedYears.length - 1 ? sortedYears[closestIndex + 1] : null;
            
            // Set comparison year 2 to closest year (most recent) if not set
            if (!this.comparisonYear2Form.value) {
              this.comparisonYear2Form.setValue(closestYear, { emitEvent: false });
              this.comparisonYear2.set(closestYear);
            } else {
              // If already set, check if it's available, otherwise update
              const compYear2 = this.comparisonYear2Form.value;
              if (!availableYears.includes(compYear2)) {
                const closestYear2 = this.getClosestYear(compYear2, availableYears);
                this.comparisonYear2Form.setValue(closestYear2, { emitEvent: false });
                this.comparisonYear2.set(closestYear2);
              }
            }
            
            // Set comparison year 1 to previous year (year before closest) if not set
            if (!this.comparisonYear1Form.value && previousYear) {
              this.comparisonYear1Form.setValue(previousYear, { emitEvent: false });
              this.comparisonYear1.set(previousYear);
            } else if (this.comparisonYear1Form.value) {
              // If already set, check if it's available, otherwise update
              const compYear1 = this.comparisonYear1Form.value;
              if (!availableYears.includes(compYear1)) {
                const closestYear1 = this.getClosestYear(compYear1, availableYears);
                this.comparisonYear1Form.setValue(closestYear1, { emitEvent: false });
                this.comparisonYear1.set(closestYear1);
              }
            }
          }
          
          // Update charts when budget years are loaded
          // Also refresh investments filtering if needed
          setTimeout(() => {
            const selectedYear = this.selectedYear();
            if (selectedYear && this.allInvestments().length > 0) {
              const selectedYearBudget = this.budgetYears().find(by => by.year === selectedYear);
              const selectedYearBudgetId = selectedYearBudget?.id;
              if (selectedYearBudgetId) {
                const filteredInvestments = this.allInvestments().filter(inv => 
                  inv.investment_budget_annual_id === selectedYearBudgetId
                );
                this.investments.set(filteredInvestments);
              }
            }
            this.updateCharts();
          }, 100);
        }
      },
      error: () => {
        if (!year) {
          this.budgetYears.set([]);
        }
      },
    });
  }


  getYearFromAnnualId(annualId: number | null | undefined): number | null {
    if (!annualId) return null;
    const year = this.budgetYears().find((y) => y.id === annualId);
    return year?.year || null;
  }

  updateCharts(): void {
    const investments = this.investmentsForSelectedYear();
    const allInvestments = this.allInvestments();
    const budgetYears = this.budgetYears();
    const selectedYear = this.selectedYear();
    const comparisonYear1 = this.comparisonYear1();
    const comparisonYear2 = this.comparisonYear2();

    // 1. Budget Status Chart - Compare selected year budget vs total investments
    if (selectedYear) {
      const budgetYear = budgetYears.find(by => by.year === selectedYear);
      const budgetAmount = budgetYear?.amount || 0;
      // Use getTotalInvestmentsForYear to get the correct total for the selected year
      const totalInvestments = budgetYear ? this.getTotalInvestmentsForYear(budgetYear.id) : 0;
      const percentage = budgetAmount > 0 ? (totalInvestments / budgetAmount) * 100 : 0;
      
      // Determine color: green (< 85%), orange (85-100%), red (> 100%)
      let statusColor = '#10b981'; // green
      if (percentage >= 100) {
        statusColor = '#ef4444'; // red
      } else if (percentage >= 85) {
        statusColor = '#f59e0b'; // orange
      }

      this.budgetStatusChart = {
        series: [
          {
            name: 'Presupuesto',
            data: [budgetAmount],
          },
          {
            name: 'Inversiones',
            data: [totalInvestments],
          },
        ],
        chart: {
          type: 'bar',
          height: 300,
          toolbar: { show: false },
          zoom: { enabled: false },
          pan: { enabled: false },
        },
        colors: ['#3b82f6', statusColor],
        plotOptions: {
          bar: {
            borderRadius: 8,
            horizontal: false,
            columnWidth: '60%',
          },
        },
        dataLabels: {
          enabled: true,
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
        xaxis: {
          categories: [`Año ${selectedYear}`],
        },
        yaxis: {
          labels: {
            formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
          },
        },
        grid: { borderColor: '#e2e8f0' },
        legend: { position: 'top' },
      };
    } else {
      // Default chart when no year selected
      this.budgetStatusChart = {
        ...this.budgetStatusChart,
        series: [
          { name: 'Presupuesto', data: [0] },
          { name: 'Inversiones', data: [0] },
        ],
        xaxis: { categories: ['Seleccione un año'] },
      };
    }

    // 2. Two Year Comparison Chart - Compare two selected years
    // This chart is independent of the main filter and uses its own year filters
    // If years are not set, use the closest available year and the previous year
    let compYear1: number | null = comparisonYear1;
    let compYear2: number | null = comparisonYear2;
    
    if (!compYear1 || !compYear2) {
      const availableYears = budgetYears.map(by => by.year).sort((a, b) => b - a);
      if (availableYears.length > 0) {
        const currentYear = new Date().getFullYear();
        const closestYear = this.getClosestYear(currentYear, availableYears);
        const closestIndex = availableYears.indexOf(closestYear);
        const previousYear = closestIndex < availableYears.length - 1 ? availableYears[closestIndex + 1] : null;
        
        compYear2 = compYear2 || closestYear;
        compYear1 = compYear1 || previousYear || (compYear2 ? compYear2 - 1 : null);
      }
    }
    
    if (compYear1 && compYear2) {
      const year1Budget = budgetYears.find(by => by.year === compYear1);
      const year2Budget = budgetYears.find(by => by.year === compYear2);
      
      // Use the same calculation method as investment-budgets.component.ts
      const year1Total = this.getTotalInvestmentsForYear(year1Budget?.id);
      const year2Total = this.getTotalInvestmentsForYear(year2Budget?.id);

      this.twoYearComparisonChart = {
        series: [
          {
            name: `${compYear1}`,
            data: [year1Total],
          },
          {
            name: `${compYear2}`,
            data: [year2Total],
          },
        ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#8b5cf6', '#ec4899'],
      plotOptions: {
        bar: {
          borderRadius: 8,
          horizontal: false,
          columnWidth: '60%',
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
      },
      xaxis: {
        categories: ['Inversiones'],
      },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
      legend: { position: 'top' },
      };
    } else {
      // Default chart when years not available
      this.twoYearComparisonChart = {
        ...this.twoYearComparisonChart,
        series: [
          { name: 'Año 1', data: [0] },
          { name: 'Año 2', data: [0] },
        ],
        xaxis: { categories: ['Sin datos disponibles'] },
      };
    }
  }

  private groupByYear(investments: Investment[]): {
    [key: string]: number;
  } {
    const grouped: {
      [key: string]: number;
    } = {};

    investments.forEach((investment) => {
      const year = this.getYearFromAnnualId(investment.investment_budget_annual_id);
      const yearKey = year ? `Año ${year}` : 'Sin año';

      if (!grouped[yearKey]) {
        grouped[yearKey] = 0;
      }

      grouped[yearKey] += investment.amount || 0;
    });

    return grouped;
  }

  private groupBudgetYearsByYear(budgetYears: InvestmentBudgetYear[]): {
    [key: string]: number;
  } {
    const grouped: {
      [key: string]: number;
    } = {};

    budgetYears.forEach((budgetYear) => {
      const yearKey = budgetYear.year.toString();

      if (!grouped[yearKey]) {
        grouped[yearKey] = 0;
      }

      grouped[yearKey] += budgetYear.amount || 0;
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
