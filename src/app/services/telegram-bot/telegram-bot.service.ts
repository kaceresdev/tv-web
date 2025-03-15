import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class TelegramBotService {
  private botUrl = environment.urlBaseServer + "/bot";

  constructor(private http: HttpClient) {}

  sendToTelegram(name_client: string, mobile_client: string, code: number): Observable<any> {
    const data = {
      name_client: name_client,
      mobile_client: mobile_client,
      code: code,
    };
    return this.http.post(this.botUrl, data, { responseType: "text" });
  }
}
