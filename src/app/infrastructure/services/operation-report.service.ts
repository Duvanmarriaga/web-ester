import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface OperationReport {
  id?: number;
  operation_budget_category_id: number;
  company_id: number;
  operation_budget_annual_id?: number | null;
  budget_date: string;
  budget_amount: number;
  executed_amount: number;
  difference_amount: number;
  percentage: number;
  user_id?: number;
}

export interface OperationReportCreate {
  operation_budget_category_id: number;
  company_id: number;
  operation_budget_annual_id?: number | null;
  budget_date: string;
  budget_amount: number;
  executed_amount: number;
  difference_amount: number;
  percentage: number;
}

@Injectable({
  providedIn: 'root',
})
export class OperationReportService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(
    page: number = 1, 
    perPage: number = 50, 
    companyId?: number,
    dateFrom?: string,
    dateTo?: string
  ): Observable<PaginatedResponse<OperationReport>> {
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
    
    return this.http.get<PaginatedResponse<OperationReport>>(
      `${this.apiUrl}/operation-budgets`,
      { params }
    );
  }

  getById(id: number): Observable<OperationReport> {
    return this.http.get<OperationReport>(`${this.apiUrl}/operation-budgets/${id}`);
  }

  create(reportData: OperationReportCreate): Observable<OperationReport> {
    return this.http.post<OperationReport>(
      `${this.apiUrl}/operation-budgets`,
      reportData
    );
  }

  update(id: number, reportData: Partial<OperationReportCreate>): Observable<OperationReport> {
    return this.http.put<OperationReport>(
      `${this.apiUrl}/operation-budgets/${id}`,
      reportData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/operation-budgets/${id}`);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/operation-budgets/template/download`,
      { responseType: 'blob' }
    );
  }

  import(file: File): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message?: string }>(`${this.apiUrl}/operation-budgets/import`, formData);
  }

  checkDateExists(companyId: number, budgetDate: string, excludeId?: number): Observable<boolean> {
    let params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('date_from', budgetDate)
      .set('date_to', budgetDate)
      .set('per_page', '100');
    
    return this.http.get<PaginatedResponse<OperationReport>>(
      `${this.apiUrl}/operation-budgets`,
      { params }
    ).pipe(
      map((response) => {
        if (excludeId) {
          return response.data.some(report => report.id !== excludeId && report.budget_date.startsWith(budgetDate.substring(0, 7)));
        }
        return response.data.some(report => report.budget_date.startsWith(budgetDate.substring(0, 7)));
      })
    );
  }
}

