import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  FileText,
  Plus,
  Trash2,
  Download,
} from 'lucide-angular';
import {
  DocumentService,
  DocumentCreate,
  Document,
} from '../../../../../infrastructure/services/document.service';
import { DocumentModalComponent } from '../../../../shared/document-modal/document-modal.component';
import { ToastrService } from 'ngx-toastr';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';
import { FileService, ReportFile } from '../../../../../infrastructure/services/file.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    DocumentModalComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
})
export class DocumentsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private documentService = inject(DocumentService);
  private fileService = inject(FileService);
  private toastr = inject(ToastrService);

  readonly icons = {
    FileText,
    Plus,
    Trash2,
    Download,
  };

  companyId = signal<number | null>(null);
  showModal = signal(false);
  documents = signal<Document[]>([]);
  isLoading = signal(false);
  selectedDocument = signal<Document | null>(null);
  showConfirmDialog = signal(false);
  deletingDocument = signal<Document | null>(null);
  documentModalComponent = viewChild<DocumentModalComponent>('documentModal');

  ngOnInit() {
    // Get company ID from route
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadDocuments();
      }
    });
  }


  loadDocuments() {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.documentService
      .getAll({ company_id: companyId })
      .subscribe({
        next: (documents) => {
          this.documents.set(documents);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Error loading documents:', error);
          this.toastr.error('Error al cargar los documentos', 'Error');
          this.isLoading.set(false);
        },
      });
  }

  openCreateModal() {
    this.selectedDocument.set(null);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.selectedDocument.set(null);
  }

  async onSaveDocument(documentData: DocumentCreate) {
    try {
      const createdDocument = await firstValueFrom(
        this.documentService.create(documentData)
      );

      // Upload file if document was created and file was selected
      const modalComponent = this.documentModalComponent();
      if (modalComponent && createdDocument.id) {
        // Access the selected file from the modal
        const selectedFile = modalComponent.getSelectedFile();
        if (selectedFile) {
          try {
            await firstValueFrom(
              this.fileService.upload('documents', createdDocument.id, selectedFile)
            );
          } catch (fileError) {
            console.error('Error uploading file:', fileError);
            this.toastr.warning(
              'Documento creado pero hubo un error al subir el archivo',
              'Advertencia'
            );
          }
        }
      }

      this.toastr.success('Documento creado correctamente', 'Éxito');
      this.closeModal();
      this.loadDocuments();
    } catch (error: any) {
      console.error('Error creating document:', error);
      this.toastr.error(
        error?.error?.message || 'Error al crear el documento',
        'Error'
      );
    }
  }

  async onUpdateDocument({
    id,
    data,
  }: {
    id: number;
    data: DocumentCreate;
  }) {
    try {
      await firstValueFrom(this.documentService.update(id, data));

      // Upload file if a new one was selected
      const modalComponent = this.documentModalComponent();
      if (modalComponent) {
        const selectedFile = modalComponent.getSelectedFile();
        if (selectedFile) {
          try {
            await firstValueFrom(
              this.fileService.upload('documents', id, selectedFile)
            );
          } catch (fileError) {
            console.error('Error uploading file:', fileError);
            this.toastr.warning(
              'Documento actualizado pero hubo un error al subir el archivo',
              'Advertencia'
            );
          }
        }
      }

      this.toastr.success('Documento actualizado correctamente', 'Éxito');
      this.closeModal();
      this.loadDocuments();
    } catch (error: any) {
      console.error('Error updating document:', error);
      this.toastr.error(
        error?.error?.message || 'Error al actualizar el documento',
        'Error'
      );
    }
  }

  deleteDocument(document: Document) {
    this.deletingDocument.set(document);
    this.showConfirmDialog.set(true);
  }

  async onConfirmDelete() {
    const document = this.deletingDocument();
    if (!document?.id) return;

    try {
      await firstValueFrom(this.documentService.delete(document.id));
      this.toastr.success('Documento eliminado correctamente', 'Éxito');
      this.showConfirmDialog.set(false);
      this.deletingDocument.set(null);
      this.loadDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      this.toastr.error(
        error?.error?.message || 'Error al eliminar el documento',
        'Error'
      );
      this.showConfirmDialog.set(false);
    }
  }

  onCancelDelete() {
    this.showConfirmDialog.set(false);
    this.deletingDocument.set(null);
  }

  getDeleteMessage(): string {
    const document = this.deletingDocument();
    if (!document) return '';
    return `¿Está seguro de que desea eliminar el documento "${document.title}"? Esta acción no se puede deshacer.`;
  }

  async downloadDocument(doc: Document) {
    if (!doc.id) return;

    try {
      // First, get the files associated with this document
      const files = await firstValueFrom(
        this.fileService.getAll('documents', doc.id)
      );

      if (files.length === 0) {
        this.toastr.warning('No hay archivos asociados a este documento', 'Advertencia');
        return;
      }

      // Download the first file (since each document has one file)
      const file = files[0];
      const blob = await firstValueFrom(
        this.fileService.download('documents', file.id)
      );

      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = file.name || `documento-${doc.id}`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      this.toastr.success('Archivo descargado correctamente', 'Éxito');
    } catch (error) {
      console.error('Error downloading document:', error);
      this.toastr.error('Error al descargar el archivo', 'Error');
    }
  }
}
