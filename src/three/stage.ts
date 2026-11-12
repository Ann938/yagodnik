// Общее состояние хореографии: пишут ScrollTrigger'ы в Landing, читает 3D-сцена каждый кадр.
// Отдельный файл, чтобы three не попадал в первый бандл вместе с Landing.
export type Stage = {
  openIn: number; // подлёт к блоку «Открываем» 0..1
  lid: number; // крышка снята 0..1
  flvIn: number; // подлёт к блоку вкусов
  away: number; // стаканчик улетает (состав, ритуал)
  buyIn: number; // финальный набор из трёх
  flavor: number; // текущий вкус (индекс)
  scroll: number; // общий прогресс страницы — для параллакса ингредиентов
  buyPx: number; // на сколько пикселей блок набора ушёл выше экрана — стаканчики едут вместе с ним
};

export const stage: Stage = { openIn: 0, lid: 0, flvIn: 0, away: 0, buyIn: 0, flavor: 0, scroll: 0, buyPx: 0 };
