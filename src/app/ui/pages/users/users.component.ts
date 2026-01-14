import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { selectAllUsers, selectUserIsLoading } from '../../../infrastructure/store/user';
import * as UserActions from '../../../infrastructure/store/user/user.actions';
import { User, UserCreate, UserType } from '../../../entities/interfaces';
import { LucideAngularModule, UserPlus, Pencil, Trash2 } from 'lucide-angular';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { UserModalComponent } from '../../shared/user-modal/user-modal.component';

@Component({
  selector: 'app-users',
  imports: [CommonModule, LucideAngularModule, ConfirmDialogComponent, UserModalComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  private store = inject(Store);

  users = signal<User[]>([]);
  isLoading = signal(false);
  showModal = signal(false);
  showConfirmDialog = signal(false);
  editingUser = signal<User | null>(null);
  deletingUser = signal<User | null>(null);
  userType = UserType;
  // Lucide icons
  readonly icons = { UserPlus, Pencil, Trash2 };

  ngOnInit() {
    this.store.select(selectAllUsers).subscribe(users => this.users.set(users));
    this.store.select(selectUserIsLoading).subscribe(loading => this.isLoading.set(loading));
    
    this.store.dispatch(UserActions.loadUsers());
  }

  openCreateModal() {
    this.editingUser.set(null);
    this.showModal.set(true);
  }

  openEditModal(user: User) {
    this.editingUser.set(user);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingUser.set(null);
  }

  onSaveUser(event: { user: UserCreate | Partial<User> }) {
    const editing = this.editingUser();
    if (editing) {
      this.store.dispatch(UserActions.updateUser({ 
        user: { id: editing.id, ...event.user } as any
      }));
    } else {
      this.store.dispatch(UserActions.createUser({ 
        user: event.user as UserCreate 
      }));
    }
    this.closeModal();
  }

  deleteUser(user: User) {
    this.deletingUser.set(user);
    this.showConfirmDialog.set(true);
  }
  
  confirmDelete() {
    const user = this.deletingUser();
    if (user) {
      this.store.dispatch(UserActions.deleteUser({ id: user.id }));
    }
    this.showConfirmDialog.set(false);
    this.deletingUser.set(null);
  }
  
  cancelDelete() {
    this.showConfirmDialog.set(false);
    this.deletingUser.set(null);
  }
  
  getDeleteMessage(): string {
    const user = this.deletingUser();
    return user ? `¿Estás seguro de que deseas eliminar al usuario ${user.name}? Esta acción no se puede deshacer.` : '';
  }

  isEmailVerified(user: User): boolean {
    return user.email_verified_at !== null;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}
