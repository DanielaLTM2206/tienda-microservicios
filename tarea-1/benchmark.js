/**
 * benchmark.js — Mide latencia de un endpoint usando SOLO JavaScript nativo.
 *   No requiere instalar nada (usa fetch integrado de Node 18+).
 *
 * Evidencia para:
 *   - Avance 1: comparar camino síncrono vs asíncrono.
 *
 * Uso:      node tarea-1/benchmark.js <URL> [numero_de_peticiones]
 * Ejemplos:
 *   node tarea-1/benchmark.js http://localhost:3000/api/pedidos
 *   node tarea-1/benchmark.js http://localhost:3000/api/pedidos 300 > docs/bench-sincrono.txt
 *   node tarea-1/benchmark.js http://localhost:3000/api/pedidos/notificar 200 --post
 */

const url = process.argv[2];
const n = Number(process.argv[3]) || 200;
const isPost = process.argv[4] === '--post';

if (!url) {
  console.error('Falta la URL.\n   Uso: node tarea-1/benchmark.js <URL> [numero_de_peticiones] [--post]');
  process.exit(1);
}

function percentil(valoresOrdenados, p) {
  const idx = Math.ceil((p / 100) * valoresOrdenados.length) - 1;
  return valoresOrdenados[Math.max(0, idx)];
}

(async () => {
  console.log(`\nMidiendo ${url}  (${n} peticiones, metodo: ${isPost ? 'POST' : 'GET'})\n`);
  const tiempos = [];
  let errores = 0;

  for (let i = 0; i < n; i++) {
    const inicio = Date.now();
    try {
      const options = isPost
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje: `evento-benchmark-${i}` }),
          }
        : {};
      const res = await fetch(url, options);
      await res.text();
      if (!res.ok) errores++;
    } catch (e) {
      errores++;
    }
    tiempos.push(Date.now() - inicio);
    if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${n}\r`);
  }

  tiempos.sort((a, b) => a - b);
  const suma = tiempos.reduce((s, t) => s + t, 0);
  const prom = suma / tiempos.length;

  console.log('\n------------ RESULTADOS ------------');
  console.log(`Peticiones        : ${n}`);
  console.log(`Metodo            : ${isPost ? 'POST' : 'GET'}`);
  console.log(`Latencia promedio : ${prom.toFixed(2)} ms`);
  console.log(`Latencia p95      : ${percentil(tiempos, 95).toFixed(2)} ms`);
  console.log(`Latencia max      : ${tiempos[tiempos.length - 1].toFixed(2)} ms`);
  console.log(`Errores           : ${errores}`);
  console.log('------------------------------------');
  console.log('\nFila para el README:');
  console.log(`| ${isPost ? 'Asincrono (Redis)' : 'Sincrono (TCP)'} | ${prom.toFixed(2)} | ${percentil(tiempos, 95).toFixed(2)} | ${tiempos[tiempos.length - 1].toFixed(2)} |\n`);
})();
