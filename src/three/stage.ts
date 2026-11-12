// Общее состояние хореографии: пишут ScrollTrigger'ы в Landing, читает 3D-сцена каждый кадр.
// Отдельный файл, чтобы three не попадал в первый бандл вместе с Landing.
export type Stage = {
  openIn: number; // подлёт к блоку «Заливаем» 0..1
  pour: number; // соус льётся 0..1 (по скроллу внутри блока)
  flvIn: number; // подлёт к блоку вкусов
  away: number; // рожок улетает (состав, ритуал)
  buyIn: number; // финал: три рожка
  buyPx: number; // на сколько пикселей финальный блок ушёл выше экрана — рожки едут вместе с ним
  flavor: number; // текущий вкус (индекс)
};

export const stage: Stage = { openIn: 0, pour: 0, flvIn: 0, away: 0, buyIn: 0, buyPx: 0, flavor: 0 };
