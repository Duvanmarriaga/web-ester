import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface OperationReport {
  id?: number;
  operation_category_id: number;
  company_id: number;
  operation_date: string;
  description: string;
  monthly_cost: number;
  annual_cost: number;
  user_id: number;
  document_origin?: string | null;
}

export interface OperationReportCreate {
  operation_category_id: number;
  company_id: number;
  operation_date: string;
  description: string;
  monthly_cost: number;
  annual_cost: number;
  user_id: number;
  document_origin?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class OperationReportService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(page: number = 1, perPage: number = 15, companyId?: number): Observable<PaginatedResponse<OperationReport>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    
    if (companyId) {
      params = params.set('company_id', companyId.toString());
    }
    
    return this.http.get<PaginatedResponse<OperationReport>>(
      `${this.apiUrl}/admin/reports/operations`,
      { params }
    );
  }

  getById(id: number): Observable<OperationReport> {
    return this.http.get<OperationReport>(`${this.apiUrl}/admin/reports/operations/${id}`);
  }

  create(reportData: OperationReportCreate): Observable<OperationReport> {
    return this.http.post<OperationReport>(
      `${this.apiUrl}/admin/reports/operations`,
      reportData
    );
  }

  update(id: number, reportData: Partial<OperationReportCreate>): Observable<OperationReport> {
    return this.http.put<OperationReport>(
      `${this.apiUrl}/admin/reports/operations/${id}`,
      reportData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/reports/operations/${id}`);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/admin/reports/operations/template/download`,
      { responseType: 'blob' }
    );
  }

  import(file: File): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message?: string }>(`${this.apiUrl}/admin/reports/operations/import`, formData);
  }

  checkDateExists(companyId: number, operationDate: string, excludeId?: number): Observable<boolean> {
    let params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('date_from', operationDate)
      .set('date_to', operationDate)
      .set('per_page', '100');
    
    return this.http.get<PaginatedResponse<OperationReport>>(
      `${this.apiUrl}/admin/reports/operations`,
      { params }
    ).pipe(
      map((response) => {
        if (excludeId) {
          return response.data.some(report => report.id !== excludeId && report.operation_date.startsWith(operationDate.substring(0, 7)));
        }
        return response.data.some(report => report.operation_date.startsWith(operationDate.substring(0, 7)));
      })
    );
  }
}

