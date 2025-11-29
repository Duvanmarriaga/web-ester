import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, AlertTriangle, X } from 'lucide-angular';

@Component({
  selector: 'app-confirm-dialog',
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  // Inputs
  title = input<string>('Confirmar acción');
  message = input<string>('¿Estás seguro de que deseas continuar?');
  confirmText = input<string>('Confirmar');
  cancelText = input<string>('Cancelar');
  isVisible = input<boolean>(false);
  variant = input<'danger' | 'warning' | 'info'>('warning');
  
  // Outputs
  confirmed = output<void>();
  cancelled = output<void>();
  
  // Icons
  readonly icons = { AlertTriangle, X };
  
  onConfirm() {
    this.confirmed.emit();
  }
  
  onCancel() {
    this.cancelled.emit();
  }
  
  onBackdropClick() {
    this.onCancel();
  }
}
