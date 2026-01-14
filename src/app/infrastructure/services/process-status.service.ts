import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProcessStatus {
  id: number;
  name: string;
}

export interface ProcessStatusCreate {
  name: string;
}

export interface ProcessStatusUpdate {
  name?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProcessStatusService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getAll(): Observable<ProcessStatus[]> {
    return this.http.get<ProcessStatus[]>(
      `${this.apiUrl}/process-statuses`
    );
  }

  getById(id: number): Observable<ProcessStatus> {
    return this.http.get<ProcessStatus>(
      `${this.apiUrl}/process-statuses/${id}`
    );
  }

  create(statusData: ProcessStatusCreate): Observable<ProcessStatus> {
    return this.http.post<ProcessStatus>(
      `${this.apiUrl}/process-statuses`,
      statusData
    );
  }

  update(id: number, statusData: ProcessStatusUpdate): Observable<ProcessStatus> {
    return this.http.put<ProcessStatus>(
      `${this.apiUrl}/process-statuses/${id}`,
      statusData
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/process-statuses/${id}`
    );
  }
}

