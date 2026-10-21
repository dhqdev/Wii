# 🎮 OpenWii

Central de jogos que roda no **computador** e usa o **celular como controle do Wii**.
Você aponta o celular para a tela e o ponteiro se move com o giroscópio, igual ao Wii Remote.

| Jogo | Como joga |
|---|---|
| 🍉 **Fruit Ninja** | Balance o celular como uma espada para cortar frutas. Fuja das bombas. |
| ✈️ **Aviãozinho** | Aponte para pilotar, pegue estrelas, passe pelos anéis. A/B = turbo. |
| 🎯 **Shooting Range** | Tiro ao alvo em 60 s. A = atirar, B = recarregar. Até 4 jogadores. |
| 👾 **Alien Attack** | Aliens vindo na sua direção. A = laser, B = bomba. |
| 🎨 **Sketch** | Desenhe na tela. A = pincel, B = borracha, ◀▶ cor, ▲▼ tamanho, 2 = salvar PNG. |
| 🏓 **Tênis** | Pong com raquete pelo ponteiro. Contra a CPU ou contra um amigo (2 celulares). |

## Requisitos

- [Node.js](https://nodejs.org) 18 ou mais novo
- Computador e celular **na mesma rede Wi-Fi**

## Como rodar

```bash
git clone https://github.com/dhqdev/Wii.git
cd Wii
npm install
npm start
```

O terminal mostra dois endereços:

```
Computador (tela dos jogos):  http://localhost:8080
Celular (controle):           https://192.168.0.10:8443/controller.html
```

1. **No computador**, abra `http://localhost:8080` (de preferência em tela cheia, F11).
2. **No celular**, leia o QR code que aparece na tela (ou digite o endereço `https://...:8443`).
3. O navegador vai avisar que a conexão "não é particular". Isso é esperado: o certificado é gerado na sua máquina.
   - **iPhone (Safari):** toque em *Mostrar detalhes* → *visitar este site* → *Visitar site*.
   - **Android (Chrome):** toque em *Avançado* → *Continuar para ... (não seguro)*.
4. Toque em **Conectar controle** e permita o acesso a "Movimento e orientação".
5. Segure o celular como um controle do Wii (tela para cima, topo apontando para o monitor) e mexa.

### Atualizar para a versão mais nova

Na central, clique em **⟳ Atualizar** (canto inferior esquerdo). Ele faz `git pull`, instala dependências
novas se precisar, reinicia o servidor e recarrega a tela sozinho. Quando há novidades no GitHub, aparece
uma bolinha vermelha com o número de atualizações. Os celulares recarregam também; é só tocar em
**Conectar controle** de novo.

> O botão só funciona na tela do computador (`localhost`) e numa pasta baixada com `git clone`.

### Botões do controle

| Botão | Função |
|---|---|
| **A** | Selecionar / ação principal |
| **B** | Ação secundária |
| **⌂ Home** | Voltar ao menu (segurar = centralizar ponteiro) |
| **⏻** | Centralizar o ponteiro (aponte para o meio da tela e toque) |
| **+** | Pausar |
| **⚙** (canto) | Sensibilidade, inverter eixos, vibração |

Sem giroscópio (ou sem permissão)? Arraste o dedo nas áreas vazias do controle: funciona como touchpad.
Sem celular? O mouse funciona como controle no computador (clique = A, botão direito = B, Esc = Home).

## Por que HTTPS?

iPhone e Android só liberam os sensores de movimento em páginas seguras (HTTPS). Por isso o servidor
cria um certificado autoassinado na pasta `.cert/` na primeira execução. A tela do computador usa
`http://localhost`, que o navegador já considera seguro.

## Problemas comuns

- **O QR code abre um IP errado** (máquina com várias placas de rede/VPN): rode com o IP certo,
  por exemplo `HOST_IP=192.168.0.10 npm start` (no Windows PowerShell: `$env:HOST_IP="192.168.0.10"; npm start`).
- **O celular não abre a página:** confira se está no mesmo Wi-Fi e libere as portas 8080 e 8443 no firewall
  (no Windows, aceite o aviso do firewall para o Node na primeira execução, marcando "Redes privadas").
- **O ponteiro saiu do centro:** aponte para o meio da tela e toque em ⏻ (ou segure ⌂).
- **Ponteiro invertido:** ajuste em ⚙ → Inverter horizontal/vertical.
- **Sem som:** clique uma vez na tela do computador (o navegador exige uma interação para liberar áudio).
- **Portas ocupadas:** `HTTP_PORT=3000 HTTPS_PORT=3443 npm start`.

## Como funciona

```
 celular (controller.html)          servidor (server.js)            computador (index.html + games/)
 giroscópio → posição x,y  ──wss──▶  hub WebSocket /ws  ──ws──▶     cursor + jogos em <canvas>
 botões A/B/⌂...                     (até 4 controles)  ◀──          vibração (rumble)
```

- `server.js`: servidor HTTP (8080) e HTTPS (8443), WebSocket em `/ws`, QR code em `/qr.svg`.
- `launcher.js`: o `npm start` roda o servidor por ele, para poder reiniciar depois do botão Atualizar.
- `public/controller.html`: o Wii Remote. Lê a orientação do aparelho (`deviceorientation`), calcula para onde
  o topo do celular aponta (giro horizontal e inclinação) e suaviza com um filtro One Euro.
- `public/js/wii.js`: biblioteca da tela (cursores, botões, sons sintetizados, mouse como reserva).
- `public/js/game.js`: base dos jogos (canvas, HUD, menus).
- `public/games/*.html`: os jogos. Para criar um novo, copie um deles e adicione no array `GAMES` em `public/index.html`.
