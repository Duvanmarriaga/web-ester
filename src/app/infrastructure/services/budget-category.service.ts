import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BudgetCategory {
  id: number;
  code: string;
  name: string;
  company_id: number;
}

export interface BudgetCategoryCreate {
  code: string;
  name: string;
  company_id: number;
}

export interface BudgetCategoryUpdate {
  code?: string;
  name?: string;
  company_id?: number;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetCategoryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(params?: { code?: string; company_id?: number; name?: string }): Observable<BudgetCategory[]> {
    let httpParams = new HttpParams();
    
    if (params?.code) {
      httpParams = httpParams.set('code', params.code);
    }
    if (params?.company_id) {
      httpParams = httpParams.set('company_id', params.company_id.toString());
    }
    if (params?.name) {
      httpParams = httpParams.set('name', params.name);
    }

    return this.http.get<BudgetCategory[]>(
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

  getById(id: number): Observable<BudgetCategory> {
    return this.http.get<BudgetCategory>(
      `${this.apiUrl}/operation-budget-categories/${id}`
    );
  }

  getByCompany(companyId: number): Observable<BudgetCategory[]> {
    return this.getAll({ company_id: companyId });
  }

  search(companyId: number, searchTerm: string): Observable<BudgetCategory[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.getByCompany(companyId);
    }

    const params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('name', searchTerm.trim());

    return this.http.get<BudgetCategory[] | { data: BudgetCategory[] }>(
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

  create(categoryData: BudgetCategoryCreate): Observable<BudgetCategory> {
    return this.http.post<BudgetCategory>(
      `${this.apiUrl}/operation-budget-categories`,
      categoryData
    );
  }

  update(id: number, categoryData: BudgetCategoryUpdate): Observable<BudgetCategory> {
    return this.http.put<BudgetCategory>(
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

