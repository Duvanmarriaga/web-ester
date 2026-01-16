import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReportFile {
  id: number;
  table_name: string;
  record_id: number;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class FileService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Obtiene todos los archivos asociados a un registro específico
   * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
   * @param recordId ID del registro
   */
  getAll(tableName: string, recordId: number): Observable<ReportFile[]> {
    const params = new HttpParams()
      .set('table_name', tableName)
      .set('record_id', recordId.toString());
    return this.http.get<ReportFile[]>(`${this.apiUrl}/files`, { params });
  }

  /**
   * Sube un archivo asociado a un registro
   * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
   * @param recordId ID del registro
   * @param file Archivo a subir (XLSX, PDF, CSV)
   */
  upload(
    tableName: string,
    recordId: number,
    file: File
  ): Observable<ReportFile> {
    const formData = new FormData();
    formData.append('table_name', tableName);
    formData.append('record_id', recordId.toString());
    formData.append('document', file);

    return this.http.post<ReportFile>(`${this.apiUrl}/files`, formData);
  }

  /**
   * Descarga un archivo por su ID
   * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
   * @param id ID del archivo
   */
  download(tableName: string, id: number): Observable<Blob> {
    const params = new HttpParams()
      .set('table_name', tableName)
      .set('id', id.toString());
    return this.http.get(`${this.apiUrl}/files/download`, {
      params,
      responseType: 'blob',
    });
  }

  /**
   * Elimina un archivo por su ID
   * @param tableName Nombre de la tabla (operation_budgets, investment_budgets, financial_reports, processes)
   * @param id ID del archivo
   */
  delete(tableName: string, id: number): Observable<{ message: string }> {
    const params = new HttpParams().set('table_name', tableName);
    return this.http.delete<{ message: string }>(`${this.apiUrl}/files/${id}`, {
      params,
    });
  }

  getValidTables(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/files/tables`);
  }
}
