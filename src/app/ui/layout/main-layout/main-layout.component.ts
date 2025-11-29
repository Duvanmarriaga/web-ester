import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, ToolbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  isSidebarOpen = signal(true);
  isMobileSidebarOpen = signal(false);

  onSidebarOpenChange(open: boolean) {
    this.isSidebarOpen.set(open);
  }

  onMobileSidebarOpenChange(open: boolean) {
    this.isMobileSidebarOpen.set(open);
  }
}
