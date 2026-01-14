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

  getAll(params?: { company_id?: number; code?: string; name?: string }): Observable<OperationCategory[]> {
    let httpParams = new HttpParams();
    
    if (params?.company_id) {
      httpParams = httpParams.set('company_id', params.company_id.toString());
    }
    if (params?.code) {
      httpParams = httpParams.set('code', params.code);
    }
    if (params?.name) {
      httpParams = httpParams.set('name', params.name);
    }

    return this.http.get<OperationCategory[]>(
      `${this.apiUrl}/operation-budget-categories`,
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

  getByCompany(companyId: number): Observable<OperationCategory[]> {
    return this.getAll({ company_id: companyId });
  }

  search(companyId: number, searchTerm: string): Observable<OperationCategory[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.getByCompany(companyId);
    }

    const params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('name', searchTerm.trim());

    return this.http.get<OperationCategory[] | { data: OperationCategory[] }>(
      `${this.apiUrl}/operation-budget-categories`,
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
      `${this.apiUrl}/operation-budget-categories`,
      categoryData
    );
  }

  getById(id: number): Observable<OperationCategory> {
    return this.http.get<OperationCategory>(
      `${this.apiUrl}/operation-budget-categories/${id}`
    );
  }

  update(id: number, categoryData: Partial<OperationCategoryCreate>): Observable<OperationCategory> {
    return this.http.put<OperationCategory>(
      `${this.apiUrl}/operation-budget-categories/${id}`,
      categoryData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/operation-budget-categories/${id}`
    );
  }
}

