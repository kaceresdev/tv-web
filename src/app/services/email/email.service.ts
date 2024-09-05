import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class EmailService {
  private emailUrl = environment.urlBaseServer + "/send-email"; // Replace with your backend URL

  constructor(private http: HttpClient) {}

  sendEmail(name: string, name_client: string, mobile_client: string, code: number): Observable<any> {
    const data = {
      name: name.toUpperCase(),
      name_client: name_client,
      mobile_client: mobile_client,
      code: code,
    };
    return this.http.post(this.emailUrl, data, { responseType: "text" });
  }
}
