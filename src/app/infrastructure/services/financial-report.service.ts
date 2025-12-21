import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface FinancialReport {
  id?: number;
  company_id: number;
  report_date: string;
  income: number;
  expenses: number;
  profit: number;
  user_id: number;
  document_origin?: string | null;
}

export interface FinancialReportCreate {
  company_id: number;
  report_date: string;
  income: number;
  expenses: number;
  profit: number;
  user_id: number;
  document_origin?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class FinancialReportService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(page: number = 1, perPage: number = 15, companyId?: number): Observable<PaginatedResponse<FinancialReport>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    
    if (companyId) {
      params = params.set('company_id', companyId.toString());
    }
    
    return this.http.get<PaginatedResponse<FinancialReport>>(
      `${this.apiUrl}/admin/reports/financial-reports`,
      { params }
    );
  }

  getById(id: number): Observable<FinancialReport> {
    return this.http.get<FinancialReport>(`${this.apiUrl}/admin/reports/financial-reports/${id}`);
  }

  create(reportData: FinancialReportCreate): Observable<FinancialReport> {
    return this.http.post<FinancialReport>(
      `${this.apiUrl}/admin/reports/financial-reports`,
      reportData
    );
  }

  update(id: number, reportData: Partial<FinancialReportCreate>): Observable<FinancialReport> {
    return this.http.put<FinancialReport>(
      `${this.apiUrl}/admin/reports/financial-reports/${id}`,
      reportData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/reports/financial-reports/${id}`);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/admin/reports/financial-reports/template/download`,
      { responseType: 'blob' }
    );
  }

  import(file: File): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message?: string }>(`${this.apiUrl}/admin/reports/financial-reports/import`, formData);
  }

  createMultiple(reports: FinancialReportCreate[]): Observable<FinancialReport[]> {
    return this.http.post<FinancialReport[]>(
      `${this.apiUrl}/admin/reports/financial-reports/multiple`,
      { reports }
    );
  }

  checkDateExists(companyId: number, reportDate: string, excludeId?: number): Observable<boolean> {
    // Convert YYYY-MM-DD to date range (same day for date_from and date_to)
    let params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('date_from', reportDate)
      .set('date_to', reportDate)
      .set('per_page', '100'); // Get enough to check for duplicates
    
    return this.http.get<PaginatedResponse<FinancialReport>>(
      `${this.apiUrl}/admin/reports/financial-reports`,
      { params }
    ).pipe(
      map((response) => {
        if (excludeId) {
          // In edit mode, check if there's any report with this date that is NOT the current one
          return response.data.some(report => report.id !== excludeId && report.report_date.startsWith(reportDate.substring(0, 7)));
        }
        // In create mode, check if any report exists with this date
        return response.data.some(report => report.report_date.startsWith(reportDate.substring(0, 7)));
      })
    );
  }
}

