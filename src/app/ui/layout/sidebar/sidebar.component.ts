import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
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
export class SidebarComponent {
  isOpen = input<boolean>(true);
  isMobileOpen = input<boolean>(false);
  openChange = output<boolean>();
  mobileOpenChange = output<boolean>();
  version = version;
  // Lucide icons
  readonly icons = { LayoutDashboard, Users, Building2, Info, X, ChevronLeft };

  // Determinar si es mobile
  isMobile = computed(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  menuItems: MenuItem[] = [
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
