import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
  MoreVertical,
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
import { InvestmentImportModalComponent, ImportedInvestment } from '../../../../shared/investment-modal/investment-import-modal.component';
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
    InvestmentImportModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './investment-budgets.component.html',
  styleUrl: './investment-budgets.component.scss',
})
export class InvestmentBudgetsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private store = inject(Store);
  private http = inject(HttpClient);
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
    MoreVertical,
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
  openMenuId = signal<string | null>(null);
  openMenuTop = signal(0);
  openMenuLeft = signal(0);
  showImportModal = signal(false);
  importedInvestments = signal<ImportedInvestment[]>([]);
  importingBudgetYear = signal<InvestmentBudgetYear | null>(null);

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

  getMenuId(prefix: 'year' | 'investment', id: number | null | undefined): string {
    return `${prefix}-${id ?? 'unknown'}`;
  }

  toggleMenu(menuId: string, event?: MouseEvent): void {
    const current = this.openMenuId();
    if (current !== menuId && event) {
      const target = event.currentTarget as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        const menuWidth = 200;
        const menuHeight = 200;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenUp = spaceBelow < menuHeight && spaceAbove > menuHeight;
        const rawTop = shouldOpenUp ? rect.top - menuHeight - 8 : rect.bottom + 4;
        const top = Math.max(8, Math.min(rawTop, window.innerHeight - menuHeight - 8));
        const rawLeft = rect.right - menuWidth;
        const left = Math.max(8, Math.min(rawLeft, window.innerWidth - menuWidth - 8));
        this.openMenuTop.set(top);
        this.openMenuLeft.set(left);
      }
    }
    this.openMenuId.set(current === menuId ? null : menuId);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
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
    this.http.get('assets/templates/plantilla-presupuesto-inversiones.xlsx', {
      responseType: 'blob'
    }).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const yearSuffix = budgetYearId ? `-${budgetYearId}` : '';
        link.href = url;
        link.download = `plantilla-presupuesto-inversiones${yearSuffix}.xlsx`;
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

  triggerFileInput(budgetYear: InvestmentBudgetYear): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = (e) => this.onFileSelected(e, budgetYear);
    input.click();
  }

  onFileSelected(event: Event, budgetYear: InvestmentBudgetYear): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      this.toastr.error('Por favor, selecciona un archivo Excel (.xls o .xlsx)', 'Error');
      input.value = '';
      return;
    }

    this.isImporting.set(true);
    this.importingBudgetYear.set(budgetYear);

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('No se pudo leer el archivo');
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        // Read from row 4 (index 3): A4-B4 and down
        const processedData: ImportedInvestment[] = [];
        
        const parseNumericValue = (value: any): number | null => {
          if (value === null || value === undefined || value === '') {
            return null;
          }
          const num = typeof value === 'number' 
            ? value 
            : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          return !isNaN(num) ? num : null;
        };

        for (let i = 3; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const categoryName = row[0]; // Column A
          const amountValue = row[1]; // Column B

          const hasCategory = categoryName !== null && categoryName !== undefined && categoryName !== '';
          const hasAmount = amountValue !== null && amountValue !== undefined && amountValue !== '';
          const hasAnyData = hasCategory || hasAmount;

          if (!hasAnyData) {
            continue;
          }

          processedData.push({
            category_name: hasCategory ? String(categoryName).trim() : null,
            amount: parseNumericValue(amountValue),
          });
        }

        if (processedData.length === 0) {
          this.toastr.warning(
            'No se encontraron datos válidos en el archivo. Asegúrate de que haya datos a partir de la fila 4 (columnas A4 hasta B4).',
            'Advertencia'
          );
          this.isImporting.set(false);
          this.importingBudgetYear.set(null);
          input.value = '';
          return;
        }

        this.importedInvestments.set(processedData);
        this.showImportModal.set(true);
        this.isImporting.set(false);
        input.value = '';
      } catch (error) {
        console.error('Error al leer el archivo Excel:', error);
        this.toastr.error(
          'Error al leer el archivo Excel. Asegúrate de que el archivo sea válido.',
          'Error'
        );
        this.isImporting.set(false);
        this.importingBudgetYear.set(null);
        input.value = '';
      }
    };

    reader.onerror = () => {
      this.toastr.error('Error al leer el archivo', 'Error');
      this.isImporting.set(false);
      this.importingBudgetYear.set(null);
      input.value = '';
    };

    reader.readAsBinaryString(file);
  }

  onCloseImportModal(): void {
    this.showImportModal.set(false);
    this.importedInvestments.set([]);
    this.importingBudgetYear.set(null);
  }

  onSaveImportedInvestments(investments: InvestmentCreate[]): void {
    if (!investments || investments.length === 0) {
      this.toastr.error('No hay inversiones para guardar', 'Error');
      return;
    }

    this.isImporting.set(true);
    
    // Create investments one by one
    let completed = 0;
    let errors = 0;

    investments.forEach((investment) => {
      this.investmentService.create(investment).subscribe({
        next: () => {
          completed++;
          if (completed + errors === investments.length) {
            if (errors === 0) {
              this.toastr.success(
                `${investments.length} inversión(es) importada(s) correctamente`,
                'Éxito'
              );
            } else {
              this.toastr.warning(
                `${completed} inversión(es) importada(s), ${errors} con errores`,
                'Advertencia'
              );
            }
            this.showImportModal.set(false);
            this.importedInvestments.set([]);
            this.importingBudgetYear.set(null);
            this.isImporting.set(false);
            this.loadInvestments(this.currentPage());
            this.loadBudgetYears();
          }
        },
        error: (error: unknown) => {
          errors++;
          if (completed + errors === investments.length) {
            if (errors === investments.length) {
              const errorMessage =
                (error as { error?: { message?: string }; message?: string })?.error
                  ?.message ||
                (error as { message?: string })?.message ||
                'Error al importar las inversiones';
              this.toastr.error(errorMessage, 'Error');
            } else {
              this.toastr.warning(
                `${completed} inversión(es) importada(s), ${errors} con errores`,
                'Advertencia'
              );
            }
            this.showImportModal.set(false);
            this.importedInvestments.set([]);
            this.importingBudgetYear.set(null);
            this.isImporting.set(false);
            this.loadInvestments(this.currentPage());
            this.loadBudgetYears();
          }
        },
      });
    });
  }
}
