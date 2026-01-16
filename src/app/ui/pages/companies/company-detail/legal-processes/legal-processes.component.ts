import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule,
  Scale,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
} from 'lucide-angular';
import {
  ProcessService,
  ProcessCreate,
  Process,
} from '../../../../../infrastructure/services/process.service';
import {
  ProcessContactService,
  ProcessContact,
} from '../../../../../infrastructure/services/process-contact.service';
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
  private processContactService = inject(ProcessContactService);
  private toastr = inject(ToastrService);

  readonly icons = {
    Scale,
    Plus,
    Pencil,
    Trash2,
    MoreVertical,
  };

  readonly processTypeLabels: Record<string, string> = {
    penal: 'PENAL',
    civil: 'CIVIL',
    laboral: 'LABORAL',
    administrativo: 'ADMINISTRATIVO',
    'contencioso administrativo': 'CONTENCIOSO ADMINISTRATIVO',
    constitucional: 'CONSTITUCIONAL',
    disciplinario: 'DISCIPLINARIO',
    fiscal: 'FISCAL',
    policivo: 'POLICIVO',
    'de familia': 'DE FAMILIA',
    'comercial / mercantil': 'COMERCIAL / MERCANTIL',
    tributario: 'TRIBUTARIO',
    electoral: 'ELECTORAL',
    ambiental: 'AMBIENTAL',
    agrario: 'AGRARIO',
    'de responsabilidad médica': 'DE RESPONSABILIDAD MÉDICA',
    'de insolvencia': 'DE INSOLVENCIA',
    arbitral: 'ARBITRAL',
    conciliatorio: 'CONCILIATORIO',
    otro: 'OTRO',
  };

  companyId = signal<number | null>(null);
  showModal = signal(false);
  processes = signal<Process[]>([]);
  contacts = signal<ProcessContact[]>([]);
  pagination = signal<PaginatedResponse<Process> | null>(null);
  isLoading = signal(false);
  currentPage = signal(1);
  selectedProcess = signal<Process | null>(null);
  showConfirmDialog = signal(false);
  deletingProcess = signal<Process | null>(null);
  openMenuId = signal<number | null>(null);
  openMenuTop = signal(0);
  openMenuLeft = signal(0);
  processModalComponent = viewChild<ProcessModalComponent>('processModal');

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadContacts();
        this.loadProcesses();
      }
    });
  }

  loadContacts(): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.processContactService.getAll(companyId).subscribe({
      next: (response) => {
        // Handle both array and paginated response
        const contacts = Array.isArray(response) ? response : (response.data || []);
        this.contacts.set(contacts);
      },
      error: () => {
        this.contacts.set([]);
      },
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

  toggleMenu(processId: number | null | undefined, event?: MouseEvent): void {
    if (!processId) return;
    const current = this.openMenuId();
    if (current !== processId && event) {
      const target = event.currentTarget as HTMLElement | null;
      if (target) {
        const rect = target.getBoundingClientRect();
        const menuWidth = 160;
        const menuHeight = 120;
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
    this.openMenuId.set(current === processId ? null : processId);
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  getProcessTypeLabel(type: string | null | undefined): string {
    if (!type) return '';
    return this.processTypeLabels[type] || type.toUpperCase();
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

  async onSaveProcess(processData: ProcessCreate): Promise<void> {
    this.processService.create(processData).subscribe({
      next: async (createdProcess) => {
        this.toastr.success('Proceso jurídico creado correctamente', 'Éxito');
        
        // Upload pending files for the new process
        const modalComponent = this.processModalComponent();
        if (modalComponent && createdProcess.id) {
          await modalComponent.uploadFilesForNewProcess(createdProcess.id);
        }
        
        this.closeModal();
        this.loadContacts();
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
        this.loadContacts();
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

  getContactName(contactId: number | null | undefined): string {
    if (!contactId) return '';
    const contact = this.contacts().find((c) => c.id === contactId);
    return contact?.name || '';
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

