import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InvestmentBudgetYear {
  id: number;
  company_id: number;
  year: number;
  amount: number;
}

export interface InvestmentBudgetYearCreate {
  company_id: number;
  year: number;
  amount: number;
}

export interface InvestmentBudgetYearUpdate {
  year?: number;
  amount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class InvestmentBudgetYearService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(companyId: number, year?: number): Observable<InvestmentBudgetYear[]> {
    let params = new HttpParams().set('company_id', companyId.toString());
    
    if (year) {
      params = params.set('year', year.toString());
    }
    
    return this.http.get<InvestmentBudgetYear[]>(
      `${this.apiUrl}/investment-budget-annuals`,
      { params }
    );
  }

  getById(id: number): Observable<InvestmentBudgetYear> {
    return this.http.get<InvestmentBudgetYear>(
      `${this.apiUrl}/investment-budget-annuals/${id}`
    );
  }

  create(budgetYearData: InvestmentBudgetYearCreate): Observable<InvestmentBudgetYear> {
    return this.http.post<InvestmentBudgetYear>(
      `${this.apiUrl}/investment-budget-annuals`,
      budgetYearData
    );
  }

  update(id: number, budgetYearData: InvestmentBudgetYearUpdate): Observable<InvestmentBudgetYear> {
    return this.http.put<InvestmentBudgetYear>(
      `${this.apiUrl}/investment-budget-annuals/${id}`,
      budgetYearData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/investment-budget-annuals/${id}`
    );
  }
}
