// Danske tegn: æøå ÆØÅ. Emoji i kommentar: 🎉🇩🇰👩‍💻
const hilsen = 'Hej med dig 🎉';
const flag = "🇩🇰";
const zwj = '👩‍💻';
const blandet = `æøå ${hilsen} 🎉`;
const identifikatørMedÆØÅ = 1;
const 日本語 = 2;
/* blok med 🎉 og æøå */
export const positions = { hilsen, flag, zwj, blandet, identifikatørMedÆØÅ, 日本語 };
