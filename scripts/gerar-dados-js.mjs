// Gera data/volume-radar-trans.js a partir do CSV.
// Esse arquivo é usado quando o index.html é aberto direto do disco (file://),
// situação em que o navegador bloqueia fetch() de arquivos locais.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origem = resolve('data/volume-radar-trans.csv');
const destino = resolve('data/volume-radar-trans.js');

const bytes = readFileSync(origem);
let texto;
try {
  texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
} catch {
  texto = new TextDecoder('windows-1252').decode(bytes);
}
texto = texto.replace(/^﻿/, '');

writeFileSync(destino, 'window.RADAR_CSV = ' + JSON.stringify(texto) + ';\n', 'utf8');
console.log(`Gerado ${destino} (${texto.length.toLocaleString('pt-BR')} caracteres)`);
