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
import { Company, UserType } from '../../../../entities/interfaces';
import { selectUser } from '../../../../infrastructure/store/auth';
import { selectAllCompanies } from '../../../../infrastructure/store/company';
import { ToastrService } from 'ngx-toastr';
import * as CompanyActions from '../../../../infrastructure/store/company';
@Component({
  selector: 'app-investments-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgApexchartsModule,
    NgSelectModule,
  ],
  templateUrl: './investments-dashboard.component.html',
  styleUrl: './investments-dashboard.component.scss',
})
export class InvestmentsDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private investmentService = inject(InvestmentService);
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
  currentUser = signal<any>(null);
  isAdmin = computed(() => this.currentUser()?.type === UserType.CLIENT);

  filterForm!: FormGroup;

  // Stats computed
  totalInvestment = computed(() => {
    return this.investments().reduce((sum, i) => sum + (i.amount || 0), 0);
  });

  totalCount = computed(() => {
    return this.investments().length;
  });

  averageAmount = computed(() => {
    const investments = this.investments();
    if (investments.length === 0) return 0;
    return this.totalInvestment() / investments.length;
  });

  // Charts
  investmentTrendChart: any = {};
  totalAmountChart: any = {};
  categoryChart: any = {};
  monthlyInvestmentChart: any = {};

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
        this.loadInvestments();
      }
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
        this.filterForm.patchValue({ company_id: companies[0].id });
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
      this.loadInvestments();
    }
  }

  loadInvestments(): void {
    if (!this.filterForm.valid) {
      return;
    }

    const filters = this.filterForm.getRawValue(); // Use getRawValue to get disabled form values
    const companyId = filters.company_id;

    if (!companyId) {
      this.investments.set([]);
      this.updateCharts();
      return;
    }

    this.isLoading.set(true);

    // Load investments with filters applied server-side
    this.investmentService
      .getAll(
        1,
        1000,
        companyId,
        filters.date_from || undefined,
        filters.date_to || undefined
      )
      .subscribe({
        next: (response) => {
          // Sort investments by id (oldest first)
          const sortedData = (response.data || []).sort((a, b) => {
            return (a.id || 0) - (b.id || 0);
          });
          this.investments.set(sortedData);
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
          this.investments.set([]);
          this.updateCharts();
          this.isLoading.set(false);
        },
      });
  }

  updateCharts(): void {
    const investments = this.investments();

    // Group by category
    const categoryData = this.groupByCategory(investments);
    const categories = Object.keys(categoryData);

    // Ensure we have at least one category for empty data
    if (categories.length === 0) {
      categories.push('Sin categoría');
      categoryData['Sin categoría'] = 0;
    }

    const amountData = categories.map((c: string) => categoryData[c] || 0);

    // Investment by Category Chart (Bar)
    this.investmentTrendChart = {
      series: [
        {
          name: 'Monto',
          data: amountData,
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
          horizontal: false,
        },
      },
      dataLabels: { enabled: false },
      xaxis: { categories: categories },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Total Amount Chart (Line)
    this.totalAmountChart = {
      series: [
        {
          name: 'Monto Total',
          data: amountData,
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
      xaxis: { categories: categories },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Category Distribution (Pie)
    this.categoryChart = {
      series: amountData,
      chart: {
        type: 'pie',
        height: 300,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      labels: categories,
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
      legend: { position: 'bottom' },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`,
      },
    };

    // Monthly Investment Trend (Area)
    this.monthlyInvestmentChart = {
      series: [
        { name: 'Monto', data: amountData },
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        stacked: false,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.2,
        },
      },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: { categories: categories },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' },
    };
  }

  private groupByCategory(investments: Investment[]): {
    [key: string]: number;
  } {
    const grouped: {
      [key: string]: number;
    } = {};

    investments.forEach((investment) => {
      const categoryKey = `Categoría ${investment.investment_budget_category_id || 'N/A'}`;

      if (!grouped[categoryKey]) {
        grouped[categoryKey] = 0;
      }

      grouped[categoryKey] += investment.amount || 0;
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
