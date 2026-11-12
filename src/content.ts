// Тексты и данные «Ягодника». Вёрстка про конкретные слова ничего не знает.

export const site = {
  title: "Ягодник — настоящий пломбир с кусочками фруктов",
  description:
    "Мягкий пломбир на сливках 33% с кусочками ягод в хрустящем рожке, залитый соусом из настоящих ягод. Клубника, малина, ежевика.",
};

export type FlavorId = "strawberry" | "raspberry" | "blackberry";

// фото ингредиента: файл в public/fruit, ширина в долях экрана задаётся раскладкой
export type FruitPic = { src: string; w: number; h: number };

export type Flavor = {
  id: FlavorId;
  name: string; // в переключателе
  title: string; // заголовок блока вкуса
  text: string;
  sauce: string; // доля ягод в соусе
  kcal: number;
  // палитра вкуса: фон, второй тон фона, «чёрный» в гамме, акцент
  bg: string;
  bg2: string;
  ink: string;
  accent: string;
  // цвета в 3D: пломбир и соус
  cream: string;
  glaze: string;
  fruits: FruitPic[];
};

const F = (src: string, w: number, h: number): FruitPic => ({ src: `fruit/${src}.webp`, w, h });

export const flavors: Flavor[] = [
  {
    id: "strawberry",
    name: "Клубника",
    title: "Клубника со сливками",
    text: "Сливочный пломбир с кусочками клубники, сверху — густой соус из целых ягод. Кислинка ягоды и сливки, как летом на даче.",
    sauce: "60%",
    kcal: 186,
    bg: "#fbe3dc",
    bg2: "#f6c3b9",
    ink: "#4a0d18",
    accent: "#d8283f",
    cream: "#f9b9bc",
    glaze: "#c3102b",
    fruits: [F("straw-whole", 820, 761), F("straw-half", 820, 426), F("straw-side", 820, 499), F("straw-pair", 820, 462)],
  },
  {
    id: "blackberry",
    name: "Ежевика",
    title: "Ежевика и ваниль",
    text: "Ванильный пломбир с кусочками ежевики под терпким конфи. Почти винная ягода и густые сливки — самый взрослый вкус в меню.",
    sauce: "55%",
    kcal: 172,
    bg: "#e9e2f1",
    bg2: "#cfc0e6",
    ink: "#211235",
    accent: "#5b2b8c",
    cream: "#e2cff0",
    glaze: "#2b0a3a",
    fruits: [F("bb-whole", 820, 607), F("bb-half", 820, 627), F("bb-pile", 820, 623), F("bb-whole", 820, 607)],
  },
  {
    id: "raspberry",
    name: "Малина",
    title: "Малина и сливки",
    text: "Сливочный пломбир с кусочками малины и густой малиновый соус сверху. Ягода сладкая, с лёгкой терпкостью и ароматом лесной поляны.",
    sauce: "60%",
    kcal: 178,
    bg: "#f9e0e8",
    bg2: "#efbccd",
    ink: "#4a0b26",
    accent: "#c2185b",
    cream: "#f8dbe2",
    glaze: "#9b0f3b",
    fruits: [F("rasp-whole", 820, 678), F("rasp-half", 688, 820), F("rasp-whole", 820, 678), F("rasp-half", 688, 820)],
  },
];

export const nav = [
  { href: "#flavors", label: "Вкусы" },
  { href: "#inside", label: "Из чего" },
  { href: "#find", label: "Где найти" },
];

export const hero = {
  kicker: "Мороженое · сливки 33%",
  title: ["Настоящий", "пломбир с", "кусочками", "фруктов"],
  lead: "Закручиваем пломбир в хрустящий вафельный рожок и заливаем соусом из настоящих ягод.",
  cta: "Выбрать вкус",
};

// блок, где по скроллу рожок заливается соусом
export const pour = {
  label: "Заливаем",
  title: "Соус из ягод",
  facts: [
    { num: "60%", text: "ягод в соусе, варим его каждое утро, а не открываем банку" },
    { num: "−6°", text: "температура подачи: пломбир мягкий, но держит форму" },
    { num: "3", text: "витка на рожок" },
  ],
};

export const inside = {
  label: "Из чего",
  title: "Шесть ингредиентов",
  list: [
    "Сливки 33%",
    "Молоко цельное",
    "Тростниковый сахар",
    "Кусочки ягод",
    "Ваниль",
    "Вафля на сливочном масле",
  ],
  note: "Без пальмового масла, красителей и ароматизаторов.",
};

export const ritual = {
  label: "Как есть",
  title: "Рожок не ждёт",
  steps: [
    { n: "01", title: "Сначала макушку", text: "Пока соус не застыл, снимите верхний виток — там его больше всего." },
    { n: "02", title: "Крутите рожок", text: "Поворачивайте по кругу, а не сверху вниз — так ничего не капнет на руку." },
    { n: "03", title: "Кончик — в конце", text: "На дне рожка — капля соуса. Это не случайность, это награда." },
  ],
};

export const find = {
  label: "Где найти",
  title: "Киоски в парках и на набережных",
  text: "Работаем с мая по сентябрь, а зимой — в торговых центрах.",
  price: "190 ₽",
  priceNote: "любой рожок",
  cta: "Найти ближайший",
};

export const footer = {
  links: [
    { href: "#flavors", label: "Вкусы" },
    { href: "#inside", label: "Из чего" },
    { href: "#find", label: "Где найти" },
  ],
};
