import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface Process {
  id?: number;
  company_id: number;
  docket_number: string;
  type: 'penal' | 'juridico';
  start_date: string;
  end_date?: string | null;
  description?: string | null;
  process_status_id?: number | null;
  process_status_date?: string | null;
  status_history?: Array<{
    id?: number;
    process_id?: number;
    process_status_id: number;
    user_id?: number;
    status_date?: string;
    created_at?: string;
    updated_at?: string;
  }>;
}

export interface ProcessCreate {
  company_id: number;
  docket_number: string;
  type: 'penal' | 'juridico';
  start_date: string;
  end_date?: string | null;
  description?: string | null;
  process_status_id?: number | null;
  process_status_date?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProcessService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(
    page: number = 1, 
    perPage: number = 15, 
    companyId?: number,
    dateFrom?: string,
    dateTo?: string
  ): Observable<PaginatedResponse<Process>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    
    if (companyId) {
      params = params.set('company_id', companyId.toString());
    }
    
    if (dateFrom) {
      params = params.set('date_from', dateFrom);
    }
    
    if (dateTo) {
      params = params.set('date_to', dateTo);
    }
    
    return this.http.get<PaginatedResponse<Process>>(
      `${this.apiUrl}/admin/reports/processes`,
      { params }
    );
  }

  getById(id: number): Observable<Process> {
    return this.http.get<Process>(`${this.apiUrl}/admin/reports/processes/${id}`);
  }

  create(processData: ProcessCreate): Observable<Process> {
    return this.http.post<Process>(
      `${this.apiUrl}/admin/reports/processes`,
      processData
    );
  }

  update(id: number, processData: Partial<ProcessCreate>): Observable<Process> {
    return this.http.put<Process>(
      `${this.apiUrl}/admin/reports/processes/${id}`,
      processData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/reports/processes/${id}`);
  }
}

