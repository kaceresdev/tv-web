import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterOutlet } from "@angular/router";
import { environment } from "../environments/environment";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit {
  mobile_number = "";
  name = "";
  name_client = "";
  mobile_client = "";
  step = 1;
  numberGenerated = 0;
  mostrarMensaje: boolean = false;
  amount = "";

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.name = params["name"];
      if (this.name === "javi") {
        this.mobile_number = environment.numberJavi;
        this.amount = "40€";
      } else if (this.name === "adri") {
        this.mobile_number = environment.numberAdri;
        this.amount = "25€";
      }
    });
  }

  randomNumberGen() {
    const numeroAleatorio = Math.floor(100000 + Math.random() * 900000);
    const timestamp = Date.now();
    const timestampUltimos6Digitos = timestamp % 1000000;
    const numeroUnico = (numeroAleatorio + timestampUltimos6Digitos) % 1000000;
    this.step++;
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
    this.step++;
  }
}
