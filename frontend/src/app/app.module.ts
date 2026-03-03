import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ViewerComponent } from './features/viewer/viewer.component';
import { ContentBrowserComponent } from './features/content/browser/content-browser.component';
import { ContentEditorComponent } from './features/content/editor/content-editor.component';

@NgModule({
  declarations: [
    AppComponent,
    ViewerComponent,
    ContentBrowserComponent,
    ContentEditorComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
