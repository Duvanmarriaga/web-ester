import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OperationCategory {
  id: number;
  code: string;
  name: string;
  company_id: number;
}

export interface OperationCategoryCreate {
  code: string;
  name: string;
  company_id: number;
}

@Injectable({
  providedIn: 'root',
})
export class OperationCategoryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getByCompany(companyId: number): Observable<OperationCategory[]> {
    return this.http.get<OperationCategory[]>(
      `${this.apiUrl}/admin/reports/companies/${companyId}/operation-categories`
    ).pipe(
      map((response) => {
        // Handle both array and object with data property
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

  search(companyId: number, searchTerm: string): Observable<OperationCategory[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.getByCompany(companyId);
    }

    const params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('name', searchTerm.trim());

    return this.http.get<OperationCategory[] | { data: OperationCategory[] }>(
      `${this.apiUrl}/admin/reports/operation-categories`,
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

  create(categoryData: OperationCategoryCreate): Observable<OperationCategory> {
    return this.http.post<OperationCategory>(
      `${this.apiUrl}/admin/reports/operation-categories`,
      categoryData
    );
  }
}

