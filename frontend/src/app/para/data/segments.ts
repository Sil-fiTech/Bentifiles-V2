// Conteúdo das páginas por segmento (/para/<slug>).
// Regra: só afirmar o que o produto faz hoje (ver /docs). As listas de documentos são EXEMPLOS e aparecem
// rotuladas como tal na página; o profissional define a lista de cada projeto.

export type ChecklistStatus = 'Aprovado' | 'Em análise' | 'Pendente' | 'Rejeitado';

export interface ChecklistItem {
  name: string;
  status: ChecklistStatus;
  /** Motivo exibido quando o status é Rejeitado (o produto sempre mostra o motivo). */
  reason?: string;
}

export interface Segment {
  slug: string;
  /** Rótulo curto usado em links e no kicker. */
  label: string;
  /** <title> da página (o layout acrescenta " | Bentifiles"). */
  metaTitle: string;
  metaDescription: string;
  h1: string;
  lead: string;
  problemTitle: string;
  problem: string;
  checklist: { title: string; items: ChecklistItem[] };
  steps: { title: string; text: string }[];
  faqs: { question: string; answer: string }[];
}

// Respostas que valem para qualquer segmento, tiradas da documentação do produto.
const NOT_AUTHENTICITY = {
  question: 'O Bentifiles confere se o documento é verdadeiro?',
  answer:
    'Não. A validação automática avalia se a imagem está legível (nitidez, brilho, reflexo, enquadramento). Se o conteúdo está correto e se o documento é autêntico continua sendo decisão de quem revisa, na hora de aprovar ou rejeitar.',
};

const FORMATS = {
  question: 'Quais arquivos o cliente pode enviar?',
  answer:
    'JPG, JPEG, PNG, PDF e DOCX, de até 10 MB cada. A checagem automática de legibilidade vale para imagens; PDF e DOCX seguem direto para a sua revisão.',
};

const INVITE = {
  question: 'Como o cliente entra no projeto?',
  answer:
    'Por um link de convite, que você copia e envia pelo canal que preferir, ou por e-mail direto pelo Bentifiles. Se ele ainda não tem conta, o próprio link leva ao cadastro e depois ao projeto. O convite vale 24 horas.',
};

export const segments: Segment[] = [
  {
    slug: 'contabilidades',
    label: 'Contabilidades',
    metaTitle: 'Coletar documentos de clientes na contabilidade',
    metaDescription:
      'Peça documentos aos clientes da contabilidade por link, acompanhe quem já enviou e receba fotos legíveis, sem caçar anexo no WhatsApp e no e-mail.',
    h1: 'Documentos dos clientes da contabilidade, sem caçar anexo.',
    lead: 'Abertura de empresa, admissão, imposto de renda: toda rotina começa pedindo documento, e cada cliente manda de um jeito. No Bentifiles você monta a lista uma vez, convida o cliente por link e vê o que já chegou e o que ainda falta.',
    problemTitle: 'O documento chega, mas não dá para ler.',
    problem:
      'Foto de RG cortada, comprovante tremido, arquivo que só abre no celular de quem mandou. Cada ida e volta é tempo da sua equipe e paciência do cliente. A validação confere a legibilidade das imagens no momento do envio: se a foto não serve, o cliente refaz na hora, antes de o arquivo chegar até você.',
    checklist: {
      title: 'Exemplo: abertura de empresa',
      items: [
        { name: 'Documento de identificação do sócio', status: 'Aprovado' },
        { name: 'Comprovante de endereço', status: 'Em análise' },
        { name: 'Certidão de estado civil', status: 'Pendente' },
        { name: 'Documento do segundo sócio', status: 'Rejeitado', reason: 'O verso está cortado, reenvie com a borda inteira.' },
      ],
    },
    steps: [
      {
        title: 'Um projeto por cliente ou por serviço',
        text: 'Crie o projeto com o nome do cliente (ou do serviço) e defina os documentos pedidos, marcando um a um ou aplicando um template. Monte o template "Abertura de empresa" uma vez e reaproveite em cada novo cliente.',
      },
      {
        title: 'Convide por link ou e-mail',
        text: 'O cliente abre o link, cria a conta se ainda não tiver e cai direto no projeto, onde vê o que precisa enviar.',
      },
      {
        title: 'Acompanhe o checklist de cada cliente',
        text: 'Cada documento aparece como Pendente, Em Análise, Aprovado ou Rejeitado, com a barra de progresso de cada pessoa. Em projetos com muita gente, filtre por nome ou e-mail.',
      },
      {
        title: 'Aprove, rejeite com motivo e baixe tudo',
        text: 'Rejeite dizendo o que corrigir; o cliente vê o motivo e reenvia. Quando estiver completo, baixe o projeto inteiro em um ZIP, em PDF ou nos arquivos originais, com cada arquivo nomeado pelo tipo de documento e pela pessoa.',
      },
    ],
    faqs: [
      INVITE,
      {
        question: 'Dá para reaproveitar a mesma lista de documentos em vários clientes?',
        answer:
          'Sim. Crie um template com os documentos e aplique em cada projeto. Aplicar um template só acrescenta documentos: ele não remove nem altera o que o projeto já tinha.',
      },
      NOT_AUTHENTICITY,
      FORMATS,
      {
        question: 'E se a contabilidade tiver vários profissionais usando?',
        answer:
          'O plano Office é cobrado por acesso: o dono da assinatura convida cada pessoa da equipe para uma licença. Veja os planos na página inicial.',
      },
    ],
  },
  {
    slug: 'escritorios-de-advocacia',
    label: 'Escritórios de advocacia',
    metaTitle: 'Receber documentos de clientes na advocacia',
    metaDescription:
      'Solicite documentos aos clientes do escritório, acompanhe o que já chegou e receba imagens legíveis, com aprovação e motivo de recusa no próprio projeto.',
    h1: 'Cada cliente, uma lista de documentos e um status claro.',
    lead: 'Documentos pessoais, comprovantes, contratos assinados: o caso só anda quando o cliente envia tudo, e legível. No Bentifiles o escritório pede por projeto, acompanha o que falta e devolve ao cliente o motivo exato quando um arquivo não serve.',
    problemTitle: 'Os arquivos espalhados em conversas diferentes.',
    problem:
      'Pedir pelo WhatsApp e pelo e-mail deixa cada documento numa conversa, e quando alguém precisa de um deles tem de procurar. Aqui cada cliente tem um projeto próprio, com o checklist do que foi pedido, o status de cada item e os arquivos no mesmo lugar.',
    checklist: {
      title: 'Exemplo: novo cliente',
      items: [
        { name: 'Documento de identificação', status: 'Aprovado' },
        { name: 'Comprovante de residência', status: 'Em análise' },
        { name: 'Procuração assinada', status: 'Pendente' },
        { name: 'Contrato assinado', status: 'Rejeitado', reason: 'A página da assinatura está cortada na foto.' },
      ],
    },
    steps: [
      {
        title: 'Um projeto por cliente ou por caso',
        text: 'Cada projeto tem espaço isolado, com documentos, membros e templates independentes. Defina os documentos pedidos ou aplique um template, como "Novo cliente – pessoa física".',
      },
      {
        title: 'Envie o convite',
        text: 'Por link ou por e-mail. O cliente cria a conta, se precisar, e chega direto ao projeto para enviar o que foi pedido.',
      },
      {
        title: 'Revise com motivo',
        text: 'Abra o arquivo, aprove ou rejeite. Na rejeição, o motivo que você escreve fica visível para o cliente, que reenvia só o que precisa.',
      },
      {
        title: 'Baixe e arquive',
        text: 'Baixe os documentos do caso em ZIP e arquive o projeto: arquivado, ele fica somente para consulta, sem novos envios.',
      },
    ],
    faqs: [
      {
        question: 'Os documentos ficam organizados por cliente?',
        answer:
          'Sim. Cada projeto tem seu próprio espaço, com documentos, membros e templates independentes, e você cria quantos projetos precisar.',
      },
      INVITE,
      NOT_AUTHENTICITY,
      FORMATS,
      {
        question: 'O cliente precisa instalar algo?',
        answer: 'Não. O Bentifiles é 100% web, acessível pelo navegador, em qualquer dispositivo.',
      },
    ],
  },
  {
    slug: 'imobiliarias',
    label: 'Imobiliárias',
    metaTitle: 'Coletar documentos de inquilinos e compradores',
    metaDescription:
      'Peça documentos de locatários, fiadores e compradores por link, veja o que falta em cada processo e receba fotos legíveis, sem correr atrás pelo WhatsApp.',
    h1: 'Documentação de locação e venda, processo por processo.',
    lead: 'Locatário, fiador, proprietário, comprador: cada pessoa manda a própria lista, e quase sempre falta um documento. No Bentifiles cada processo é um projeto, com os participantes, o checklist e o status de cada arquivo.',
    problemTitle: 'Foto tirada na pressa, descoberta tarde.',
    problem:
      'Documento fotografado às pressas no celular é a regra. Quando a imagem chega cortada ou tremida, o corretor só descobre depois de abrir. A validação confere a legibilidade no envio: imagem que não serve é barrada na hora, e a pessoa refaz a foto antes de o arquivo chegar até você.',
    checklist: {
      title: 'Exemplo: locação, locatário',
      items: [
        { name: 'Documento de identificação', status: 'Aprovado' },
        { name: 'Comprovante de renda', status: 'Em análise' },
        { name: 'Comprovante de residência', status: 'Pendente' },
        { name: 'Certidão de estado civil', status: 'Rejeitado', reason: 'Está cortada na parte de baixo, reenvie a página inteira.' },
      ],
    },
    steps: [
      {
        title: 'Um projeto por contrato ou imóvel',
        text: 'Crie o projeto do processo e defina os documentos pedidos. Se você repete a mesma lista em toda locação, transforme-a em um template.',
      },
      {
        title: 'Convide cada participante',
        text: 'Locatário, fiador e demais envolvidos entram pelo link ou por e-mail. No mesmo projeto, cada pessoa aparece com o próprio checklist e a própria barra de progresso.',
      },
      {
        title: 'Veja o que falta, pessoa por pessoa',
        text: 'Pendente, Em Análise, Aprovado ou Rejeitado, com o motivo da recusa visível para quem precisa corrigir.',
      },
      {
        title: 'Aprove e baixe para o contrato',
        text: 'Com tudo aprovado, baixe os arquivos do projeto em um ZIP, em PDF ou no formato original, já nomeados pelo tipo de documento e pela pessoa.',
      },
    ],
    faqs: [
      {
        question: 'Posso ter locatário e fiador no mesmo processo?',
        answer:
          'Sim. Cada pessoa convidada aparece no projeto com o próprio checklist e o próprio progresso, e você acompanha todos na mesma tela.',
      },
      {
        question: 'A pessoa consegue enviar pelo celular?',
        answer:
          'Sim. O Bentifiles é 100% web e funciona pelo navegador do celular: ela fotografa e envia. A documentação traz dicas para fotografar documentos de modo que passem na validação.',
      },
      INVITE,
      NOT_AUTHENTICITY,
      FORMATS,
    ],
  },
];

export const getSegment = (slug: string) => segments.find((s) => s.slug === slug);
