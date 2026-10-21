// Mantém o servidor rodando e o reinicia depois de uma atualização pelo botão "Atualizar".
const { spawn } = require('child_process');
const path = require('path');

const RESTART_CODE = 75;

function run() {
  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], { stdio: 'inherit', env: { ...process.env, OPENWII_LAUNCHER: '1' } });
  child.on('exit', (code, signal) => {
    if (code === RESTART_CODE) {
      console.log('\n  🔄  Reiniciando com a versão nova...\n');
      return run();
    }
    process.exit(code === null ? (signal ? 1 : 0) : code);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => child.kill(sig));
}
run();
