import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterOutlet } from "@angular/router";
import { environment } from "../environments/environment";
import { FormsModule } from "@angular/forms";
import { EmailService } from "./services/email/email.service";
import { LoaderComponent } from "./shared/loader/loader.component";
import { HttpClientModule } from "@angular/common/http";
import { ModalComponent } from "./shared/modal/modal.component";
import { TelegramBotService } from "./services/telegram-bot/telegram-bot.service";
import { CurrencyService } from "./services/currency/currency.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule, LoaderComponent, ModalComponent, HttpClientModule],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  mobile_number = "";
  name = "";
  name_client = "";
  mobile_client = "";
  tivimate = false;
  step = 1;
  numberGenerated = 0;
  mostrarMensaje: boolean = false;
  amount = 0;

  isLoading = false;
  isEmailKO = false;

  constructor(
    private route: ActivatedRoute,
    private currencyService: CurrencyService,
    private emailService: EmailService,
    private telegramBotService: TelegramBotService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.name = params["name"];
      if (this.name === "javi") {
        this.mobile_number = environment.numberJavi;
        this.amount = 45;
      } else if (this.name === "adri") {
        this.mobile_number = environment.numberAdri;
        this.amount = 40;
      }
      this.currencyService.getExchangeRate(this.amount).subscribe((data) => {
        this.amount = data.result;
      });
    });
  }

  randomNumberGen() {
    const numeroAleatorio = Math.floor(100000 + Math.random() * 900000);
    const timestamp = Date.now();
    const timestampUltimos6Digitos = timestamp % 1000000;
    const numeroUnico = (numeroAleatorio + timestampUltimos6Digitos) % 1000000;
    this.step++;
    setTimeout(() => {}, 5000);
    this.numberGenerated = numeroUnico < 100000 ? numeroUnico + 100000 : numeroUnico;
  }

  copyText(text: number | string): void {
    navigator.clipboard
      .writeText(text.toString())
      .then(() => {
        this.mostrarMensaje = true;
        setTimeout(() => {
          this.mostrarMensaje = false;
        }, 3000);
      })
      .catch((err) => {
        console.error("Error al copiar el texto: ", err);
      });
  }

  nextStep() {
    this.isLoading = true;
    this.isEmailKO = false;
    this.emailService.sendEmail(this.name, this.name_client, this.mobile_client, this.tivimate, this.numberGenerated).subscribe({
      next: (resp) => {
        this.isLoading = false;
        console.log("Email sent ", resp);
        this.step++;
      },
      error: (err) => {
        this.isLoading = false;
        this.isEmailKO = true;
        console.error("An error occurred :", err);
      },
      complete: () => {
        console.log("There are no more action happen.");
      },
    });
    this.telegramBotService.sendToTelegram(this.name_client, this.mobile_client, this.numberGenerated).subscribe({
      next: (resp) => {
        console.log("Telegram message sent ", resp);
      },
      error: (err) => {
        console.error("An error occurred :", err);
      },
      complete: () => {
        console.log("There are no more action happen.");
      },
    });
  }
}
