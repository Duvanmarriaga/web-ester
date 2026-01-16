import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
  viewChild,
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
import {
  ProcessContactService,
  ProcessContact,
  ProcessContactCreate,
} from '../../../infrastructure/services/process-contact.service';
import { LucideAngularModule, X } from 'lucide-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { firstValueFrom, Observable, of, Subject } from 'rxjs';
import {
  map,
  catchError,
  debounceTime,
  switchMap,
  distinctUntilChanged,
} from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { FileUploadComponent } from '../file-upload/file-upload.component';

@Component({
  selector: 'app-process-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    NgSelectModule,
    FileUploadComponent,
  ],
  templateUrl: './process-modal.component.html',
  styleUrl: './process-modal.component.scss',
})
export class ProcessModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private processStatusService = inject(ProcessStatusService);
  private processContactService = inject(ProcessContactService);
  private toastr = inject(ToastrService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  process = input<Process | null>(null);
  defaultType = input<'penal' | 'juridico'>('penal');

  // Outputs
  close = output<void>();
  save = output<ProcessCreate>();
  update = output<{ id: number; data: ProcessCreate }>();

  // File upload component reference
  fileUploadComponent = viewChild<FileUploadComponent>('fileUpload');

  processForm!: FormGroup;
  readonly icons = { X };
  isSubmitting = signal(false);
  isEditMode = signal(false);
  currentProcessId = signal<number | null>(null);
  statuses = signal<ProcessStatus[]>([]);
  contacts = signal<ProcessContact[]>([]);
  contactInput$ = new Subject<string>();
  isLoadingContacts = signal(false);
  currentSearchTerm = signal<string>('');
  isCreatingContact = signal(false);

  readonly processTypes = [
    { value: 'penal', label: 'PENAL' },
    { value: 'civil', label: 'CIVIL' },
    { value: 'laboral', label: 'LABORAL' },
    { value: 'administrativo', label: 'ADMINISTRATIVO' },
    { value: 'contencioso administrativo', label: 'CONTENCIOSO ADMINISTRATIVO' },
    { value: 'constitucional', label: 'CONSTITUCIONAL' },
    { value: 'disciplinario', label: 'DISCIPLINARIO' },
    { value: 'fiscal', label: 'FISCAL' },
    { value: 'policivo', label: 'POLICIVO' },
    { value: 'de familia', label: 'DE FAMILIA' },
    { value: 'comercial / mercantil', label: 'COMERCIAL / MERCANTIL' },
    { value: 'tributario', label: 'TRIBUTARIO' },
    { value: 'electoral', label: 'ELECTORAL' },
    { value: 'ambiental', label: 'AMBIENTAL' },
    { value: 'agrario', label: 'AGRARIO' },
    { value: 'de responsabilidad médica', label: 'DE RESPONSABILIDAD MÉDICA' },
    { value: 'de insolvencia', label: 'DE INSOLVENCIA' },
    { value: 'arbitral', label: 'ARBITRAL' },
    { value: 'conciliatorio', label: 'CONCILIATORIO' },
    { value: 'otro', label: 'OTRO' },
  ];

  // Statuses permitidos

  // Computed signal para filtrar solo los status permitidos
  filteredStatuses = computed(() => {
    const allStatuses = this.statuses();
    return allStatuses;
  });

  // Computed signal to ensure it's always an array
  contactsList = computed(() => {
    const contacts = this.contacts();
    return Array.isArray(contacts) ? contacts : [];
  });

  constructor() {
    effect(() => {
      const currentProcess = this.process();
      const isVisible = this.isVisible();

      // Cargar contactos cada vez que se abre el modal
      if (isVisible) {
        this.loadContacts();
      }

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
          const defaultTypeValue = this.defaultType() || 'penal';
          this.processForm.reset({
            docket_number: '',
            type: defaultTypeValue,
            start_date: '',
            end_date: '',
            description: '',
            process_status_id: null,
            contact_id: null,
          });
        }, 0);
      }
    });
  }

  ngOnInit() {
    // Usar el tipo por defecto del input, o 'penal' si no se proporciona
    const defaultTypeValue = this.defaultType() || 'penal';
    
    this.processForm = this.fb.group({
      docket_number: ['', [Validators.required]],
      type: [defaultTypeValue, [Validators.required]],
      start_date: ['', [Validators.required]],
      end_date: [''],
      description: [''],
      process_status_id: ['', [Validators.required]],
      contact_id: [''],
    });

    // Setup typeahead for contacts
    this.setupContactTypeahead();

    // Cargar statuses primero, luego poblar el formulario si hay un proceso
    // Los contactos se cargarán automáticamente cuando se abra el modal (en el effect)
    this.loadStatuses();
  }

  setupContactTypeahead(): void {
    this.contactInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term: string) => {
          this.isLoadingContacts.set(true);
          this.currentSearchTerm.set(term || '');
          const companyId = this.companyId();
          if (!companyId) {
            this.isLoadingContacts.set(false);
            return of([]);
          }
          // If term is empty, load all contacts
          if (!term || term.trim().length === 0) {
            return this.processContactService.getAll(companyId).pipe(
              map((response) => {
                // Handle both array and paginated response
                if (Array.isArray(response)) {
                  return response;
                }
                return response.data || [];
              }),
              catchError(() => {
                this.isLoadingContacts.set(false);
                return of([]);
              })
            );
          }
          // Otherwise search by name
          return this.processContactService.getAll(companyId, term).pipe(
            map((response) => {
              // Handle both array and paginated response
              if (Array.isArray(response)) {
                return response;
              }
              return response.data || [];
            }),
            catchError(() => {
              this.isLoadingContacts.set(false);
              return of([]);
            })
          );
        })
      )
      .subscribe((contacts) => {
        this.contacts.set(Array.isArray(contacts) ? contacts : []);
        this.isLoadingContacts.set(false);
      });
  }

  loadContacts(): void {
    const companyId = this.companyId();
    if (!companyId) {
      this.contacts.set([]);
      return;
    }

    this.isLoadingContacts.set(true);
    this.processContactService.getAll(companyId).subscribe({
      next: (response) => {
        // Handle both array and paginated response
        const contacts = Array.isArray(response) ? response : (response.data || []);
        this.contacts.set(contacts);
        this.isLoadingContacts.set(false);
        // Trigger typeahead with empty term to show initial contacts
        this.contactInput$.next('');
      },
      error: () => {
        this.contacts.set([]);
        this.isLoadingContacts.set(false);
      },
    });
  }

  onCreateContactFromTag(term: string | any): void {
    let contactName: string;

    if (typeof term === 'string') {
      contactName = term;
    } else if (term && typeof term === 'object' && term.name) {
      contactName = term.name;
    } else if (term && typeof term === 'object' && term.value) {
      contactName = term.value;
    } else {
      contactName = this.currentSearchTerm();
    }

    if (!contactName || contactName.trim().length === 0) {
      return;
    }

    // Check if contact already exists
    const existingContact = this.contactsList().find(
      (contact) => contact.name.toLowerCase() === contactName.trim().toLowerCase()
    );

    if (existingContact) {
      this.processForm.patchValue({
        contact_id: existingContact.id,
      });
      return;
    }

    // Create the contact
    this.createContact(contactName.trim());
  }

  createContact(term: string): void {
    const companyId = this.companyId();

    if (
      !companyId ||
      !term ||
      term.trim().length === 0 ||
      this.isCreatingContact()
    ) {
      return;
    }

    const contactData: ProcessContactCreate = {
      name: term.trim(),
      company_id: companyId,
    };

    this.isCreatingContact.set(true);
    this.isLoadingContacts.set(true);

    this.processContactService.create(contactData).subscribe({
      next: (newContact) => {
        const currentContacts = this.contacts();
        this.contacts.set([...currentContacts, newContact]);
        this.processForm.patchValue({ contact_id: newContact.id });
        this.toastr.success('Contacto creado exitosamente', 'Éxito');
        this.isLoadingContacts.set(false);
        this.isCreatingContact.set(false);
        this.currentSearchTerm.set('');
      },
      error: (error) => {
        this.toastr.error('Error al crear el contacto', 'Error');
        this.isLoadingContacts.set(false);
        this.isCreatingContact.set(false);
        this.processForm.patchValue({ contact_id: '' });
      },
    });
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
    // Set the current process ID for file upload component
    this.currentProcessId.set(process.id || null);

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

    // Buscar el contacto por ID si existe
    if (process.contact_id) {
      const currentContacts = this.contacts();
      const contactInList = currentContacts.find(
        (c) => c.id === process.contact_id
      );

      if (contactInList) {
        // Si está en la lista, usarlo directamente
        this.processForm.patchValue(
          {
            contact_id: { name: contactInList.name },
          },
          { emitEvent: false }
        );
      } else {
        // Si no está en la lista, buscarlo por ID
        this.processContactService.getById(process.contact_id).subscribe({
          next: (contact) => {
            // Agregar el contacto a la lista si no está presente
            const updatedContacts = this.contacts();
            const contactExists = updatedContacts.some(
              (c) => c.id === contact.id
            );
            if (!contactExists) {
              this.contacts.set([...updatedContacts, contact]);
            }

            // Establecer el valor del formulario como objeto con name
            this.processForm.patchValue(
              {
                contact_id: { name: contact.name },
              },
              { emitEvent: false }
            );
          },
          error: () => {
            // Si falla la búsqueda, establecer solo con el ID como fallback
            this.processForm.patchValue(
              {
                contact_id: process.contact_id?.toString() || '',
              },
              { emitEvent: false }
            );
          },
        });
      }
    } else {
      this.processForm.patchValue(
        {
          contact_id: '',
        },
        { emitEvent: false }
      );
    }

    // En modo edición, obtener el process_status_id del último elemento de status_history
    let statusIdToUse: number | null | undefined = null;
    if (this.isEditMode() && process.status_history && Array.isArray(process.status_history) && process.status_history.length > 0) {
      // Tomar el último elemento del array status_history
      const lastStatusHistory = process.status_history[process.status_history.length - 1];
      statusIdToUse = lastStatusHistory?.process_status_id;
    } else {
      // Si no hay status_history o no está en modo edición, usar process_status_id directamente
      statusIdToUse = process.process_status_id;
    }

    // Buscar el status por ID si existe
    if (statusIdToUse) {
      // Primero intentar encontrar el status en la lista actual
      const currentStatuses = this.statuses();
      const statusInList = currentStatuses.find(
        (s) => s.id === statusIdToUse
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
        this.processStatusService.getById(statusIdToUse).subscribe({
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
                process_status_id: statusIdToUse || '',
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

  async onSubmit() {
    if (this.processForm.invalid) {
      this.processForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    let formValue = { ...this.processForm.value };

    // Si contact_id es un objeto con name pero sin id, buscar el contacto en la lista
    if (
      formValue.contact_id &&
      typeof formValue.contact_id === 'object' &&
      formValue.contact_id.name &&
      !formValue.contact_id.id
    ) {
      const contactName = formValue.contact_id.name;
      const foundContact = this.contactsList().find(
        (contact) => contact.name === contactName
      );

      if (foundContact) {
        formValue.contact_id = foundContact.id;
      } else {
        // Si no encontramos el contacto, crear uno nuevo
        const contactData: ProcessContactCreate = {
          name: contactName.trim(),
          company_id: this.companyId(),
        };

        this.isCreatingContact.set(true);
        this.isLoadingContacts.set(true);

        try {
          const newContact = await firstValueFrom(
            this.processContactService.create(contactData)
          );
          formValue.contact_id = newContact.id;
        } catch (error) {
          this.toastr.error('Error al crear el contacto', 'Error');
          this.isSubmitting.set(false);
          return;
        } finally {
          this.isCreatingContact.set(false);
          this.isLoadingContacts.set(false);
        }
      }
    }

    // Extraer el ID del contacto si es un objeto
    let contactId: number | null = null;
    if (formValue.contact_id) {
      if (
        typeof formValue.contact_id === 'object' &&
        formValue.contact_id.id
      ) {
        contactId = formValue.contact_id.id;
      } else if (typeof formValue.contact_id === 'number') {
        contactId = formValue.contact_id;
      } else if (typeof formValue.contact_id === 'string' && formValue.contact_id.trim() !== '') {
        contactId = parseInt(formValue.contact_id, 10) || null;
      }
    }

    // Extraer el ID del status si es un objeto
    let statusId: number | null = null;
    if (formValue.process_status_id) {
      if (
        typeof formValue.process_status_id === 'object' &&
        formValue.process_status_id.id
      ) {
        statusId = formValue.process_status_id.id;
      } else if (typeof formValue.process_status_id === 'number') {
        statusId = formValue.process_status_id;
      } else {
        statusId = parseInt(formValue.process_status_id, 10) || null;
      }
    }

    const processData: ProcessCreate = {
      company_id: this.companyId(),
      contact_id: contactId,
      docket_number: formValue.docket_number,
      type: formValue.type,
      start_date: formValue.start_date,
      end_date: formValue.end_date || null,
      description: formValue.description || null,
      process_status_id: statusId,
      process_status_date: statusId ? new Date().toISOString() : null,
    };

    try {
      if (this.isEditMode() && this.process()?.id) {
        this.update.emit({
          id: this.process()!.id!,
          data: processData,
        });
        
        // Upload pending files after update
        const fileUpload = this.fileUploadComponent();
        if (fileUpload) {
          await fileUpload.uploadPendingFiles(this.process()!.id!);
        }
      } else {
        // For new processes, emit save and let parent handle file upload after creation
        this.save.emit(processData);
      }
    } catch (error) {
      console.error('Error in submit:', error);
      this.toastr.error('Error al guardar el proceso', 'Error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose() {
    this.processForm.reset();
    this.isEditMode.set(false);
    this.currentProcessId.set(null);
    
    // Clear pending files
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      fileUpload.clearPendingFiles();
    }
    
    this.close.emit();
  }

  // Public method to upload files after process creation
  async uploadFilesForNewProcess(processId: number): Promise<boolean> {
    const fileUpload = this.fileUploadComponent();
    if (fileUpload) {
      return await fileUpload.uploadPendingFiles(processId);
    }
    return true;
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
    if (
      typeof status1 === 'number' &&
      typeof status2 === 'object' &&
      status2.id
    ) {
      return status1 === status2.id;
    }
    if (
      typeof status2 === 'number' &&
      typeof status1 === 'object' &&
      status1.id
    ) {
      return status2 === status1.id;
    }

    // Comparación directa
    return status1 === status2;
  }

  compareContacts(contact1: any, contact2: any): boolean {
    // Comparar por nombre para que funcione con {name: ...}
    if (!contact1 || !contact2) return false;
    if (typeof contact1 === 'object' && typeof contact2 === 'object') {
      return contact1.name === contact2.name;
    }
    return contact1 === contact2;
  }
}
