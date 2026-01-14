import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProcessStatusHistory {
  id: number;
  process_id: number;
  process_status_id: number;
  user_id: number;
  status_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessStatusHistoryParams {
  process_id?: number;
  process_status_id?: number;
  user_id?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProcessStatusHistoryService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(params?: ProcessStatusHistoryParams): Observable<ProcessStatusHistory[]> {
    let httpParams = new HttpParams();
    
    if (params?.process_id) {
      httpParams = httpParams.set('process_id', params.process_id.toString());
    }
    if (params?.process_status_id) {
      httpParams = httpParams.set('process_status_id', params.process_status_id.toString());
    }
    if (params?.user_id) {
      httpParams = httpParams.set('user_id', params.user_id.toString());
    }

    return this.http.get<ProcessStatusHistory[]>(
      `${this.apiUrl}/process-status-histories`,
      { params: httpParams }
    );
  }

  getById(id: number): Observable<ProcessStatusHistory> {
    return this.http.get<ProcessStatusHistory>(
      `${this.apiUrl}/process-status-histories/${id}`
    );
  }
}

