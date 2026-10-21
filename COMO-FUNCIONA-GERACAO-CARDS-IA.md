# Como funciona a geração de cards por IA

A geração de cards foi pensada principalmente para **legislação**: leis, decretos e códigos, com seus artigos, parágrafos, incisos e alíneas. O objetivo é tirar do documento **o maior número possível de cards bons**, sem a IA "pular" partes da lei, e sem deixar você esperando muito.

## O problema que isso resolve

Antes, quando alguém enviava um PDF grande, o sistema mandava o documento inteiro numa única pergunta pra IA e esperava uma resposta só no final. Era **lento** e **frágil**: se algo desse errado no meio, perdia tudo.

Depois passamos a dividir o documento em partes processadas ao mesmo tempo, o que resolveu a fragilidade. Mas ainda sobravam três problemas:

- **Partes grandes demais.** Cada parte pedia muitos cards de uma vez, e a resposta demorava mais que o tempo máximo permitido. A parte era cancelada e refeita do zero, várias vezes.
- **A IA às vezes tinha "preguiça".** Num trecho com 25 incisos, ela podia gerar 12 cards e ignorar o resto, e ninguém percebia.
- **A revisão final era lenta.** A IA revisora reescrevia todos os cards de novo, o que levava quase o mesmo tempo que gerá-los.

## O passo a passo, depois que você clica em "Gerar"

### 1. Confirmação imediata
O sistema responde na hora "recebido, comecei a trabalhar". A tela não trava, e a barra de progresso aparece quase instantaneamente.

### 2. O documento é dividido em partes pequenas, respeitando os artigos
O texto do PDF é dividido em pedaços de umas duas a três páginas. O sistema procura cortar **exatamente no início de um artigo** ("Art. 15"), para que nenhum artigo fique partido entre dois pedaços. Quando não encontra um artigo por perto, corta entre páginas ou parágrafos.

> Partes menores são o que mais deixa a geração rápida: cada resposta da IA fica curta, e muitas partes são processadas ao mesmo tempo. O tempo total passa a ser o da parte mais lenta, e nenhuma parte é grande.

### 3. O sistema lista os dispositivos de cada parte, antes da IA
Antes de chamar a IA, o próprio sistema lê o trecho e monta uma **lista de tudo que existe ali**: cada artigo, parágrafo, inciso e alínea. Por exemplo:

```
Art. 7
Art. 7, § 1
Art. 7, § 2, I
Art. 7, § 2, II
...
```

Ele sabe diferenciar um dispositivo de verdade de uma simples menção a outro ("nos termos do § 1º do art. 37"). Esse passo não usa IA: é instantâneo e não tem custo.

### 4. A IA gera os cards seguindo essa lista
A IA recebe o trecho junto com a lista e a orientação de cobrir **todos** os dispositivos. Cada card informa a qual dispositivo ele pertence. Dispositivos com prazo, exceção, vedação ou sanção podem render mais de um card. Já um item que é só remissão ou título pode ser deixado de fora, a critério da IA.

A quantidade de cards **não é um número fixo**. Ela parte de quantos dispositivos existem no trecho e funciona como referência, não como teto. Se você preencher o "Teto máximo de cards", aí sim ele vira um limite rígido.

### 5. Conferência de cobertura: a IA "deixou algo de fora"?
Quando a IA termina, o sistema compara os cards com a lista do passo 3 e vê quais dispositivos ficaram **sem nenhum card**.

- **Tudo coberto (ou faltou só um):** segue em frente, sem gastar mais tempo.
- **Faltaram dois ou mais:** o sistema faz **uma segunda rodada só para o que faltou**. Ele mostra à IA os cards que já existem e a lista do que ficou de fora, e pede cards apenas para esses itens. Essa rodada é rápida, porque a IA "lembra" do trecho (ele fica em cache) e só escreve o que falta.

Esse é o equilíbrio entre "pensar mais" e "ter preguiça". A IA não gasta tempo extra raciocinando em todas as partes; o esforço extra vai apenas para as partes onde ela realmente deixou conteúdo de fora. Mesmo na segunda rodada ela pode julgar que algum item não vale card, e isso é respeitado.

Para documentos que não são legislação (sem artigos), a conferência é feita pela quantidade: se a IA gerou bem menos cards do que o trecho comporta, ela recebe a mesma segunda chance.

### 6. Cada parte concluída fica salva na hora
Assim que uma parte termina, o resultado é gravado. Se alguma parte falhar, só ela é refeita. Se a segunda rodada da etapa 5 falhar, os cards da primeira são mantidos e a parte não é perdida.

A barra de progresso ("X de Y partes concluídas") mostra o progresso real.

### 7. Juntar, limpar duplicatas e revisar
Com todas as partes prontas, o sistema junta os cards e remove automaticamente os repetidos. Depois, uma IA revisora olha a lista e **apenas aponta quais cards devem sair**: duplicatas que passaram, cards cujo verso não responde a frente e cards genéricos demais. Na dúvida, ela mantém.

Como ela só devolve os números dos cards a remover, essa etapa é rápida. Há duas proteções:
- se a revisora tentar remover mais da metade dos cards, a revisão é ignorada (provavelmente ela se confundiu);
- em documentos muito grandes (mais de 250 cards), a revisão é pulada e você recebe a lista já sem duplicatas.

### 8. Você revisa e aprova
A tela de revisão abre com os cards prontos para você editar, ajustar e aprovar antes de salvar na disciplina.

## Dicas para legislação

- **Use o modo "Preencher Lacuna".** É o padrão da tela. A IA transforma o núcleo do dispositivo (prazo, órgão, condição, exceção) em lacuna, o que é ótimo para memorizar a letra da lei.
- **Deixe o "Teto máximo de cards" em 0 (automático)** para aproveitar a cobertura completa. Use um teto só se quiser de propósito um conjunto menor.
- **Envie o PDF da lei com texto selecionável** (não escaneado como imagem). A lista de dispositivos depende de o sistema conseguir ler "Art.", "§" e os incisos.

## Resumo visual

```
Você envia o documento
        │
        ▼
Confirmação imediata (sem travar a tela)
        │
        ▼
Documento dividido em partes pequenas, cortando no início dos artigos
        │
        ▼
Para cada parte, ao MESMO TEMPO:
   Sistema lista os dispositivos (artigos, §, incisos, alíneas)
        │
        ▼
   IA gera os cards seguindo a lista
        │
        ▼
   Sistema confere: algum dispositivo ficou sem card?
        ├── não → parte concluída e salva
        └── sim → 2ª rodada só para o que faltou → parte concluída e salva
        │
        ▼
Todas as partes prontas → junta tudo e remove duplicatas
        │
        ▼
IA revisora aponta os cards fracos ou repetidos (rápido)
        │
        ▼
Tela de revisão pra você aprovar
```

## O que mudou

| Antes | Agora |
|---|---|
| Partes grandes, com respostas que estouravam o tempo limite | Partes pequenas, cortadas no início dos artigos, mais partes em paralelo |
| Partes eram canceladas após 1 minuto e refeitas do zero | Tempo limite adequado; partes não são mais canceladas no meio |
| A IA podia ignorar incisos e ninguém percebia | O sistema lista os dispositivos e confere se cada um ganhou card |
| Quantidade de cards definida por um teto | Quantidade definida pelo conteúdo da lei; o teto é opcional |
| Revisão final reescrevia todos os cards (lenta, limitada a 40 cards) | Revisão só aponta o que remover (rápida, até 250 cards) |
