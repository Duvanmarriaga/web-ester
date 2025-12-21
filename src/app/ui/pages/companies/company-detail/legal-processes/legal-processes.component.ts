import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule,
  Scale,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-angular';
import {
  ProcessService,
  ProcessCreate,
  Process,
} from '../../../../../infrastructure/services/process.service';
import { ProcessModalComponent } from '../../../../shared/process-modal/process-modal.component';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-legal-processes',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PaginationComponent, ProcessModalComponent, ConfirmDialogComponent],
  templateUrl: './legal-processes.component.html',
  styleUrl: './legal-processes.component.scss',
})
export class LegalProcessesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private processService = inject(ProcessService);
  private toastr = inject(ToastrService);

  readonly icons = {
    Scale,
    Plus,
    Pencil,
    Trash2,
  };

  companyId = signal<number | null>(null);
  showModal = signal(false);
  processes = signal<Process[]>([]);
  pagination = signal<PaginatedResponse<Process> | null>(null);
  isLoading = signal(false);
  currentPage = signal(1);
  selectedProcess = signal<Process | null>(null);
  showConfirmDialog = signal(false);
  deletingProcess = signal<Process | null>(null);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadProcesses();
      }
    });
  }

  loadProcesses(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.processService.getAll(page, 15, companyId).subscribe({
      next: (response: PaginatedResponse<Process>) => {
        this.processes.set(response.data);
        this.pagination.set(response);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los procesos';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  onPageChange(page: number): void {
    this.loadProcesses(page);
  }

  openCreateModal() {
    if (!this.companyId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedProcess.set(null);
    this.showModal.set(true);
  }

  editProcess(process: Process) {
    if (!this.companyId()) {
      this.toastr.error('No se pudo obtener la información necesaria', 'Error');
      return;
    }
    this.selectedProcess.set(process);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedProcess.set(null);
  }

  onSaveProcess(processData: ProcessCreate): void {
    this.processService.create(processData).subscribe({
      next: () => {
        this.toastr.success('Proceso jurídico creado correctamente', 'Éxito');
        this.closeModal();
        this.loadProcesses(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al crear el proceso';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  onUpdateProcess(updateData: { id: number; data: ProcessCreate }): void {
    this.processService.update(updateData.id, updateData.data).subscribe({
      next: () => {
        this.toastr.success('Proceso jurídico actualizado correctamente', 'Éxito');
        this.closeModal();
        this.loadProcesses(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al actualizar el proceso';
        this.toastr.error(errorMessage, 'Error');
      },
    });
  }

  deleteProcess(process: Process): void {
    this.deletingProcess.set(process);
    this.showConfirmDialog.set(true);
  }

  onConfirmDelete(): void {
    const process = this.deletingProcess();
    if (!process || !process.id) return;

    this.processService.delete(process.id).subscribe({
      next: () => {
        this.toastr.success('Proceso jurídico eliminado correctamente', 'Éxito');
        this.showConfirmDialog.set(false);
        this.deletingProcess.set(null);
        this.loadProcesses(this.currentPage());
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al eliminar el proceso';
        this.toastr.error(errorMessage, 'Error');
        this.showConfirmDialog.set(false);
        this.deletingProcess.set(null);
      },
    });
  }

  onCancelDelete(): void {
    this.showConfirmDialog.set(false);
    this.deletingProcess.set(null);
  }

  getDeleteMessage(): string {
    const process = this.deletingProcess();
    if (!process) return '';
    
    return `¿Estás seguro de que deseas eliminar el proceso "${process.docket_number}"? Esta acción no se puede deshacer.`;
  }
}

