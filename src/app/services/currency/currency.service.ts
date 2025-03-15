import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class CurrencyService {
  private apiUrl = "https://api.exchangerate.host/convert";

  constructor(private http: HttpClient) {}

  getExchangeRate(amount: number): Observable<any> {
    return this.http.get<any>(this.apiUrl, {
      params: { access_key: environment.exchangerateToken, from: "USD", to: "EUR", amount: amount, format: "1" },
    });
  }
}
