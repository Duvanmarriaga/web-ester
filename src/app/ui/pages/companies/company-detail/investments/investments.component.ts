import { Component, OnInit, inject, signal } from '@angular/core';
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
} from 'lucide-angular';
import {
  InvestmentService,
  InvestmentCreate,
  Investment,
  InvestmentUpdate,
} from '../../../../../infrastructure/services/investment.service';
import {
  InvestmentCategoryService,
  InvestmentCategory,
} from '../../../../../infrastructure/services/investment-category.service';
import { InvestmentModalComponent } from '../../../../shared/investment-modal/investment-modal.component';
import { selectUser } from '../../../../../infrastructure/store/auth/auth.selectors';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    PaginationComponent,
    InvestmentModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './investments.component.html',
  styleUrl: './investments.component.scss',
})
export class InvestmentsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private investmentService = inject(InvestmentService);
  private investmentCategoryService = inject(InvestmentCategoryService);
  private toastr = inject(ToastrService);

  readonly icons = {
    TrendingUp,
    Download,
    Upload,
    Plus,
    Pencil,
    Trash2,
  };

  companyId = signal<number | null>(null);
  userId = signal<number | null>(null);
  showModal = signal(false);
  investments = signal<Investment[]>([]);
  categories = signal<InvestmentCategory[]>([]);
  pagination = signal<PaginatedResponse<Investment> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  currentPage = signal(1);
  selectedInvestment = signal<Investment | null>(null);
  showConfirmDialog = signal(false);
  deletingInvestment = signal<Investment | null>(null);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
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

  loadInvestments(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.investmentService.getAll(page, 15, companyId).subscribe({
      next: (response: PaginatedResponse<Investment>) => {
        this.investments.set(response.data);
        this.pagination.set(response);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los reportes de inversión';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  onPageChange(page: number): void {
    this.loadInvestments(page);
  }

  downloadTemplate(): void {
    this.investmentService.downloadTemplate().subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla-reportes-inversiones.csv';
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
    this.investmentService.import(file).subscribe({
      next: () => {
        this.toastr.success(
          'Reportes de inversión importados correctamente',
          'Éxito'
        );
        this.isImporting.set(false);
        input.value = '';
        this.loadInvestments(this.currentPage());
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
    this.selectedInvestment.set(null);
    this.showModal.set(true);
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

  onSaveInvestment(investmentData: InvestmentCreate): void {
    this.investmentService.create(investmentData).subscribe({
      next: () => {
        this.toastr.success(
          'Reporte de inversión creado correctamente',
          'Éxito'
        );
        this.closeModal();
        this.loadInvestments(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el reporte';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateInvestment(
    updateData: { id: number; data: InvestmentCreate }
  ): void {
    // Convert InvestmentCreate to InvestmentUpdate (all fields optional)
    const updatePayload: InvestmentUpdate = {
      investment_budget_category_id: updateData.data.investment_budget_category_id,
      investment_budget_annual_id: updateData.data.investment_budget_annual_id,
      company_id: updateData.data.company_id,
      amount: updateData.data.amount,
    };
    
    this.investmentService.update(updateData.id, updatePayload).subscribe({
      next: () => {
        this.toastr.success(
          'Reporte de inversión actualizado correctamente',
          'Éxito'
        );
        this.closeModal();
        this.loadInvestments(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el reporte';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  deleteInvestment(investment: Investment): void {
    this.deletingInvestment.set(investment);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    const investment = this.deletingInvestment();
    if (!investment || !investment.id) return;

    this.investmentService.delete(investment.id).subscribe({
      next: () => {
        this.toastr.success(
          'Reporte de inversión eliminado correctamente',
          'Éxito'
        );
        this.showConfirmDialog.set(false);
        this.deletingInvestment.set(null);
        this.loadInvestments(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al eliminar el reporte';
        this.toastr.error(errorMessage, 'Error');
        this.showConfirmDialog.set(false);
        this.deletingInvestment.set(null);
      },
    });
  }

  onCancelDelete(): void {
    this.showConfirmDialog.set(false);
    this.deletingInvestment.set(null);
  }

  getDeleteMessage(): string {
    const investment = this.deletingInvestment();
    if (!investment) return '';

    return `¿Estás seguro de que deseas eliminar la inversión de $${investment.amount?.toLocaleString() || 0}? Esta acción no se puede deshacer.`;
  }
}

