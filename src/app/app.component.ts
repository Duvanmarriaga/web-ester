import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastrModule } from 'ngx-toastr';
import { Store } from '@ngrx/store';
import * as AuthActions from './infrastructure/store/auth/auth.actions';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastrModule],
  template: ` <router-outlet /> `,
  styles: [],
})
export class AppComponent implements OnInit {
  private store = inject(Store);

  ngOnInit() {
    // Load auth state from localStorage on app init
    this.store.dispatch(AuthActions.loadAuthFromStorage());
  }
}
