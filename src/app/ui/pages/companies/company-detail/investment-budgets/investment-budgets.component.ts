import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  TrendingUp,
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-angular';
import {
  InvestmentService,
  InvestmentCreate,
  Investment,
} from '../../../../../infrastructure/services/investment.service';
import {
  InvestmentBudgetYearService,
  InvestmentBudgetYear,
  InvestmentBudgetYearCreate,
  InvestmentBudgetYearUpdate,
} from '../../../../../infrastructure/services/investment-budget-year.service';
import {
  InvestmentCategoryService,
  InvestmentCategory,
} from '../../../../../infrastructure/services/investment-category.service';
import { InvestmentBudgetModalComponent } from '../../../../shared/investment-modal/investment-budget-modal.component';
import { InvestmentBudgetYearModalComponent } from '../../../../shared/investment-modal/investment-budget-year-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import * as XLSX from 'xlsx';

interface InvestmentBudgetYearWithInvestments extends InvestmentBudgetYear {
  investments: Investment[];
  isExpanded: boolean;
}

@Component({
  selector: 'app-investment-budgets',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    InvestmentBudgetModalComponent,
    InvestmentBudgetYearModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './investment-budgets.component.html',
  styleUrl: './investment-budgets.component.scss',
})
export class InvestmentBudgetsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private investmentService = inject(InvestmentService);
  private budgetYearService = inject(InvestmentBudgetYearService);
  private investmentCategoryService = inject(InvestmentCategoryService);
  private toastr = inject(ToastrService);

  readonly icons = {
    TrendingUp,
    Download,
    Upload,
    Plus,
    Pencil,
    Trash2,
    ChevronDown,
    ChevronUp,
  };

  companyId = signal<number | null>(null);
  userId = signal<number | null>(null);
  showModal = signal(false);
  showBudgetYearModal = signal(false);
  investments = signal<Investment[]>([]);
  budgetYears = signal<InvestmentBudgetYear[]>([]);
  budgetYearsWithInvestments = signal<InvestmentBudgetYearWithInvestments[]>([]);
  investmentsWithoutYear = signal<Investment[]>([]);
  categories = signal<InvestmentCategory[]>([]);
  pagination = signal<PaginatedResponse<Investment> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  importingYearId = signal<number | null>(null);
  currentPage = signal(1);
  selectedInvestment = signal<Investment | null>(null);
  selectedBudgetYear = signal<InvestmentBudgetYear | null>(null);
  showConfirmDialog = signal(false);
  deletingInvestment = signal<Investment | null>(null);
  deletingBudgetYear = signal<InvestmentBudgetYear | null>(null);
  isDeletingBudgetYear = signal(false);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadBudgetYears();
        this.loadInvestments();
        this.loadCategories();
      }
    });

    this.store.select(selectUser).subscribe((user) => {
      if (user) {
        this.userId.set(user.id);
      }
    });
  }

  loadBudgetYears(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.budgetYearService.getAll(companyId).subscribe({
      next: (budgetYears) => {
        this.budgetYears.set(budgetYears);
        this.groupInvestmentsByYear();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los presupuestos anuales';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  loadInvestments(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.investmentService.getAll(page, 1000, companyId).subscribe({
      next: (response: PaginatedResponse<Investment>) => {
        this.investments.set(response.data);
        this.pagination.set(response);
        this.groupInvestmentsByYear();
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los presupuestos de inversión';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  groupInvestmentsByYear(): void {
    const investments = this.investments();
    const budgetYears = this.budgetYears();

    // Agrupar investments por investment_budget_annual_id
    const investmentsByYear = new Map<number, Investment[]>();
    const investmentsWithoutYear: Investment[] = [];

    investments.forEach((investment) => {
      if (investment.investment_budget_annual_id) {
        if (!investmentsByYear.has(investment.investment_budget_annual_id)) {
          investmentsByYear.set(investment.investment_budget_annual_id, []);
        }
        investmentsByYear.get(investment.investment_budget_annual_id)!.push(investment);
      } else {
        investmentsWithoutYear.push(investment);
      }
    });

    // Crear array de InvestmentBudgetYearWithInvestments
    const budgetYearsWithInvestments: InvestmentBudgetYearWithInvestments[] = budgetYears.map((year) => ({
      ...year,
      investments: investmentsByYear.get(year.id) || [],
      isExpanded: false,
    }));

    this.budgetYearsWithInvestments.set(budgetYearsWithInvestments);
    this.investmentsWithoutYear.set(investmentsWithoutYear);
  }

  toggleBudgetYear(year: InvestmentBudgetYearWithInvestments): void {
    const current = this.budgetYearsWithInvestments();
    const index = current.findIndex((y) => y.id === year.id);
    if (index !== -1) {
      current[index].isExpanded = !current[index].isExpanded;
      this.budgetYearsWithInvestments.set([...current]);
    }
  }

  onPageChange(page: number): void {
    this.loadInvestments(page);
  }

  downloadTemplate(budgetYearId?: number): void {
    this.investmentService.downloadTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const yearSuffix = budgetYearId ? `-${budgetYearId}` : '';
        link.href = url;
        link.download = `plantilla-presupuestos-inversiones${yearSuffix}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.toastr.success('Plantilla descargada correctamente', 'Éxito');
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al descargar la plantilla';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  openCreateModal(budgetYearId?: number) {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedInvestment.set(null);
    if (budgetYearId) {
      // Si se pasa budgetYearId, crear un investment temporal con ese año para pre-seleccionarlo
      const tempInvestment: Investment = {
        investment_budget_annual_id: budgetYearId,
        investment_budget_category_id: 0,
        company_id: this.companyId()!,
        amount: 0,
      };
      this.selectedInvestment.set(tempInvestment);
    }
    this.showModal.set(true);
  }

  openCreateBudgetYearModal() {
    if (!this.companyId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedBudgetYear.set(null);
    this.showBudgetYearModal.set(true);
  }

  editInvestment(investment: Investment) {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedInvestment.set(investment);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedInvestment.set(null);
  }

  closeBudgetYearModal() {
    this.showBudgetYearModal.set(false);
    this.selectedBudgetYear.set(null);
  }

  onSaveInvestment(investmentData: InvestmentCreate): void {
    this.investmentService.create(investmentData).subscribe({
      next: () => {
        this.toastr.success('Presupuesto de inversión creado correctamente', 'Éxito');
        this.closeModal();
        this.loadInvestments(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el presupuesto de inversión';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateInvestment(updateData: { id: number; data: InvestmentCreate }): void {
    // Convert InvestmentCreate to InvestmentUpdate (all fields optional)
    const updatePayload = {
      investment_budget_category_id: updateData.data.investment_budget_category_id,
      investment_budget_annual_id: updateData.data.investment_budget_annual_id,
      company_id: updateData.data.company_id,
      amount: updateData.data.amount,
    };
    
    this.investmentService.update(updateData.id, updatePayload).subscribe({
      next: () => {
        this.toastr.success('Presupuesto de inversión actualizado correctamente', 'Éxito');
        this.closeModal();
        this.loadInvestments(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el presupuesto de inversión';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onSaveBudgetYear(budgetYearData: InvestmentBudgetYearCreate): void {
    this.budgetYearService.create(budgetYearData).subscribe({
      next: () => {
        this.toastr.success('Presupuesto anual de inversión creado correctamente', 'Éxito');
        this.closeBudgetYearModal();
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el presupuesto anual';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateBudgetYear(updateData: { id: number; data: InvestmentBudgetYearUpdate }): void {
    this.budgetYearService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Presupuesto anual de inversión actualizado correctamente', 'Éxito');
        this.closeBudgetYearModal();
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el presupuesto anual';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  editBudgetYear(budgetYear: InvestmentBudgetYear): void {
    this.selectedBudgetYear.set(budgetYear);
    this.showBudgetYearModal.set(true);
  }

  deleteBudgetYear(budgetYear: InvestmentBudgetYear): void {
    // Verificar si tiene investments asociados
    const budgetYearWithInvestments = this.budgetYearsWithInvestments().find(
      (by) => by.id === budgetYear.id
    );
    
    if (budgetYearWithInvestments && budgetYearWithInvestments.investments.length > 0) {
      this.toastr.warning(
        'No se puede eliminar un presupuesto anual que tiene presupuestos de inversión asociados',
        'Advertencia'
      );
      return;
    }

    this.deletingBudgetYear.set(budgetYear);
    this.isDeletingBudgetYear.set(true);
    this.showConfirmDialog.set(true);
  }

  onConfirmDeleteBudgetYear(): void {
    const budgetYear = this.deletingBudgetYear();
    if (!budgetYear || !budgetYear.id) return;

    // Verificar nuevamente antes de eliminar
    const budgetYearWithInvestments = this.budgetYearsWithInvestments().find(
      (by) => by.id === budgetYear.id
    );
    
    if (budgetYearWithInvestments && budgetYearWithInvestments.investments.length > 0) {
      this.toastr.warning(
        'No se puede eliminar un presupuesto anual que tiene presupuestos de inversión asociados',
        'Advertencia'
      );
      this.showConfirmDialog.set(false);
      this.deletingBudgetYear.set(null);
      this.isDeletingBudgetYear.set(false);
      return;
    }

    this.budgetYearService.delete(budgetYear.id).subscribe({
      next: () => {
        this.toastr.success('Presupuesto anual eliminado correctamente', 'Éxito');
        this.showConfirmDialog.set(false);
        this.deletingBudgetYear.set(null);
        this.isDeletingBudgetYear.set(false);
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al eliminar el presupuesto anual';
        this.toastr.error(errorMessage, 'Error');
        this.showConfirmDialog.set(false);
        this.deletingBudgetYear.set(null);
        this.isDeletingBudgetYear.set(false);
      },
    });
  }

  deleteInvestment(investment: Investment): void {
    this.deletingInvestment.set(investment);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    if (this.isDeletingBudgetYear()) {
      this.onConfirmDeleteBudgetYear();
      return;
    }

    const investment = this.deletingInvestment();
    if (!investment || !investment.id) return;

    this.investmentService.delete(investment.id).subscribe({
      next: () => {
        this.toastr.success('Presupuesto de inversión eliminado correctamente', 'Éxito');
        this.showConfirmDialog.set(false);
        this.deletingInvestment.set(null);
        this.loadInvestments(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al eliminar el presupuesto de inversión';
        this.toastr.error(errorMessage, 'Error');
        this.showConfirmDialog.set(false);
        this.deletingInvestment.set(null);
      },
    });
  }

  onCancelDelete(): void {
    this.showConfirmDialog.set(false);
    this.deletingInvestment.set(null);
    this.deletingBudgetYear.set(null);
    this.isDeletingBudgetYear.set(false);
  }

  getDeleteMessage(): string {
    if (this.isDeletingBudgetYear()) {
      const budgetYear = this.deletingBudgetYear();
      if (!budgetYear) return '';
      return `¿Estás seguro de que deseas eliminar el presupuesto anual de inversión ${budgetYear.year}? Esta acción no se puede deshacer.`;
    }

    const investment = this.deletingInvestment();
    if (!investment) return '';
    
    return `¿Estás seguro de que deseas eliminar el presupuesto de inversión de $${investment.amount?.toLocaleString() || 0}? Esta acción no se puede deshacer.`;
  }

  canDeleteBudgetYear(budgetYear: InvestmentBudgetYear): boolean {
    const budgetYearWithInvestments = this.budgetYearsWithInvestments().find(
      (by) => by.id === budgetYear.id
    );
    return !budgetYearWithInvestments || budgetYearWithInvestments.investments.length === 0;
  }

  loadCategories(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.investmentCategoryService.getByCompany(companyId).subscribe({
      next: (categories) => {
        this.categories.set(categories);
      },
      error: () => {
        this.toastr.error('Error al cargar las categorías', 'Error');
      },
    });
  }

  getCategoryName(categoryId: number): string {
    const category = this.categories().find((c) => c.id === categoryId);
    return category?.name || 'Sin categoría';
  }
}
