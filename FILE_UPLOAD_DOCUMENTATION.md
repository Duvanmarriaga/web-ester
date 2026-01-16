# Documentación del Sistema de Carga de Archivos

## Descripción General

El sistema de carga de archivos permite asociar documentos (XLSX, PDF, CSV) a registros específicos en diferentes módulos de la aplicación. Todos los archivos se gestionan a través de la API con endpoints centralizados.

## Nombres de Tabla Requeridos

Cada módulo utiliza un nombre de tabla específico que debe ser enviado en todas las operaciones de archivo:

| Módulo | Table Name | Descripción |
|--------|-----------|-------------|
| Presupuestos de Operación | `operation_budgets` | Archivos asociados a presupuestos de operación |
| Presupuestos de Inversión | `investment_budgets` | Archivos asociados a presupuestos de inversión |
| Reportes Financieros | `financial_reports` | Archivos asociados a reportes financieros |
| Procesos Jurídicos | `processes` | Archivos asociados a procesos legales |

## Endpoints de la API

### 1. Listar Archivos
**GET** `/api/files`

**Parámetros Query:**
- `table_name` (string, requerido): Nombre de la tabla
- `record_id` (number, requerido): ID del registro

**Ejemplo:**
```
GET /api/files?table_name=operation_budgets&record_id=123
```

---

### 2. Subir Archivo
**POST** `/api/files`

**Body (FormData):**
- `table_name` (string, requerido): Nombre de la tabla
- `record_id` (number, requerido): ID del registro
- `document` (File, requerido): Archivo a subir

**Tipos de archivo permitidos:**
- `.xlsx` - Excel
- `.pdf` - PDF
- `.csv` - CSV

**Ejemplo:**
```typescript
const formData = new FormData();
formData.append('table_name', 'operation_budgets');
formData.append('record_id', '123');
formData.append('document', file);
```

---

### 3. Descargar Archivo
**GET** `/api/files/download`

**Parámetros Query:**
- `table_name` (string, requerido): Nombre de la tabla
- `id` (number, requerido): ID del archivo

**Ejemplo:**
```
GET /api/files/download?table_name=operation_budgets&id=456
```

---

### 4. Eliminar Archivo
**DELETE** `/api/files/{id}`

**Parámetros Query:**
- `table_name` (string, requerido): Nombre de la tabla

**Parámetros URL:**
- `id` (number, requerido): ID del archivo

**Ejemplo:**
```
DELETE /api/files/456?table_name=operation_budgets
```

---

## Uso del Componente FileUpload

### Integración en Modales

El componente `FileUploadComponent` se integra en cada modal de la siguiente manera:

```html
<app-file-upload
  #fileUpload
  [tableName]="'operation_budgets'"
  [recordId]="currentRecordId()"
  [disabled]="isSubmitting()"
></app-file-upload>
```

### Parámetros del Componente

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `tableName` | string (requerido) | Nombre de la tabla correspondiente al módulo |
| `recordId` | number \| null | ID del registro. Null cuando se está creando un nuevo registro |
| `disabled` | boolean | Deshabilita la interacción con el componente |

### Referencia del Componente en TypeScript

```typescript
// 1. Importar en el componente
import { FileUploadComponent } from '../file-upload/file-upload.component';

// 2. Agregar a imports
@Component({
  imports: [
    // ... otros imports
    FileUploadComponent,
  ],
})

// 3. Crear referencia con viewChild
fileUploadComponent = viewChild<FileUploadComponent>('fileUpload');

// 4. Agregar signal para el ID actual
currentRecordId = signal<number | null>(null);

// 5. Actualizar el ID cuando se carga un registro existente
populateForm(record: Record): void {
  this.currentRecordId.set(record.id || null);
  // ... resto del código
}

// 6. Limpiar al cerrar el modal
onClose() {
  this.currentRecordId.set(null);
  const fileUpload = this.fileUploadComponent();
  if (fileUpload) {
    fileUpload.clearPendingFiles();
  }
  this.close.emit();
}

// 7. Subir archivos después de actualizar
async onSubmit() {
  try {
    if (this.isEditMode() && this.record()?.id) {
      this.update.emit({
        id: this.record()!.id!,
        data: recordData,
      });
      
      // Upload pending files after update
      const fileUpload = this.fileUploadComponent();
      if (fileUpload) {
        await fileUpload.uploadPendingFiles(this.record()!.id!);
      }
    } else {
      // For new records, emit save and let parent handle file upload
      this.save.emit(recordData);
    }
  } catch (error) {
    console.error('Error in submit:', error);
  }
}

// 8. Método público para subir archivos después de crear
async uploadFilesForNewRecord(recordId: number): Promise<boolean> {
  const fileUpload = this.fileUploadComponent();
  if (fileUpload) {
    return await fileUpload.uploadPendingFiles(recordId);
  }
  return true;
}
```

### Integración en Componente Padre

```typescript
// 1. Agregar referencia al modal
modalComponent = viewChild<RecordModalComponent>('recordModal');

// 2. Actualizar método onSave para manejar archivos
async onSaveRecord(recordData: RecordCreate): Promise<void> {
  this.recordService.create(recordData).subscribe({
    next: async (createdRecord) => {
      this.toastr.success('Registro creado correctamente', 'Éxito');
      
      // Upload pending files for the new record
      const modalComponent = this.modalComponent();
      if (modalComponent && createdRecord.id) {
        await modalComponent.uploadFilesForNewRecord(createdRecord.id);
      }
      
      this.closeModal();
      this.loadRecords();
    },
    error: (error) => {
      this.toastr.error('Error al crear el registro', 'Error');
    },
  });
}
```

### Template del Componente Padre

```html
<app-record-modal
  #recordModal
  [isVisible]="showModal()"
  [companyId]="companyId()!"
  [record]="selectedRecord()"
  (close)="closeModal()"
  (save)="onSaveRecord($event)"
  (update)="onUpdateRecord($event)"
></app-record-modal>
```

---

## Flujo de Trabajo

### Creación de Nuevo Registro

1. Usuario abre modal de creación
2. Usuario completa formulario
3. Usuario selecciona archivos (quedan como "pendientes")
4. Usuario hace clic en "Guardar"
5. Se crea el registro en la base de datos
6. Se obtiene el ID del nuevo registro
7. Se suben todos los archivos pendientes asociándolos al nuevo ID
8. Se muestra mensaje de éxito

### Edición de Registro Existente

1. Usuario abre modal de edición
2. Se cargan los archivos existentes del registro
3. Usuario puede:
   - Ver archivos existentes
   - Descargar archivos existentes
   - Eliminar archivos existentes
   - Agregar nuevos archivos (quedan como "pendientes")
4. Usuario hace clic en "Actualizar"
5. Se actualiza el registro en la base de datos
6. Se suben todos los archivos pendientes
7. Se muestra mensaje de éxito

---

## Características del Componente

### Validación de Archivos
- Solo acepta archivos con extensiones: `.xlsx`, `.pdf`, `.csv`
- Valida tanto por extensión como por tipo MIME
- Muestra mensaje de error para archivos no válidos

### Visualización
- **PDF**: Icono rojo de archivo
- **XLSX**: Icono verde de archivo
- **CSV**: Icono azul de documento de texto

### Estados
- **Archivos Existentes**: Fondo blanco, botones de descarga y eliminar
- **Archivos Pendientes**: Fondo amarillo claro con indicador "Pendiente de subir"
- **Cargando**: Spinner mientras se cargan/suben/eliminan archivos

### Acciones Disponibles
- **Cargar**: Abre selector de archivos (múltiple)
- **Descargar**: Descarga el archivo seleccionado
- **Eliminar**: Elimina archivo (con confirmación)

---

## Métodos del FileService

### getAll(tableName: string, recordId: number)
```typescript
/**
 * Obtiene todos los archivos asociados a un registro específico
 * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
 * @param recordId ID del registro
 */
```

### upload(tableName: string, recordId: number, file: File)
```typescript
/**
 * Sube un archivo asociado a un registro
 * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
 * @param recordId ID del registro
 * @param file Archivo a subir (XLSX, PDF, CSV)
 */
```

### download(tableName: string, id: number)
```typescript
/**
 * Descarga un archivo por su ID
 * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
 * @param id ID del archivo
 */
```

### delete(tableName: string, id: number)
```typescript
/**
 * Elimina un archivo por su ID
 * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
 * @param id ID del archivo
 */
```

---

## Notas Importantes

1. **Todos los métodos requieren `table_name`**: Es obligatorio enviar el nombre de la tabla en todas las operaciones (listar, subir, descargar, eliminar).

2. **Archivos pendientes**: Los archivos seleccionados antes de guardar el registro se mantienen en memoria hasta que se complete la creación del registro.

3. **Validación de tipos**: Solo se aceptan archivos XLSX, PDF y CSV. Cualquier otro tipo será rechazado.

4. **Confirmación de eliminación**: Al eliminar un archivo existente, se solicita confirmación al usuario.

5. **Manejo de errores**: Todos los errores se capturan y se muestran mediante toastr notifications.

6. **Responsividad**: El componente se adapta correctamente a diferentes tamaños de pantalla.

---

## Ejemplos de Uso Completos

### Presupuestos de Operación
```html
<app-file-upload
  #fileUpload
  [tableName]="'operation_budgets'"
  [recordId]="currentBudgetId()"
  [disabled]="isSubmitting()"
></app-file-upload>
```

### Presupuestos de Inversión
```html
<app-file-upload
  #fileUpload
  [tableName]="'investment_budgets'"
  [recordId]="currentInvestmentId()"
  [disabled]="isSubmitting()"
></app-file-upload>
```

### Reportes Financieros
```html
<app-file-upload
  #fileUpload
  [tableName]="'financial_reports'"
  [recordId]="currentReportId()"
  [disabled]="isSubmitting()"
></app-file-upload>
```

### Procesos Jurídicos
```html
<app-file-upload
  #fileUpload
  [tableName]="'processes'"
  [recordId]="currentProcessId()"
  [disabled]="isSubmitting()"
></app-file-upload>
```
