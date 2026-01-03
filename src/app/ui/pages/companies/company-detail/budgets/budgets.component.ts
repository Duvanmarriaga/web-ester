import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  DollarSign,
  Download,
  Upload,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-angular';
import {
  BudgetService,
  BudgetCreate,
  Budget,
} from '../../../../../infrastructure/services/budget.service';
import {
  BudgetYearService,
  BudgetYear,
  BudgetYearCreate,
  BudgetYearUpdate,
} from '../../../../../infrastructure/services/budget-year.service';
import { BudgetModalComponent } from '../../../../shared/budget-modal/budget-modal.component';
import { BudgetYearModalComponent } from '../../../../shared/budget-year-modal/budget-year-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';

interface BudgetYearWithBudgets extends BudgetYear {
  budgets: Budget[];
  isExpanded: boolean;
}

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BudgetModalComponent, BudgetYearModalComponent, ConfirmDialogComponent],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.scss',
})
export class BudgetsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private budgetService = inject(BudgetService);
  private budgetYearService = inject(BudgetYearService);
  private toastr = inject(ToastrService);

  readonly icons = {
    DollarSign,
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
  budgets = signal<Budget[]>([]);
  budgetYears = signal<BudgetYear[]>([]);
  budgetYearsWithBudgets = signal<BudgetYearWithBudgets[]>([]);
  budgetsWithoutYear = signal<Budget[]>([]);
  pagination = signal<PaginatedResponse<Budget> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  currentPage = signal(1);
  selectedBudget = signal<Budget | null>(null);
  selectedBudgetYear = signal<BudgetYear | null>(null);
  showConfirmDialog = signal(false);
  deletingBudget = signal<Budget | null>(null);
  deletingBudgetYear = signal<BudgetYear | null>(null);
  isDeletingBudgetYear = signal(false);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadBudgetYears();
        this.loadBudgets();
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
        this.groupBudgetsByYear();
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

  loadBudgets(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.budgetService.getAll(page, 1000, companyId).subscribe({
      next: (response: PaginatedResponse<Budget>) => {
        this.budgets.set(response.data);
        this.pagination.set(response);
        this.groupBudgetsByYear();
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

  groupBudgetsByYear(): void {
    const budgets = this.budgets();
    const budgetYears = this.budgetYears();

    // Agrupar budgets por budget_year_id
    const budgetsByYear = new Map<number, Budget[]>();
    const budgetsWithoutYear: Budget[] = [];

    budgets.forEach((budget) => {
      if (budget.budget_year_id) {
        if (!budgetsByYear.has(budget.budget_year_id)) {
          budgetsByYear.set(budget.budget_year_id, []);
        }
        budgetsByYear.get(budget.budget_year_id)!.push(budget);
      } else {
        budgetsWithoutYear.push(budget);
      }
    });

    // Crear array de BudgetYearWithBudgets
    const budgetYearsWithBudgets: BudgetYearWithBudgets[] = budgetYears.map((year) => ({
      ...year,
      budgets: budgetsByYear.get(year.id) || [],
      isExpanded: false,
    }));

    this.budgetYearsWithBudgets.set(budgetYearsWithBudgets);
    this.budgetsWithoutYear.set(budgetsWithoutYear);
  }

  toggleBudgetYear(year: BudgetYearWithBudgets): void {
    const current = this.budgetYearsWithBudgets();
    const index = current.findIndex((y) => y.id === year.id);
    if (index !== -1) {
      current[index].isExpanded = !current[index].isExpanded;
      this.budgetYearsWithBudgets.set([...current]);
    }
  }

  onPageChange(page: number): void {
    this.loadBudgets(page);
  }

  downloadTemplate(): void {
    this.budgetService.downloadTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla-presupuestos.csv';
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isImporting.set(true);
    this.budgetService.import(file).subscribe({
      next: () => {
        this.toastr.success(
          'Presupuestos importados correctamente',
          'Éxito'
        );
        this.isImporting.set(false);
        input.value = '';
        this.loadBudgets(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al importar el archivo';
        this.toastr.error(errorMessage, 'Error');
        this.isImporting.set(false);
        input.value = '';
      },
    });
  }

  triggerFileInput(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => this.onFileSelected(e);
    input.click();
  }

  openCreateModal(budgetYearId?: number) {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedBudget.set(null);
    if (budgetYearId) {
      // Si se pasa budgetYearId, crear un budget temporal con ese año para pre-seleccionarlo
      const tempBudget: Budget = {
        budget_year_id: budgetYearId,
        budget_category_id: 0,
        company_id: this.companyId()!,
        budget_date: '',
        budget_amount: 0,
        executed_amount: 0,
        difference_amount: 0,
        percentage: 0,
        user_id: this.userId()!,
      };
      this.selectedBudget.set(tempBudget);
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

  editBudget(budget: Budget) {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedBudget.set(budget);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedBudget.set(null);
  }

  closeBudgetYearModal() {
    this.showBudgetYearModal.set(false);
    this.selectedBudgetYear.set(null);
  }

  onSaveBudget(budgetData: BudgetCreate): void {
    this.budgetService.create(budgetData).subscribe({
      next: () => {
        this.toastr.success('Presupuesto creado correctamente', 'Éxito');
        this.closeModal();
        this.loadBudgets(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el presupuesto';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateBudget(updateData: { id: number; data: BudgetCreate }): void {
    this.budgetService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Presupuesto actualizado correctamente', 'Éxito');
        this.closeModal();
        this.loadBudgets(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el presupuesto';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onSaveBudgetYear(budgetYearData: BudgetYearCreate): void {
    this.budgetYearService.create(budgetYearData).subscribe({
      next: () => {
        this.toastr.success('Presupuesto anual creado correctamente', 'Éxito');
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

  onUpdateBudgetYear(updateData: { id: number; data: BudgetYearUpdate }): void {
    this.budgetYearService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Presupuesto anual actualizado correctamente', 'Éxito');
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

  editBudgetYear(budgetYear: BudgetYear): void {
    this.selectedBudgetYear.set(budgetYear);
    this.showBudgetYearModal.set(true);
  }

  deleteBudgetYear(budgetYear: BudgetYear): void {
    // Verificar si tiene budgets asociados
    const budgetYearWithBudgets = this.budgetYearsWithBudgets().find(
      (by) => by.id === budgetYear.id
    );
    
    if (budgetYearWithBudgets && budgetYearWithBudgets.budgets.length > 0) {
      this.toastr.warning(
        'No se puede eliminar un presupuesto anual que tiene presupuestos mensuales asociados',
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
    const budgetYearWithBudgets = this.budgetYearsWithBudgets().find(
      (by) => by.id === budgetYear.id
    );
    
    if (budgetYearWithBudgets && budgetYearWithBudgets.budgets.length > 0) {
      this.toastr.warning(
        'No se puede eliminar un presupuesto anual que tiene presupuestos mensuales asociados',
        'Advertencia'
      );
      this.showConfirmDialog.set(false);
      this.deletingBudgetYear.set(null);
      this.isDeletingBudgetYear.set(false);
      return;
    }

    // Aquí necesitaríamos un método delete en el servicio, pero no está en la API
    // Por ahora solo mostramos un mensaje
    this.toastr.info('La funcionalidad de eliminar presupuesto anual estará disponible próximamente', 'Info');
    this.showConfirmDialog.set(false);
    this.deletingBudgetYear.set(null);
    this.isDeletingBudgetYear.set(false);
  }

  deleteBudget(budget: Budget): void {
    this.deletingBudget.set(budget);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    if (this.isDeletingBudgetYear()) {
      this.onConfirmDeleteBudgetYear();
      return;
    }

    const budget = this.deletingBudget();
    if (!budget || !budget.id) return;

    this.budgetService.delete(budget.id).subscribe({
      next: () => {
        this.toastr.success('Presupuesto eliminado correctamente', 'Éxito');
        this.showConfirmDialog.set(false);
        this.deletingBudget.set(null);
        this.loadBudgets(this.currentPage());
        this.loadBudgetYears();
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al eliminar el presupuesto';
        this.toastr.error(errorMessage, 'Error');
        this.showConfirmDialog.set(false);
        this.deletingBudget.set(null);
      },
    });
  }

  onCancelDelete(): void {
    this.showConfirmDialog.set(false);
    this.deletingBudget.set(null);
    this.deletingBudgetYear.set(null);
    this.isDeletingBudgetYear.set(false);
  }

  getDeleteMessage(): string {
    if (this.isDeletingBudgetYear()) {
      const budgetYear = this.deletingBudgetYear();
      if (!budgetYear) return '';
      return `¿Estás seguro de que deseas eliminar el presupuesto anual ${budgetYear.year}? Esta acción no se puede deshacer.`;
    }

    const budget = this.deletingBudget();
    if (!budget) return '';
    
    const date = new Date(budget.budget_date);
    const formattedDate = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    
    return `¿Estás seguro de que deseas eliminar el presupuesto de ${formattedDate}? Esta acción no se puede deshacer.`;
  }

  canDeleteBudgetYear(budgetYear: BudgetYear): boolean {
    const budgetYearWithBudgets = this.budgetYearsWithBudgets().find(
      (by) => by.id === budgetYear.id
    );
    return !budgetYearWithBudgets || budgetYearWithBudgets.budgets.length === 0;
  }
}

