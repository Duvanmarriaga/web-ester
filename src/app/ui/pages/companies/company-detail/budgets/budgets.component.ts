import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PaginationComponent],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.scss',
})
export class BudgetsComponent implements OnInit {
  private route = inject(ActivatedRoute);
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
  budgets = signal<Budget[]>([]);
  pagination = signal<PaginatedResponse<Budget> | null>(null);
  isLoading = signal(false);
  isImporting = signal(false);
  currentPage = signal(1);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadBudgets();
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
}

