# Como escrever a documentação (`/docs`)

A documentação pública do Bentifiles fica em `/docs` e é escrita em **MDX** (Markdown com alguns componentes).
Cada página é um arquivo em `frontend/src/content/docs/<seção>/<página>.mdx`. Não é preciso mexer em código para
criar ou editar uma página: o menu, a ordem, o índice "Nesta página" e a galeria de vídeos saem dos próprios arquivos.

## Adicionar uma página

1. Escolha a seção (a pasta). As seções existentes e sua ordem estão em `frontend/src/lib/docs/sections.ts`:
   `comecando`, `pedir`, `enviar`, `conta`, `ajuda`.
2. Crie `frontend/src/content/docs/<seção>/<nome-da-pagina>.mdx`. O nome do arquivo vira a URL
   (`/docs/<seção>/<nome-da-pagina>`), então use minúsculas, sem acento e com hífen.
3. Comece o arquivo com o bloco `meta`:

```mdx
export const meta = {
  title: 'Título da página',
  description: 'Uma frase que resume a página (aparece abaixo do título e no Google).',
  order: 3,            // posição dentro da seção (menor primeiro)
  video: 'dQw4w9WgXcQ', // opcional: ID do vídeo no YouTube
  duration: '3 min',    // opcional: só para exibir
};

Texto da página em Markdown...
```

4. Escreva o conteúdo. Títulos `##` viram o índice "Nesta página".

Para criar uma **seção nova**, adicione-a em `sections.ts` e crie a pasta com o mesmo `id`.

## Subir um vídeo

1. Grave o vídeo e envie ao YouTube como **Não listado** (quem tem o link assiste; não aparece em buscas nem no canal).
2. Copie o ID do vídeo: é o trecho depois de `v=` na URL (`youtube.com/watch?v=`**`ABC123`**) ou depois de `youtu.be/`.
3. No `meta` da página correspondente, preencha `video: 'ABC123'` (e, se quiser, `duration`).
4. Pronto: o vídeo aparece no topo da página e a galeria `/docs/videos` troca "Em breve" por "Disponível".

Páginas sem `video` mostram um espaço "Vídeo em breve". O player só é carregado do YouTube **depois do clique**
e usa o domínio sem cookies (`youtube-nocookie.com`).

Para colocar um vídeo extra no meio do texto: `<Video id="ABC123" title="O que o vídeo mostra" duration="2 min" />`.

## Componentes disponíveis

Estão disponíveis em qualquer `.mdx` sem importar.

**Passos numerados** (deixe uma linha em branco entre as tags e a lista):

```mdx
<Steps>

1. Primeiro passo.
2. Segundo passo.

</Steps>
```

**Avisos** (`type` pode ser `info`, `tip` ou `warning`; `title` é opcional):

```mdx
<Callout type="warning" title="Atenção">
Texto do aviso.
</Callout>
```

**Tabelas** usam a sintaxe normal do Markdown (`| a | b |`). **Links**: use caminhos como `/docs/pedir/criar-um-projeto`
para páginas internas.

## Cuidados ao escrever em MDX

- Não use `<` nem `{` soltos no texto; escreva dentro de crases (`` `{` ``) ou reformule.
- Linhas em branco são necessárias ao redor de tabelas, listas e componentes.
- Escreva o que o sistema **realmente faz**, com os nomes exatos dos botões e das mensagens. Se algo mudar no produto,
  atualize a página correspondente. Evite repetir preços: aponte para `/plans`.

## Conferir antes de publicar

```bash
cd frontend
npm run build   # gera todas as páginas; falha se um .mdx tiver erro de sintaxe
npm run start   # abre em http://localhost:3000/docs
```
