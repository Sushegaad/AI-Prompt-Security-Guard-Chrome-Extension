/* ============================================================================
 * AI Prompt - Security Guard — EU / multilingual detection tests
 * Run: node src/content/detector.i18n.test.mjs
 * Covers: FR/DE/ES keyword packs and the three checksum-anchored EU
 * identifiers (French NIR, German Steuer-ID, Spanish DNI).
 * ========================================================================== */

import { detect, nirValid, steuerIdValid, dniValid } from './detector.js';

let pass = 0;
let fail = 0;
const fails = [];
const ok = (n, c) => (c ? pass++ : (fail++, fails.push(n)));
const has = (text, category) => new Set(detect(text).categories).has(category);
const safe = (text) => detect(text).riskLevel === 'safe';

/* ------------------------------------------------------- French NIR ------- */
ok('nirValid: valid key', nirValid('185057800604830'));
ok('nirValid: wrong key', !nirValid('185057800604831'));
ok('nirValid: wrong length', !nirValid('18505780060483'));
ok('nir: bare compact detected', has('mon numéro est 185057800604830 merci', 'gov_id'));
ok('nir: spaced form detected', has('NIR 1 85 05 78 006 048 30 enregistré', 'gov_id'));
ok('nir: critical', detect('185057800604830').riskLevel === 'critical');
ok('nir: invalid key not flagged', !has('code 185057800604831 erreur', 'gov_id'));
ok('nir: random 15 digits mostly safe', !has('référence 355057800604899 dossier', 'gov_id'));

/* --------------------------------------------------- German Steuer-ID ----- */
ok('steuerIdValid: valid', steuerIdValid('86574432857'));
ok('steuerIdValid: wrong check digit', !steuerIdValid('86574432858'));
ok('steuerIdValid: leading zero rejected', !steuerIdValid('06574432857'));
ok('steuer: keyword-anchored detected', has('meine Steuer-ID: 86574432857', 'gov_id'));
ok('steuer: long form keyword', has('steuerliche Identifikationsnummer 25896314747', 'gov_id'));
ok('steuer: spaced digits', has('IdNr. 86 574 432 857 hinterlegt', 'gov_id'));
ok('steuer: critical', detect('Steuer-ID: 86574432857').riskLevel === 'critical');
ok('steuer: bare 11 digits NOT flagged (phone collision)', !has('ruf mich an: 01765554433', 'gov_id'));
ok('steuer: keyword + invalid check not flagged', !has('Steuer-ID: 86574432858', 'gov_id'));

/* ------------------------------------------------------ Spanish DNI ------- */
ok('dniValid: valid letter', dniValid('12345678', 'Z'));
ok('dniValid: wrong letter', !dniValid('12345678', 'A'));
ok('dni: detected with letter', has('mi DNI es 12345678Z', 'gov_id'));
ok('dni: hyphenated', has('DNI 87654321-X registrado', 'gov_id'));
ok('dni: critical', detect('12345678Z').riskLevel === 'critical');
ok('dni: wrong letter not flagged', !has('ref 12345678A pedido', 'gov_id'));
ok('dni: 8 digits alone safe', safe('el pedido 12345678 llegó'));

/* --------------------------------------------------- keyword packs: DE ---- */
ok('de: Gehaltsabrechnung -> workplace', has('anbei die Gehaltsabrechnung von Alex', 'workplace'));
ok('de: Personalakte -> workplace', has('die Personalakte wurde geprüft', 'workplace'));
ok('de: Betriebsratsmitglied -> special_category', has('er ist Betriebsratsmitglied seit 2023', 'special_category'));
ok('de: Schwerbehindertenausweis -> special_category', has('sie hat einen Schwerbehindertenausweis', 'special_category'));
ok('de: Krankenakte -> health', has('die Krankenakte des Patienten liegt vor', 'health'));
ok('de: streng vertraulich -> restriction', has('dieses Dokument ist streng vertraulich', 'restriction'));
ok('de: Geheimhaltungsvereinbarung -> legal', has('gemäß der Geheimhaltungsvereinbarung', 'legal'));
ok('de: Sorgerecht -> children', has('das Sorgerecht wurde neu geregelt', 'children'));
ok('de: Kontoauszug -> financial', has('der Kontoauszug zeigt die Buchung', 'financial'));

/* --------------------------------------------------- keyword packs: FR ---- */
ok('fr: dossier médical -> health', has('le dossier médical du patient est joint', 'health'));
ok('fr: fiche de paie -> workplace', has('voici la fiche de paie de mars', 'workplace'));
ok('fr: appartenance syndicale -> special_category', has('son appartenance syndicale est connue', 'special_category'));
ok('fr: strictement confidentiel -> restriction', has('ce document est strictement confidentiel', 'restriction'));
ok('fr: mise en demeure -> legal', has('une mise en demeure a été envoyée', 'legal'));
ok('fr: relevé bancaire -> financial', has('le relevé bancaire de janvier', 'financial'));
ok('fr: bulletin scolaire -> education', has('le bulletin scolaire de Lucas', 'education'));

/* --------------------------------------------------- keyword packs: ES ---- */
ok('es: nómina -> workplace', has('adjunto la nómina de Alex', 'workplace'));
ok('es: historial médico -> health', has('el historial médico del paciente', 'health'));
ok('es: afiliación sindical -> special_category', has('su afiliación sindical consta', 'special_category'));
ok('es: estrictamente confidencial -> restriction', has('documento estrictamente confidencial', 'restriction'));
ok('es: transferencia bancaria -> financial', has('la transferencia bancaria se realizó', 'financial'));
ok('es: custodia de los hijos -> children', has('la custodia de los hijos se acordó', 'children'));

/* --------------------------------------- false-positive guards (all langs) */
ok('fp: english "diagnose the problem" safe', safe('please diagnose the problem in my code'));
ok('fp: "newsletter kündigen" safe', safe('wie kann ich den newsletter kündigen'));
ok('fp: "salaire minimum" discussion safe', safe('quel est le salaire minimum en France'));
ok('fp: "denominación" safe (nómina substring guard)', safe('la denominación social de la empresa'));
ok('fp: german everyday prose safe', safe('ich überweise dir das Rezept für den Kuchen morgen'));
ok('fp: french everyday prose safe', safe('on se retrouve à la gare demain matin'));
ok('fp: spanish everyday prose safe', safe('nos vemos mañana en la oficina'));

/* ----------------------------------------------------------------- report */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\nFailures:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('All i18n detection tests passed ✓');
