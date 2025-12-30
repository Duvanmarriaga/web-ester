import { Component, input, output, computed, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  LucideAngularModule,
  LayoutDashboard,
  Users,
  Building2,
  Info,
  X,
  ChevronLeft,
} from 'lucide-angular';
import { version } from '../../../../../package.json';
import { selectUser } from '../../../infrastructure/store/auth';
import { UserType } from '../../../entities/interfaces';
interface MenuItem {
  label: string;
  icon: any;
  route: string;
  badge?: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private store = inject(Store);
  
  isOpen = input<boolean>(true);
  isMobileOpen = input<boolean>(false);
  openChange = output<boolean>();
  mobileOpenChange = output<boolean>();
  version = version;
  // Lucide icons
  readonly icons = { LayoutDashboard, Users, Building2, Info, X, ChevronLeft };

  user = signal<any>(null);

  // Determinar si es mobile
  isMobile = computed(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  allMenuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      route: '/dashboard',
    },
    {
      label: 'Usuarios',
      icon: Users,
      route: '/users',
    },
    {
      label: 'Compañías',
      icon: Building2,
      route: '/companies',
    },
  ];

  menuItems = computed(() => {
    const currentUser = this.user();
    if (!currentUser || currentUser.type !== UserType.ADMIN) {
      // Si no es admin, solo mostrar Dashboard
      return this.allMenuItems.filter(item => item.route === '/dashboard');
    }
    // Si es admin, mostrar todos los items
    return this.allMenuItems;
  });

  ngOnInit() {
    this.store.select(selectUser).subscribe(user => {
      this.user.set(user);
    });
  }

  // Toggle sidebar (desktop)
  toggleSidebar() {
    this.openChange.emit(!this.isOpen());
  }

  // Cerrar mobile menu
  closeMobileMenu() {
    this.mobileOpenChange.emit(false);
  }

  // Click en link (cierra en mobile)
  onLinkClick() {
    if (this.isMobile()) {
      this.closeMobileMenu();
    }
  }
}
