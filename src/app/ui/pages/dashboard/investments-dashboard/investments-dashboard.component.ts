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
          this.investments.set(response.data || []);
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

    // Group by month
    const monthlyData = this.groupByMonth(investments);
    const months = Object.keys(monthlyData).sort();

    // Ensure we have at least one month for empty data
    if (months.length === 0) {
      const today = new Date();
      months.push(
        today.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      );
    }

    const totalCostData = months.map((m) => monthlyData[m]?.totalCost || 0);
    const quantityData = months.map((m) => monthlyData[m]?.quantity || 0);
    const unitCostData = months.map((m) => monthlyData[m]?.unitCost || 0);

    // Investment Trend Chart (Line)
    this.investmentTrendChart = {
      series: [
        {
          name: 'Costo Total',
          data: totalCostData,
        },
      ],
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6'],
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: months },
      yaxis: {
        labels: {
          formatter: (val: number) => `$${(val / 1000).toFixed(0)}k`,
        },
      },
      grid: { borderColor: '#e2e8f0' },
    };

    // Total Cost Chart (Bar)
    this.totalCostChart = {
      series: [
        {
          name: 'Costo Total',
          data: totalCostData,
        },
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#10b981'],
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

    // Quantity Chart (Bar)
    this.quantityChart = {
      series: [
        {
          name: 'Cantidad',
          data: quantityData,
        },
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#8b5cf6'],
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

    // Monthly Investment (Area)
    this.monthlyInvestmentChart = {
      series: [
        { name: 'Costo Total', data: totalCostData },
        { name: 'Cantidad', data: quantityData.map((q) => q * 1000) }, // Scale for visibility
      ],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: false },
        stacked: false,
        zoom: { enabled: false },
        pan: { enabled: false },
      },
      colors: ['#3b82f6', '#8b5cf6'],
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
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' },
    };
  }

  private groupByMonth(investments: Investment[]): {
    [key: string]: { totalCost: number; quantity: number; unitCost: number };
  } {
    const grouped: {
      [key: string]: { totalCost: number; quantity: number; unitCost: number };
    } = {};

    investments.forEach((investment) => {
      const date = new Date(investment.investment_date);
      const monthKey = date.toLocaleDateString('es-ES', {
        month: 'short',
        year: 'numeric',
      });

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
