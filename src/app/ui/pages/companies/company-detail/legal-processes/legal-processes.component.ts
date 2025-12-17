import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule,
  Scale,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-angular';
import {
  ProcessService,
  ProcessCreate,
  Process,
} from '../../../../../infrastructure/services/process.service';
import { ToastrService } from 'ngx-toastr';
import { PaginationComponent } from '../../../../shared/pagination/pagination.component';
import { PaginatedResponse } from '../../../../../entities/interfaces/pagination.interface';

@Component({
  selector: 'app-legal-processes',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, PaginationComponent],
  templateUrl: './legal-processes.component.html',
  styleUrl: './legal-processes.component.scss',
})
export class LegalProcessesComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private processService = inject(ProcessService);
  private toastr = inject(ToastrService);

  readonly icons = {
    Scale,
    Plus,
    Pencil,
    Trash2,
  };

  companyId = signal<number | null>(null);
  processes = signal<Process[]>([]);
  pagination = signal<PaginatedResponse<Process> | null>(null);
  isLoading = signal(false);
  currentPage = signal(1);

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId.set(parseInt(id, 10));
        this.loadProcesses();
      }
    });
  }

  loadProcesses(page: number = 1): void {
    const companyId = this.companyId();
    if (!companyId) return;

    this.isLoading.set(true);
    this.currentPage.set(page);
    this.processService.getAll(page, 15, companyId).subscribe({
      next: (response: PaginatedResponse<Process>) => {
        this.processes.set(response.data);
        this.pagination.set(response);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        const errorMessage =
          (error as { error?: { message?: string }; message?: string })?.error
            ?.message ||
          (error as { message?: string })?.message ||
          'Error al cargar los procesos';
        this.toastr.error(errorMessage, 'Error');
        this.isLoading.set(false);
      },
    });
  }

  onPageChange(page: number): void {
    this.loadProcesses(page);
  }
}

