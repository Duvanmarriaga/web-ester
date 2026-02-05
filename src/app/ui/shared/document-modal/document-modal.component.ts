import {
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
  effect,
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
  DocumentService,
  DocumentCreate,
  Document,
} from '../../../infrastructure/services/document.service';
import { LucideAngularModule, X, FileText } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { FileService } from '../../../infrastructure/services/file.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-document-modal',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './document-modal.component.html',
  styleUrl: './document-modal.component.scss',
})
export class DocumentModalComponent implements OnInit {
  private fb = inject(FormBuilder);
  private documentService = inject(DocumentService);
  private fileService = inject(FileService);
  private toastr = inject(ToastrService);

  // Inputs
  isVisible = input.required<boolean>();
  companyId = input.required<number>();
  document = input<Document | null>(null);

  // Outputs
  close = output<void>();
  save = output<DocumentCreate>();
  update = output<{ id: number; data: DocumentCreate }>();

  documentForm!: FormGroup;
  readonly icons = { X, FileText };
  isSubmitting = signal(false);
  isEditMode = signal(false);
  selectedFile = signal<File | null>(null);
  isDragOver = signal(false);

  private readonly maxFileSizeBytes = 25 * 1024 * 1024; // 25MB

  constructor() {
    // Watch for document and visibility changes to populate form in edit mode
    effect(() => {
      const currentDocument = this.document();
      const isVisible = this.isVisible();

      if (isVisible && currentDocument) {
        this.isEditMode.set(true);
        setTimeout(() => {
          if (this.documentForm) {
            this.populateForm(currentDocument);
          }
        }, 0);
      } else if (isVisible && !currentDocument) {
        this.isEditMode.set(false);
        setTimeout(() => {
          if (this.documentForm) {
            this.documentForm.reset({
              title: '',
              report_date: '',
              description: '',
            });
            this.selectedFile.set(null);
          }
        }, 0);
      }
    });
  }

  ngOnInit() {
    this.documentForm = this.fb.group({
      title: ['', [Validators.required]],
      report_date: ['', [Validators.required]],
      description: [''],
    });

    // Initialize form if document is already set
    if (this.document() && this.isVisible()) {
      this.isEditMode.set(true);
      this.populateForm(this.document()!);
    }
  }

  populateForm(document: Document) {
    const reportDate = document.report_date
      ? new Date(document.report_date).toISOString().split('T')[0]
      : '';

    this.documentForm.patchValue({
      title: document.title || '',
      report_date: reportDate,
      description: document.description || '',
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.setFileFromFile(input.files[0]);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    this.setFileFromFile(files[0]);
  }

  private setFileFromFile(file: File) {
    const allowedExtensions = ['xlsx', 'pdf', 'csv', 'doc', 'docx'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      this.toastr.warning(
        'Solo se permiten archivos XLSX, PDF, CSV, DOC y DOCX',
        'Archivo no válido'
      );
      return;
    }

    if (file.size > this.maxFileSizeBytes) {
      this.toastr.warning(
        'El archivo no puede ser mayor a 25MB',
        'Archivo muy grande'
      );
      return;
    }

    this.selectedFile.set(file);
  }

  removeFile() {
    this.selectedFile.set(null);
    const fileInput = document.getElementById('document_file') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  async onSubmit() {
    if (this.documentForm.invalid) {
      this.documentForm.markAllAsTouched();
      return;
    }

    // In edit mode, file is optional
    if (!this.isEditMode() && !this.selectedFile()) {
      this.toastr.warning('Debe seleccionar un archivo', 'Archivo requerido');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const formValue = this.documentForm.value;
      const reportDate = formValue.report_date;

      const documentData: DocumentCreate = {
        company_id: this.companyId(),
        title: formValue.title.trim(),
        report_date: reportDate,
        description: formValue.description?.trim() || null,
      };

      if (this.isEditMode() && this.document()?.id) {
        // Update existing document - emit update, parent will handle file upload
        this.update.emit({
          id: this.document()!.id!,
          data: documentData,
        });
      } else {
        // Create new document - emit save with file info
        // The parent component will handle creation and file upload
        this.save.emit(documentData);
      }
    } catch (error: any) {
      console.error('Error in submit:', error);
      this.toastr.error(
        error?.error?.message || 'Error al guardar el documento',
        'Error'
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose() {
    this.documentForm.reset({
      title: '',
      report_date: '',
      description: '',
    });
    this.selectedFile.set(null);
    this.isEditMode.set(false);
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('modal')) {
      this.onClose();
    }
  }

  // Public method to get selected file
  getSelectedFile(): File | null {
    return this.selectedFile();
  }
}
