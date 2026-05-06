const regexCD = /(?:^|\n)\s*(Chẩn đoán|Bệnh chính|Chẩn đoán chính|ICD chính)[\s:*]*$/i;
const text1 = "Chẩn đoán\n";
const text2 = "Chẩn đoán : ";
const text3 = "Bệnh kèm theo\n";

console.log(text1.match(regexCD));
console.log(text2.match(regexCD));
console.log(text3.match(regexCD));
