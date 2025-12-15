import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, DollarSign } from 'lucide-angular';

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.scss',
})
export class BudgetsComponent {
  readonly icons = {
    DollarSign,
  };
}

