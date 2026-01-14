import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface FinancialReport {
  id?: number;
  company_id: number;
  financial_report_category_id?: number | null;
  report_date: string;
  current_asset?: number;
  current_passive?: number;
  inventories?: number;
  total_passive?: number;
  total_assets?: number;
  net_profit?: number;
  total_revenue?: number;
  current_value_result?: number;
  initial_value_of_the_year?: number;
  budgeted_value?: number;
  executed_value?: number;
  current_cash_balance?: number;
  average_consumption_of_boxes_over_the_last_3_months?: number;
  user_id?: number;
}

export interface FinancialReportCreate {
  company_id: number;
  financial_report_category_id?: number | null;
  report_date: string;
  current_asset?: number;
  current_passive?: number;
  inventories?: number;
  total_passive?: number;
  total_assets?: number;
  net_profit?: number;
  total_revenue?: number;
  current_value_result?: number;
  initial_value_of_the_year?: number;
  budgeted_value?: number;
  executed_value?: number;
  current_cash_balance?: number;
  average_consumption_of_boxes_over_the_last_3_months?: number;
}

@Injectable({
  providedIn: 'root',
})
export class FinancialReportService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(
    page: number = 1,
    perPage: number = 15,
    companyId?: number,
    dateFrom?: string,
    dateTo?: string
  ): Observable<PaginatedResponse<FinancialReport>> {
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

    return this.http.get<PaginatedResponse<FinancialReport>>(
      `${this.apiUrl}/financial-reports`,
      { params }
    );
  }

  getById(id: number): Observable<FinancialReport> {
    return this.http.get<FinancialReport>(
      `${this.apiUrl}/financial-reports/${id}`
    );
  }

  create(reportData: FinancialReportCreate): Observable<FinancialReport> {
    return this.http.post<FinancialReport>(
      `${this.apiUrl}/financial-reports`,
      reportData
    );
  }

  update(
    id: number,
    reportData: Partial<FinancialReportCreate>
  ): Observable<FinancialReport> {
    return this.http.put<FinancialReport>(
      `${this.apiUrl}/financial-reports/${id}`,
      reportData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/financial-reports/${id}`
    );
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/financial-reports/template/download`,
      { responseType: 'blob' }
    );
  }

  import(file: File): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message?: string }>(
      `${this.apiUrl}/financial-reports/import`,
      formData
    );
  }

  createMultiple(
    reports: FinancialReportCreate[]
  ): Observable<FinancialReport[]> {
    return this.http.post<FinancialReport[]>(
      `${this.apiUrl}/financial-reports/multiple`,
      { reports }
    );
  }

  checkDateExists(
    companyId: number,
    reportDate: string,
    excludeId?: number
  ): Observable<boolean> {
    // Convert YYYY-MM-DD to date range (same day for date_from and date_to)
    let params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('date_from', reportDate)
      .set('date_to', reportDate)
      .set('per_page', '100'); // Get enough to check for duplicates

    return this.http
      .get<PaginatedResponse<FinancialReport>>(
        `${this.apiUrl}/financial-reports`,
        { params }
      )
      .pipe(
        map((response) => {
          if (excludeId) {
            // In edit mode, check if there's any report with this date that is NOT the current one
            return response.data.some(
              (report) =>
                report.id !== excludeId &&
                report.report_date.startsWith(reportDate.substring(0, 7))
            );
          }
          // In create mode, check if any report exists with this date
          return response.data.some((report) =>
            report.report_date.startsWith(reportDate.substring(0, 7))
          );
        })
      );
  }
}
