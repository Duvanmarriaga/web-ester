import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ProcessService,
  ProcessCreate,
  Process,
} from '../../../infrastructure/services/process.service';
import {
  ProcessStatusService,
  ProcessStatus,
} from '../../../infrastructure/services/process-status.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-process-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgSelectModule,
  ],
  templateUrl: './process-modal.component.html',
  styleUrl: './process-modal.component.scss',
})
export class ProcessModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private processService = inject(ProcessService);
  private processStatusService = inject(ProcessStatusService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  process = input<Process | null>(null);

  // Outputs
  close = output<void>();
  save = output<ProcessCreate>();
  update = output<{ id: number; data: ProcessCreate }>();

  processForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  isEditMode = signal(false);
  statuses = signal<ProcessStatus[]>([]);

  readonly processTypes = [
    { value: 'penal', label: 'Penal' },
    { value: 'juridico', label: 'Jurídico' },
  ];

  // Statuses permitidos

  // Computed signal para filtrar solo los status permitidos
  filteredStatuses = computed(() => {
    const allStatuses = this.statuses();
    console.log(allStatuses);
    return allStatuses;
  });

  constructor() {
    effect(() => {
      const currentProcess = this.process();
      const isVisible = this.isVisible();

      if (isVisible && currentProcess && this.processForm) {
        this.isEditMode.set(true);
        // Solo poblar si los statuses ya están cargados
        if (this.statuses().length > 0) {
        setTimeout(() => {
            this.populateForm(currentProcess);
          }, 0);
          }
        // Si no hay statuses cargados, loadStatuses() se encargará de poblar después de cargar
      } else if (isVisible && !currentProcess && this.processForm) {
        this.isEditMode.set(false);
        setTimeout(() => {
            this.processForm.reset({
              docket_number: '',
              type: 'penal',
              start_date: '',
              end_date: '',
              description: '',
            process_status_id: '',
            });
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.processForm = this.fb.group({
      docket_number: ['', [Validators.required]],
      type: ['penal', [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: [''],
      description: [''],
      process_status_id: ['', [Validators.required]],
    });

    // Cargar statuses primero, luego poblar el formulario si hay un proceso
    this.loadStatuses();
  }

  loadStatuses(): void {
    this.processStatusService.getAll().subscribe({
      next: (statuses) => {
        this.statuses.set(statuses);
        
        // Después de cargar los statuses, si hay un proceso para editar, poblar el formulario
        if (this.process() && this.isVisible() && !this.isEditMode()) {
          this.isEditMode.set(true);
          this.populateForm(this.process()!);
        }
      },
      error: () => {
        this.statuses.set([]);
        // Aún así intentar poblar el formulario si hay un proceso
        if (this.process() && this.isVisible() && !this.isEditMode()) {
      this.isEditMode.set(true);
      this.populateForm(this.process()!);
    }
      },
    });
  }

  populateForm(process: Process): void {
    const startDate = process.start_date
      ? process.start_date.substring(0, 10)
      : '';
    const endDate = process.end_date ? process.end_date.substring(0, 10) : '';

    // Establecer los valores básicos primero
    this.processForm.patchValue(
      {
        docket_number: process.docket_number,
        type: process.type,
        start_date: startDate,
        end_date: endDate,
        description: process.description || '',
      },
      { emitEvent: false }
    );

    // Buscar el status por ID si existe
    if (process.process_status_id) {
      // Primero intentar encontrar el status en la lista actual
      const currentStatuses = this.statuses();
      const statusInList = currentStatuses.find(
        (s) => s.id === process.process_status_id
      );

      if (statusInList) {
        // Si está en la lista, usarlo directamente
        this.processForm.patchValue(
          {
            process_status_id: statusInList,
          },
          { emitEvent: false }
        );
      } else {
        // Si no está en la lista, buscarlo por ID
        this.processStatusService.getById(process.process_status_id).subscribe({
          next: (status) => {
            // Agregar el status a la lista si no está presente
            const updatedStatuses = this.statuses();
            const statusExists = updatedStatuses.some(
              (s) => s.id === status.id
            );
            if (!statusExists) {
              this.statuses.set([...updatedStatuses, status]);
            }

            // Esperar un tick para asegurar que la lista se actualice
            setTimeout(() => {
              // Buscar el status en la lista actualizada para asegurar referencia correcta
              const finalStatuses = this.statuses();
              const finalStatus = finalStatuses.find((s) => s.id === status.id);
              
              // Establecer el valor del formulario con el objeto de la lista
              if (finalStatus) {
                this.processForm.patchValue(
                  {
                    process_status_id: finalStatus,
                  },
                  { emitEvent: false }
                );
              } else {
                // Si por alguna razón no está en la lista, usar el status obtenido
                this.processForm.patchValue(
                  {
                    process_status_id: status,
                  },
                  { emitEvent: false }
                );
              }
            }, 0);
          },
          error: () => {
            // Si falla la búsqueda, establecer solo con el ID como fallback
            this.processForm.patchValue(
              {
                process_status_id: process.process_status_id || '',
              },
              { emitEvent: false }
            );
          },
        });
      }
    } else {
      this.processForm.patchValue(
        {
          process_status_id: '',
        },
        { emitEvent: false }
      );
    }
  }

  onSubmit() {
    if (this.processForm.invalid) {
      this.processForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const formValue = this.processForm.value;

    // Extraer el ID del status si es un objeto
    let statusId: number | null = null;
    if (formValue.process_status_id) {
      if (typeof formValue.process_status_id === 'object' && formValue.process_status_id.id) {
        statusId = formValue.process_status_id.id;
      } else if (typeof formValue.process_status_id === 'number') {
        statusId = formValue.process_status_id;
      } else {
        statusId = parseInt(formValue.process_status_id, 10) || null;
      }
    }

    const processData: ProcessCreate = {
      company_id: this.companyId(),
      docket_number: formValue.docket_number,
      type: formValue.type,
      start_date: formValue.start_date,
      end_date: formValue.end_date || null,
      description: formValue.description || null,
      process_status_id: statusId,
      process_status_date: statusId ? new Date().toISOString() : null,
    };

    if (this.isEditMode() && this.process()?.id) {
      this.update.emit({
        id: this.process()!.id!,
        data: processData,
      });
    } else {
      this.save.emit(processData);
    }

    this.isSubmitting.set(false);
  }

  onClose() {
    this.processForm.reset();
    this.isEditMode.set(false);
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }

  compareStatuses(status1: any, status2: any): boolean {
    if (!status1 || !status2) return false;
    
    // Si ambos son objetos, comparar por ID
    if (typeof status1 === 'object' && typeof status2 === 'object') {
      // Si tienen id, comparar por id
      if (status1.id && status2.id) {
        return status1.id === status2.id;
      }
      // Si no tienen id pero tienen name, comparar por name (por si acaso)
      if (status1.name && status2.name) {
        return status1.name === status2.name;
      }
    }
    
    // Si uno es número y el otro es objeto con id, comparar
    if (typeof status1 === 'number' && typeof status2 === 'object' && status2.id) {
      return status1 === status2.id;
    }
    if (typeof status2 === 'number' && typeof status1 === 'object' && status1.id) {
      return status2 === status1.id;
    }
    
    // Comparación directa
    return status1 === status2;
  }
}
