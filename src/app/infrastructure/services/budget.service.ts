import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface Budget {
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

export interface BudgetCreate {
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
export class BudgetService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(
    page: number = 1, 
    perPage: number = 15, 
    companyId?: number,
    dateFrom?: string,
    dateTo?: string
  ): Observable<PaginatedResponse<Budget>> {
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
    
    return this.http.get<PaginatedResponse<Budget>>(
      `${this.apiUrl}/operation-budgets`,
      { params }
    );
  }

  getById(id: number): Observable<Budget> {
    return this.http.get<Budget>(`${this.apiUrl}/operation-budgets/${id}`);
  }

  create(budgetData: BudgetCreate): Observable<Budget> {
    return this.http.post<Budget>(
      `${this.apiUrl}/operation-budgets`,
      budgetData
    );
  }

  update(id: number, budgetData: Partial<BudgetCreate>): Observable<Budget> {
    return this.http.put<Budget>(
      `${this.apiUrl}/operation-budgets/${id}`,
      budgetData
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

  import(file: File, annualId?: number): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (annualId) {
      formData.append('operation_budget_annual_id', annualId.toString());
    }
    return this.http.post<{ message?: string }>(`${this.apiUrl}/operation-budgets/import`, formData);
  }

  createMultiple(budgets: BudgetCreate[]): Observable<Budget[]> {
    return this.http.post<Budget[]>(
      `${this.apiUrl}/operation-budgets/multiple`,
      { budgets }
    );
  }

  checkDateExists(companyId: number, budgetDate: string, excludeId?: number): Observable<boolean> {
    let params = new HttpParams()
      .set('company_id', companyId.toString())
      .set('date_from', budgetDate)
      .set('date_to', budgetDate)
      .set('per_page', '100');
    
    return this.http.get<PaginatedResponse<Budget>>(
      `${this.apiUrl}/operation-budgets`,
      { params }
    ).pipe(
      map((response) => {
        if (excludeId) {
          return response.data.some(budget => budget.id !== excludeId && budget.budget_date.startsWith(budgetDate.substring(0, 7)));
        }
        return response.data.some(budget => budget.budget_date.startsWith(budgetDate.substring(0, 7)));
      })
    );
  }
}

