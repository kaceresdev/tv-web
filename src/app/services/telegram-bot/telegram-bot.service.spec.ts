import { TestBed } from '@angular/core/testing';

import { TelegramBotService } from './telegram-bot.service';

describe('TelegramBotService', () => {
  let service: TelegramBotService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TelegramBotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
