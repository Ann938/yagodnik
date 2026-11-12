// Города и киоски для блока «Киоски»: настоящие координаты мест (центр парка/набережной), карта — MapLibre + OpenFreeMap.
export type Kiosk = { name: string; lng: number; lat: number };
export type CityMap = {
  id: string;
  name: string;
  gis: string; // город в адресе 2ГИС
  kiosks: Kiosk[];
};

export const cities: CityMap[] = [
  {
    id: "msk",
    name: "Москва",
    gis: "moscow",
    kiosks: [
      { name: "Парк Горького", lat: 55.7298, lng: 37.6031 },
      { name: "Музеон", lat: 55.7357, lng: 37.6089 },
      { name: "Зарядье", lat: 55.7514, lng: 37.629 },
      { name: "Воробьёвы горы", lat: 55.7105, lng: 37.543 },
      { name: "ВДНХ", lat: 55.8263, lng: 37.6377 },
    ],
  },
  {
    id: "spb",
    name: "Санкт-Петербург",
    gis: "spb",
    kiosks: [
      { name: "Летний сад", lat: 59.945, lng: 30.336 },
      { name: "Новая Голландия", lat: 59.929, lng: 30.289 },
      { name: "Елагин остров", lat: 59.979, lng: 30.265 },
      { name: "Стрелка Васильевского", lat: 59.944, lng: 30.306 },
      { name: "Севкабель Порт", lat: 59.9235, lng: 30.241 },
    ],
  },
  {
    id: "kzn",
    name: "Казань",
    gis: "kazan",
    kiosks: [
      { name: "Кремлёвская набережная", lat: 55.802, lng: 49.105 },
      { name: "Чёрное озеро", lat: 55.793, lng: 49.112 },
      { name: "Улица Баумана", lat: 55.7895, lng: 49.117 },
      { name: "Набережная Кабана", lat: 55.775, lng: 49.12 },
      { name: "Парк Горького", lat: 55.784, lng: 49.146 },
    ],
  },
  {
    id: "ekb",
    name: "Екатеринбург",
    gis: "ekaterinburg",
    kiosks: [
      { name: "Плотинка", lat: 56.838, lng: 60.604 },
      { name: "Харитоновский сад", lat: 56.847, lng: 60.612 },
      { name: "Литературный квартал", lat: 56.8445, lng: 60.616 },
      { name: "Зелёная роща", lat: 56.825, lng: 60.615 },
      { name: "ЦПКиО Маяковского", lat: 56.813, lng: 60.644 },
    ],
  },
  {
    id: "nn",
    name: "Нижний Новгород",
    gis: "n_novgorod",
    kiosks: [
      { name: "Стрелка", lat: 56.334, lng: 43.969 },
      { name: "Нижневолжская набережная", lat: 56.329, lng: 43.993 },
      { name: "Кремль", lat: 56.3285, lng: 44.003 },
      { name: "Большая Покровская", lat: 56.32, lng: 43.999 },
      { name: "Парк Швейцария", lat: 56.284, lng: 43.975 },
    ],
  },
];
