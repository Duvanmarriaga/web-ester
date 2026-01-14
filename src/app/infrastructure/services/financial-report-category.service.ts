import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FinancialReportCategory {
  id: number;
  name: string;
  company_id: number;
}

export interface FinancialReportCategoryCreate {
  name: string;
  company_id: number;
}

@Injectable({
  providedIn: 'root',
})
export class FinancialReportCategoryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(params?: { company_id?: number; name?: string }): Observable<FinancialReportCategory[]> {
    let httpParams = new HttpParams();
    
    if (params?.company_id) {
      httpParams = httpParams.set('company_id', params.company_id.toString());
    }
    if (params?.name) {
      httpParams = httpParams.set('name', params.name);
    }

    return this.http.get<FinancialReportCategory[]>(
      `${this.apiUrl}/financial-report-categories`,
      { params: httpParams }
    ).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        }
        if (response && typeof response === 'object' && 'data' in response) {
          return Array.isArray((response as any).data) ? (response as any).data : [];
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  getByCompany(companyId: number): Observable<FinancialReportCategory[]> {
    return this.getAll({ company_id: companyId });
  }

  search(companyId: number, searchTerm: string): Observable<FinancialReportCategory[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.getByCompany(companyId);
    }

    const params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('name', searchTerm.trim());

    return this.http.get<FinancialReportCategory[] | { data: FinancialReportCategory[] }>(
      `${this.apiUrl}/financial-report-categories`,
      { params }
    ).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          return response;
        }
        if (response && typeof response === 'object' && 'data' in response) {
          return Array.isArray((response as any).data) ? (response as any).data : [];
        }
        return [];
      }),
      catchError(() => of([]))
    );
  }

  create(categoryData: FinancialReportCategoryCreate): Observable<FinancialReportCategory> {
    return this.http.post<FinancialReportCategory>(
      `${this.apiUrl}/financial-report-categories`,
      categoryData
    );
  }

  update(id: number, categoryData: Partial<FinancialReportCategoryCreate>): Observable<FinancialReportCategory> {
    return this.http.put<FinancialReportCategory>(
      `${this.apiUrl}/financial-report-categories/${id}`,
      categoryData
    );
  }
}

