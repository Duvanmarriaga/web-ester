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

  getAll(recordId: number): Observable<ReportFile[]> {
    const params = new HttpParams().set('record_id', recordId.toString());
    return this.http.get<ReportFile[]>(
      `${this.apiUrl}/files`,
      { params }
    );
  }

  upload(tableName: string, recordId: number, file: File): Observable<ReportFile> {
    const formData = new FormData();
    formData.append('table_name', tableName);
    formData.append('record_id', recordId.toString());
    formData.append('document', file);
    
    return this.http.post<ReportFile>(
      `${this.apiUrl}/files`,
      formData
    );
  }

  download(id: number): Observable<Blob> {
    const params = new HttpParams().set('id', id.toString());
    return this.http.get(
      `${this.apiUrl}/files/download`,
      { params, responseType: 'blob' }
    );
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/files/${id}`
    );
  }

  getValidTables(): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.apiUrl}/files/tables`
    );
  }
}
