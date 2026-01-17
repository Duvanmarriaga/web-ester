import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../../entities/interfaces/pagination.interface';

export interface Investment {
  id?: number;
  investment_budget_annual_id?: number | null;
  company_id: number;
  description?: string | null;
  amount: number;
  executed_amount?: number;
  variance?: number;
  percentage_variance?: number;
}

export interface InvestmentCreate {
  investment_budget_annual_id?: number | null;
  company_id: number;
  description?: string | null;
  amount: number;
  executed_amount?: number;
  variance?: number;
  percentage_variance?: number;
}

export interface InvestmentUpdate {
  investment_budget_annual_id?: number | null;
  company_id?: number;
  description?: string | null;
  amount?: number;
  executed_amount?: number;
  variance?: number;
  percentage_variance?: number;
}

@Injectable({
  providedIn: 'root',
})
export class InvestmentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(
    page: number = 1, 
    perPage: number = 50, 
    companyId?: number,
    dateFrom?: string,
    dateTo?: string,
    investmentBudgetAnnualId?: number
  ): Observable<PaginatedResponse<Investment>> {
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
    
    if (investmentBudgetAnnualId) {
      params = params.set('investment_budget_annual_id', investmentBudgetAnnualId.toString());
    }
    
    return this.http.get<PaginatedResponse<Investment>>(
      `${this.apiUrl}/investment-budgets`,
      { params }
    );
  }

  getById(id: number): Observable<Investment> {
    return this.http.get<Investment>(
      `${this.apiUrl}/investment-budgets/${id}`
    );
  }

  create(investmentData: InvestmentCreate): Observable<Investment> {
    return this.http.post<Investment>(
      `${this.apiUrl}/investment-budgets`,
      investmentData
    );
  }

  update(id: number, investmentData: InvestmentUpdate): Observable<Investment> {
    return this.http.put<Investment>(
      `${this.apiUrl}/investment-budgets/${id}`,
      investmentData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/investment-budgets/${id}`
    );
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/investment-budgets/template/download`,
      { responseType: 'blob' }
    );
  }

  import(file: File): Observable<{ message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ message?: string }>(
      `${this.apiUrl}/investment-budgets/import`,
      formData
    );
  }

  createMultiple(investments: InvestmentCreate[]): Observable<Investment[]> {
    return this.http.post<Investment[]>(
      `${this.apiUrl}/investment-budgets/multiple`,
      { investments }
    );
  }
}

