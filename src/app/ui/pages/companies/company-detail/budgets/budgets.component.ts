import { Component, OnInit, inject, signal } from '@angular/core';
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
} from 'lucide-angular';
import {
  BudgetService,
  BudgetCreate,
  Budget,
} from '../../../../../infrastructure/services/budget.service';
import { BudgetModalComponent } from '../../../../shared/budget-modal/budget-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PaginationComponent, BudgetModalComponent, ConfirmDialogComponent],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.scss',
})
export class BudgetsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private budgetService = inject(BudgetService);
  private toastr = inject(ToastrService);

  readonly icons = {
    DollarSign,
    Download,
    Upload,
    Plus,
    Pencil,
    Trash2,
  };

  companyId = signal<number | null>(null);
  userId = signal<number | null>(null);
  showModal = signal(false);
  budgets = signal<Budget[]>([]);
  pagination = signal<PaginatedResponse<Budget> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  currentPage = signal(1);
  selectedBudget = signal<Budget | null>(null);
  showConfirmDialog = signal(false);
  deletingBudget = signal<Budget | null>(null);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadBudgets();
      }
    });

    this.store.select(selectUser).subscribe((user) => {
      if (user) {
        this.userId.set(user.id);
      }
    });
  }

  loadBudgets(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.budgetService.getAll(page, 15, companyId).subscribe({
      next: (response: PaginatedResponse<Budget>) => {
        this.budgets.set(response.data);
        this.pagination.set(response);
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

  openCreateModal() {
    if (!this.companyId() || !this.userId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedBudget.set(null);
    this.showModal.set(true);
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

  onSaveBudget(budgetData: BudgetCreate): void {
    this.budgetService.create(budgetData).subscribe({
      next: () => {
        this.toastr.success('Presupuesto creado correctamente', 'Éxito');
        this.closeModal();
        this.loadBudgets(this.currentPage());
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

  deleteBudget(budget: Budget): void {
    this.deletingBudget.set(budget);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    const budget = this.deletingBudget();
    if (!budget || !budget.id) return;

    this.budgetService.delete(budget.id).subscribe({
      next: () => {
        this.toastr.success('Presupuesto eliminado correctamente', 'Éxito');
        this.showConfirmDialog.set(false);
        this.deletingBudget.set(null);
        this.loadBudgets(this.currentPage());
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
  }

  getDeleteMessage(): string {
    const budget = this.deletingBudget();
    if (!budget) return '';
    
    const date = new Date(budget.budget_date);
    const formattedDate = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    
    return `¿Estás seguro de que deseas eliminar el presupuesto de ${formattedDate}? Esta acción no se puede deshacer.`;
  }
}

