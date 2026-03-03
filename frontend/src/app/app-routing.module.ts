import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ViewerComponent } from './features/viewer/viewer.component';

const routes: Routes = [
  { path: 'edit', component: ViewerComponent },
  { path: 'view/:section/:filename', component: ViewerComponent },
  { path: '', pathMatch: 'full', component: ViewerComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
