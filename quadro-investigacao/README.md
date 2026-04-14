# Quadro de Investigação — Como Rodar

## Rodar Localmente

**Opção 1 — Direto no browser (mais simples):**
Basta abrir o arquivo `index.html` no navegador clicando duas vezes nele. Funciona sem servidor web!

**Opção 2 — Com servidor local (recomendado):**
Se você tiver Node.js instalado:
```bash
npx serve .
```
Acesse `http://localhost:3000`

---

## Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `V` | Ferramenta Mover |
| `P` | Ferramenta Fixar |
| `C` | Ferramenta Conectar |
| `A` | Ferramenta Anotar |
| `Del` | Ferramenta Remover |
| `N` | Nova Pista (Modo Mestre) |
| `M` | Alternar Mestre/Jogador |
| `Esc` | Cancelar / Fechar modal |
| `Ctrl+E` | Exportar JSON |
| `Ctrl+I` | Importar JSON |
| `Ctrl++` | Zoom + |
| `Ctrl+-` | Zoom - |
| `Ctrl+0` | Resetar zoom |

---

## Funcionalidades

### Modo Jogador
- Ver e mover pistas no quadro
- Conectar pistas com fios coloridos
- Escrever anotações em cada pista

### Modo Mestre (ative com 🎭 Mestre)
- **Nova Pista**: cria evidências com título, imagem (upload ou URL) e descrição
- **Editar/Remover** pistas existentes
- Todas as ferramentas do Jogador

### Ferramentas
- **✋ Mover**: arraste pistas livremente; scroll para zoom; clique e arraste o fundo para mover o quadro
- **📌 Fixar**: impede que uma pista seja movida
- **🧵 Conectar**: clique em pista A → clique em pista B → fio criado; escolha a cor do fio na sidebar
- **✏️ Anotar**: abre o modal de detalhes direto na área de anotações
- **✂️ Remover**: clique em pista ou fio para remover

---

## Armazenamento

O estado é salvo automaticamente no `localStorage`. Use **Exportar** para salvar um `.json` e **Importar** para restaurar.

---

## Estrutura de Arquivos

```
quadro-investigacao/
├── index.html
├── css/
│   ├── main.css       # Variáveis, header, toasts
│   ├── board.css      # Textura de cortiça, vignette, minimap
│   ├── cards.css      # Cards de pistas (papel envelhecido, pino)
│   ├── sidebar.css    # Barra de ferramentas
│   └── modals.css     # Modais, formulários, anotações
└── js/
    ├── main.js        # Bootstrap e atalhos de teclado
    ├── storage.js     # localStorage, export/import JSON
    ├── board.js       # Pan e zoom do quadro
    ├── connections.js # Linhas SVG (fios de investigação)
    ├── cards.js       # Cards de pistas (drag-and-drop)
    └── ui.js          # Modais, sidebar, minimap, toasts
```
