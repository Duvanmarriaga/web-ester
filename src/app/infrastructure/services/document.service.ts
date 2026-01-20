import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Document {
  id: number;
  company_id: number;
  title: string;
  report_date: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentCreate {
  company_id: number;
  title: string;
  report_date: string;
  description?: string | null;
}

export interface DocumentUpdate {
  title?: string;
  report_date?: string;
  description?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Lista todos los documentos con filtros opcionales
   */
  getAll(params?: {
    company_id?: number;
    date_from?: string;
    date_to?: string;
    title?: string;
    description?: string;
  }): Observable<Document[]> {
    let httpParams = new HttpParams();
    
    if (params?.company_id) {
      httpParams = httpParams.set('company_id', params.company_id.toString());
    }
    if (params?.date_from) {
      httpParams = httpParams.set('date_from', params.date_from);
    }
    if (params?.date_to) {
      httpParams = httpParams.set('date_to', params.date_to);
    }
    if (params?.title) {
      httpParams = httpParams.set('title', params.title);
    }
    if (params?.description) {
      httpParams = httpParams.set('description', params.description);
    }

    return this.http.get<Document[]>(`${this.apiUrl}/documents`, { params: httpParams });
  }

  /**
   * Obtiene un documento por su ID
   */
  getById(id: number): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/documents/${id}`);
  }

  /**
   * Crea un nuevo documento
   */
  create(document: DocumentCreate): Observable<Document> {
    return this.http.post<Document>(`${this.apiUrl}/documents`, document);
  }

  /**
   * Actualiza un documento existente
   */
  update(id: number, document: DocumentUpdate): Observable<Document> {
    return this.http.put<Document>(`${this.apiUrl}/documents/${id}`, document);
  }

  /**
   * Elimina un documento
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documents/${id}`);
  }
}
