import { loremIpsum } from "lorem-ipsum";

const lorem = (count, units = "sentences") => loremIpsum({ count, units });

export default {
  subject: "Skriešanas sezona ir noslēgusies",
  blocks: [
    { heading: "Kas tālāk?" },
    { text:  "Kā jau tas mēdz notikt, sezona ir paskrējusi nemanot. Tāda sajūta, ka augusts bija labākajā gadījumā 4 dienu garš un 2 no tām bija Gauja Trail by UTMB. Pa šo laiku ir daudz kas sasniegts rezultātu ziņā, bet blogs palicis novārtā. Tagad, kad ir patīkams atelpas brīdis, būtu arī labs laiks sakopot domas rakstos, jo ir gana daudz ar ko dalīties. Kamēr tie top, ir iespēja atskatīties uz manas sezonas spilgtākajiem notikumiem, bet jau tuvākajā laikā padalīšos ar savu sezonu plānošanas pieeju, nelielu sacensību wishlistu pavasarim un arī pašmāju našķu topu."},
    { text: "1. SKM, LČ un debija 50M distancē vienā piegājienā. Man patika. Labprāt nākamsezon skrietu līdzīga garuma sacensības."},
    { post: "skm-2026" },
    { text: "2. Biju arī Francijas Dauphiné Alpos. Pirmā ārzemju sacensību pieredze ar daudz iespaidiem un pārsteiguma pjedestālu." },
    { post: "oisans-trail-tour-2026" },
    { text: "3. Vilkaču maratons vispār bija šogad? Episkas sacensības un milzīgs pavērsiena punkts mentāli, kas pozitīva ietekmēja visu atlikušo sezonu." },
    { post: "vilkacu-maratons-2026" },
  ],
};
