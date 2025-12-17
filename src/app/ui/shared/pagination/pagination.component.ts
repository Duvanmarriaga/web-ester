import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { PaginatedResponse } from '../../../entities/interfaces/pagination.interface';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  pagination = input.required<PaginatedResponse<any>>();
  pageChange = output<number>();

  readonly icons = {
    ChevronLeft,
    ChevronRight,
  };

  currentPage = computed(() => this.pagination().current_page);
  lastPage = computed(() => this.pagination().last_page);
  total = computed(() => this.pagination().total);
  from = computed(() => this.pagination().from || 0);
  to = computed(() => this.pagination().to || 0);
  hasPrevious = computed(() => this.pagination().prev_page_url !== null);
  hasNext = computed(() => this.pagination().next_page_url !== null);

  visiblePages = computed(() => {
    const current = this.currentPage();
    const last = this.lastPage();
    const pages: number[] = [];

    if (last <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= last; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push(-1); // Ellipsis
        pages.push(last);
      } else if (current >= last - 3) {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = last - 4; i <= last; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push(-1); // Ellipsis
        pages.push(last);
      }
    }

    return pages;
  });

  goToPage(page: number): void {
    if (page >= 1 && page <= this.lastPage() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }

  previousPage(): void {
    if (this.hasPrevious() && this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.hasNext() && this.currentPage() < this.lastPage()) {
      this.goToPage(this.currentPage() + 1);
    }
  }
}
