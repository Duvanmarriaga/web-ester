import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InvestmentCategory {
  id: number;
  code: string;
  name: string;
  company_id: number;
}

export interface InvestmentCategoryCreate {
  code: string;
  name: string;
  company_id: number;
}

export interface InvestmentCategoryUpdate {
  code?: string;
  name?: string;
  company_id?: number;
}

@Injectable({
  providedIn: 'root',
})
export class InvestmentCategoryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(params?: { company_id?: number; code?: string; name?: string }): Observable<InvestmentCategory[]> {
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

    return this.http.get<InvestmentCategory[]>(
      `${this.apiUrl}/investment-budget-categories`,
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

  getById(id: number): Observable<InvestmentCategory> {
    return this.http.get<InvestmentCategory>(
      `${this.apiUrl}/investment-budget-categories/${id}`
    );
  }

  getByCompany(companyId: number): Observable<InvestmentCategory[]> {
    return this.http.get<InvestmentCategory[]>(
      `${this.apiUrl}/companies/${companyId}/investment-budget-categories`
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

  search(companyId: number, searchTerm: string): Observable<InvestmentCategory[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.getByCompany(companyId);
    }

    const params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('name', searchTerm.trim());

    return this.http.get<InvestmentCategory[] | { data: InvestmentCategory[] }>(
      `${this.apiUrl}/investment-budget-categories`,
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

  create(categoryData: InvestmentCategoryCreate): Observable<InvestmentCategory> {
    return this.http.post<InvestmentCategory>(
      `${this.apiUrl}/investment-budget-categories`,
      categoryData
    );
  }

  update(id: number, categoryData: InvestmentCategoryUpdate): Observable<InvestmentCategory> {
    return this.http.put<InvestmentCategory>(
      `${this.apiUrl}/investment-budget-categories/${id}`,
      categoryData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/investment-budget-categories/${id}`
    );
  }

  // Método para obtener presupuestos anuales de inversión
  getAnnuals(companyId: number, year?: number): Observable<any[]> {
    let params = new HttpParams().set('company_id', companyId.toString());
    if (year) {
      params = params.set('year', year.toString());
    }
    return this.http.get<any[]>(
      `${this.apiUrl}/investment-budget-annuals`,
      { params }
    );
  }

  createAnnual(annualData: { company_id: number; year: number; amount: number }): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/investment-budget-annuals`,
      annualData
    );
  }

  updateAnnual(id: number, annualData: { year?: number; amount?: number }): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/investment-budget-annuals/${id}`,
      annualData
    );
  }

  deleteAnnual(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/investment-budget-annuals/${id}`
    );
  }

  getAnnualById(id: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/investment-budget-annuals/${id}`
    );
  }
}

